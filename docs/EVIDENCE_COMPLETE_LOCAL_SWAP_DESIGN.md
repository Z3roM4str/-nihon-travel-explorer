# Phase 3E-B — Evidence-Complete Local Swap Design Gate

Status: **design/audit only**  
Base audited: `b27a6422b4374ee1c6bb3b7dbc451963fe74cfe5` (`main` after Phase 3E-A)  
Recommended successor if accepted: **Phase 3E-C — Evidence-Complete Local Swap Runtime**

---

## 1. Decision

Nihon is still **not approved to auto-sort, optimise, rank a whole itinerary, or choose a day split**.

Phase 3E-A now makes the current trip legible as a whole without collapsing unknown evidence into
zero. That enables one deliberately narrow next step:

> derive one-step local alternatives by swapping exactly two adjacent **interior** places inside one
> maximal same-hub block of one existing day, and surface only alternatives whose local registered
> transfer range is provably lower than the current block using complete directed evidence.

This is a **local alternative generator**, not a route optimiser.

It changes nothing automatically.

No runtime is implemented in this gate.

---

## 2. Why this frontier is now justified

The current app already guarantees:

- explicit user-defined day membership and order;
- stable day identity;
- exact directed `TransferEdge` lookup with no reverse/chaining fallback;
- conservative two-order comparison in `sequence-comparison.ts`;
- manual accommodation boundary evidence;
- manual inter-hub evidence attached to exact current plan positions;
- trip-bounds annotation without repair/filtering;
- whole-trip composition with explicit known/missing coverage.

That is enough to prove a very local proposition:

> "For these same places, inside this same local block, this one adjacent swap has a complete
> registered transfer range whose worst case is below the current block's best case."

It is **not** enough to prove:

- the whole day is better;
- the whole trip is better;
- the route is optimal;
- the user should choose this order;
- the schedule still fits;
- a hotel/airport/rail-station journey is improved.

The feature must keep those claim strengths separate.

---

## 3. Real-data utility audit

The design was checked against the current recorded local graph on
`b27a6422b4374ee1c6bb3b7dbc451963fe74cfe5`.

Current dataset:

- 214 places;
- 403 directed `nearby.json` relations.

For a four-place local window:

`L → A → B → R`

an adjacent interior swap:

`L → B → A → R`

requires all six directed edges below to exist if both orders are to be fully evidenced:

- `L → A`
- `A → B`
- `B → R`
- `L → B`
- `B → A`
- `A → R`

The current dataset contains **348 ordered four-place evidence-complete swap patterns**:

- Osaka: 114
- Kioto: 98
- Tokio: 94
- Okinawa: 42

This does not mean 348 user-visible improvements exist: range comparison can still be equivalent,
overlapping, or favour the current order.

It does prove that the evidence substrate is not too sparse for this specific one-step feature.

No dataset expansion is approved by this gate.

---

## 4. Core scope

The first runtime may generate alternatives only when all of the following stay fixed:

- day count;
- day identity;
- day membership;
- hub membership;
- maximal same-hub block boundaries;
- first place of the block;
- last place of the block;
- first/last place of the day;
- accommodation boundary choices;
- manual accommodation legs;
- every manual inter-hub segment object;
- every inter-hub applicability result;
- trip bounds;
- visit start times;
- visit durations;
- reservation/hours/closure facts;
- `routeIds`;
- planning-draft schema/version.

Only two adjacent **interior** place ids exchange ordinal positions inside one day entity.

---

## 5. Maximal same-hub block

A **same-hub block** is one maximal contiguous run inside a day where all places resolve to the
same current `Place.hub`.

Example:

```text
Día 1:
A(Tokio), B(Tokio), C(Tokio), D(Tokio), E(Kioto), F(Kioto)
```

blocks:

```text
[A, B, C, D] Tokio
[E, F]       Kioto
```

The generator never merges two blocks.

It never flattens across:

- a hub boundary;
- a day boundary;
- an empty day.

Every block endpoint is **locked**.

Reason:

- a block endpoint may participate in a same-day inter-hub boundary;
- a day endpoint may own a manual accommodation leg;
- a day endpoint may participate in a between-days inter-hub segment;
- preserving endpoints makes all evidence outside the block structurally unchanged.

---

## 6. Candidate shape

For a block:

```text
[P0, P1, P2, ... Pn]
```

only indices:

```text
1 ... n-1
```

are interior.

One candidate swaps exactly one adjacent pair:

```text
Pi ↔ P(i+1)
```

where both are interior.

Therefore a block needs at least four places to have one legal candidate.

Example:

