# Phase 3D-Z — Whole-Trip Composition Design Gate

Status: **design/audit only**
Base audited: `837265ba0cb569ff751bc52d0900f620606489a8` (`main` after Phase 3D-Y)
Recommended successor if this gate is accepted: **Phase 3E-A — Whole-Trip Composition Runtime**

---

## 1. Decision

Nihon is still **not ready for automatic itinerary optimisation**.

Phase 3D-Y closed one major blind spot by letting the user record an explicit inter-hub segment
between two positions in the plan. That does not make hypothetical reordering automatically
comparable:

- an inter-hub segment is attached to the current `fromPlaceId → toPlaceId` position;
- moving either anchor can make it inactive;
- the app cannot invent a replacement Shinkansen/flight/ferry duration for a new hypothetical pair;
- local place-to-place coverage remains sparse;
- accommodation legs, visit duration, trip bounds and reservation/temporal signals remain separate
  domains.

The next safe increment is therefore **composition before optimisation**.

This gate approves a derived, read-only **whole-trip composition** that answers:

> What time and logistics facts are currently recorded for this exact user-authored plan, which
> components are still missing, and which facts must remain separate rather than being collapsed
> into one misleading total?

No route, day, hotel, transport mode or date is changed by this composition.

No runtime is implemented in this gate.

---

## 2. Why composition is the prerequisite

The current planner already owns several valid but intentionally separate facts:

1. **Visit duration**
   - `selection.ts` can sum only quantified place-duration ranges.
   - day-scale commitments and unclassifiable durations remain explicitly non-quantified.

2. **Intra-day place transfers**
   - `day-assignment.ts` builds directed consecutive pairs inside each day only.
   - unknown `TransferEdge` legs remain unknown and never contribute zero minutes.

3. **Accommodation boundary legs**
   - `accommodation-commute.ts` can resolve exact user-entered accommodation→place and
     place→accommodation minutes.
   - unselected, missing and explicit no-accommodation states remain distinct.

4. **Inter-hub segments**
   - Phase 3D-Y stores an exact user-entered duration for a major cross-hub plan boundary.
   - applicability is derived and can become inactive after edits.

5. **Trip bounds**
   - Phase 3D-W derives the inclusive calendar-day range and which day buckets fall after the
     user-entered end date.
   - it does not repair the plan.

These facts can now be presented together, but they cannot be collapsed carelessly.

The product needs an evidence-preserving composition layer before any future candidate generator can
claim that one itinerary is globally better than another.

---

## 3. Current data still does not support a global optimiser

Phase 3D-X measured:

- 214 places;
- 403 directed nearby relations;
- 45,582 possible directed place pairs;
- 0.88% global recorded directed-pair coverage;
- zero recorded inter-hub `TransferEdge` relations.

Phase 3D-Y did **not** turn that graph into a transport network.

It added explicit manual facts for the user's current inter-hub positions.

That is valuable for describing the current plan, but it cannot be reused automatically for a
different hypothetical anchor pair.

Therefore 3D-Z explicitly refuses:

- TSP;
- shortest path;
- nearest-neighbour;
- route score;
- automatic day distribution;
- automatic candidate ranking;
- "best order";
- "best split";
- "optimized itinerary".

---

## 4. Required plan state

Whole-trip composition requires a **valid day assignment**.

If `days === null`, result:

```ts
{ kind: "unavailable"; reason: "no-day-assignment" }
```

If the current day matrix does not validly partition `routeIds`, result:

```ts
{ kind: "unavailable"; reason: "invalid-day-partition" }
```

Before any composition is built, every `routeId` must also resolve to exactly one current `Place`.
If any route id cannot be resolved, result:

```ts
{ kind: "unavailable"; reason: "unresolved-route-place" }
```

The successor must not imitate the current presentation convenience of filtering unresolved ids out
of a `Place[]`: whole-trip arithmetic cannot silently turn a missing place into a shorter trip.

There is deliberately no route-only whole-trip fallback.

Reason:

- accommodation choices are day-bound;
- trip-bound assessment is ordinal-day-bound;
- cross-day inter-hub semantics depend on day boundaries;
- flattening the route would erase the distinction between intra-day movement, overnight boundaries
  and explicit inter-hub transitions.

The route-only inter-hub feature remains valid on its own; it simply is not enough context for a
whole-trip composition.

---

## 5. Composition vocabulary

The successor may add a pure module such as:

`app/src/lib/whole-trip-composition.ts`

Suggested high-level result:

```ts
type WholeTripComposition =
  | {
      kind: "unavailable";
      reason:
        | "no-day-assignment"
        | "invalid-day-partition"
        | "unresolved-route-place";
    }
  | {
      kind: "available";
      dayCount: number;
      visit: WholeTripVisitComposition;
      movement: WholeTripMovementComposition;
      accommodation: WholeTripAccommodationComposition;
      interHub: WholeTripInterHubComposition;
      bounds: WholeTripBoundsComposition;
    };
```

This is derived output only.

No new planning-draft version is approved.

---

## 6. Visit composition

Reuse the existing duration taxonomy.

Suggested shape:

```ts
type WholeTripVisitComposition = {
  quantifiedMinutes: MinuteRange | null;
  quantifiedPlaceCount: number;
  nonQuantifiedPlaceCount: number;
  dayScaleCommitmentCount: number;
  unclassifiedPlaceCount: number;
  completeNumericCoverage: boolean;
};
```

Rules:

- use the same classification/parser semantics as `summarizeSelection`;
- sum quantified minima to minima and maxima to maxima;
- never convert a half-day/full-day/overnight-plus commitment into minutes;
- never invent a numeric duration for an unclassifiable place;
- `completeNumericCoverage === true` only when every route place contributes a numeric duration and
  there are no day-scale or unclassified entries.

The UI may say:

- "Tiempo de visita cuantificado"
- "8 de 10 lugares con duración numérica"

It must not say "tiempo total de visitas" when numeric coverage is incomplete.

---

## 7. Movement adjacency classification

The whole-trip layer must not simply sum each day's existing
`OrderedSequenceSummary.transferMinutes`.

A same-day cross-hub pair with an active manual inter-hub segment is intentionally an unknown
`TransferEdge` pair. Counting the day summary and the inter-hub segment independently would make
coverage look incomplete or could lead to double accounting in a future implementation.

Instead, the composition layer classifies each **actual plan adjacency** by hub relationship.

### 7.1 Same-day adjacency

For each consecutive pair inside one day:

#### Same current hub

Use the existing exact directed `getBestTransfer(fromId, toId)` semantics.

Result:

```ts
type LocalMovementComponent =
  | { kind: "local-transfer"; transfer: TransferEdge }
  | { kind: "local-transfer-missing"; fromPlaceId: string; toPlaceId: string };
```

No reverse lookup.
No chaining.
No geometry fallback.

#### Different current hubs

Do **not** use `TransferEdge` as the composition source for this boundary.

Look for the stored manual inter-hub segment for that exact directional anchor pair and assess it
against the current plan.

Result:

```ts
type InterHubMovementComponent =
  | {
      kind: "inter-hub";
      segmentId: string;
      minutes: number;
      mode: InterHubMode;
      placement: "same-day";
    }
  | {
      kind: "inter-hub-missing";
      fromPlaceId: string;
      toPlaceId: string;
      placement: "same-day";
    };
```

An inactive/missing manual segment is missing evidence, not zero minutes.

### 7.2 Between consecutive days

The ordinary day-assignment contract still breaks `TransferEdge` aggregation at day boundaries.

For Day N → Day N+1:

- no ordinary same-hub place→place transfer is automatically created;
- no "overnight transfer" is inferred;
- accommodation legs remain their own components.

However, when the last place of Day N and first place of Day N+1 are in **different hubs**, this is
an explicit inter-hub evidence slot.

If the exact active `between-consecutive-days` manual segment exists, count it.

Otherwise record an `inter-hub-missing` component.

When both boundary places are in the same hub, no place→place movement component is expected at that
day boundary in this phase.

This is intentional: the user's accommodation boundary choices own that part of the plan.

