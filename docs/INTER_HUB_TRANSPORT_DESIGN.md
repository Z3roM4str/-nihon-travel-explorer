# Phase 3D-X — Inter-Hub Transport Design Gate

Status: **design/audit only**  
Base audited: `79c461f71ddab2491e52a8dad8ae4beb09b3dd93` (`main` after Phase 3D-W)  
Recommended successor if this gate is accepted: **Phase 3D-Y — Manual Inter-Hub Segment Runtime**

---

## 1. Decision

Nihon is **not ready for automatic itinerary optimisation**.

The current planner can describe an explicit user-authored order, compare two explicit user-authored
orders, divide that order into stable day entities, attach civil dates and trip bounds, and record
manual accommodation-boundary legs. It still has no honest representation for the major transport
step between different city hubs.

That gap must be closed before any "best order", auto-sort, day optimiser, nearest-neighbour,
shortest-path or itinerary recommendation is considered.

This gate therefore approves one narrow model only:

> a **user-authored, manually timed inter-hub segment** attached to an explicit ordered pair of
> stable day identities, with an explicit mode and a snapshot of the two hub names it was created
> for.

It is not a `TransferEdge`, not an accommodation leg, not a timetable, not a booking, not a
door-to-door journey and not a recommendation.

No runtime is implemented in this gate.

---

## 2. Why this is the next gap

### 2.1 Measured logistics coverage at the audited base

The current dataset contains:

- **214 places**
- **403 directed nearby relations**
- **45,582 possible directed place pairs**
- global recorded-pair coverage: **0.88%**

All 403 recorded relations are intra-hub. There are **zero inter-hub relations**.

Measured directed coverage inside the four large hubs is also sparse:

| Hub | Places | Known directed relations | Possible directed pairs | Coverage |
|---|---:|---:|---:|---:|
| Tokio | 57 | 136 | 3,192 | 4.3% |
| Kioto | 49 | 126 | 2,352 | 5.4% |
| Osaka | 53 | 79 | 2,756 | 2.9% |
| Okinawa | 50 | 62 | 2,450 | 2.5% |

Sapporo currently has 3 places and no recorded directed relation between them. Nagoya and Fukuoka
currently have one place each.

The existing transfer vocabulary is also deliberately local:

- `walk`
- `local-transit`
- `disney-resort-line`

No Shinkansen, domestic flight, ferry, intercity rail or highway-bus relation exists in
`nearby.json`.

### 2.2 Consequence for optimisation

An optimiser over this graph would mostly optimise **where Nihon happens to have an edge**, not
the user's real travel burden.

A route with one unknown Tokyo→Kyoto jump cannot honestly be declared better or worse than another
route whose local walking edges happen to be recorded. Unknown is not infinite, and unknown is not
zero.

Phase 3C-B already has the correct comparison rule: incomplete candidates do not produce a winner.
Phase 3D-X does not weaken that rule.

### 2.3 Why inter-hub transport comes before candidate generation

For the intended Japan trip, the route can legitimately cross Tokio, Kioto, Osaka and Okinawa.
The largest logistical decisions are therefore exactly the ones the current graph cannot represent.

Before the planner can recommend an ordering, it needs a truthful way to say that the user intends
a major move between two days and how much time the user has explicitly recorded for that move.

---

## 3. Existing contracts that remain authoritative

This design preserves the following current boundaries.

### 3.1 `TransferEdge`

`app/src/lib/transfer.ts` remains the domain for **recorded directed place-to-place relations**.

Phase 3D-X does not:

- add inter-hub modes to `TransferMode`;
- synthesize a place-to-place edge between hubs;
- infer a route from coordinates;
- reverse a missing edge;
- chain edges;
- call a routing provider;
- reinterpret `getBestTransfer()`.

### 3.2 Ordered sequence

`ordered-sequence.ts` continues to consume one explicit place order and looks up only each exact
consecutive directed pair.

A manual inter-hub segment is not inserted into that sequence and is not used to make an incomplete
place sequence look complete.

### 3.3 Sequence comparison

`sequence-comparison.ts` keeps its existing rule:

> both candidates must be complete before a faster candidate may be declared.

Manual inter-hub segments do not retroactively fill missing `TransferEdge` legs and do not make
automatic candidate generation safe.

### 3.4 Day assignment

`day-assignment.ts` intentionally breaks transfer aggregation at day boundaries.

That remains correct. An inter-hub segment is a **separate boundary-level fact**, not an intra-day
leg that gets smuggled into a day sequence.

