# Block 13 — portable backup and restoration of the trip

Nihon keeps every decision in the browser. That is what makes it private, needs no account, and has
kept the architecture honest for thirteen blocks. It also means a trip prepared on one phone cannot
be moved to another browser, and a cleared browser is a lost trip.

This block adds the smallest thing that fixes that: **export the travellers' durable decisions to a
file they keep, and read that file back somewhere else.** No account, no server, no sync.

---

## 1. Persistence inventory

Found by scanning every `localStorage` / `sessionStorage` / `indexedDB` access in `src/`. There is
no IndexedDB use anywhere. **Five keys exist**, not the two the brief assumed:

| key | owner | holds | classification | in the backup? |
|---|---|---|---|---|
| `nihon.travellers.v1` | `lib/travellers.ts` | the roster, who is active, and each person's stance per place | **durable human decision** (personal preference + identity) | **yes** |
| `nihon.manualPlanningDraft` | `lib/planning-draft-v8.ts` | route, days, both dates, visit times, accommodations, legs, inter-hub segments, zone choices | **durable human decision** (shared plan) | **yes** |
| `nihon.zoneComparison.v1` | `useZoneComparison.ts` | which zones are side by side, per hub | **working set / ephemeral UI** | no |
| `nihon.onboarding.seen.v1` | `lib/onboarding.ts` | `"1"` once the explainer is dismissed | **device UI flag** | no |
| `nihon.savedPlaceIds` | legacy | the pre-Block-5 shortlist | **legacy migration source**, read only when no travellers document exists, never written | no |

### A correction to this block's own brief

The brief supposed the durable state was `nihon.savedPlaceIds` + `nihon.manualPlanningDraft`. It is
not, and has not been since Block 5: **`nihon.savedPlaceIds` is a legacy key.** Saved places now
live inside `nihon.travellers.v1` as per-person stances, and the "Quiero ir" list is *derived* from
them by `shortlistPlaceIds()`. Backing up the legacy key would have exported a stale second copy of
state the file already carries — and, on a browser that had both, restoring it would have done
nothing at all, since it is only ever read when no travellers document exists.

### Authority over each state

| state | sole authority |
|---|---|
| travellers, stances, roster | `lib/travellers.ts` — `parseTravellersDocument`, `reconcileTravellers` |
| planning draft, all versions | `lib/planning-draft-v8.ts` — `parseStoredDraft` (chains V1→…→V8), `reconcileDraft` |
| the portable envelope | `lib/portable-backup.ts` (new) — and **only** the envelope |

### Three exclusions worth arguing rather than asserting

* **`nihon.zoneComparison.v1`** holds which zones are currently being compared. That is a working
  set, not a decision. The *decision* it exists to produce — "for this hub we sleep in this zone" —
  is stored in the planning draft as `zoneAccommodationChoices`, and that **is** in the backup.
  Restoring the scratch pad would restore the act of comparing, not its conclusion.
* **`nihon.onboarding.seen.v1`** is a fact about a browser, not about a trip. Restoring it would
  suppress the first-run explainer on a device that has never shown it.
* **The shortlist itself** is derived and therefore absent by the same rule that keeps the catalogue
  out. A restored file recomputes it exactly as the app always does.

**The rule, stated once:** a portable backup is the human decisions, not a photograph of storage.
Copying every `nihon.*` key would have been shorter and wrong — it would weld the file format to
today's storage layout, so a key added tomorrow for a modal's scroll position would start travelling
between devices.

---

## 2. The portable contract

```ts
type NihonPortableBackupV1 = {
  format: "nihon-portable-backup";   // discriminant, checked before anything else
  version: 1;                        // the ENVELOPE's version
  exportedAt: string;                // ISO 8601 instant, the only non-decision field
  data: {
    travellers: TravellersDocumentV1;          // carries its own `version`
    planningDraft: ManualPlanningDraftV8 | null; // carries its own `version`
  };
};
```

JSON, UTF-8, pretty-printed — a file someone keeps should be one they can open and read. No
binaries, no derived values, no storage keys, no URLs.

### Two versions, never one

The envelope says `1`. The documents inside say `1` and `8`, and those are **not** the envelope's
business. A draft written at V6 inside a V1 envelope is an ordinary, valid file. Merging the numbers
would mean every internal schema change invalidated every file already on disk.

### Strict envelope

Exactly four keys at the top and exactly two under `data`; anything else rejects the file. Strictness
is affordable precisely *because* the envelope is versioned: a future format will declare `version: 2`
and be refused by name rather than silently half-read.

`Object.keys` is used for that check deliberately — `JSON.parse` turns `"__proto__"` into an ordinary
own property, so a file carrying one is **seen and rejected as an unexpected key** rather than
ignored. The module also never assigns a parsed key into an object (`target[key] = value`), which is
the assignment that would otherwise replace a fresh object's prototype.