### 7.3 Empty days

An empty day creates no intra-day adjacency.

An empty day between two non-empty days prevents those two days from becoming an inter-hub boundary
for composition, matching Phase 3D-Y applicability.

No flattening across the empty day.

---

## 8. Movement composition

Suggested output:

```ts
type WholeTripMovementComposition = {
  registeredMinutes: MinuteRange | null;

  localKnownCount: number;
  localMissingCount: number;

  interHubActiveCount: number;
  interHubMissingCount: number;

  modeledAdjacencyCount: number;
  adjacencyCoverageComplete: boolean;
};
```

### 8.1 Registered minutes

`registeredMinutes` sums only:

- known local `TransferEdge.minutes` ranges;
- active manual inter-hub exact minutes as `[minutes, minutes]`.

Unknown/missing components add nothing.

If there are no recorded movement components, return `null`, not zero.

### 8.2 Completeness

`modeledAdjacencyCount` is the number of same-day local/cross-hub slots plus expected
different-hub cross-day slots described by this composition.

`adjacencyCoverageComplete` means:

> every movement slot this composition model expects between planned places has recorded evidence.

The boolean may be vacuously true when `modeledAdjacencyCount === 0`, but the UI must not render a
positive "todos los tramos están cubiertos" statement unless `modeledAdjacencyCount > 0`.

It does **not** mean:

- door-to-door complete;
- every real-world movement is known;
- the trip is optimal;
- no station/airport transfer exists;
- no walking is required;
- no waiting time exists.

This distinction must be explicit in comments and UI copy.

---

## 9. Accommodation composition

Accommodation remains a separate domain.

For every non-empty day and both boundary sides, reuse the existing exact semantics:

- `manual-leg`
- `manual-leg-missing`
- `boundary-unselected`
- `not-applicable`

Suggested shape:

```ts
type WholeTripAccommodationComposition = {
  registeredMinutes: number | null;

  manualLegCount: number;
  manualLegMissingCount: number;
  boundaryUnselectedCount: number;
  explicitNoAccommodationCount: number;
  emptyDayNotApplicableCount: number;
};
```

### 9.1 Registered minutes

Sum only actual `manual-leg` results.

No range is invented because each manual leg is one exact positive integer.

No reverse direction is inferred.

### 9.2 Explicit no-accommodation

`no-accommodation` contributes:

- zero registered minutes;
- one `explicitNoAccommodationCount`.

That zero is **absence of this modelled accommodation component**, not evidence that the user has
zero real-world travel on that side of the day.

Therefore it must not be used to claim whole-trip door-to-door completeness.

### 9.3 No global accommodation-complete flag

Phase 3D-Z deliberately does not define a "whole trip accommodation complete" boolean.

Reasons:

- first/last trip day may begin/end at an airport, station, home or other unmodelled origin;
- explicit no-accommodation does not identify what movement replaces the hotel commute;
- hotel changes can involve other movement not represented by two boundary legs alone.

The existing per-day `completeDoorToDoor` semantics remain unchanged and may still be displayed per
day.

---

## 10. Inter-hub composition

Suggested shape:

```ts
type WholeTripInterHubComposition = {
  activeSegmentIds: string[];
  inactiveSegmentIds: string[];
  missingExpectedCount: number;
  registeredMinutes: number | null;
};
```

Rules:

- only active segments count minutes;
- an inactive stored segment remains visible as inactive evidence and contributes no minutes;
- active ids are unique by existing parser contract;
- no segment is counted twice;
- a stored active segment must correspond to an expected cross-hub slot in the valid day
  composition;
- a segment that is shape-valid but not currently applicable is not silently reassigned.

`registeredMinutes` is informational and may equal the inter-hub portion already included in
`movement.registeredMinutes`.

The UI must avoid presenting those two as two additive independent totals.

---

## 11. Trip-bound composition

Suggested shape:

```ts
type WholeTripBoundsComposition = {
  startDate: string | null;
  endDate: string | null;
  tripCalendarDays: number | null;
  dayCount: number;
  daysAfterTripEnd: number | null;
  unavailableReason:
    | "no-start-date"
    | "no-end-date"
    | "invalid-date"
    | "inverted-range"
    | null;
};
```