```text
[A, B, C, D]
```

legal candidate:

```text
[A, C, B, D]
```

illegal in this phase:

```text
[B, A, C, D] // moves block/day start
[A, B, D, C] // moves block/day end
[D, C, B, A] // multi-place reorder
```

No permutation search.

No nearest-neighbour loop.

No recursive improvement loop.

No TSP.

---

## 7. Why adjacent-swap only

Adjacent-swap generation has bounded, auditable semantics.

For a day with `N` places, the number of adjacent candidate positions is linear.

The runtime never explores factorial permutations.

A user may manually apply one accepted swap and then let Nihon recompute fresh alternatives from
the new current plan.

The app itself must not:

1. apply a first candidate;
2. automatically generate the next;
3. continue until no improvement remains.

That would become an optimisation/search algorithm and requires a different gate.

---

## 8. Structural availability

The generator requires:

- a non-null day assignment;
- a structurally valid day partition;
- every current `routeId` to resolve to a `Place`.

Suggested top-level refusal reasons:

```ts
type LocalSwapGenerationUnavailableReason =
  | "no-day-assignment"
  | "invalid-day-partition"
  | "unresolved-route-place";
```

No route-only fallback.

No silent filtering of unresolved places.

Bounds do not block generation.

A day assessed `after-trip-end` remains an existing user-authored day and may still have local
alternatives; its existing warning remains separate.

---

## 9. Temporal lock

Phase 3D-L persists optional manual visit start times per place.

A candidate must **not move a place that currently has a non-empty persisted visit start time**.

For a proposed adjacent swap `A ↔ B`:

- if `visitStartTimes[A]` exists → reject candidate;
- if `visitStartTimes[B]` exists → reject candidate.

Untimed places may swap around a timed place only when the timed place itself remains at the same
ordinal position.

This preserves every manual clock anchor exactly.

The runtime must not:

- move a time with a place to a new semantic slot;
- recalculate a time;
- derive arrival times;
- judge schedule feasibility;
- treat an un-timed place as unconstrained in a broader optimisation sense.

UI copy must still disclose that local transfer improvement is **not a schedule-feasibility claim**.

---

## 10. Baseline evidence gate

For each maximal same-hub block, build the current exact block sequence through the existing
directed lookup semantics.

The block is comparison-eligible only when:

- it has at least four places;
- its current ordered sequence is `complete === true`;
- its `transferMinutes` is non-null.

If the baseline block contains any unknown local edge:

- generate no improvement claim for that block.

Reason:

a partial current subtotal cannot be used as the loser/winner baseline of a proven comparison.

Unknown is not zero.

Unknown is not infinity.

---

## 11. Candidate evidence gate

For each legal interior adjacent swap:

1. clone the block;
2. swap exactly those two ids;
3. build the candidate block through the same exact directed lookup;
4. require the candidate sequence to be complete.

If any candidate edge is missing:

- discard that candidate from the provable-improvement set.

No reverse lookup.
No chain.
No haversine.
No ORS.
No network call.
No synthetic estimate.

---

## 12. Comparison semantics

The runtime must reuse the existing conservative comparison rule from
`sequence-comparison.ts`.

For baseline A and generated candidate B:

```ts
sequenceComparisonFromLookup(baselineIds, candidateIds, lookup)
```

A generated alternative is eligible for user presentation only when:

```ts
outcome === "b-clearly-faster"
```

which already means:

```text
candidate.maxMinutes < baseline.minMinutes
```

and both sequences are complete.

The candidate may expose:

- baseline registered local-transfer range;
- candidate registered local-transfer range;
- `guaranteedAdvantageMinutes`;
- optional existing possible-advantage range.

The runtime must not redefine comparison arithmetic.

---

## 13. Equivalent, overlapping and losing candidates

Candidates whose comparison result is:

- `equivalent`;
- `overlapping`;
- `a-clearly-faster`;
- `incomplete`;
- `invalid`

are **not** surfaced as improvement alternatives.

This does not mean those orders are bad or impossible.

It means current recorded evidence does not prove the narrow proposition approved here.

Suggested neutral empty-state copy:

> No hay un intercambio local con mejora demostrable usando todos los traslados registrados
> necesarios para esta comparación.

Forbidden empty-state copy:

- "El orden actual es el mejor."
- "Ya está optimizado."
- "No existe una ruta más rápida."

---

## 14. Multiple proved alternatives

If more than one adjacent swap is proven:

- return every proved alternative;
- preserve deterministic day/block/swap-position order;
- do **not** sort by minutes saved;
- do **not** label one "recommended";
- do **not** identify a winner among the generated alternatives.