---

## 3. Layers

```
lib/portable-backup.ts     PURE. build · serialise · parse · validate · plan · summarise · apply
        │                  no clock, no storage, no fetch, no document, no window
usePortableBackup.ts       the only impure edge: clock, localStorage, Blob download, File read
        │
components/TripBackup.tsx  copy, preview, confirmation. Contains no validation logic.
```

The parser takes `unknown` and keeps it `unknown` all the way down. **There is no `as` casting an
external file into a domain type** — asserted by a test that greps for exactly that.

---

## 4. Import: the order, and what it guarantees

1. read the file's text;
2. `JSON.parse` — failure is `not-json`;
3. **validate the envelope** — format, then version, then shape;
4. hand `data.travellers` and `data.planningDraft`, still `unknown`, to **their own** parsers;
5. reconcile against the live catalogue, counting what is lost;
6. build a preview in human units;
7. **a human confirms**;
8. write, once, with rollback.

Step 3 precedes step 4 so that **an internal migration can never rescue a file whose envelope was
never valid** — tested directly with a perfectly migratable V3 draft inside a wrong-format envelope.

**Nothing before step 8 writes anything.** That is structural, not a promise: `prepareImport` has no
access to a writer, and `applyRestore` needs a plan only `prepareImport` produces.

---

## 5. Blocking errors vs reconcilable loss

**Blocking — nothing is written at all:**
`empty` · `not-json` · `not-an-object` · `wrong-format` · `unsupported-version` ·
`invalid-envelope` · `invalid-travellers` · `invalid-planning-draft`.

The discriminant is checked **before** the version, so a file that was never a Nihon backup is never
reported as "a Nihon backup from the future". `unsupported-version` says the app is too old, not
that the file is broken — a different sentence for a different situation.

**Reconcilable — counted, never swallowed.** A file may remember a place this build's catalogue no
longer has. Nihon does not delete it quietly and report success: the preview states how many places
cannot be restored, and the person confirms the reduced version deliberately. The plan is then pruned
against the shortlist that *survives*, so a route entry cannot outlive the stance that put it there.

---

## 6. Replace, never merge

Importing replaces the two keys. No union of saved places, no "newest draft wins", no merging of
days, no reconciliation of stances by timestamp. Merging two trips means deciding whose route wins,
and nobody has answered that question — it belongs to a synchronisation feature that does not exist.

Two consequences, both deliberate:

* a `null` draft in the file **removes** the stored draft rather than leaving the old one behind —
  keeping it would be an implicit merge arrived at by omission;
* the UI says so before the button exists to press: *"sustituirá los datos de Nihon de este
  navegador… No se combinan."*

---

## 7. Atomicity — best-effort rollback, and the honest name for it

`localStorage` has no transactions. What `applyRestore` does instead:

1. read both keys' current values;
2. write the new values in order, remembering which landed;
3. on any throw, put back **only the keys that actually changed**, and report.

It is called best-effort rollback because that is what it is. What it buys is that a half-restore
does not survive — you never end up with the file's travellers beside the old plan, a trip neither
person ever had. What it cannot promise is that the rollback itself succeeds; if storage is failing,
restoring can fail too, and `rolledBack: false` says exactly that.

**Scoping the rollback to writes that landed was a finding, not a plan.** The first version restored
both keys unconditionally, so a first-write failure tried to undo a write that never happened —
usually by asking the same failing storage to accept the same key again, and then reporting a failed
rollback for a problem that did not exist. The test caught it.

---

## 8. The reload is a correctness requirement

`useTravellers` and `usePlanningDraft` hold their documents in React state and write them back when
that state changes. A restore replaces the keys underneath them, so until the app re-reads storage
its in-memory copies are the **previous** trip — and the next heart pressed would write that stale
copy straight over everything just imported, destroying it silently.

So a successful restore ends in `window.location.reload()`, and the confirmation screen has no other
way out: Escape, the backdrop and the close button all finish the restore rather than dismissing it.
Leaving someone inside a restored-but-not-reloaded app would be leaving a trap open.

---

## 9. Privacy

No `fetch`, no `XMLHttpRequest`, no `sendBeacon`, no WebSocket, no telemetry, no analytics, no
service worker. Export goes `localStorage` → `Blob` → the browser's own download. Import goes
`<input type="file">` → text → parser. The object URL is revoked immediately.

Asserted twice: a source scan of the hook, and — in the browser audit — a request interceptor that
counts every request to any origin other than the app's own during a full export and import.
Leaflet's map tiles are excluded by name, for the same reason the console filter already excludes
them, and the backup's own silence is measured separately with scoped counters around each operation.

---

## 10. The two travellers stay two

