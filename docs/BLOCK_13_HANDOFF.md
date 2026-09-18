# Block 13 — handoff

Written so the next session, or an auditor, can continue from GitHub and this repository alone.

## Identity

| | |
|---|---|
| Repository | `Z3roM4str/-nihon-travel-explorer` |
| Branch | `claude/sleepy-heisenberg-hn7340` |
| Started from | `30c553c3616fd2744e991cce650617cf369728c9` (Block 12 closed) |
| `main` reference | `1a11fe8cfd2fb1b2ed31c463472181f2a29cba81` (Nihon v1.0.0) — untouched |
| Merged to `main`? | **No.** No pull request. No merge. No new branch. |
| Working tree | Clean. |
| Block 13 status | **Closed.** |

## Authority situation

The capability gap named in this block's brief: a trip prepared in one browser cannot be moved to
another. No prior document assigned Block 13 and no conflict was found. The one assumption in the
brief that the repository contradicted is corrected below and in the design record.

**Preflight discrepancy, unchanged since Block 6 and again left alone:** local `main` is stale at
`b924f5c`; `origin/main` is `1a11fe8`. `main` was not to be modified and the stale ref is local only.

## Preflight, as actually run

| check | expected | found |
|---|---|---|
| branch | `claude/sleepy-heisenberg-hn7340` | same |
| local HEAD · `origin/…` | `30c553c…` | both `30c553c…` |
| `origin/main` | `1a11fe8…` | `1a11fe8…` |
| working tree | clean | clean |
| Vitest | 3126 / 91 files | **3126 / 91** |
| lint · `tsc` · build | clean (RC-05 advisory expected) | as expected |
| Python suites · argument-free validators | 13 · 8 | **13** · **8** |

## The correction this block had to make to its own brief

The brief assumed the durable state was `nihon.savedPlaceIds` + `nihon.manualPlanningDraft`. It is
not, and has not been since Block 5: **`nihon.savedPlaceIds` is a legacy key**, read only when no
travellers document exists and never written. Saved places now live inside `nihon.travellers.v1` as
per-person stances, and "Quiero ir" is **derived** from them by `shortlistPlaceIds()`.

Consequences, both followed: the legacy key is **excluded** (a stale second copy of state the file
already carries, inert on any browser that has a travellers document), and the derived shortlist is
**excluded** (it is derived, which is the one thing the format refuses).

## Persistence inventory — all five keys

| key | holds | classification | in the backup? |
|---|---|---|---|
| `nihon.travellers.v1` | roster, active traveller, each person's stance per place | **durable human decision** | **yes** |
| `nihon.manualPlanningDraft` | route, days, both dates, visit times, accommodations, legs, inter-hub segments, zone choices | **durable human decision** | **yes** |
| `nihon.zoneComparison.v1` | zones currently side by side, per hub | working set / ephemeral UI | no |
| `nihon.onboarding.seen.v1` | `"1"` once the explainer is dismissed | device UI flag | no |
| `nihon.savedPlaceIds` | pre-Block-5 shortlist | legacy migration source | no |

No IndexedDB or `sessionStorage` use exists anywhere in `src/`.

