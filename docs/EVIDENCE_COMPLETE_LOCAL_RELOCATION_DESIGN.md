# Phase 3E-D — Evidence-Complete Local Relocation Design Gate

Status: **design/audit only**
Base audited: `e07c523bfe57b65ea47ee5ab74281b4e41c4f476` (`main` after Phase 3E-C)
Recommended successor if accepted: **Phase 3E-E — Evidence-Complete Local Relocation Runtime**

---

## 1. Decision

Nihon is still **not approved for whole-day permutation search, recursive local optimisation, route ranking, or global itinerary optimisation**.

Phase 3E-C proves one-step adjacent interior swaps inside fixed same-hub blocks.

The next safe frontier is broader but still bounded:

> move exactly **one interior place** to a different interior position inside the same maximal same-hub block, while preserving every other place's relative order and keeping the block/day endpoints fixed.

This is a **single local relocation**, not an optimisation session.

No runtime is implemented in this gate.

---

## 2. Why relocation is the next frontier

An adjacent swap can move a place by only one position.

Some locally better orders require one place to move by two or more positions before the recorded transfer range improves.

A relocation can express that in one explicit user action without exploring arbitrary permutations.

Example:

```text
Current:
L → A → B → C → R

Candidate:
L → B → C → A → R
```

Only `A` is relocated.

The relative order of:

```text
B → C
```

is preserved.

This is materially narrower than an arbitrary permutation.

---

## 3. Real-data incremental-value audit

The design was checked against the current graph and the current `getBestTransfer` preference order on
`e07c523bfe57b65ea47ee5ab74281b4e41c4f476`.

Current evidence base:

- 214 places;
- 403 recorded directed nearby relations;
- 24 walking-pilot results;
- 308 walking-scale results;
- `getBestTransfer` prefers a clean validated-static routed edge over the original estimate.

Phase 3E-C's current one-swap opportunity set contains:

- 153 proved adjacent-swap alternatives;
- 109 fully validated-static comparisons;
- 44 mixed validated/estimated comparisons;
- 0 fully-estimated comparisons.

For the new relocation audit:

- 1,616 complete same-hub ordered five-place baselines were found;
- a candidate relocation was considered **incremental** only when:
  - it moved one interior place by at least two positions;
  - it preserved block endpoints;
  - baseline and candidate both had complete exact directed evidence;
  - candidate recorded transfer minutes were strictly below baseline;
  - **no single adjacent swap from that same baseline was already faster**.

Result:

- **24 incremental five-place relocation opportunities**;
- **19/24 fully validated-static**;
- Tokio: 8 opportunities, 7 fully validated;
- Kioto: 4 opportunities, 2 fully validated;
- Osaka: 11 opportunities, 9 fully validated;
- Okinawa: 1 opportunity, 1 fully validated.

Example, fully validated:

```text
Shinjuku Gyoen
→ Kabukicho
→ Tokyo Metropolitan Government Observatory
→ Golden Gai
→ Omoide Yokocho
```

Recorded baseline: 62 min

Move Golden Gai from interior position 3 to interior position 1:

```text
Shinjuku Gyoen
→ Golden Gai
→ Kabukicho
→ Tokyo Metropolitan Government Observatory
→ Omoide Yokocho
```

Recorded candidate: 49 min

No one-step adjacent swap from that baseline provides the same newly-discovered improvement.

This proves incremental product value beyond Phase 3E-C without requiring permutation search.

---

## 4. Candidate scope

A candidate belongs to exactly:

- one existing day;
- one maximal contiguous same-hub block;
- one current baseline order.

It relocates exactly one interior place.

Everything below remains fixed:

- day count;
- day id;
- day membership;
- route membership;
- block hub;
- block first place;
- block last place;
- day first place;
- day last place;
- accommodation choices;
- accommodation legs;
- inter-hub segment objects;
- trip bounds;
- visit durations;
- reservation/hours/closure facts;
- planning-draft schema.