Each alternative is compared only with the **current baseline**.

The app does not create a tournament or ranking among generated candidates.

This avoids silently turning Phase 3C-B's pairwise conservative relation into a multi-candidate
ranking algorithm.

---

## 15. Candidate identity

Candidates are derived and ephemeral.

No random id is required.

Suggested shape:

```ts
type EvidenceCompleteLocalSwapAlternative = {
  dayId: string;
  dayOrdinal: number;
  hub: string;

  blockStartPlaceId: string;
  blockEndPlaceId: string;

  leftPlaceId: string;
  rightPlaceId: string;

  baselineDayPlaceIds: readonly string[];
  candidateDayPlaceIds: readonly string[];

  baselineTransferMinutes: MinuteRange;
  candidateTransferMinutes: MinuteRange;

  guaranteedAdvantageMinutes: number;
  possibleAdvantageRange: MinuteRange;
};
```

No candidate is persisted.

No candidate is written to localStorage.

---

## 16. Safe application

Applying an alternative always requires an explicit user action.

Suggested button:

> Aplicar este intercambio

Before mutation, runtime must verify that the candidate is not stale.

At minimum:

- target day id still exists;
- its current `placeIds` exactly equal `baselineDayPlaceIds`;
- the two expected swap places are still adjacent at the expected interior positions;
- both still resolve to the same hub;
- neither currently has a persisted manual visit start time.

If any check fails:

- no mutation;
- recompute alternatives.

Do not apply by stale array index alone.

---

## 17. Mutation contract

A successful application changes exactly:

```text
day.placeIds
```

for one existing day entity.

It preserves byte-for-byte where structurally possible:

- day id;
- day accommodation boundary object;
- all other day entities;
- `routeIds`;
- `startDate`;
- `endDate`;
- `visitStartTimes`;
- accommodations;
- accommodation legs;
- inter-hub segment objects.

No schema migration.

Planning draft remains V7.

The existing canonical storage key remains:

`nihon.manualPlanningDraft`

---

## 18. Inter-hub invariant

Because:

- swaps are same-hub only;
- maximal block endpoints are locked;
- day endpoints are locked;

every cross-hub adjacency stays exactly where it was.

Therefore every stored manual inter-hub segment must have the **same assessment before and after**
a successful local swap:

- same active/inactive kind;
- same placement;
- same inactive reason where applicable;
- same from/to day ordinals where applicable.

The future runtime test suite must assert this for **all stored segments**, not just active ones.

If a proposed implementation cannot prove this invariant, the candidate must not be generated.

---

## 19. Accommodation invariant

Because first/last place of every day is unchanged:

- each accommodation boundary still references the same endpoint;
- every manual accommodation leg lookup result is unchanged;
- every per-day accommodation subtotal is unchanged;
- whole-trip accommodation composition is unchanged.

This is true even when a boundary is:

- unselected;
- explicit no-accommodation;
- manual-leg-missing;
- manual-leg.

The generator never improves or evaluates hotel routing.

---

## 20. Whole-trip composition invariant

Applying a valid local swap may change only the local movement evidence inside the target block.

For the Phase 3E-A composition:

### Allowed to change

- local movement component order inside the affected block;
- local registered movement range;
- whole-trip `movement.registeredMinutes`;
- whole-trip `registeredTransportMinutes`;
- local known/missing counts only if the implementation violated candidate eligibility — therefore
  under a valid candidate those counts must actually remain complete for that block.

### Must not change

- visit composition;
- accommodation composition;
- inter-hub summary/segment assessments;
- bounds composition;
- day count;
- place membership.

Because both baseline and candidate block are complete, the local block range delta is evidenced.

The UI may state the candidate's local registered transfer range is guaranteed lower.

It must not state the **whole real trip** is guaranteed faster.

---

## 21. Visit-duration invariant

The same places stay in the same day.

No visit duration changes.

The generator does not use visit duration as a score.

A candidate can be proven to reduce recorded local transfer while having places with:

- numeric duration;
- day-scale commitment;
- unclassified duration.

Those duration classes do not affect the narrow transfer comparison.

The UI must not infer that a lower local transfer range makes the day "fit better".

---

## 22. Closures, hours, reservations and date signals

Because membership and date remain unchanged, existing place/date signals stay attached to the same
place/day.

However the app still has no schedule solver.

Therefore generated alternatives do **not** claim compatibility with:

- opening hours;
- closures;
- reservation windows;
- best-time text;
- visit-duration fit against a future chained arrival;
- real arrival/departure time.

No signal becomes a numeric penalty.

No "transport improvement minus closure penalty" score exists.