The `zoneComparison` exclusion is the one genuinely debatable call and is argued rather than
asserted: it is the *act* of comparing, while the *decision* it produces ("for this hub we sleep in
this zone") lives in the planning draft as `zoneAccommodationChoices` and **is** in the backup.

## The portable contract

```ts
{
  format: "nihon-portable-backup",   // discriminant, checked BEFORE the version
  version: 1,                        // the ENVELOPE's version, independent of the documents'
  exportedAt: "<ISO 8601 instant>",  // the only non-decision field; injected, never a clock read in core
  data: {
    travellers:    TravellersDocumentV1,             // carries its own version: 1
    planningDraft: ManualPlanningDraftV8 | null      // carries its own version: 8
  }
}
```

Strict envelope: exactly four top-level keys and two under `data`; anything else rejects the file.
`Object.keys` is used for that check so a `"__proto__"` key — which `JSON.parse` makes an ordinary
own property — is **seen and rejected**, not ignored. The module never assigns a parsed key into an
object, which is the assignment that would replace a fresh object's prototype.

## Files changed

| file | change |
|---|---|
| `app/src/lib/portable-backup.ts` | **new** — the pure domain: build, serialise, parse, validate, plan, summarise, apply |
| `app/src/lib/portable-backup.test.ts` | **new** — 52 tests |
| `app/src/usePortableBackup.ts` | **new** — the only impure edge: clock, storage, Blob, File |
| `app/src/components/TripBackup.tsx` | **new** — the modal, containing no validation logic |
| `app/src/App.tsx` | header control, state, hook wiring, static import of the modal |
| `app/src/App.css` | `.app__backup` and the `.trip-backup` block |
| `app/scripts/block13-portable-backup-browser-audit.mjs` | **new** — 52 checks × 3 viewports |
| `docs/BLOCK_13_DESIGN.md`, `docs/BLOCK_13_HANDOFF.md`, `docs/ROADMAP.md` | **new / updated** |

**No data file changed.** All 27 pre-existing files under `app/scripts/` are byte-identical to
`30c553c` by SHA-256.

## Tests

| file | tests |
|---|---|
| `app/src/lib/portable-backup.test.ts` | **52** |
| **Vitest total** | 3126 → **3178**, 91 → **92 files** |

Covering: construction · serialisation · exact round trip · a person with no plan yet · determinism
apart from `exportedAt` · envelope version independent of document versions · **no derived data, no
place names, no catalogue, no storage keys, no tokens or URLs in the file** · both travellers keep
separate identities and stances · the draft stays one shared document · stated preferences counted as
statements not scores · every blocking error by name · the discriminant checked before the version ·
strict extra-key rejection · `__proto__`/`constructor`/`prototype` rejected with nothing polluted ·
the draft's own migration authority used (a V3 draft arrives as V8) and **no migration logic in this
module** · an internal migration cannot rescue an invalid envelope · losses counted not swallowed ·
the plan pruned against the shortlist that survives · replace never merge · a `null` draft removes
the stored plan · rollback on first-write and second-write failure · honest reporting when rollback
itself fails · re-importing the current backup is a safe no-op · the core reads no clock, no storage,
no network · no `as` cast of an external file into a domain type · parsing writes nothing whatever
the file · the hook is the only writer and only `confirmImport` writes · the restore ends in a reload
· the copy never says synchronised/connected/cloud/account.

### Guards broken on purpose

| broken | caught by |
|---|---|
| rollback restoring keys that were never written | surfaced by the first-write-failure test; **fixed in the product** (see Regressions) |
| a day seeded without `accommodationBoundary` | the draft's own parser silently fell back to a fresh draft; caught by the audit's adoption check |
| `.app__backup` at 36px | **Block 1's tap-target audit**, 142 → 141 |

## Browser audit

`app/scripts/block13-portable-backup-browser-audit.mjs` — **52 checks × 3 viewports = 156, all
passing** at 390×844 DPR 2, 820×1180 DPR 2 and 1440×900, against the production build.

**The golden path, end to end:** save places across two hubs as two different people → open the
planner (which persists the draft) → a route, two days, both dates and a visit time → export →
**read the file the browser actually saved from disk** → assert the contract and the absence of
derived data → wipe the browser → import → preview → cancel (writes nothing) → import again →
confirm → verify travellers and plan return field for field → finish (reloads) → reload again →
modify the state → re-import → **verify replacement, not merge**.

Then: seven malformed files (empty, non-JSON, `{}`, wrong format, future version, wrong types,
`__proto__`) each refused, explained, and **writing nothing**; no prototype pollution; keyboard focus,
Escape, tap-target floor, no horizontal overflow; Block 12's deferred surfaces still out of the
critical path; and **no external request at any point**, map tiles aside.

### Network silence

Proven three ways: a scoped request counter around export, a second around import, and a
session-wide counter. Leaflet's tile requests are excluded by name — the same exclusion the console
filter already makes — and the backup's own silence is measured by the two scoped counters, which
see zero.

## Negative cases

| case | result |
|---|---|
| empty file · non-JSON text · `{}` · `[]` · a bare string or number | refused, nothing written |
| wrong `format` · unknown/future `version` | refused **by name**, and a foreign file is never called "from the future" |
| bad `exportedAt` (missing, civil date, number) · missing/extra envelope key · `data` not an object | refused |
| `__proto__` · `constructor` · `prototype` keys | refused; `{}` unpolluted |
| traveller id not a string · duplicate traveller ids · dangling stance · unknown active traveller | refused, and a stance is never reattributed |
| corrupt draft: duplicate route ids, `"24:00"` visit time, non-string route ids, a string, a number | refused |
| write failure on the first key · on the second key | rolled back; storage exactly as before |
| rollback itself failing | reported honestly as `rolledBack: false` |
| cancelling the file picker · cancelling the confirmation | nothing written, surface stays usable |
| importing the exact current backup | succeeds, no-op |
| places the catalogue no longer has | counted, stated in the preview, confirmed deliberately |

Every failure before confirmation demonstrates **zero persistent changes**.

## Regressions found

**One real regression, caught by the historical net and fixed in the product.**

`.app__backup` was written at 36px, copying `.app__help` beside it. Block 1's audit dropped from
**142 to 141**: `.app__help` sits on a *named historical allowance* in `COMPACT_TAP_ALLOWANCE`, and a
control added today does not get to join an exemption list. The button was raised to 44px. Block 1
is back at exactly 142 and its script is byte-identical.

**One product defect found by a test before it shipped.** `applyRestore` originally rolled back both
keys unconditionally, so a *first*-write failure tried to undo a write that never happened — usually
by asking the same failing storage to accept the same key again, then reporting `rolledBack: false`
for a problem that did not exist. It now rolls back only the writes that landed.

**One correctness issue found by reasoning about the hooks, not by a test.** `useTravellers` and
`usePlanningDraft` hold their documents in React state and write them back on change. A restore
replaces those keys underneath them, so the next heart pressed would have written the **previous**
trip over the import, silently. A successful restore therefore ends in `window.location.reload()`,
and the confirmation screen has no other exit — Escape, the backdrop and the close button all finish
the restore.

## False positives

**Five, all in my own new audit and tests, none a product defect.**

1. *"the trip is gone after wiping"* and *"nothing has been written yet"* asserted the travellers key
   was `null`. It is not: mounting writes a **fresh, empty** document, which is correct. Both now
   assert that nobody has marked anything and no draft exists.
2. *"cancelling wrote nothing"* compared against `null` for the same reason; it now compares against
   the value captured immediately before.
3. *"no external request was made"* counted Leaflet's map tiles — the map doing its job, nothing to
   do with the backup. Excluded by name, exactly as the console filter already does.
4. The copy scan for "sincronizado / conectado / nube / cuenta" matched the component's **doc
   comment**, whose entire purpose is to forbid those words. Fixed with `withoutComments` — the same
   helper, for the same reason, that Block 10 had to introduce three times.
5. A `__proto__` test built with an object literal tested nothing, because `__proto__:` in a literal
   sets the prototype rather than creating a key. Rewritten as raw JSON text.

## Size, before and after

| | Block 12 | Block 13 | delta |
|---|---|---|---|
| initial JS raw | 1,377,479 B | 1,389,634 B | +12,155 B |
| initial JS gzip | 250,628 B | **253,736 B** | **+3,108 B** |
| initial JS brotli | 201,105 B | 203,677 B | +2,572 B |
| deferred chunks | 2 | 2 | unchanged |

**`TripBackup` is deliberately not lazy.** It was built lazy first and measured at 7,378 B raw /
2,417 B gzipped — *smaller* than `SelectionAnalysis` (14 kB) and `TravellerManager` (9 kB), both of
which Block 12 examined and left in the entry because "a chunk each would buy a round trip and save
nothing worth having". Splitting this one would have applied a threshold to every surface except the
one this block happened to be adding. Block 12's two boundaries are untouched and re-verified.

## Baseline vs final

| check | baseline | result |
|---|---|---|
| Vitest | 3126 / 91 files | **3178 passed**, 0 failed, **92 files** |
| oxlint · `tsc` | clean | clean |
| `vite build` | RC-05 advisory | RC-05 advisory, unchanged |
| Python suites | 13 | **13 of 13** |
| Argument-free validators | 8 | **8 of 8** |
| Block 1 | 142 | **142** (after the regression above was fixed) |
| Block 2 | 69 | **69** |
| Block 3 | 105 | **105** |
| Block 4 | 261 | **261** |
| Block 5 | 225 | **225** |
| Block 6 | 216 | **216** |
| Block 7 | 129 | **129** |
| Block 8 | 114 | **114** |
| Block 9 | 153 | **153** |
| Block 10 | 81 | **81** |
| Block 11 | no audit | still none |
| Block 12 | 81 | **81** |
| **Block 13** | — | **156/156** (52 × 3) |
| `git diff --check` | clean | clean |

### The gate list a future block must run

```
cd app && npm ci && npm test && npm run lint && npx tsc --noEmit -p tsconfig.app.json && npm run build
pip install -r scripts/requirements.txt
for t in scripts/test_*.py; do python3 "$t"; done                 # 13
for v in scripts/validate-*.py; do python3 "$v"; done             # 8 argument-free
cd app && for b in block1-ux block2-photography block3-zones block4-zone-planner \
                   block5-travellers block6-divergence block7-zone-provenance \
                   block8-airport-link block9-editorial-governance block10-source-freshness \
                   block12-bundle-architecture block13-portable-backup; do
            node scripts/$b-browser-audit.mjs --browser=/opt/pw-browsers/chromium; done
node scripts/bundle-report.mjs
```

Do **not** run `playwright install`.

## Remaining technical debt

| | |
|---|---|
| **No Safari / iOS evidence for the download** | **New.** Everything is verified in Chromium. The APIs are standard, but this environment has no iOS, so no claim is made about Safari's handling of generated downloads. A gap in evidence, not a known failure. |
| **Restoring forces a full reload** | **New, and deliberate.** The alternative is threading the restored documents back into the live hooks, which is a larger change and would have to be got exactly right or it silently loses the import. Revisit only with a reason. |
| **No merge semantics** | **New, and deliberate.** Import replaces. Merging needs synchronisation semantics nobody has specified; inventing a rule here would quietly commit the project to it. |
| `RC-05` — resolved and re-stated | Inherited from Block 12. The advisory fires on raw JSON that ships as ~105 kB. Not silenced. |
| The walking dataset is on the critical path | Inherited from Block 12. ~12 kB gzip; needs a functional refactor to move. |
| `standing-sales-rule` has no re-check interval | Inherited from Block 11. **Do not close it by picking a number.** |
| `unsupported` provenance is not representable | Inherited from Block 10, deliberate. |
| Editorial ratings still have no second reader | Inherited from Block 3; only the travellers can close it. |
| Ikebukuro's Narita coach is no longer recorded | Inherited from Block 8. |
| `railLines` / `shinkansen` remain encyclopedia-sourced | Inherited from Block 7. |
| Four zones inline the same Narita source record | Inherited from Block 7. |
| `.icon-button--small` is a 36px control | Pre-existing, allowed since Block 1. |

---

## ¿BLOQUE 13 CERRADO? **SÍ**

All five durable keys were inventoried and classified before anything was designed, and the one
assumption the brief got wrong was corrected from the repository rather than implemented; the
portable format is Nihon's own, versioned independently of the documents inside it, and carries
decisions rather than a photograph of storage; an arbitrary file stays `unknown` until its own
parsers accept it, with no cast anywhere; the envelope is settled before any migration can run, so no
migrator can rescue an invalid file; the draft's existing migration authority is delegated to and
never duplicated; nothing is written before a human confirms, and every failure before that point
demonstrates zero writes; a write failure rolls back only what landed and says honestly when the
rollback itself fails; import replaces and never merges, including by omission; the two travellers
keep their separate identities and stances and the itinerary stays one shared document; derived data,
the catalogue, the scratch pad and the UI flag are all out; export and import make no network request
of any kind; the trip survives the reload the restore itself performs; the round trip returns the
state field for field; three viewports pass; every historical gate is at its exact baseline with all
27 scripts byte-identical; Block 12's lazy boundaries are intact; no backend, no account and no word
suggesting synchronisation was introduced; and a person can move their trip between browsers with a
file. The tree is clean, the branch is pushed, `main` is untouched, and there is no merge and no pull
request.

---

## Recommendation for Block 14

**Record the outcome of the human review Block 9 unblocked.** Unchanged since Block 11 and now by a
wide margin the oldest open thread. It needs no external research and no new code — it needs the two
travellers, which is exactly why no session can close it unilaterally.

**Second choice: verify the backup on a real iPhone.** It is the one evidence gap this block opened
and cannot close itself. It needs a device, not a session — and until someone has one, the honest
state is the one recorded above rather than an assumption in either direction.

**Explicitly NOT recommended now:**

- **Adding merge, sync, accounts or a backend.** Block 13 deliberately built the smallest honest
  thing. Merging requires deciding whose route wins, which is a product question nobody has answered.
- **Auto-exporting, scheduled backups or a reminder.** The file is the person's; Nihon should not
  acquire opinions about when they should make one.
- **Encrypting or compressing the file.** It would stop being readable by its owner, against no
  threat this design faces.
- **Splitting `TripBackup` into its own chunk.** Measured at 2.4 kB gzipped — below the threshold
  Block 12 set and applied to two larger surfaces.
- **Restoring `nihon.savedPlaceIds`, the zone comparison or the onboarding flag.** Each was excluded
  for a reason recorded in the design record.
- **The backend / two-device layer**, more photography (both Block 2 STOP criteria hold), more zones
  (the 4–7 rule), travel-time estimation without a routing-provider decision.