Block 5's boundary is preserved exactly. Each traveller keeps their id, their label and their own
stances; `travellers` stays a list, not a pair; a stance is never reattributed to the other person —
a dangling stance rejects the whole file rather than being quietly reassigned, which is the existing
parser's rule and is inherited rather than re-decided here.

The planning draft stays **one shared document**. It is not split per person, because the two of them
have one itinerary — the distinction Block 5 exists to hold.

`statedPreferenceCount` in the preview counts *statements*: two people who both want somewhere count
twice, because two preferences were stated. It is not a score per place, and the module still has no
function that returns a number per place.

---

## 11. UX

A discreet header control (`⤓`), the same shape and weight as the help `?` beside it — a secondary
safety tool, not a fifth verb competing with Explorar / Quiero ir / Planificar / Dónde dormir. It
opens one modal following `TravellerManager`'s established pattern: `role="dialog"`,
`aria-modal="true"`, focus on the close control, a minimal focus trap, Escape to dismiss.

**Export** explains what it makes and where it goes: *"Guarda vuestras decisiones de Nihon en un
archivo… No se envía a ningún sitio."*

**Import** states the consequence before the file picker is used, previews the contents in units a
traveller recognises — people, places in "Quiero ir", stated preferences, route, days, dates, visit
times, accommodations, zones, inter-hub legs — and requires a second, explicit press. Cancelling is
always available and writes nothing. An invalid file explains itself in one plain sentence, says
*"No se ha cambiado nada en este navegador"*, and leaves the surface open.

**Words that do not appear:** sincronizado, conectado, nube, cuenta, iniciar sesión, compartido
automáticamente. Each would describe a thing that does not exist, and would leave someone believing
their trip is safe somewhere it is not. A test enforces the list.

---

## 12. Performance

| | Block 12 | Block 13 | delta |
|---|---|---|---|
| initial JS raw | 1,377,479 B | 1,389,634 B | +12,155 B |
| initial JS gzip | 250,628 B | 253,736 B | **+3,108 B** |
| initial JS brotli | 201,105 B | 203,677 B | +2,572 B |
| deferred chunks | 2 | 2 | unchanged |

**`TripBackup` is deliberately NOT lazy, and that decision is Block 12's own rule applied to Block
13's code.** It was built lazy first and measured: 7,378 B raw / 2,417 B gzipped. Block 12 examined
`SelectionAnalysis` (14 kB) and `TravellerManager` (9 kB) and left both in the entry because "a chunk
each would buy a round trip and save nothing worth having". This surface is *smaller than both*.
Splitting it would have meant applying a threshold to every surface except the one this block
happened to be adding, which is how a rule becomes an exception.

Block 12's two boundaries are untouched, byte for byte in module membership, and the audit re-checks
that neither is pulled into the critical path.

---

## 13. Alternatives rejected

| rejected | why |
|---|---|
| **Dumping every `nihon.*` key** | Welds the portable format to today's storage layout; would export the scratch pad and the onboarding flag today, and whatever key is added tomorrow. |
| **Including `nihon.savedPlaceIds`** | Legacy since Block 5. A stale second copy of state the file already carries, and inert on any browser that has a travellers document. |
| **Exporting the derived shortlist** | It is derived. Storing it would create exactly the drift Block 5 removed by deriving it. |
| **Merging on import** | Requires deciding whose route wins. That is synchronisation semantics, and inventing a rule here would quietly commit the project to it. |
| **Splitting the draft per traveller** | Two people have one itinerary. Block 5 settled this. |
| **Re-implementing draft migration in the backup** | `parseStoredDraft` already chains V1→V8 and is the single authority. A second implementation is a second set of bugs. |
| **A lazy chunk for `TripBackup`** | Smaller than two surfaces Block 12 explicitly declined to split. See §12. |
| **Claiming true atomicity** | `localStorage` does not offer it. Best-effort rollback is what exists and is what it is called. |
| **A spinner during import** | The file is read locally; there is nothing to wait for worth announcing. |
| **Restoring without reloading** | Would leave stale in-memory documents able to overwrite the import. See §8. |
| **Encrypting or compressing the file** | Would make it unreadable to its owner for no threat this block faces; the file never leaves the device unless they move it. |
| **A QR / WebRTC / cloud transfer** | Out of scope by §18, and all three are sync in disguise. |

---

## 14. Known limitation, recorded rather than claimed

Everything here is verified in **Chromium**, at three viewports, against the production build. The
APIs used (`Blob`, `URL.createObjectURL`, an anchor `download`, `<input type="file">`, `File.text()`)
are standard, but this environment has no iOS or real Safari, so **no claim is made about Safari's
download behaviour**, which is known to differ in how it handles generated files. That is a gap in
evidence, not a known failure, and it is written here as such rather than asserted either way.