---

## 23. Bounds

Trip bounds remain annotation only.

A local swap:

- does not add/remove a day;
- does not change day ordinal;
- does not change `startDate` or `endDate`;
- does not repair an inverted range;
- does not filter a day after the trip end.

A candidate may be generated on an after-end day because that bucket still exists in the user's
current plan.

The existing after-end warning remains visible.

---

## 24. Approved claim strength

Approved candidate claim:

> Este intercambio reduce de forma demostrable el traslado local registrado de este bloque según
> las relaciones disponibles.

Approved evidence detail:

> Reducción garantizada del traslado local registrado: 4 min.

Required qualification nearby:

> No evalúa horarios, reservas, alojamiento, tiempos puerta a puerta ni el viaje completo.

Not approved:

- "Mejor orden"
- "Ruta recomendada"
- "Orden óptimo"
- "Día optimizado"
- "Viaje más rápido"
- "Te conviene"
- "Ahorra 4 min en tu viaje"
- "La mejor alternativa"

---

## 25. UI surface

Recommended placement:

inside the existing affected day card, after its current local transfer/visit summary and before or
near accommodation details.

Heading:

**Alternativas locales con evidencia completa**

Each item should show:

- the two places that would be exchanged;
- current block local-transfer range;
- candidate block local-transfer range;
- guaranteed registered local-transfer reduction;
- explicit local-only qualification;
- explicit Apply button.

No modal.
No new page.
No wizard.
No automatic application.

If no proved candidate exists, the section may be omitted or render one neutral sentence.

---

## 26. No automatic chain after Apply

After user application:

1. persist the ordinary day-order mutation;
2. recompute the current plan;
3. recompute fresh local alternatives.

Do not automatically apply another candidate.

Do not keep an "optimisation session".

Do not maintain an accumulated savings score.

The user remains the decision-maker after every individual local change.

---

## 27. Persistence

No schema change.

No V8.

No new storage key.

Do not persist:

- candidate list;
- candidate outcome;
- advantage;
- evaluated block;
- "optimised" marker;
- rank;
- score.

All alternatives derive from:

- current V7 draft;
- current Places;
- current directed transfer lookup.

---

## 28. Domain module

Suggested successor module:

`app/src/lib/evidence-complete-local-swap.ts`

Responsibilities:

- structural availability;
- maximal same-hub block derivation;
- legal interior adjacent swap enumeration;
- manual-time lock;
- baseline/candidate complete-evidence gate;
- reuse of existing sequence comparison;
- deterministic alternative output;
- stale-application validation helper if appropriate.

It must not own:

- persistence;
- transfer parsing;
- transfer lookup semantics;
- inter-hub assessment semantics;
- accommodation logic;
- trip-bounds arithmetic;
- UI state.

Use injected:

- place resolver;
- exact directed transfer lookup.

---

## 29. Complexity

Candidate enumeration is intentionally linear in swap positions, not factorial in place count.

For one block of length `n`:

- at most `n - 3` legal interior adjacent swaps;
- each candidate can be evaluated through the existing ordered-sequence/comparison semantics.

No global graph search.

No shortest path.

No dynamic programming.

No beam search.

No heuristic ordering.

---

## 30. Test contract for Phase 3E-C

### Structural availability

1. no days → unavailable.
2. invalid day partition → unavailable.
3. unresolved route place → unavailable.
4. valid plan → generation available.
5. bounds unavailable/inverted do not block generation.

### Block derivation

6. maximal contiguous same-hub runs derived correctly.
7. no merge across hub boundary.
8. no merge across day boundary.
9. empty day yields no block candidate.
10. block with fewer than four places yields no legal swap.
11. first block place locked.
12. last block place locked.
13. day start stays fixed.
14. day end stays fixed.

### Temporal lock

15. left swapped place with manual start time blocks candidate.
16. right swapped place with manual start time blocks candidate.
17. timed place outside swapped pair keeps position and does not block unrelated swap.
18. no start time is edited or moved.

### Baseline evidence

19. complete baseline block may be evaluated.
20. missing baseline directed edge refuses improvement generation for that block.
21. reverse edge never repairs missing baseline edge.
22. chained path never repairs missing baseline edge.

### Candidate evidence

23. candidate with every exact directed edge may be compared.
24. candidate missing one directed edge is discarded.
25. reverse candidate edge is not reused.
26. geometry/network fallback absent.

### Conservative comparison

27. candidate clearly faster → alternative emitted.
28. equal range → no improvement alternative.
29. overlapping ranges → no improvement alternative.
30. baseline clearly faster → no improvement alternative.
31. incomplete result → no improvement alternative.
32. guaranteed advantage equals existing Phase 3C-B arithmetic.