### 3.5 Accommodation commute

`ManualAccommodationLeg` remains an exact user-entered accommodation↔place duration.

An inter-hub segment does not:

- represent hotel→station;
- represent airport→hotel;
- combine with an accommodation leg;
- infer a terminal;
- produce a door-to-door total.

### 3.6 Trip bounds

Phase 3D-W's `startDate`, `endDate`, day identity and bounds assessment remain untouched.

An inter-hub segment has no clock time and no timezone. It does not derive arrival/departure dates,
change the trip bounds, create a travel day or alter day membership.

---

## 4. Approved domain model

The successor may add a new independent domain type:

```ts
type InterHubMode =
  | "shinkansen"
  | "limited-express"
  | "domestic-flight"
  | "ferry"
  | "highway-bus"
  | "other";

type ManualInterHubSegment = {
  id: string;
  fromDayId: string;
  toDayId: string;
  fromHub: string;
  toHub: string;
  mode: InterHubMode;
  minutes: number;
  source: { kind: "user-entered" };
};
```

### 4.1 Identity

`id` is opaque and locally minted, using the same no-semantic-payload principle as stable day and
accommodation ids.

It encodes no:

- date;
- ordinal;
- hub;
- mode;
- duration;
- creation time;
- place id;
- recommendation score.

### 4.2 Boundary identity

The segment refers to **two stable day ids**:

- `fromDayId`
- `toDayId`

The pair is directional.

A segment for A→B is not a segment for B→A.

The ids are stored because ordinal positions are not stable identities. Reordering days must never
silently rebind "the train from Tokyo to Kyoto" to whichever two buckets happen to occupy positions
2 and 3 later.

### 4.3 Hub snapshot

`fromHub` and `toHub` are stored as the explicit hub pair the user created the segment for.

They are not automatically rewritten if the contents of either day later change.

This is intentionally redundant with what may be derivable from the current day contents: the
redundancy is evidence that prevents a segment from silently changing meaning after a place move.

### 4.4 Mode

`mode` is an explicit user selection.

No mode is inferred from the hub pair.

Tokio→Kioto does not imply Shinkansen. Osaka→Okinawa does not imply flight. The model carries the
user's decision, not Nihon's assumption.

### 4.5 Duration

`minutes` is:

- a positive safe integer;
- entered explicitly by the user;
- one exact recorded number;
- the duration of the **main inter-hub transport segment as the user intends to record it**.

It is not widened into an invented range.

It is not a door-to-door duration and does not include local access/egress unless a future,
separately-designed model explicitly says so.

The UI must label this boundary plainly, e.g. "Duración manual del tramo principal".

### 4.6 Provenance

The only approved provenance is:

```ts
{ kind: "user-entered" }
```

No official timetable, booking source, routing provider, airline, JR operator or live feed is
claimed.

---

## 5. Canonical persistence

The successor should promote the canonical planning draft from V6 to V7:

```ts
type ManualPlanningDraftV7 = {
  version: 7;
  routeIds: string[];
  days: PlanningDayV5[] | null;
  startDate: string | null;
  endDate: string | null;
  visitStartTimes: Record<string, string>;
  accommodations: AccommodationAnchor[];
  accommodationLegs: ManualAccommodationLeg[];
  interHubSegments: ManualInterHubSegment[];
};
```

The storage key remains exactly:

`nihon.manualPlanningDraft`

No second localStorage key is approved.

### 5.1 Migration

V6 → V7 adds exactly:

```ts
interHubSegments: []
```

Nothing is inferred from:

- route order;
- day order;
- place hubs;
- trip bounds;
- accommodation anchors;
- existing transfer edges;
- dates;
- today's date.

An old trip did not contain an inter-hub decision, so migration must not invent one.

---

## 6. Shape validation

At parse time, a segment is shape-valid only when:

- `id` is a non-empty string;
- `fromDayId` and `toDayId` are non-empty strings and differ;
- `fromHub` and `toHub` are non-empty strings and differ;
- `mode` is in the closed vocabulary;
- `minutes` is a positive safe integer;
- `source` is exactly `{ kind: "user-entered" }`;
- segment ids are unique;
- no two stored segments have the same exact directional `fromDayId → toDayId` key.

Referential/ordinal coherence is **not** a parse invariant. See §7.

This distinction matters because normal user edits can temporarily make a previously valid segment
inactive. That state must not turn the whole persisted trip into corruption on reload.

---