---

## 5. Relocation semantics

For a block:

```text
[P0, P1, P2, ... Pn]
```

only positions:

```text
1 ... n-1
```

are interior.

A relocation is represented by:

```ts
fromIndex
toIndex
```

where both are interior positions in the **final block coordinate system**.

Semantics:

1. remove the place currently at `fromIndex`;
2. insert that same place so it occupies `toIndex` in the resulting block;
3. preserve the relative order of every other place.

Examples:

```text
[L, A, B, C, R]
from 1 → to 3
= [L, B, C, A, R]
```

```text
[L, A, B, C, R]
from 3 → to 1
= [L, C, A, B, R]
```

---

## 6. Adjacent relocations are excluded

If:

```text
abs(fromIndex - toIndex) === 1
```

the resulting order is just the adjacent-swap capability already owned by Phase 3E-C.

Therefore Phase 3E-E must generate only:

```text
abs(fromIndex - toIndex) >= 2
```

This prevents duplicate suggestions and keeps the two domains clear:

- Phase 3E-C: adjacent swap;
- Phase 3E-E: non-adjacent single-place relocation.

`fromIndex === toIndex` is also invalid.

---

## 7. Minimum block length

A four-place block has only two interior positions.

Moving one interior place to the other interior position is equivalent to an adjacent swap.

Therefore the first genuinely new relocation requires a block of at least **five places**.

A block shorter than five yields no Phase 3E-E candidate.

---

## 8. No arbitrary permutation

One candidate may change multiple local edges, but it moves one place only.

It must not:

- swap multiple independent pairs;
- reverse a slice;
- shuffle a set;
- enumerate every permutation;
- choose an arbitrary new order.

The relative order of every place except the relocated place remains unchanged.

This property must be testable directly.

---

## 9. Candidate enumeration complexity

For a block of length `n`:

- interior place count = `n - 2`;
- the **number of candidate relocations** is bounded by `O(n²)`;
- same-position moves are excluded;
- adjacent moves are excluded as Phase 3E-C duplicates.

The gate makes **no claim that total runtime is O(n²)**. A straightforward implementation that
rebuilds/compares a length-`n` block for each candidate can require O(n³) directed-lookups in the
worst case.

That is still deliberately bounded polynomial work over one local block and is qualitatively
different from factorial permutation search.

No factorial search.

No recursion.

No iterative improvement loop.

No candidate generated from another candidate.

Every candidate is derived independently from the current user-authored baseline.

---

## 10. Structural availability

Same structural requirements as Phase 3E-C:

```ts
type LocalRelocationGenerationUnavailableReason =
  | "no-day-assignment"
  | "invalid-day-partition"
  | "unresolved-route-place";
```

Rules:

- `days === null` → unavailable;
- invalid partition → unavailable;
- unresolved route place → unavailable;
- no route-only fallback;
- no repair;
- no silent filtering.

Trip bounds remain independent annotation and never block generation.

---

## 11. Maximal same-hub block reuse

The successor should reuse the same block semantics already approved for Phase 3E-C.

A block is a maximal contiguous same-hub run inside one existing day.

Never cross:

- hub boundary;
- day boundary;
- empty day.

Both block endpoints remain locked.

The successor may reuse/export Phase 3E-C's existing block derivation helper rather than reimplementing equivalent semantics.

No semantic change to existing Phase 3E-C behavior is approved.

---

## 12. Affected temporal window

A relocation changes more than the three edges of an adjacent swap.

For:

```text
[L, A, B, C, D, R]
```

moving `A` from index 1 to index 4 produces:

```text
[L, B, C, D, A, R]
```

The only places whose immediate transfer context can change lie in the contiguous span from:

```text
min(fromIndex, toIndex) - 1
```

through:

```text
max(fromIndex, toIndex) + 1
```

inclusive.

Call this the **affected relocation window**.

---

## 13. Temporal lock

