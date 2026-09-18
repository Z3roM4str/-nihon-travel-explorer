# Block 5 — two local travellers

**Status:** implemented. **Base:** `claude/brave-wozniak-f79ie3` at `9275281` (Block 4 closed).
**`main` reference:** `1a11fe8` (Nihon v1.0.0). Not merged, no pull request.

**Product decision taken by the user:** option **A** — two local profiles in one browser. No
backend, no accounts, no login, no cross-device sync. The model is nevertheless shaped so that a
later move to synchronisation would not require re-conceiving this layer.

**Authorities it starts from:** [`BLOCK_4_HANDOFF.md`](BLOCK_4_HANDOFF.md) (which named this as the
blocking product question), [`ACCOMMODATION_COMMUTE_DESIGN.md`](ACCOMMODATION_COMMUTE_DESIGN.md)
and [`BLOCK_3_DESIGN.md`](BLOCK_3_DESIGN.md) (the fact / derived / editorial separation this block
extends rather than blurs).

---

## 1. The question the architecture had to answer first

> Which data belongs to the trip, and which can belong to one traveller?

Everything else follows from the answer, so it was settled before a single component was written.

**Shared — one trip, one truth.** The route, the day assignment, the dates, the visit start times,
the accommodation anchors, the day boundaries, the manual legs, the inter-hub segments and the
chosen zones. Two adults travelling together have one itinerary; duplicating any of these per
person would produce **two plans rather than one trip**, and would make every downstream question
("which day is this?", "where do we sleep?") ambiguous.

**Personal — exactly one thing.** *Does this person want to go here.*

That asymmetry is the whole design. It is also the answer to the brief's §9 — *what must not be
duplicated per person* — and it is enforced by test: `lib/travellers.ts` may not contain the
strings `routeIds`, `days`, `startDate`, `endDate`, `visitStartTimes`, `accommodations`,
`accommodationLegs`, `interHubSegments` or `zoneAccommodationChoices`, and `planning-draft-v8.ts`
may not mention a traveller.

## 2. Five categories, kept apart

Blocks 1–4 separated three kinds of statement. Block 5 adds two and blurs none:

| kind | example | where it lives |
|---|---|---|
| **FACT** | "cierra a las 17:00" | the dataset, with provenance |
| **DERIVED** | "a 1,2 km del anchor" | computed on read, badged *calculado* |
| **EDITORIAL** | "zona animada de noche" | `editorial`, badged *criterio* |
| **PREFERENCIA PERSONAL** | "Ana quiere ir" | `nihon.travellers.v1` — a stance, because somebody pressed a button |
| **DECISIÓN DE PLANIFICACIÓN** | "va el martes" | `nihon.manualPlanningDraft` — shared |

A preference never becomes a plan on its own, and a coincidence of preferences is never a score.
"Los dos" is reported in exactly those words as *two people happened to say the same thing*. There
is deliberately **no function anywhere in this layer that returns a number per place** — no score,
no percentage, no compatibility figure, no ranking input — and that is asserted by scanning the
modules' own code with comments stripped.

## 3. The data model

```ts
type InterestStance = "interested" | "not-interested";      // absence = no opinion

type PlaceInterest = {
  placeId: string;
  stances: { travellerId: string; stance: InterestStance }[];
  carriedOver: boolean;      // was in the list before profiles existed
};

type TravellersDocumentV1 = {
  version: 1;
  travellers: { id: string; label: string }[];
  activeTravellerId: string | null;   // who is holding the device
  interests: PlaceInterest[];
};
```

**Three states, never two.** A traveller with no entry in `stances` has expressed **no opinion**,
which is a different statement from `not-interested`. That is the same discipline Phase 3D-P
already applies to `unselected` vs `no-accommodation`, and the brief's §4 asks for it explicitly.

**The shortlist is derived, never stored.**
`shortlistPlaceIds()` = places where at least one traveller is interested, or which were carried
over and nobody has spoken about yet. That single function is the **only** point of contact
between the two-person layer and the shared plan: `usePlanningDraft(savedIds)` keeps receiving the
same `string[]` it always did, and reconciles exactly as before.

**Why a separate store rather than a draft field.** The shortlist was already a separate store
(`nihon.savedPlaceIds`) that the draft *reconciles against*; this block evolves that store instead
of inventing a relationship. Putting interests inside the draft would have coupled a per-person
preference to a shared planning document and forced a V9 for data that is not a planning decision.

## 4. Migration, and the one thing it refuses to invent

`nihon.savedPlaceIds` is read **only when no travellers document exists**, and is never written or
deleted — it becomes inert the moment the new document is written, and deleting it would add a
data-loss path for no benefit.

Those places were saved when there was one list and no people. Three options were available and
two are dishonest:

- attribute them to Persona 1 → invents an opinion about a real person;
- attribute them to both → invents two;
- **carry them over unclaimed** → true, and says so on screen.

So they arrive with `carriedOver: true` and no stances, stay in the shortlist, are reported as *sin
reclamar*, and the flag clears for good the moment anybody speaks. Going quiet again afterwards
does **not** resurrect it: having been asked and having never been asked are different things.

## 5. Invariants, all fail-closed