## 7. Derived applicability assessment

A pure assessment layer determines whether a stored segment currently describes a usable day
boundary.

Approved result vocabulary:

```ts
type InterHubSegmentAssessment =
  | { kind: "active"; fromOrdinal: number; toOrdinal: number }
  | {
      kind: "inactive";
      reason:
        | "no-day-assignment"
        | "missing-from-day"
        | "missing-to-day"
        | "not-adjacent"
        | "reversed-order"
        | "empty-from-day"
        | "empty-to-day"
        | "mixed-from-hubs"
        | "mixed-to-hubs"
        | "from-hub-mismatch"
        | "to-hub-mismatch"
        | "same-current-hub";
    };
```

The exact successor implementation may collapse `not-adjacent`/`reversed-order` if tests prove
one subsumes the other cleanly, but it may not collapse an ambiguous/missing state into `active`.

### 7.1 Current day hub

A day has a resolvable current hub only when:

1. it is non-empty;
2. every `placeId` resolves;
3. every resolved place in that day has the same `Place.hub`.

No majority vote, first-place heuristic or last-place heuristic is allowed.

A mixed-hub day is ambiguous for this feature.

### 7.2 Active segment

A segment is active only when all are true:

1. both referenced day ids exist;
2. `fromDayId` immediately precedes `toDayId` in the current day order;
3. both days resolve to exactly one current hub;
4. current from-hub equals stored `fromHub`;
5. current to-hub equals stored `toHub`;
6. the two current hubs differ.

Anything else is inactive and contributes no transport minutes to any summary.

### 7.3 No repair

Assessment never:

- moves a day;
- edits a segment;
- rewrites a hub snapshot;
- changes a mode;
- changes minutes;
- deletes the segment;
- changes trip bounds;
- changes accommodation data.

An inactive segment remains visible as a user-authored fact that no longer matches the current plan.

---

## 8. Mutation semantics

### 8.1 Create

A segment may be created only for a **currently active-eligible boundary**:

- two consecutive day entities;
- each non-empty;
- each single-hub;
- hubs differ.

The UI may derive the two hub labels from that boundary at creation time and persist those labels as
the snapshot. It must not infer the transport mode or minutes.

### 8.2 Edit

The user may change only:

- mode;
- minutes.

Changing the bound day pair is modeled as delete + create, not silent identity rebinding.

### 8.3 Reorder days

`withDayMoved` does not rewrite any segment.

After reorder, assessment recomputes. A formerly active segment may become inactive.

If the exact same two day entities remain consecutive in the same direction, it remains active.

### 8.4 Move places between days

The segment object is unchanged.

If the move makes a day empty, mixed-hub, or changes its single resolved hub, the segment becomes
inactive. Its stored hub snapshot is never rewritten automatically.

### 8.5 Reorder places inside a day

No effect on segment applicability if the set of hubs in the day is unchanged.

### 8.6 Add an empty day

No segment is created automatically.

Inserting an empty day between two referenced day entities can make their segment non-adjacent and
therefore inactive.

### 8.7 Remove a day

Deleting a day destroys that stable identity.

The successor is permitted to remove segments that reference the explicitly deleted day in the same
mutation, because those segments can never again refer to an existing entity.

This destructive consequence must be visible in the UI before the user confirms/removes that day;
it must not happen as an unrelated background cleanup.

### 8.8 Route composition change / reset

Existing planner semantics can invalidate the entire day assignment (`days: null`) when route
composition changes or the route is reset.

Because inter-hub segments are defined specifically between stable day identities, when the day
assignment is structurally destroyed the successor must clear `interHubSegments` in that same
explicit mutation.

The bounds and accommodation anchors keep their existing independent semantics.

A pure route reorder that preserves the existing day entities does not clear segments.

### 8.9 Bounds changes

Setting, clearing or inverting `startDate`/`endDate` never changes an inter-hub segment.

The segment has no date or clock-time semantics in this phase.

---

## 9. Presentation contract

The successor may add one subsection inside the **existing** planning dialog:

**Traslados entre ciudades**

No new top-level page, wizard or modal is required.

The section may:

- list stored segments;
- show the explicit day pair;
- show `fromHub → toHub`;
- show the user-selected mode;
- show the manually entered minutes;
- show whether the segment currently matches that boundary;
- explain an inactive reason neutrally;
- add/edit/delete a segment.

### 9.1 Copy boundaries

Approved style:

- "Tokio → Kioto"
- "Shinkansen"
- "140 min registrados manualmente"
- "Este tramo ya no coincide con dos días consecutivos."
- "El contenido actual del Día 3 mezcla más de un hub; Nihon no puede aplicar este tramo."

Forbidden:

- "Mejor opción"
- "Ruta óptima"
- "Conviene"
- "Más rápido" unless comparing independently supported complete evidence in a future phase
- "Llegarás a las..."
- "Toma este tren/vuelo"
- "Reserva ahora"
- "Puerta a puerta"
- "Incluye traslado al aeropuerto/estación"
- any invented station, terminal, airport, fare or timetable.

### 9.2 Totals

The manually entered segment may be displayed as its own duration fact.

It must not be silently merged into:

- intra-day transfer totals;
- accommodation commute totals;
- visit-time totals.

A later phase may design a trip-level time composition, but Phase 3D-Y must not invent one by simple
addition across incomparable boundaries.

---

## 10. Why this is not `TransferMode`

Adding `shinkansen` or `domestic-flight` to the current `TransferMode` looks superficially
simple but is rejected.

`TransferEdge` currently means a recorded directed relation between two tourism places, with
distance, confidence, provenance and a lookup key over those place ids.

The proposed segment instead means:

- a user-authored major travel decision;
- between two stable day entities;
- with no tourism-place endpoints;
- no recorded geometric distance;
- no routing-provider evidence;
- no access/egress model;
- no assumption that the day endpoints are stations/airports.

Conflating the two would make existing consumers interpret a fundamentally different object as a
normal place-to-place transfer.

---

## 11. Automatic candidate generation remains deferred

This gate explicitly re-audits the roadmap's unscheduled auto-ordering item.

### 11.1 No candidate generator in 3D-X or 3D-Y

No:

- permutation enumeration;
- TSP;
- shortest path;
- nearest-neighbour;
- greedy route;
- clustering optimiser;
- auto day split;
- auto day count;
- "optimise" button;
- generated recommended itinerary.

### 11.2 Reopening condition

Automatic candidate generation can be reconsidered only after a future audit can answer at least:

1. What objective is being optimised — transport time, completeness, hotel commute, visit time,
   reservation constraints, or a defined multi-objective rule?
2. How are unknown edges treated without turning missing data into a penalty or a free edge?
3. How are inter-hub segments represented with evidence strong enough for comparison?
4. How are incomplete candidates prevented from losing merely because they contain unknowns?
5. How are activity duration, trip bounds and accommodation boundaries incorporated so transport is
   not optimised in isolation?
6. What claim may the UI make: generated alternative, locally improved candidate, or global optimum?
7. What computational bound prevents factorial search from becoming a hidden scalability problem?

Until those are answered, the existing explicit-user-order model remains the correct product
contract.

---

## 12. Test contract for Phase 3D-Y

The successor is not complete unless the following matrix passes.

### Migration and parser

1. V6 → V7 adds `interHubSegments: []` and changes nothing else.
2. V1–V6 historical migration chain still reaches V7.
3. Valid manual segment parses verbatim.
4. Invalid mode rejects whole V7 draft.
5. Zero, negative, fractional, unsafe or non-number minutes reject.
6. Empty ids/hubs reject.
7. `fromDayId === toDayId` rejects.
8. `fromHub === toHub` rejects.
9. Duplicate segment id rejects.
10. Duplicate directional day-pair key rejects.
11. A shape-valid segment referencing a currently missing/non-adjacent day remains parseable and is
    assessed inactive rather than corrupting the whole draft.

### Assessment

12. Consecutive single-hub day pair matching snapshots → active.
13. A→B segment does not become active for B→A.
14. Missing from-day → inactive.
15. Missing to-day → inactive.
16. Non-adjacent days → inactive.
17. Empty from-day → inactive.
18. Empty to-day → inactive.
19. Mixed-hub from-day → inactive.
20. Mixed-hub to-day → inactive.
21. Changed from hub → inactive.
22. Changed to hub → inactive.
23. Same current hub → inactive.
24. Assessment never mutates draft or segment.

### Identity and edits