A candidate is not generated if **any place in the affected relocation window** has a non-empty persisted manual `visitStartTime`.

Reason:

- the relocated place changes position;
- its former predecessor/successor can become adjacent;
- its new predecessor/successor change;
- intermediate places may have one changed incoming/outgoing relationship at the moved boundary;
- Nihon has no arrival/departure propagation solver that can prove compatibility with any manual clock anchor touched by those changed edges.

A timed place outside the affected window does not block an unrelated relocation.

No manual time is:

- moved;
- copied;
- recalculated;
- inferred.

---

## 14. Baseline evidence gate

The entire maximal same-hub baseline block must be complete under the existing exact directed lookup.

Require:

```ts
baseline.summary.complete === true
baseline.summary.transferMinutes !== null
```

If any baseline local edge is unknown:

- no relocation improvement claim is generated for that block.

No partial-loser arithmetic.

Unknown is never zero or infinity.

---

## 15. Candidate evidence gate

Each candidate block must also be complete.

If one exact directed edge is missing:

- discard that candidate.

Never repair from:

- reverse edge;
- chained path;
- geometry;
- haversine;
- ORS/live routing;
- sibling relation;
- synthetic minutes.

The successor may call the same existing sequence builder/comparison lookup used by Phase 3E-C.

---

## 16. Comparison semantics

Reuse:

`sequenceComparisonFromLookup`

unchanged.

Baseline = current block.

Candidate = one relocation result.

Surface a candidate only when:

```ts
outcome === "b-clearly-faster"
```

The existing conservative relation therefore requires:

```text
candidate.maxMinutes < baseline.minMinutes
```

No new arithmetic.

---

## 17. Confidence disclosure

As in Phase 3E-C:

- complete coverage is not equivalent to validated evidence;
- carry baseline confidence counts;
- carry candidate confidence counts;
- estimated/mixed comparisons remain visibly estimated/mixed;
- confidence never becomes a numeric rank or penalty.

User-facing claim remains about **recorded ranges**.

---

## 18. Candidate output

Suggested shape:

```ts
type EvidenceCompleteLocalRelocationAlternative = {
  dayId: string;
  dayOrdinal: number;
  hub: string;

  blockStartPlaceId: string;
  blockEndPlaceId: string;

  movedPlaceId: string;
  fromDayIndex: number;
  toDayIndex: number;

  affectedWindowPlaceIds: readonly string[];

  baselineDayPlaceIds: readonly string[];
  candidateDayPlaceIds: readonly string[];

  baselineBlockPlaceIds: readonly string[];
  candidateBlockPlaceIds: readonly string[];

  baselineTransferMinutes: MinuteRange;
  candidateTransferMinutes: MinuteRange;

  guaranteedAdvantageMinutes: number;
  possibleAdvantageRange: MinuteRange;

  baselineConfidenceCounts: ConfidenceCounts;
  candidateConfidenceCounts: ConfidenceCounts;
};
```

Candidate is derived and ephemeral.

No stored id is required.

---

## 19. Deterministic enumeration

Enumerate in deterministic:

1. day order;
2. block order;
3. `fromIndex` ascending;
4. `toIndex` ascending.

Do not sort by:

- advantage;
- duration;
- confidence;
- place popularity.

No rank.

No "best" field.

---

## 20. Duplicate candidate orders

Different relocation operations must not produce duplicate candidate day orders in the returned set.

If two operation descriptors somehow resolve to the same candidate ordering:

- retain the first by deterministic enumeration order;
- drop later duplicates;
- do not rank between equivalent operation descriptions.

Tests must pin uniqueness by candidate order.

---

## 21. Relationship to Phase 3E-C

3E-C remains unchanged.

3E-E does not replace adjacent swaps.

The day UI may compose both sets under the existing broader heading:

**Alternativas locales con evidencia completa**

Recommended subgroups:

- **Intercambios adyacentes**
- **Reubicaciones de un lugar**