This is a projection of the existing Phase 3D-W result.

No new range arithmetic.
No night count.
No recommendation to add/remove a day.

A mismatch is a fact, not a score penalty.

### 11.1 Bounds never filter composition

All user-created day buckets participate in visit/movement/accommodation composition even when one
or more are assessed `after-trip-end`.

Phase 3D-W's invariant remains authoritative: the civil range and the day-bucket plan are two
independent user decisions. A bucket after `endDate` is annotated as such; it is not hidden,
discarded, zeroed or excluded from the whole-trip subtotal.

Likewise, missing/inverted/invalid bounds do not make an otherwise valid day composition
unavailable. The bounds subsection reports its existing neutral unavailable reason while the rest
of the plan remains composed.

---

## 12. Approved trip-level displayed subtotal

The successor may display:

**Traslado registrado en el plan**

as one range/exact subtotal formed from:

```
movement.registeredMinutes
+
accommodation.registeredMinutes
```

where exact accommodation minutes add equally to min/max.

This subtotal is allowed only with the explicit qualification that it includes **registered
components only**.

Suggested copy:

> Traslado registrado: 310–345 min. Faltan 2 tramos locales y 1 tramo entre ciudades por registrar.

It must never be labelled:

- "tiempo total de traslado" when coverage is incomplete;
- "tiempo real";
- "tiempo puerta a puerta";
- "duración del viaje";
- "tiempo óptimo".

When all composition-model movement slots are covered **and `modeledAdjacencyCount > 0`**, the UI
may say:

> Todos los tramos que este resumen modela tienen tiempo registrado.

It still may not say:

> Todo tu transporte del viaje está cubierto.

The model intentionally does not include every real-world access, waiting or terminal process.

---

## 13. No visit + transport grand total

Phase 3D-Z explicitly rejects one combined:

`visit minutes + movement minutes + accommodation minutes`

"total trip time".

Even when arithmetic is possible, such a total would omit or conflate:

- meals;
- queues;
- check-in/check-out;
- station/airport access not manually modelled;
- security/boarding/waiting;
- day-scale visit commitments that have no numeric minutes;
- opening-hour constraints;
- reservation windows;
- sleep;
- unrecorded transfers.

Visit time and transport subtotals stay visually adjacent but semantically separate.

This is a load-bearing prerequisite for future optimisation: a future objective function must decide
explicitly what it is optimizing instead of inheriting an accidental grand total.

---

## 14. Reservation, hours and temporal signals remain constraints, not minutes

The successor does not convert:

- closure warnings;
- recorded hours;
- visit-fit states;
- reservation lead-time windows;
- reservation reference relation;
- Feb–Mar signals

into a numeric score or minute penalty.

These facts may eventually become **hard/soft candidate constraints** in a separately designed
optimisation phase, but 3D-Z only composes time/logistics facts that already have explicit numeric
semantics.

No "bad schedule = +30 minutes" style scoring is allowed.

---

## 15. Persistence

No persistence change.

The composition is recomputed on read from:

- current places;
- `routeIds`;
- valid current day entities;
- accommodation boundaries and manual accommodation legs;
- manual inter-hub segments;
- trip bounds;
- current transfer lookup.

Therefore:

- planning draft remains V7;
- storage key remains `nihon.manualPlanningDraft`;
- no `composition` field;
- no cached totals;
- no second localStorage key;
- no stale score.

---

## 16. Presentation contract

The successor may add one read-only section to the existing planner/day surface:

**Resumen del plan completo**

Suggested groups:

### Visitas

- quantified visit range;
- quantified count / total count;
- non-quantified count;
- day-scale commitments kept separate.

### Traslados registrados

- registered movement range;
- known vs missing local adjacency count;
- active vs missing inter-hub count.

### Alojamiento

- exact registered manual accommodation minutes;
- missing/unselected/not-applicable counts.

### Rango del viaje

- civil date range;
- calendar-day count;
- created-day count;
- after-end count if applicable.