### Multiple candidates

33. multiple proved swaps all emitted.
34. order is deterministic by day/block/swap position.
35. no ranking by advantage.
36. no "best" field.
37. candidates are compared only against current baseline.

### Application

38. explicit apply swaps exactly two adjacent interior ids.
39. day id preserved.
40. day membership preserved.
41. routeIds unchanged.
42. accommodation boundary object preserved.
43. other days unchanged.
44. stale baseline day array → no-op/refusal.
45. stale non-adjacent pair → no-op/refusal.
46. newly timed swap place → no-op/refusal.

### Inter-hub isolation

47. every stored segment object unchanged.
48. every stored segment assessment unchanged after valid apply.
49. active same-day cross-hub pair unchanged.
50. active between-day pair unchanged.
51. inactive stored segment does not become active through the swap.

### Accommodation isolation

52. outbound boundary result unchanged.
53. return boundary result unchanged.
54. manual accommodation registered minutes unchanged.

### Whole-trip composition

55. visit composition unchanged.
56. accommodation composition unchanged.
57. inter-hub composition unchanged.
58. bounds composition unchanged.
59. registered local movement changes only by candidate evidence delta.
60. registered transport changes by the same evidenced local delta.
61. local missing count does not improve via fabrication.

### Persistence

62. planning draft remains V7.
63. same storage key.
64. no persisted alternatives.
65. no persisted score/rank/advantage.
66. reload derives fresh alternatives from current day order.

### UI/browser

67. section appears only for a day with at least one proved alternative.
68. candidate shows exact swapped place names.
69. current and candidate registered local ranges visible.
70. guaranteed local reduction visible.
71. local-only qualification visible.
72. no best/optimal/recommended/trip-faster claim.
73. Apply requires explicit click.
74. after Apply only expected two place ordinals change.
75. inter-hub UI status unchanged.
76. accommodation endpoint/status unchanged.
77. bounds warning unchanged.
78. place with manual visit time is never offered in a swap.
79. Apply recomputes fresh alternatives; no second automatic apply.
80. console errors = 0.
81. page errors = 0.

---

## 31. Non-goals

Phase 3E-B and its recommended successor do not include:

- whole-day permutation generation;
- cross-hub reorder;
- moving places between days;
- changing day count;
- automatic day distribution;
- routeIds auto-sort;
- nearest-neighbour;
- TSP;
- shortest path;
- repeated hill climbing;
- beam search;
- multi-candidate ranking;
- global route score;
- day-quality score;
- visit-time score;
- closure penalty;
- reservation penalty;
- automatic schedule feasibility;
- automatic hotel routing;
- inter-hub duration inference;
- live transit;
- ORS/network calls;
- timetable lookup;
- fare comparison;
- JR Pass evaluation;
- luggage optimisation;
- booking;
- persistence version change;
- dataset/workbook edits;
- dependency changes.

---

## 32. Acceptance gate for Phase 3E-B

This design is accepted only if review agrees that:

1. automatic global optimisation remains deferred;
2. generated scope is one adjacent interior same-hub swap only;
3. maximal block endpoints remain fixed;
4. day endpoints remain fixed;
5. manual visit-time places are never moved by a candidate;
6. baseline and candidate both require complete exact directed local evidence;
7. Phase 3C-B's conservative comparison arithmetic is reused unchanged;
8. only `b-clearly-faster` candidates are surfaced as improvements;
9. multiple alternatives are not ranked against each other;
10. application is explicit and stale-guarded;
11. day membership, accommodation, inter-hub evidence and bounds remain unchanged;
12. no candidate/score/rank is persisted;
13. UI claim remains local registered-transfer only;
14. runtime uses no new dataset, dependency, API or network provider.

---

## 33. Conclusion

Phase 3E-A closed the evidence-composition prerequisite.

The current graph is still far too sparse for honest global optimisation, but the real dataset now
contains enough dense local clusters to support a smaller proposition with exact evidence.

The correct next move is therefore not "optimise my Japan trip".

It is:

> show the user a small number of one-step, evidence-complete local swaps where recorded directed
> transfer ranges prove a local reduction, while preserving every larger trip decision.

That gives Nihon its first generated alternative without crossing the line into fabricated or
opaque optimisation.

**Approved design direction:** explicit, user-applied, evidence-complete interior adjacent swaps
inside fixed same-hub blocks.

**Recommended successor: Phase 3E-C — Evidence-Complete Local Swap Runtime. NOT STARTED.**