A relocation section appears only when a genuinely non-adjacent proved candidate exists.

No candidate should appear in both groups.

---

## 22. Multiple relocation candidates

Return every proved relocation candidate.

Do not choose a winner.

Do not compare candidates against siblings.

Every candidate is compared only against the current baseline.

The UI may show many candidates but must preserve deterministic domain order.

No top-N truncation based on advantage is approved.

---

## 23. Explicit Apply

Applying a relocation requires explicit user action.

Suggested button:

> Aplicar esta reubicación

Nothing happens automatically.

After Apply:

1. persist the one relocation;
2. recompute the current plan;
3. recompute Phase 3E-C swaps;
4. recompute Phase 3E-E relocations.

Do not automatically apply another suggestion.

---

## 24. Stale guard

Immediately before mutation verify at least:

- days still exist;
- target day id still exists;
- current day `placeIds` exactly equal captured `baselineDayPlaceIds`;
- moved place still equals expected id at `fromDayIndex`;
- target final index remains legal and interior;
- block endpoints remain the expected ids;
- every place in the current affected relocation window resolves to the expected hub;
- no affected-window place has acquired a manual visit start time.

If any invariant fails:

- no mutation;
- return stale/refusal;
- let UI regenerate from current state.

Never apply by stale numeric indices alone.

---

## 25. New planning-draft mutation

Phase 3E-E may add one pure identity-aware mutation helper, e.g.:

`withPlaceRelocatedWithinDay(draft, dayId, fromIndex, toIndex)`

and a corresponding hook callback.

That helper must:

- move exactly one place within one identified day;
- preserve all other places' relative order;
- preserve day id;
- preserve accommodation boundary;
- preserve all other days;
- preserve routeIds;
- preserve start/end dates;
- preserve visitStartTimes;
- preserve accommodations;
- preserve accommodation legs;
- preserve interHubSegments;
- remain V7.

It must not be implemented as a series of asynchronous UI clicks/state updates.

One domain mutation should produce one resulting draft.

---

## 26. Inter-hub invariant

Because relocation stays inside one same-hub block and block endpoints are locked:

- cross-hub adjacency does not move;
- day boundaries do not move.

Every stored manual inter-hub segment must therefore retain:

- byte-identical stored object;
- identical assessment kind;
- identical placement;
- identical inactive reason where applicable;
- identical day ordinals where applicable.

Tests must include active and inactive segments.

---

## 27. Accommodation invariant

Day first/last place is unchanged.

Therefore:

- boundary choices remain byte-identical;
- outbound/return assessment stays identical;
- manual accommodation legs stay unchanged;
- registered accommodation minutes stay unchanged.

No hotel routing is evaluated.

---

## 28. Whole-trip composition invariant

A valid relocation may change only local movement inside the target block.

Must remain unchanged:

- visit composition;
- accommodation composition;
- inter-hub composition;
- bounds composition;
- day count;
- place membership;
- trip dates.

May change:

- local movement edge order;
- movement registered range;
- registered transport range;
- confidence mix of local movement.

Because baseline and candidate blocks are complete, no missing local edge is introduced.

The change in whole-trip registered movement/transport must equal the evidenced block delta.

---

## 29. Reservation / hours / closure boundary

No relocation candidate claims schedule feasibility.

The same places remain on the same day/date, but ordering changes.

Without chained clock-time propagation Nihon cannot prove that a relocation is compatible with:

- opening times;
- reservations;
- recorded interval fit;
- best-time text;
- queue patterns;
- real arrival time.

No temporal signal becomes a numeric score.

The temporal-lock rule protects existing manual clock anchors only; it is not a schedule solver.

---

## 30. Approved claim strength

Approved:

> Esta reubicación reduce de forma demostrable el rango de traslado local registrado de este bloque.

Approved evidence detail:

> Ventaja mínima entre los rangos registrados: 13 min.

Required qualification:

> No evalúa horarios, reservas, alojamiento, puerta a puerta ni el viaje completo.

Not approved:

- "Mejor orden"
- "Ruta óptima"
- "Día optimizado"
- "Te recomendamos mover..."
- "Ahorra 13 min en tu viaje"
- "Esta es la mejor alternativa"

---

## 31. UI contract

Use the existing day-card local-alternatives surface.

For each relocation show:

- moved place;
- current interior position;
- new interior position, preferably explained through neighboring place names rather than raw number alone;
- baseline registered block range;
- candidate registered block range;
- minimum recorded-range gap;
- baseline/candidate confidence quality;
- local-only qualification;
- explicit Apply.

Suggested natural copy:

> Mover Golden Gai antes de Kabukicho.

Avoid exposing implementation-only indices as the primary user message.

---

## 32. Empty state

Do not add a second reassuring empty message.

If adjacent swaps and relocations are both absent, the current neutral Phase 3E-C empty statement remains sufficient:

> No hay un intercambio local con mejora demostrable usando todos los traslados registrados necesarios para esta comparación.

The successor may generalize that wording to:

> No hay una alternativa local con mejora demostrable usando todos los traslados registrados necesarios para esta comparación.

If changed, tests must ensure it still makes no optimum claim.

---

## 33. Persistence

No schema change.

No V8.

Same key:

`nihon.manualPlanningDraft`

Never persist:

- relocation candidate;
- from/to index;
- advantage;
- confidence counts;
- candidate history;
- score;
- rank;
- optimisation state.

Only the applied resulting day order persists through the existing V7 draft.

---

## 34. Test contract for Phase 3E-E

### Structural availability

1. no days → unavailable.
2. invalid partition → unavailable.
3. unresolved route place → unavailable.
4. valid plan → available.
5. bounds unavailable/inverted do not block.

### Block and relocation enumeration

6. maximal same-hub block semantics equal Phase 3E-C.
7. no cross-hub candidate.
8. no cross-day candidate.
9. empty day produces none.
10. block length < 5 produces no relocation.
11. endpoints remain fixed.
12. from index is interior.
13. to index is final interior position.
14. same-position move excluded.
15. adjacent move excluded.
16. non-adjacent single-place move generated.
17. all non-moved places preserve relative order.
18. no duplicate candidate order.
19. deterministic day/block/from/to order.
20. candidate count grows quadratically, not factorially.
21. implementation/test comments do not misstate total runtime as O(n²); a naïve evaluator may be O(n³) in lookups.

### Temporal affected window

22. affected window computed as min(from,to)-1 through max(from,to)+1.
23. manual time on left boundary of affected window blocks.
24. manual time on moved place blocks.
25. manual time on an intermediate affected place blocks.
26. manual time on right boundary blocks.
27. timed place outside affected window does not block.
28. no time is edited/moved.

### Evidence

29. complete baseline required.
30. missing baseline edge blocks block.
31. reverse/chaining do not repair baseline.
32. complete candidate required.
33. missing candidate edge discards candidate.
34. no geometry/network fallback.

### Comparison and confidence

35. b-clearly-faster emitted.
36. equivalent rejected.
37. overlapping rejected.
38. baseline-faster rejected.
39. incomplete rejected.
40. Phase 3C-B advantage arithmetic reused.
41. confidence tallies preserved.
42. estimated evidence remains labelled.
43. no confidence score/rank.

### Incremental separation from 3E-C

44. adjacent relocation never emitted by 3E-E.
45. one candidate order never appears in both swap and relocation sets.
46. real five-place fixture demonstrates a relocation not found by one adjacent swap.

### Apply / stale safety

47. Apply explicit.
48. exactly one place relocated.
49. non-moved relative order preserved.
50. day id unchanged.
51. day membership unchanged.
52. routeIds unchanged.
53. accommodation boundary unchanged.
54. other days unchanged.
55. stale baseline rejected.
56. moved identity mismatch rejected.
57. illegal target index rejected.
58. changed block endpoint/hub rejected.
59. newly timed affected-window place rejected.

