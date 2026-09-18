# Block 4 — the chosen zone becomes an input to the plan

**Status:** implemented. **Base:** `claude/brave-wozniak-f79ie3` at `f8f3eb9` (Block 3 closed).
**`main` reference:** `1a11fe8` (Nihon v1.0.0). Not merged, no pull request.

**Authorities it starts from:** [`ACCOMMODATION_COMMUTE_DESIGN.md`](ACCOMMODATION_COMMUTE_DESIGN.md)
(Phase 3D-P — what accommodation may and may not be in this repository),
[`BLOCK_3_DESIGN.md`](BLOCK_3_DESIGN.md) (the zone registry and the fact/derived/editorial
boundary) and [`BLOCK_3_HANDOFF.md`](BLOCK_3_HANDOFF.md), whose recommendation this block
implements.

Block 3 gave the reader something substantive to decide. Block 4 makes the decision do something.

---

## The question

> *Elegimos dormir aquí. ¿Cómo incorporo esa decisión a nuestro plan sin que Nihon invente
> logística?*

Every choice below follows from the second half of that sentence.

---

## 1. What was audited before anything was written

The Block 3 handoff proposed that a chosen zone could seed an accommodation anchor "using the same
fields the planner already handles: label and coordinates". That was a hypothesis, and it was
checked against the code before it was built.

It holds exactly. `AccommodationAnchor` is `{ id, label, location: { lat, lng } }` and nothing
else; `withNewAccommodation(draft, label, location, idFactory)` is the whole creation path; the
anchor is deliberately **not** bound to a hub (Phase 3D-P §9), carries no priority, and is offered
to every day's boundary. A zone's registry record already carries `anchor: { label, lat, lng }`.
Seeding is therefore a copy of two fields the catalogue already asserts — not a new entity, not a
new contract, and not a second kind of accommodation.

**So Block 4 adds no accommodation concept.** It adds one record saying *where an anchor came
from*.

## 2. The state model — one truth, not two

The failure mode this block had to avoid is named in its own brief: a `selectedZone` in one module
and an unrelated anchor in the planner. The relation had to be explicit, persistible,
reconcilable, deletable and resistant to zone changes.

```
ZoneAccommodationChoice ──hub──────────▶ one hub, at most one choice
         │
         ├──zoneId──────────▶ data/accommodation/zones.json  (resolved one layer up)
         └──accommodationId─▶ an AccommodationAnchor IN THE SAME DRAFT
```

The anchor is the single truth about *where*; the choice is the single truth about *why that
anchor exists*. There is no second copy of the label, no second copy of the coordinate, and no
separate store. Both live in `nihon.manualPlanningDraft` and are written in one transaction.

**Why the draft and not a sibling of `nihon.zoneComparison.v1`:** a choice stored outside the
draft could reference an anchor the draft had already deleted, and nothing would ever notice.
Inside it, the invariant is checkable — and is checked, at parse time and at reconcile time.

**Layering.** `zone-accommodation-choice.ts` holds the record and is **registry-free**: the
persistence layer never imports the 40 KB zone catalogue. `zoneId` is opaque there and is resolved
in `zone-plan-link.ts`, where an id that has left the catalogue becomes an honest "zona ya no
disponible" state rather than a crash or a silent deletion.

## 3. Persistence — V8, and why a migration was justified

`ManualPlanningDraftV8` adds exactly one field to V7:

```ts
zoneAccommodationChoices: ZoneAccommodationChoice[];
```

Under the same key. `migrateV7ToV8` adds `[]` and invents nothing — no anchor already in a V7
draft is retroactively attributed to a zone.

This follows the established V5→V6→V7 pattern exactly: every inherited operation runs against a
`v7View` that does not contain the new field, so a V7 function *provably* cannot read or write it,
and the choices are re-attached afterwards. Three operations are explicit exceptions because they
are the only ones that must reason about both halves: `withoutAccommodation`, `reconcileDraft` and
`resetRoute`.

It is not a generic migration framework and not architectural ambition: the alternative was a
second store, which is the thing the brief forbids. Old payloads keep failing closed exactly as
before — `parseStoredDraft` returns `null` and the app falls back to a fresh draft, never a
repaired one.

**Parse rejects, never repairs:** two choices for one hub, two choices on one anchor, a malformed
entry, and — the relational rule only this layer can see — a choice pointing at an anchor the
draft does not contain. That mirrors the existing policy for a boundary referencing an unknown
accommodation (Phase 3D-P §8.2).

## 4. The six state transitions

The brief named six cases. Each has one rule, and the rule is the same one: **manual state is
never destroyed silently.**

| | case | what happens |
|---|---|---|
| A | chooses a zone | one anchor seeded, one choice recorded, in one update. No boundary, no leg, no duration is created alongside it. |
| B | changes to another zone | the choice is replaced. The previous anchor is removed **only if it carries no user work**; otherwise it is kept as an ordinary anchor, and the UI says so. |
| C | deletes the choice | same rule, symmetric. |
| D | already had a manual anchor | nothing happens to it. Both coexist; the boundary select offers both; the zone-seeded one is labelled. No rebinding, ever. |
| E | the set of places changes | anchors are not place-scoped and survive; the choice survives with them. Reconciliation prunes only a choice whose anchor is actually gone. |
| F | days are reordered | untouched. The choice is not day-scoped. |

**"Carries user work" is defined precisely**: a day boundary selects the anchor, or a manual
duration was typed for it. Nothing else counts.