25. Reordering places inside one day preserves active state when hub set is unchanged.
26. Moving a place across days can deactivate a segment without editing the segment.
27. Moving a day away deactivates the segment without rewriting ids/hubs/mode/minutes.
28. Moving the exact pair back to the same adjacency reactivates the same stored segment.
29. Adding an empty day never creates a segment.
30. Inserting/reordering a day between the referenced pair can deactivate it.
31. Removing a referenced day removes only segments that reference that deleted identity.
32. Removing an unrelated day preserves the segment.
33. Route composition change that destroys `days` clears inter-hub segments.
34. Route pure reorder that preserves day identities preserves segments.
35. `resetRoute` clears day-bound segments when it clears `days`.
36. Bounds changes preserve every segment byte-for-byte.
37. Accommodation edits preserve every segment byte-for-byte.
38. Segment edit changes only mode/minutes.

### Existing domain isolation

39. `getBestTransfer()` output is unchanged.
40. `TransferMode` is unchanged.
41. `ordered-sequence.ts` never reads inter-hub segments.
42. `sequence-comparison.ts` never reads inter-hub segments.
43. `day-assignment.ts` never inserts an inter-hub segment as an intra-day leg.
44. `ManualAccommodationLeg` semantics are unchanged.
45. Trip-bounds assessment is unchanged.

### Persistence and UI

46. Write→reload preserves segment identity, day refs, hub snapshots, mode and minutes.
47. Storage key remains `nihon.manualPlanningDraft`.
48. No second inter-hub storage key exists.
49. UI creates a segment only from an eligible current boundary.
50. UI never infers mode/minutes.
51. Inactive segment remains visible with neutral reason.
52. No copy claims optimisation, timetable validity, price, booking, arrival time or door-to-door
    coverage.
53. Real-browser QA covers active → reorder/inactive → reorder-back/active and reload.
54. Console errors = 0; page errors = 0.

---

## 13. Non-goals

Phase 3D-X and its recommended 3D-Y successor do **not** include:

- dataset or workbook changes;
- current Shinkansen schedules;
- airline schedules;
- fares or price comparison;
- ticket classes;
- seat reservations;
- JR Pass evaluation;
- IC cards;
- live inventory;
- booking links/integration;
- airports or station ids;
- station/airport access legs;
- luggage, takkyubin, lockers or oversized-baggage rules;
- hotel check-in/check-out;
- arrival/departure clock times;
- timezone or absolute instants;
- automatic travel-day insertion;
- automatic day creation/removal;
- automatic place moves;
- candidate generation;
- itinerary recommendation;
- optimisation;
- live transit activation;
- ORS calls;
- a new npm dependency.

Those are separate decisions.

---

## 14. Roadmap implications

This gate makes two roadmap facts explicit.

First, the old "Hotel-origin/return modelling — runtime not started" text is stale: Phase 3D-Q
already implemented manual accommodation commute legs and the canonical persisted accommodation
model. That entry should be corrected as documentation maintenance.

Second, automatic candidate generation remains unscheduled, but its blocker is now more concrete:
before a candidate-order design can make a useful travel claim, the planner needs a truthful
inter-hub transport boundary and a later multi-objective audit. Sparse local edge coverage alone is
not an optimisation substrate.

---

## 15. Acceptance gate for Phase 3D-X

This design gate is accepted only if review agrees that:

1. inter-hub transport is a distinct domain object, not a new `TransferEdge` mode;
2. stable day-pair identity is the correct attachment boundary;
3. stored hub snapshots prevent silent semantic rebinding after place moves;
4. current applicability is derived and can be inactive without corrupting persistence;
5. minutes and mode are explicit user input only;
6. no arrival time, timetable, fare, terminal, door-to-door claim or optimisation is implied;
7. V6 → V7 migration adds an empty segment list and invents nothing;
8. route/day mutations have explicit segment-preservation/clearing semantics;
9. automatic candidate generation remains deferred;
10. Phase 3D-Y, if started, implements exactly this narrow runtime and nothing broader.

---

## 16. Conclusion

The planner now knows **when** the trip starts and ends, and it can preserve stable user-authored
days and accommodation boundaries. Its largest remaining logistics blind spot is the movement
between different city hubs.

The data proves that blind spot cannot be solved by pretending the current nearby graph is a route
network: 403 recorded directed relations across 214 places cover only 0.88% of all possible
directed pairs, and all of them are intra-hub.

The safe next increment is therefore explicit rather than inferred:

> let the user record the major inter-hub segment they actually intend, bind it to the two stable
> days it belongs between, keep the mode and duration visibly manual, and deactivate rather than
> silently reinterpret it when the plan changes.

**Approved design direction:** manual, provenance-explicit, day-pair-bound inter-hub segments.

**Recommended successor: Phase 3D-Y — Manual Inter-Hub Segment Runtime. NOT STARTED.**
