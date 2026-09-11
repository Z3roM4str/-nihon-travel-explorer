# Phase 3D-X — Inter-Hub Transport Design Gate

Status: **design/audit only**  
Base audited: `79c461f71ddab2491e52a8dad8ae4beb09b3dd93` (`main` after Phase 3D-W)  
Recommended successor if this gate is accepted: **Phase 3D-Y — Manual Inter-Hub Segment Runtime**

---

## 1. Decision

Nihon is **not ready for automatic itinerary optimisation**.

The planner can describe an explicit user-authored order, compare two explicit user-authored
orders, divide that order into stable day entities, attach civil dates and trip bounds, and record
manual accommodation-boundary legs. It still has no honest representation for the major transport
step when two consecutive parts of the user's plan belong to different city hubs.

That gap must be closed before any "best order", auto-sort, day optimiser, nearest-neighbour,
shortest-path or itinerary recommendation is considered.

This gate approves one narrow model only:

> a **user-authored, manually timed inter-hub segment** positioned between two explicit,
> directionally ordered place ids that are currently consecutive at the relevant point in the
> user's plan, with an explicit mode and a snapshot of the two hubs it was created for.

The place ids are **plan-position anchors**, not transport terminals. The segment does not claim to
be a place-to-place door-to-door duration.

It is not a `TransferEdge`, not an accommodation leg, not a timetable, not a booking and not a
recommendation.

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

The existing transfer vocabulary is deliberately local:

- `walk`
- `local-transit`
- `disney-resort-line`

No Shinkansen, domestic flight, ferry, intercity rail or highway-bus relation exists in
`nearby.json`.

### 2.2 Consequence for optimisation

An optimiser over this graph would mostly optimise **where Nihon happens to have an edge**, not
the user's real travel burden.

A route with one unknown Tokio→Kioto jump cannot honestly be declared better or worse than another
route whose local walking edges happen to be recorded. Unknown is not infinite, and unknown is not
zero.

Phase 3C-B already has the correct comparison rule: incomplete candidates do not produce a winner.
Phase 3D-X does not weaken that rule.

### 2.3 Why inter-hub transport comes before candidate generation

For the intended multi-city use case, the largest logistical decisions are exactly the ones the
current graph cannot represent.

Before the planner can recommend an ordering, it needs a truthful way to say that the user intends
a major move between two consecutive parts of the plan and how much time the user explicitly
recorded for that move.

---

## 3. Hostile-review correction: why the segment is NOT day-pair-bound

An initial version of this design attached a segment to `fromDayId → toDayId`.

That is rejected.

A legitimate itinerary can contain a major inter-hub move **inside one calendar day**:

- morning in Tokio;
- Shinkansen;
- afternoon/evening in Kioto.

A day-pair-only model would be structurally unable to represent that trip. It would force the user
to invent an extra day boundary merely to store a transport fact.

The corrected model therefore anchors the segment to the two tourism-place ids that bracket its
position in the current plan:

`fromPlaceId → toPlaceId`

Those ids identify **where the inter-hub segment sits in the plan**, not the physical departure and
arrival terminals.

This supports both:

1. two adjacent places inside the same day; and
2. the last place of Day N followed by the first place of Day N+1.

It does not support a segment across an intervening empty day, because those places are not on
consecutive day boundaries.

---

## 4. Existing contracts that remain authoritative

### 4.1 `TransferEdge`

`app/src/lib/transfer.ts` remains the domain for **recorded directed place-to-place relations**.

Phase 3D-X does not:

- add inter-hub modes to `TransferMode`;
- synthesize a place-to-place edge between hubs;
- infer a route from coordinates;
- reverse a missing edge;
- chain edges;
- call a routing provider;
- reinterpret `getBestTransfer()`.

### 4.2 Ordered sequence

`ordered-sequence.ts` continues to consume one explicit place order and looks up only each exact
consecutive directed pair.

A manual inter-hub segment is not inserted into `OrderedSequenceLeg.transfer` and is not used to
make an incomplete `TransferEdge` sequence look complete.

### 4.3 Sequence comparison

`sequence-comparison.ts` keeps its existing rule:

> both candidates must be complete before a faster candidate may be declared.

Manual inter-hub segments do not retroactively fill missing `TransferEdge` legs and do not make
automatic candidate generation safe.

### 4.4 Day assignment

`day-assignment.ts` intentionally breaks normal transfer aggregation at day boundaries.

That remains correct. An inter-hub segment is a **separate planning-boundary fact**, not an
intra-day `TransferEdge` smuggled into the sequence.

### 4.5 Accommodation commute

`ManualAccommodationLeg` remains an exact user-entered accommodation↔place duration.

An inter-hub segment does not:

- represent hotel→station;
- represent airport→hotel;
- combine with an accommodation leg;
- infer a terminal;
- produce a door-to-door total.

### 4.6 Trip bounds

Phase 3D-W's `startDate`, `endDate`, day identity and bounds assessment remain untouched.

An inter-hub segment has no clock time and no timezone. It does not derive arrival/departure dates,
change trip bounds, create a travel day or alter day membership.

---

## 5. Approved domain model

The successor may add:

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
  fromPlaceId: string;
  toPlaceId: string;
  fromHub: string;
  toHub: string;
  mode: InterHubMode;
  minutes: number;
  source: { kind: "user-entered" };
};
```

### 5.1 Identity

`id` is opaque and locally minted using the same no-semantic-payload principle as stable day and
accommodation ids.

It encodes no date, ordinal, hub, mode, duration, creation time or place id.

### 5.2 Directional plan anchors

`fromPlaceId → toPlaceId` is directional.

A segment for A→B is not a segment for B→A.

These place ids mean:

> the major inter-hub segment sits between these two consecutive plan items.

They do **not** mean:

> the transport departs from the physical coordinates of A and arrives at the physical coordinates
> of B.

No distance is derived between those place coordinates.

### 5.3 Hub snapshot

`fromHub` and `toHub` store the explicit hub pair the segment was created for.

At creation time, the UI may copy those values from the two resolved `Place.hub` fields because
that is direct dataset evidence about the selected places.

They are never automatically rewritten later.

This deliberate snapshot prevents a segment from silently changing semantic meaning if dataset
classification or route composition changes.

### 5.4 Mode

`mode` is an explicit user selection.

No mode is inferred from the hub pair.

Tokio→Kioto does not imply Shinkansen. Osaka→Okinawa does not imply flight.

### 5.5 Duration

`minutes` is:

- a positive safe integer;
- entered explicitly by the user;
- one exact recorded number;
- the duration of the **main inter-hub transport segment as the user intends to record it**.

It is not widened into an invented range.

It is not a door-to-door duration. The anchor tourism places are positional context, not terminals.

The UI must label this clearly, e.g. **"Duración manual del tramo principal"**.

### 5.6 Provenance

Only:

```ts
{ kind: "user-entered" }
```

No official timetable, airline, JR operator, routing provider or live feed is claimed.

---

## 6. Canonical persistence

The successor should promote the canonical draft V6→V7:

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

Storage key remains exactly:

`nihon.manualPlanningDraft`

No second localStorage key.

### 6.1 Migration

V6 → V7 adds exactly:

```ts
interHubSegments: []
```

Nothing is inferred from route order, day order, place hubs, bounds, accommodations, existing
transfer edges, dates or the current clock.

---

## 7. Shape validation

A segment is shape-valid only when:

- `id` is a non-empty string;
- `fromPlaceId` and `toPlaceId` are non-empty strings and differ;
- `fromHub` and `toHub` are non-empty strings and differ;
- `mode` is in the closed vocabulary;
- `minutes` is a positive safe integer;
- `source` is exactly `{ kind: "user-entered" }`;
- segment ids are unique;
- no two segments have the same exact directional `fromPlaceId → toPlaceId` key.

Current route/day adjacency and current hub agreement are **not parse invariants**.

A normal user reorder can make a segment inactive temporarily; that must not turn the whole
persisted trip into corruption on reload.

---

## 8. Derived applicability assessment

Approved result shape:

```ts
type InterHubSegmentAssessment =
  | {
      kind: "active";
      placement: "route-only" | "same-day" | "between-consecutive-days";
      fromDayOrdinal: number | null;
      toDayOrdinal: number | null;
    }
  | {
      kind: "inactive";
      reason:
        | "missing-from-place"
        | "missing-to-place"
        | "from-hub-mismatch"
        | "to-hub-mismatch"
        | "same-current-hub"
        | "not-consecutive-in-route"
        | "not-consecutive-in-day"
        | "not-boundary-of-consecutive-days"
        | "invalid-day-partition";
    };