Parse rejects — never repairs, never last-wins:

- 1 to `MAX_TRAVELLERS` (2) travellers, with unique ids and non-blank labels;
- one stance per traveller per place; one record per place;
- **every stance must reference a traveller in the same document** — a dangling stance is rejected
  outright, never dropped and never reattributed to the other person;
- `activeTravellerId`, when set, resolves to a live traveller;
- a record with no stances and `carriedOver: false` is refused, because no setter can produce one.

Staleness against live data is handled separately, in `reconcileTravellers` — the same
parse-then-reconcile split the planning draft already uses.

## 6. Deleting and resetting

| action | effect |
|---|---|
| **rename** | label only; a blank label is rejected rather than defaulted |
| **reset** | clears that person's stances, keeps the person; the other's are untouched |
| **remove** | takes the person and their stances; refused when only one remains; if they were active, the remaining traveller becomes active — a fact about who is holding the phone, not an opinion transferred |

Nothing is ever reattributed. A place that was in the shortlist only because of that person leaves
it, `savedIds` shrinks, and the planner prunes it through the existing, already-tested cascade.
**The count of places that will be affected is on screen before the button is pressed**, again in
the confirmation, and both destructive steps need a second explicit press.

## 7. UX — how the layer stays almost invisible

The brief's list of things to avoid is long: Persona 1 / Persona 2 on every card, chips, continual
modals, dating-app UI, gamification, colour as the only differentiator, a duplicated interface. One
rule keeps it clear of all of them:

> **A marker appears only when it tells the reader something they do not already know.**

So the marker is computed from the **active reader's point of view** and returns `null` for the two
commonest states — nobody has an opinion, and *you* saved it and the other person has not seen it
yet. The heart already says the second one. What is left is exactly what is worth interrupting for:
the other person wants this too, only they want it, or somebody has said no.

- **Permanent footprint: one header row.** A two-option segmented control — one tap, no dropdown,
  `aria-pressed` for state and the name in text.
- **Saving is still one tap.** Because the reader says who they are once, in the header, no card
  needs a person picker, and no card carries both names.
- **The heart shows YOUR interest, not shared membership.** `activeInterestedIds` is deliberately a
  different list from `savedIds`; otherwise a place only the other person saved would look already
  hearted while the marker beside it said it was theirs.
- **The full picture and the explicit refusal live in the place detail** — the one surface with
  room, and a deliberate, infrequent act that would invite mis-taps next to the heart.
- **The saved list carries counts**, never a percentage.
- **One modal**, opened only by the reader, for rename / reset / remove.

Every marker carries **text**; `tone` styles it but never carries it. The layer survives greyscale,
colour blindness and a screen reader intact, and each short label has a spelled-out `description`
for assistive technology.

## 8. Questions the brief asked, answered honestly

**§6 — how to migrate from `ManualPlanningDraftV8`?** It is **not migrated**, because nothing in it
is personal. Bumping to V9 out of symmetry would have added a version, a migration and a parser
rule for no change in meaning. Asserted by test rather than asserted in prose.

**§10 — does this force the `useZonePlanChoice` / `usePlanningDraft` debt to be resolved now?**
**No.** Block 4's assumption is that the zone comparison and the planner are the only two writers of
the draft and are mutually exclusive. Block 5 adds a writer of a *different* key and never touches
the draft: `useTravellers`, `lib/travellers.ts` and `lib/traveller-presentation.ts` are each
asserted to contain no reference to `manualPlanningDraft`, `writeDraft` or `planning-draft`. The
assumption still holds, so the refactor stays unmade — exactly as the brief instructed.

## 9. Regression found and fixed

Block 3's browser audit emptied the shortlist by removing `nihon.savedPlaceIds` in order to prove
the zone panel degrades honestly with nothing saved. Block 5 made that the *legacy* key, so the
list survived and the empty state was never reached — 6 of 105 checks failed. The audit now clears
the current owner as well. The check's intent is unchanged; only the key it pokes moved. This is
the regression net doing its job, in the same way Block 1's tap-target audit caught Block 3's 38px
button.

---

## Verified

| check | result |
|---|---|
| Vitest | **2842 passed**, 0 failed, 81 files (from 2720 / 78) |
| oxlint / `tsc` / build | clean · clean · OK |
| **All 13 Python suites** | **OK** |
| **All 8 argument-free validators** | **OK** |
| Block 1 UX audit | **142/142** |
| Block 2 photography audit | **69/69** |
| Block 3 zone audit | **105/105** (after the fix above) |
| Block 4 zone → planner audit | **261/261** |
| **Block 5 two-traveller audit** | **225/225** at 390×844 DPR 2, 820×1180 DPR 2, 1440×900 |
| `git diff --check` | clean |

## What was deliberately not built

No backend, no accounts, no login, no cross-device sync, no collaboration protocol, no presence, no
conflict resolution, no invitations, no sharing links. No score, no percentage, no compatibility
figure, no ranking by preference, no "mejor para vosotros", no filtering or sorting of the
catalogue by what people said, no gamification, no notifications, no generative AI. No third
traveller, no per-person day plan, no per-person route, and no per-person accommodation.