No new top-level page, wizard or modal.

---

## 17. Automatic optimisation remains deferred

After 3D-Z, a future optimisation gate may be reconsidered only if it explicitly handles all of the
following.

### 17.1 Hypothetical inter-hub evidence

A candidate that breaks an existing inter-hub anchor pair loses that manual evidence.

The optimiser must not transfer that duration to a new pair.

A safe future candidate generator may need to constrain itself to moves that preserve every required
manual inter-hub anchor, or require new explicit user evidence.

### 17.2 Accommodation boundaries

A reorder that changes a day's first/last place changes which exact manual accommodation legs apply.

A candidate cannot inherit a hotel commute recorded for a different endpoint.

### 17.3 Unknown local edges

Missing `TransferEdge` evidence is neither zero nor infinity.

A candidate with missing local movement cannot lose merely because another candidate has a known
subtotal.

### 17.4 Visit duration

Day-scale and unclassified visit durations cannot be treated as zero.

### 17.5 Trip bounds

A candidate/day split must not silently create days beyond the end date or repair the user's range.

### 17.6 Temporal/reservation constraints

Any future scorer must specify whether recorded closure/reservation facts are:

- hard exclusion;
- warning only;
- user preference;
- not considered.

No implicit numeric penalty.

### 17.7 Claim strength

The future UI must distinguish:

- generated alternative;
- evidence-complete local improvement;
- ranked candidate set;
- claimed global optimum.

Those are not synonyms.

---

## 18. Recommended optimisation frontier after composition

This gate does **not** approve an optimiser, but it identifies the first plausible future frontier:

> local, evidence-complete reordering inside a fixed day and fixed hub, while preserving day
> membership, accommodation endpoints and every active inter-hub anchor.

Even that narrower feature requires its own design gate.

It must prove:

- the baseline and candidate both have complete required movement evidence;
- accommodation boundary endpoints are unchanged;
- inter-hub anchors are unchanged and remain active;
- no day count/bounds change occurs;
- no non-transport temporal constraint becomes stronger/weaker without disclosure;
- the UI calls it a local alternative, not a globally optimal itinerary.

---

## 19. Test contract for Phase 3E-A

The successor is not complete unless at least the following matrix passes.

### Availability

1. `days === null` → unavailable/no-day-assignment.
2. invalid day partition → unavailable/invalid-day-partition.
3. unresolved route place → unavailable/unresolved-route-place; never silently filtered.
4. valid partition + all places resolved → available.
5. no route-only fallback when days are absent.

### Visit composition

6. quantified ranges add min-to-min/max-to-max.
7. day-scale commitments never become minutes.
8. unclassified duration never becomes zero.
9. numeric coverage false when any route place is non-quantified.
10. numeric coverage true only when every route place is quantified.

### Same-day movement

11. same-hub known directed edge → local-transfer.
12. same-hub missing edge → local-transfer-missing.
13. reverse edge never reused.
14. cross-hub active manual segment → inter-hub exact minutes.
15. cross-hub missing/inactive segment → inter-hub-missing.
16. cross-hub segment is not double-counted as local transfer.

### Day boundaries

17. same-hub Day N→N+1 boundary creates no ordinary place transfer.
18. different-hub boundary + active exact segment → counted once.
19. different-hub boundary without active segment → missing expected inter-hub.
20. empty intervening day prevents cross-day inter-hub application.
21. no flattening across empty day.

### Accommodation

22. manual outbound exact minutes counted once.
23. manual return exact minutes counted once.
24. missing leg adds no minutes and increments missing.
25. unselected adds no minutes and increments unselected.
26. explicit no-accommodation adds no minutes and increments explicit-no-accommodation.
27. empty-day not-applicable kept distinct.
28. no reverse accommodation leg inference.

### Subtotals

29. registered movement subtotal contains known components only.
30. registered accommodation subtotal contains manual legs only.
31. combined registered transport subtotal adds ranges correctly.
32. zero known components → null, never synthetic zero.
33. missing counts remain visible alongside a partial subtotal.
34. modeled adjacency count is explicit.
35. zero modeled adjacencies never render a positive "all tramos covered" claim.
36. no visit+transport grand total exists.