```

The successor may refine names, but it may not collapse an unknown/non-matching state into
`active`.

### 8.1 When no day assignment exists

Use the explicit `routeIds` order.

The segment is active only when:

1. both anchor places exist in the current route;
2. `fromPlaceId` immediately precedes `toPlaceId`;
3. the current `Place.hub` values match the stored hub snapshots;
4. the current hubs differ.

Placement: `route-only`.

### 8.2 When a valid day assignment exists

Day order becomes the presentation order for this assessment.

A segment is active only in one of two cases.

**Same day**

- both anchors are in the same day;
- `fromPlaceId` immediately precedes `toPlaceId` inside that day's place order;
- hubs match snapshots and differ.

Placement: `same-day`.

**Between consecutive days**

- `fromPlaceId` is the last place of Day N;
- `toPlaceId` is the first place of Day N+1;
- N+1 is immediately consecutive — no intervening empty day;
- hubs match snapshots and differ.

Placement: `between-consecutive-days`.

A pair separated by an empty day is not active merely because flattening non-empty place ids would
make the two ids adjacent.

### 8.3 Invalid partition

If a day assignment cannot be trusted structurally, no inter-hub segment is active from that day
view. The assessment returns `invalid-day-partition`; it does not fall back silently to a different
order.

### 8.4 No repair

Assessment never moves a place/day, edits a segment, rewrites hub snapshots, changes mode/minutes,
changes bounds or touches accommodation data.

---

## 9. Mutation semantics

### 9.1 Create

The UI may create a segment only when the selected directional anchor pair is currently eligible:

- both places resolve;
- they occupy an allowed consecutive position under §8;
- their current hubs differ.

The UI copies `fromHub`/`toHub` from the two places as a snapshot.

The user explicitly chooses mode and minutes.

### 9.2 Edit

Only mode and minutes are edited in-place.

Changing either anchor place is modeled as delete + create, not silent identity rebinding.

### 9.3 Route reorder

A pure route reorder never rewrites a segment.

When `days === null`, applicability recomputes from the new route adjacency.

When days exist, the day assignment remains the assessment order; no route reorder silently
overrides it.

### 9.4 Place reorder/move within day planning

Segments remain byte-identical.

If the anchor pair ceases to be an allowed adjacency, the segment becomes inactive.

If the same pair later returns to an allowed adjacency in the same direction, the same stored
segment can become active again.

### 9.5 Day reorder

Segments remain byte-identical.

A cross-day pair may become inactive or active depending on whether the two anchor places now form
the exact last-of-Day-N → first-of-Day-N+1 boundary.

A same-day pair remains active if its intra-day order is untouched.

### 9.6 Empty days

Adding/removing an unrelated empty day creates no segment and edits no segment.

An empty day inserted between a formerly consecutive cross-day pair makes that pair inactive.

### 9.7 Removing an anchor place from the route

A segment whose `fromPlaceId` or `toPlaceId` is explicitly removed from the route must be pruned
by the same canonical route/reconciliation mutation that removes stale place-bound state.

No unrelated segment is removed.

If the user later adds the place back, the old segment is not resurrected automatically.

### 9.8 Bounds and accommodation changes

Setting/clearing/inverting trip bounds and any accommodation operation preserve every inter-hub
segment byte-for-byte.

---

## 10. Presentation contract

The successor may add one subsection inside the existing planning dialog:

**Traslados entre ciudades**

No new top-level page/wizard/modal is required.

It may:

- show the anchor pair by place names;
- show `fromHub → toHub`;
- show user-selected mode;
- show manually entered minutes;
- state whether it currently applies and where: route-only, same day, or between two consecutive
  days;
- explain inactivity neutrally;
- add/edit/delete a segment.

### 10.1 Copy boundaries

Approved examples:

- "Tokio → Kioto"
- "Shinkansen"
- "140 min registrados manualmente"
- "Tramo principal entre estos dos puntos de tu plan; no es un tiempo puerta a puerta."
- "Estos lugares ya no son consecutivos en el reparto actual."

Forbidden:

- "Mejor opción"
- "Ruta óptima"
- "Conviene"
- "Más rápido" without a separately-supported complete comparison
- "Llegarás a las..."
- "Toma este tren/vuelo"
- "Reserva ahora"
- invented station, terminal, airport, fare or timetable.

### 10.2 Totals

The segment may be displayed as its own duration fact.

It must not be silently merged into intra-day transfer totals, accommodation commute totals or
visit-time totals.

A later phase may design a trip-level composition; 3D-Y does not invent one.

---

## 11. Why this is not `TransferMode`

Adding `shinkansen` or `domestic-flight` to current `TransferMode` is rejected.

`TransferEdge` means a recorded directed relation between tourism places, with distance,
confidence, provenance and a lookup key over those place ids.

The proposed segment means:

- a user-authored major travel decision;
- positioned between two plan items;
- with tourism-place ids used only as plan anchors;
- no geometric distance;
- no routing-provider evidence;
- no access/egress model;
- no claim that the anchor places are stations/airports.

Conflating them would make existing consumers interpret a fundamentally different object as a
normal place-to-place transfer.

---

## 12. Automatic candidate generation remains deferred

No candidate generator in 3D-X or 3D-Y:

- no permutation enumeration;
- TSP;
- shortest path;
- nearest-neighbour;
- greedy route;
- clustering optimiser;
- auto day split/count;
- "optimise" button;
- generated recommended itinerary.

Reopening requires a separate audit that answers at least:

1. What objective is optimized — transport time, completeness, hotel commute, visit time,
   reservation constraints, or a defined multi-objective rule?
2. How are unknown edges treated without making missing data a penalty or free edge?
3. How are inter-hub segments evidenced strongly enough for comparison?
4. How are incomplete candidates prevented from losing merely because they contain unknowns?
5. How are activity duration, trip bounds and accommodation boundaries incorporated so transport is
   not optimized in isolation?
6. What UI claim is justified: generated alternative, local improvement, or global optimum?
7. What computational bound prevents factorial search from becoming a hidden scalability problem?

Until then, explicit user order remains authoritative.

---

## 13. Test contract for Phase 3D-Y

### Migration/parser

1. V6→V7 adds `interHubSegments: []` only.
2. V1–V6 historical migration still reaches V7.
3. Valid segment parses verbatim.
4. Invalid mode rejects whole V7 draft.
5. Invalid minutes reject.
6. Empty ids/hubs reject.
7. same anchor id rejects.
8. same stored hub rejects.
9. duplicate segment id rejects.
10. duplicate directional anchor-pair key rejects.
11. shape-valid but currently non-adjacent segment parses and assesses inactive.

### Route-only assessment

12. Adjacent route pair with matching different hubs → active/route-only.
13. Reverse order does not activate.
14. missing from/to place → inactive.
15. non-adjacent route pair → inactive.
16. hub snapshot mismatch → inactive.
17. same current hub → inactive.

### Day assessment

18. Adjacent pair inside same day → active/same-day.
19. non-adjacent pair in same day → inactive.
20. last of Day N → first of Day N+1 → active/between-consecutive-days.
21. pair across Day N → Day N+2 with empty/intervening day → inactive.
22. cross-day pair that is not last→first → inactive.
23. invalid partition → inactive, no route-order fallback.
24. same-day Tokio→Kioto is representable and active when those places are adjacent.
25. assessment is pure.

### Edits/identity

26. route reorder can deactivate/reactivate without rewriting segment.
27. place reorder inside day can deactivate/reactivate without rewriting.
28. moving a place between days can change placement kind without rewriting if the exact anchor
    relationship still qualifies.
29. day reorder can deactivate/reactivate cross-day pair without rewriting.
30. empty day insertion breaks cross-day adjacency.
31. deleting unrelated empty day preserves segment.
32. removing an anchor place prunes only segments that reference it.
33. re-adding that place never resurrects the old segment automatically.
34. bounds changes preserve segments byte-for-byte.
35. accommodation changes preserve segments byte-for-byte.
36. editing a segment changes only mode/minutes.

### Isolation

37. `getBestTransfer()` unchanged.
38. `TransferMode` unchanged.
39. `ordered-sequence.ts` never treats a manual inter-hub segment as `transfer`.
40. `sequence-comparison.ts` winner semantics unchanged.
41. `day-assignment.ts` never inserts inter-hub segment into an intra-day `OrderedSequence`.
42. accommodation semantics unchanged.
43. trip-bounds semantics unchanged.

### Persistence/UI/browser

44. write→reload preserves id, anchor ids, hub snapshots, mode and minutes.
45. storage key unchanged.
46. no second inter-hub key.
47. UI only creates from an eligible current anchor pair.
48. UI never infers mode/minutes.
49. inactive segment remains visible with neutral reason.
50. no copy claims optimisation/timetable/price/booking/arrival time/door-to-door coverage.
51. real-browser QA: route-only active, same-day active, cross-day active, reorder inactive,
    reorder-back active, empty-day separation inactive, reload preserved.
52. console errors 0; page errors 0.

---

## 14. Non-goals

Neither 3D-X nor recommended 3D-Y includes:

- dataset/workbook changes;
- current Shinkansen or airline schedules;
- fares/price comparison;
- ticket classes;
- seat reservations;
- JR Pass evaluation;
- IC cards;
- live inventory;
- booking integration;
- airports/station ids;
- station/airport access legs;
- luggage/takkyubin/lockers/oversized-baggage;
- check-in/check-out;
- arrival/departure clock times;
- timezone/absolute instants;
- automatic travel-day insertion;
- automatic day creation/removal;
- automatic place moves;
- candidate generation;
- itinerary recommendation;
- optimisation;
- live transit activation;
- ORS calls;
- a new npm dependency.

---

## 15. Roadmap implications

The old "Hotel-origin/return modelling — runtime not started" text is stale: Phase 3D-Q already
implemented manual accommodation commute legs and the canonical persisted accommodation model.

Automatic candidate generation remains unscheduled, but its blocker is now concrete: before any
candidate-order design can make a useful travel claim, the planner needs a truthful inter-hub
transport boundary and a later multi-objective audit. Sparse local edge coverage alone is not an
optimisation substrate.

---

## 16. Acceptance gate for Phase 3D-X

Review must agree that:

1. inter-hub transport is a distinct domain object, not a new `TransferEdge` mode;
2. place ids are plan-position anchors, not claimed transport terminals;
3. the model supports both same-day and cross-day inter-hub movement;
4. stored hub snapshots prevent silent semantic rebinding;
5. applicability is derived and may become inactive without corrupting persistence;
6. mode/minutes are explicit user input only;
7. no arrival time, timetable, fare, terminal, door-to-door or optimisation claim is implied;
8. V6→V7 adds an empty segment list and invents nothing;
9. automatic candidate generation remains deferred;
10. Phase 3D-Y, if started, implements exactly this narrow runtime.

---

## 17. Conclusion

The planner now knows when the trip starts and ends, and it preserves stable days and accommodation
boundaries. Its largest remaining logistics blind spot is movement between different city hubs.

The data proves that blind spot cannot be solved by pretending the nearby graph is a route network:
403 directed relations across 214 places cover only 0.88% of all possible directed pairs, and every
one is intra-hub.

The safe next increment is explicit rather than inferred:

> let the user record the major inter-hub segment they actually intend, place it between the two
> consecutive itinerary items it belongs between, keep mode and duration visibly manual, and
> deactivate rather than silently reinterpret it when the plan changes.

Using place anchors rather than day-pair anchors is essential: a real Tokio→Kioto move can occur
inside one day, and the model must not force the user to falsify the calendar to record it.

**Approved design direction:** manual, provenance-explicit, place-anchor-positioned inter-hub
segments.

**Recommended successor: Phase 3D-Y — Manual Inter-Hub Segment Runtime. NOT STARTED.**