### New V7 mutation helper

60. one pure mutation produces final order directly.
61. no intermediate persisted orders.
62. V7 unchanged.
63. all non-day fields structurally preserved.
64. no async multi-click implementation required.

### Inter-hub

65. all segment objects unchanged.
66. all assessments unchanged.
67. active same-day unchanged.
68. active between-day unchanged.
69. inactive reasons unchanged.

### Accommodation

70. boundary results unchanged.
71. accommodation registered minutes unchanged.

### Whole-trip composition

72. visit unchanged.
73. accommodation unchanged.
74. inter-hub unchanged.
75. bounds unchanged.
76. local registered movement changes by exact candidate delta.
77. registered transport changes by same exact delta.
78. no local missing edge introduced.

### Persistence

79. V7 remains.
80. same storage key.
81. candidate not persisted.
82. advantage/rank/score not persisted.
83. reload keeps applied day order.
84. reload regenerates fresh swap + relocation alternatives.

### UI/browser

85. existing local-alternative surface contains distinct relocation subgroup when applicable.
86. relocation candidate names moved place.
87. destination described naturally.
88. baseline/candidate ranges visible.
89. minimum recorded-range gap visible.
90. confidence visible.
91. local-only disclaimer visible.
92. no best/optimal/recommended/trip-faster claim.
93. explicit Apply.
94. Apply changes exactly expected day order.
95. adjacent-swap group remains functional.
96. inter-hub status unchanged.
97. accommodation status unchanged.
98. bounds warning unchanged.
99. manual time inside affected relocation window suppresses candidate.
100. no automatic follow-up apply.
101. reload derives fresh alternatives.
102. console errors = 0.
103. page errors = 0.

---

## 35. Non-goals

Not approved:

- arbitrary permutation generation;
- whole-block exhaustive permutation;
- whole-day reorder;
- moving places between days;
- changing day count;
- endpoint movement;
- cross-hub relocation;
- automatic repeated relocation;
- repeated hill climbing;
- automatic application of adjacent swap followed by relocation;
- global route score;
- ranking candidates by savings;
- shortest path;
- TSP;
- beam search;
- dynamic programming;
- live transit;
- ORS/runtime network call;
- hotel routing;
- schedule solver;
- reservation solver;
- dataset/workbook edits;
- dependency changes;
- schema migration.

---

## 36. Acceptance gate for Phase 3E-D

Accept only if review agrees that:

1. the feature is one non-adjacent single-place relocation only;
2. endpoints stay fixed;
3. all other places preserve relative order;
4. adjacent moves remain owned by 3E-C;
5. enumeration is quadratic and baseline-derived only;
6. affected temporal window is conservatively locked;
7. baseline and candidate both require complete exact directed evidence;
8. only b-clearly-faster is surfaced;
9. confidence remains disclosure, not score;
10. candidates are unranked;
11. Apply is explicit and stale-guarded;
12. one new pure V7-preserving relocation mutation is allowed;
13. inter-hub/accommodation/bounds invariants remain unchanged;
14. no candidate state is persisted;
15. global optimisation remains deferred.

---

## 37. Conclusion

Phase 3E-C proved that Nihon can generate a local alternative without turning unknown evidence into a score or silently changing larger trip decisions.

The next useful step is not arbitrary permutation.

It is a single-place relocation that can discover improvements a one-position swap cannot.

Real data demonstrates that this is not hypothetical:

- 24 incremental five-place opportunities;
- 19 fully validated-static;
- several with materially larger recorded-range reductions than adjacent swaps.

**Approved design direction:** evidence-complete, non-adjacent, one-place relocation inside a fixed same-hub block.

**Recommended successor: Phase 3E-E — Evidence-Complete Local Relocation Runtime. NOT STARTED.**