### Inter-hub identity

37. inactive stored segment contributes no minutes.
38. active segment counted once only.
39. stored segment not attached to an expected slot is not silently reassigned.
40. reorder can change composition without mutating segment.

### Bounds

41. existing trip-bound summary projected without changing semantics.
42. after-trip-end remains a count/fact, not a penalty.
43. days after end remain included in all other composition subtotals.
44. inverted/no-end/no-start states remain neutral/unrepaired and do not block other composition.

### Persistence/isolation

45. no planning-draft version change.
46. no new localStorage key.
47. no cached persisted composition.
48. `ordered-sequence.ts` unchanged.
49. `sequence-comparison.ts` unchanged.
50. `TransferMode` unchanged.
51. accommodation domain semantics unchanged.
52. inter-hub parser/assessment semantics unchanged.

### UI/browser

53. one read-only whole-trip section on a valid day plan.
54. unavailable state does not invent a partial whole-trip composition.
55. unresolved route place does not disappear from arithmetic.
56. partial movement coverage copy shows missing counts.
57. complete composition-model adjacency coverage uses qualified copy only and requires at least one
    modeled adjacency for positive complete-coverage copy.
58. visit non-quantified items remain separate.
59. after-end day content remains included while the bounds mismatch stays visible.
60. no forbidden "optimal/best/total real/door-to-door" claim.
61. reload produces the same derived composition from the same draft.
62. editing one manual inter-hub minute updates only derived totals.
63. editing one accommodation leg updates only the applicable derived totals.
64. reordering to make an inter-hub segment inactive removes its minutes and increases missing
    coverage without editing the stored segment.
65. console errors = 0.
66. page errors = 0.

---

## 20. Non-goals

Phase 3D-Z and recommended 3E-A do not include:

- new persisted fields;
- auto-sort;
- automatic day split;
- route optimisation;
- candidate ranking;
- a route score;
- live transit;
- ORS/network calls;
- schedule lookup;
- Shinkansen/flight timetable lookup;
- fares;
- booking;
- terminals/stations/airports;
- waiting/security/boarding estimates;
- JR Pass evaluation;
- luggage/takkyubin;
- hotel search;
- geocoding;
- timezone/instant arithmetic;
- a visit+transport grand total;
- automatic repair of missing logistics;
- dataset/workbook edits;
- new npm dependency.

---

## 21. Acceptance gate for Phase 3D-Z

This gate is accepted only if review agrees that:

1. composition must precede optimisation;
2. valid day assignment is required for whole-trip composition;
3. same-day cross-hub adjacency is owned by active manual inter-hub evidence, not ordinary
   `TransferEdge`;
4. cross-day ordinary place transfer remains absent;
5. cross-day different-hub movement is counted only from an exact active manual inter-hub segment;
6. accommodation remains a separate explicit component;
7. unknown components never contribute zero minutes;
8. a registered transport subtotal may exist while coverage is incomplete, but must be labelled as
   partial/registered;
9. visit time remains separate from transport;
10. temporal/reservation facts are not converted into a numeric score;
11. no persistence change is needed;
12. any later automatic candidate generation still requires a separate design gate.

---

## 22. Conclusion

Nihon now contains the raw ingredients needed to describe more of a real multi-city trip, but those
ingredients deliberately live in separate evidence domains.

The next safe capability is not to ask the app to choose a better itinerary.

It is to make the current itinerary legible as a whole without losing the distinctions that make the
data honest:

- quantified vs non-quantified visit time;
- known vs missing local movement;
- active vs missing inter-hub movement;
- recorded vs missing/unselected accommodation legs;
- day buckets vs civil trip bounds.

Once that composition exists, a future optimisation design can reason explicitly about what it is
allowed to compare.

**Approved design direction:** derived, evidence-preserving whole-trip composition with qualified
registered subtotals and explicit coverage.

**Recommended successor: Phase 3E-A — Whole-Trip Composition Runtime. NOT STARTED.**