Two alternatives were considered and rejected for B:

- **re-pointing the old anchor at the new zone's coordinate** — this would silently reattribute
  durations the reader typed for a *different* station. 25 minutes from Shinjuku is not 25 minutes
  from Asakusa. Rejected outright;
- **always deleting the old anchor** — destroys a boundary choice and a typed duration without
  asking. Rejected.

So an untouched seeded anchor is cleaned up (nothing is lost) and one the reader has built on is
kept (nothing is lost). Both branches are tested, and both are exercised in the browser audit.

## 5. What the planner may say about the days

`zone-plan-link.ts` answers three questions and refuses a fourth.

| shown | kind | source |
|---|---|---|
| which hub a day is in | **fact** | `Place.hub` in the catalogue |
| which anchor each boundary side is planned from | **fact** | the reader's own choices in the draft |
| how far the day's places are from the zone's station | **derived** | straight-line geometry, in Block 3's bands |

The fourth question — *how long would that take* — has no honest answer and is not attempted. No
minute is produced, estimated, widened or converted anywhere in this block. `getBestTransfer` is
never called with an anchor, and the section's only rendered numbers are kilometres and day
ordinals.

Block 3's vocabulary is carried over intact: derived values are badged *calculado* and worded
*línea recta*, and the section states in words that straight-line distance is not travel time and
does not make a day better.

**A day that spans two hubs gets no zone at all.** `singleHub` is non-null only when every
resolvable place in the day agrees; otherwise the day is reported with the reason visible and no
zone attached. That is also what keeps one hub's zone from appearing as another hub's
accommodation (§8 of the brief) — and when the reader *deliberately* points a Kioto day at a Tokio
zone's anchor, the section reports it as a neutral fact (`seededByZoneForHub`) rather than a
warning, because they have done nothing wrong.

## 6. One writer at a time

The comparison panel is opened from the hub bar, long before the planner exists on screen, so it
must write the draft without `OrderedSequenceBuilder` being mounted. `useZonePlanChoice` therefore
holds **no authoritative state**: every mutation is a full read-modify-write against storage, and
the only React state is a render-only snapshot re-derived from the draft just written.

`App.tsx` then makes the two surfaces mutually exclusive — opening either closes the other — which
turns "exactly one live writer" from an incidental property into a structural one, and happens to
be the right flow anyway: *comparar → elegir → planificar* is one movement, and it needs no new
modal to express.

## 7. UX and accessibility

- A CTA on every zone, in both the list and the comparison: **"Usar esta zona en el plan"**, or
  **"Cambiar a esta zona"** when another is chosen. Never "la mejor" and never "te conviene": the
  choice is the reader's.
- A `role="status"` banner names the chosen zone, names the accommodation the planner gained, and
  states plainly that nothing was booked and no time was calculated.
- **"Abrir el planificador"** hands the reader straight on. The planner's route view shows a
  compact summary so the decision is acknowledged the moment they arrive; the full per-day detail
  sits in the day-assignment view, beside the boundaries it describes.
- The accommodation manager marks seeded anchors and warns — visibly and in the accessible name —
  that deleting one also drops the zone choice.
- Semantic buttons throughout, distinct accessible names for the two remove controls, the 44px tap
  floor, no hover-only affordance, and no horizontal overflow at any of the three viewports.

## 8. Two test-gate corrections

Both are recorded rather than quietly made.

1. **`ORS` was unanchored in the Phase 3D-Q forbidden-claim scan.** Case-insensitively it also
   matched the "ors" inside ordinary English words such as `anchors`, so the gate fired on prose
   that said nothing about a routing provider. Tightened to `\bORS\b`, with a test proving it
   still catches a real claim and no longer catches `anchors`. The gate is not weakened.
2. **Vocabulary scans now run on code with comments stripped, and on rendered text with the
   disclaimer removed.** Block 4's copy says *"no dice que un día sea mejor que otro"* and *"no ha
   calculado ni un minuto"* — sentences that deny the very thing a blunt keyword scan flags. The
   disclaimers are now asserted **positively** and then excluded before scanning for the claim, so
   the assertion means what it says.

The Block 4 UI also moved to its own file, `components/ZonePlanSection.tsx`, after an existing test
that slices `OrderedSequenceBuilder.tsx` between two hard-coded landmarks swept it up. Better
structure regardless: the host file was already 3,499 lines.

---

## Verified

| check | result |
|---|---|
| Vitest | **2720 passed**, 0 failed (from 2583) |
| oxlint / `tsc` / build | clean · clean · OK |
| **All 13 Python suites** | **OK** |
| **All 8 argument-free validators** | **OK** |
| Block 1 UX audit | **142/142** |
| Block 2 photography audit | **69/69** |
| Block 3 zone audit | **105/105** |
| **Block 4 zone → planner audit** | **261/261** at 390×844 DPR 2, 820×1180 DPR 2, 1440×900 |
| `git diff --check` | clean |

## What was deliberately not built

No hotels, no prices, no availability, no booking, no scraping, no backend, no accounts, no
collaboration, no sync, no external routing, no Google Directions, no invented minutes, no
automatic optimisation, no composite score, no universal zone recommendation, no new cities, no
new photography, no generative AI at runtime, and no reopening of any fail-closed parse.

**And, explicitly: no decision about the two-person layer.** Block 4 has no authorisation to
choose between two local profiles in one browser and two real people on two devices. That remains
an open product decision, and it is still the right thing to open the next block with.
