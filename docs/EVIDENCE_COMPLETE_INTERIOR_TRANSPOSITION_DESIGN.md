# Phase 3E-F — Evidence-Complete Interior Transposition Design Gate

Status: **design/audit only**  
Base audited: `fdf1369ad431a38dd15b7c858eaf8a498d4c0a8d` (`main` after Phase 3E-E and its validation-record corrective)  
Recommended successor if accepted: **Phase 3E-G — Evidence-Complete Interior Transposition Runtime**

---

## 1. Decision

Nihon is still **not approved for arbitrary permutation search, recursive local optimisation, route ranking, whole-day optimisation, TSP, shortest-path search or automatic repeated improvement**.

Phase 3E-C owns one adjacent interior swap.

Phase 3E-E owns one non-adjacent single-place relocation.

The next smallest distinct local move with measurable incremental value is:

> swap exactly **two non-adjacent interior places** inside one existing maximal same-hub block, while keeping every other place in its original relative position and keeping the block/day endpoints fixed.

This document calls that move an **interior transposition**.

One candidate is one explicit transposition from the current user-authored baseline. It is not an optimisation session.

No runtime is implemented in this gate.

---

## 2. Why transposition is the next frontier

An adjacent swap changes one neighbouring pair.

A single-place relocation moves one place while preserving the relative order of every other place.

Those two one-step neighbourhoods still cannot express every small local reorder.

Example:

```text
Current:
L → A → B → C → R

Interior transposition:
L → C → B → A → R
```

This move exchanges `A` and `C`.

It is not an adjacent swap.

It is not one single-place relocation:

```text
move A 1 → 3 = L → B → C → A → R
move C 3 → 1 = L → C → A → B → R
```

Neither produces:

```text
L → C → B → A → R
```

The move is therefore genuinely distinct while still changing exactly two identified places and preserving all other places in position/order.

---

## 3. Real-data incremental-value audit

The candidate frontier was audited against the current shipped dataset and the exact current `getBestTransfer` preference semantics on base `fdf1369ad431a38dd15b7c858eaf8a498d4c0a8d`.

Current evidence base:

- 214 places;
- 403 recorded directed nearby relations;
- 325 clean validated walking results promotable through `getBestTransfer`;
- remaining recorded edges fall back to their existing estimate when no clean validated result applies.

The audit reconstructed the same five-place complete-baseline population used to justify Phase 3E-D:

- **1,616 complete ordered same-hub five-place baselines**.

For a five-place block:

```text
[L, A, B, C, R]
```

there is exactly one genuinely new interior transposition:

```text
[L, C, B, A, R]
```

The candidate was counted as **incremental** only when:

1. baseline and transposition candidate both had complete exact directed evidence under current `getBestTransfer`;
2. candidate was conservatively `b-clearly-faster` than baseline;
3. **no one-step Phase 3E-C adjacent swap from the same baseline was already faster**;
4. **no one-step Phase 3E-E single-place relocation from the same baseline was already faster**.

Results:

- 76 five-place baselines had complete evidence for the non-adjacent interior transposition;
- **11 incremental transposition opportunities** remained after excluding baselines already improved by one adjacent swap or one relocation;
- **4/11 fully validated-static** on both baseline and candidate;
- **7/11 mixed validated/estimated**;
- **0/11 fully estimated**.

Breakdown:

- Tokio: 2 opportunities, 2 fully validated-static;
- Kioto: 4 opportunities, 0 fully validated-static;
- Osaka: 5 opportunities, 2 fully validated-static;
- Okinawa: 0 opportunities.

Representative fully validated example:

```text
Jimbocho Book Town
→ Retro game hunt: Super Potato + Mandarake
→ Ameyoko
→ Kanda Myojin
→ Akihabara Electric Town
```

Recorded baseline:

```text
68 min
```

Swap the first and third interior places:

```text
Jimbocho Book Town
→ Kanda Myojin
→ Ameyoko
→ Retro game hunt: Super Potato + Mandarake
→ Akihabara Electric Town
```

Recorded candidate:

```text
60 min
```

Minimum recorded-range gap:

```text
8 min
```

All four baseline edges and all four candidate edges are `validated-static`.

No one-step adjacent swap and no one-step single-place relocation from that same baseline is faster.

This demonstrates incremental product value beyond Phases 3E-C and 3E-E without requiring arbitrary permutation search.

---

## 4. Candidate scope

A candidate belongs to exactly:

- one existing day;
- one maximal contiguous same-hub block;
- one current baseline order.

It exchanges exactly two interior places.

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
- every non-transposed place's position relative to every other non-transposed place;
- accommodation choices;
- accommodation legs;
- inter-hub segment objects;
- trip bounds;
- visit durations;
- reservation/hours/closure facts;
- planning-draft schema.

---

## 5. Transposition semantics

For a block:

```text
[P0, P1, P2, ... Pn]
```

choose:

```ts
leftIndex
rightIndex
```

with:

```text
1 <= leftIndex < rightIndex <= n - 1
```

Semantics:

1. read the place at `leftIndex`;
2. read the place at `rightIndex`;
3. exchange those two places directly;
4. leave every other place at the same index.

Example:

```text
[L, A, B, C, R]
left 1, right 3
= [L, C, B, A, R]
```

This is a direct transposition, not two persisted moves.

---

## 6. Adjacent transpositions are excluded

If:

```text
rightIndex - leftIndex === 1
```

the move is already exactly Phase 3E-C's adjacent-swap capability.

Therefore Phase 3E-G, if implemented, must generate only:

```text
rightIndex - leftIndex >= 2
```

No candidate may appear in both the adjacent-swap and transposition groups.

---

## 7. Minimum block length

A four-place block has only two interior places.

Swapping them is an adjacent swap and therefore already Phase 3E-C.

The first genuinely new transposition requires three interior positions:

```text
block length >= 5
```

A shorter block yields no Phase 3E-G candidate.

---

## 8. Distinction from single-place relocation

A transposition moves exactly two identified places and keeps every other place at the same index.

A relocation moves exactly one identified place and shifts intervening places.

Those are different neighbourhoods.

Phase 3E-G must not implement a transposition as:

- two sequential relocations;
- a relocation followed by an adjacent swap;
- repeated clicks;
- an iterative local-improvement loop.

One pure domain mutation should produce the final transposed order.

---

## 9. No arbitrary permutation

One transposition may change several directed local edges, but it exchanges exactly two places.

It must not:

- swap multiple independent pairs;
- reverse a slice;
- rotate a slice;
- shuffle a set;
- enumerate every permutation;
- choose an arbitrary new order;
- derive a second candidate from a first candidate.

Every candidate is derived independently from the current baseline.

---

## 10. Candidate enumeration complexity

For a block of length `n`:

- interior count = `n - 2`;
- all unordered interior pairs = `C(n - 2, 2)`;
- adjacent interior pairs already owned by 3E-C = `n - 3`;
- genuine non-adjacent transpositions:

```text
(n - 3)(n - 4) / 2
```

Therefore candidate count is `O(n²)`.

This gate makes **no claim that total runtime is O(n²)**.

A straightforward implementation that rebuilds and compares a length-`n` sequence for every candidate can require `O(n³)` directed lookups in the worst case.

Still prohibited:

- factorial search;
- recursion over candidate orders;
- hill climbing;
- beam search;
- dynamic programming over permutations;
- repeated automatic application.

---

## 11. Structural availability

Use the same structural refusal contract as 3E-C/3E-E:

```ts
type InteriorTranspositionGenerationUnavailableReason =
  | "no-day-assignment"
  | "invalid-day-partition"
  | "unresolved-route-place";
```

Rules:

- `days === null` → unavailable;
- invalid route/day partition → unavailable;
- any unresolved route place → unavailable;
- no route-only fallback;
- no repair;
- no silent filtering.

Trip bounds remain annotation and never block generation.

---

## 12. Maximal same-hub block reuse

Reuse Phase 3E-C's already-approved maximal contiguous same-hub block semantics.

Never cross:

- hub boundary;
- day boundary;
- empty day.

Both block endpoints remain locked.

No semantic change to Phase 3E-C or 3E-E block derivation is approved.

---

## 13. Affected temporal set

A transposition changes the transfer context only around the two exchanged positions.

For non-adjacent indices `i < j`, the affected position set is the unique union of:

```text
{i - 1, i, i + 1, j - 1, j, j + 1}
```

clamped naturally by the already-required interior-index rule.

Because `i` and `j` are interior, all predecessor/successor positions exist.

When `j === i + 2`, the two local windows overlap.

Example:

```text
[L, A, B, C, R]
swap A and C
```

Affected places are:

```text
L, A, B, C, R
```

For a larger gap:

```text
[L, A, B, C, D, E, R]
swap A and E
```

the directly affected places are:

```text
L, A, B, D, E, R
```

`C` retains both neighbours `B` and `D`, so its immediate transfer context does not change.

This phase should lock the exact affected set rather than unnecessarily locking untouched interior places.

---

## 14. Temporal lock

A candidate is not generated if **any place in the affected temporal set** has a non-empty persisted manual `visitStartTime`.

Reason:

- each transposed place changes position;
- each transposed place's predecessor/successor relationship changes;
- each immediate neighbour of a transposed position can gain a different incoming or outgoing edge;
- Nihon still has no clock-propagation solver that can prove compatibility with a touched manual anchor.

A timed place outside the affected set does not block an unrelated transposition.

No manual time is:

- moved;
- copied;
- recalculated;
- inferred.

---

## 15. Baseline evidence gate

The entire maximal same-hub baseline block must be complete under the existing exact directed lookup.

Require:

```ts
baseline.summary.complete === true
baseline.summary.transferMinutes !== null
```

If one baseline local edge is unknown:

- no transposition claim is generated for that block.

Unknown is never zero or infinity.

---

## 16. Candidate evidence gate

Every transposed candidate block must also be complete.

If one exact directed candidate edge is missing:

- discard that candidate.

Never repair from:

- reverse edge;
- chained path;
- geometry;
- haversine;
- ORS/live routing;
- sibling relation;
- synthetic minutes.

Reuse the existing exact sequence lookup/comparison path.

---

## 17. Comparison semantics

Reuse:

`sequenceComparisonFromLookup`

unchanged.

Baseline = current block.

Candidate = one direct interior transposition.

Surface a candidate only when:

```ts
outcome === "b-clearly-faster"
```

The existing conservative relation therefore requires:

```text
candidate.maxMinutes < baseline.minMinutes
```

No new arithmetic is approved.

---

## 18. Confidence disclosure

As in 3E-C and 3E-E:

- complete coverage is not equivalent to validated evidence;
- preserve baseline confidence counts;
- preserve candidate confidence counts;
- mixed/estimated comparisons remain visibly mixed/estimated;
- confidence never becomes a numeric score, penalty or rank.

User-facing claims remain about **recorded ranges**.

---

## 19. Suggested candidate output

A runtime may use a shape such as:

```ts
type EvidenceCompleteInteriorTranspositionAlternative = {
  dayId: string;
  dayOrdinal: number;
  hub: string;

  blockStartPlaceId: string;
  blockEndPlaceId: string;
  blockStartDayIndex: number;
  blockEndDayIndex: number;

  leftPlaceId: string;
  rightPlaceId: string;
  leftDayIndex: number;
  rightDayIndex: number;

  affectedPlaceIds: readonly string[];

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

Candidate state remains derived and ephemeral.

No persisted candidate id is required.

---

## 20. Deterministic enumeration

Enumerate in deterministic:

1. day order;
2. block order;
3. `leftIndex` ascending;
4. `rightIndex` ascending.

Do not sort by:

- advantage;
- duration;
- confidence;
- popularity;
- grade.

No `best`, `rank`, `score`, `recommended` or winner field.

---

## 21. Candidate uniqueness

With unique route-place membership, one unordered pair of indices maps to one transposed order.

Runtime should still assert uniqueness by `candidateDayPlaceIds` defensively.

If duplicate orders ever become possible because of a future schema change:

- retain the first by deterministic enumeration order;
- drop later duplicates;
- do not rank equivalent descriptors.

---

## 22. Relationship to Phases 3E-C and 3E-E

3E-C remains unchanged.

3E-E remains unchanged.

The existing day-card surface may compose three groups:

- **Intercambios adyacentes**
- **Reubicaciones de un lugar**
- **Intercambios no adyacentes**

A candidate must not appear in more than one group.

For the current unique-id route model:

- adjacent transpositions belong only to 3E-C and are excluded here;
- a genuine non-adjacent transposition cannot equal one single-place relocation;
- runtime may still defensively deduplicate by candidate day order across groups.

---

## 23. Multiple transposition candidates

Return every proved transposition candidate.

Do not choose a winner.

Do not compare candidate siblings.

Every candidate is compared only with the current baseline.

No top-N truncation by advantage is approved.

---

## 24. Explicit Apply

Applying a transposition requires explicit user action.

Suggested button:

> Aplicar este intercambio no adyacente

Nothing happens automatically.

After Apply:

1. persist exactly one transposition;
2. recompute the current plan;
3. recompute 3E-C adjacent swaps;
4. recompute 3E-E relocations;
5. recompute 3E-G transpositions.

Do not automatically apply another local suggestion.

---

## 25. Stale guard

Immediately before mutation verify at least:

- days still exist;
- target day id still exists;
- current day `placeIds` exactly equal captured `baselineDayPlaceIds`;
- both expected place ids still occupy their captured indices;
- both target indices remain legal and interior;
- index distance remains at least two;
- block endpoints remain the expected ids;
- every place in the current block still resolves to the expected hub;
- current transposed order equals captured `candidateDayPlaceIds`;
- current affected-place set equals captured `affectedPlaceIds`;
- no affected place has acquired a manual visit start time.

If any invariant fails:

- no mutation;
- return stale/refusal;
- let UI regenerate from current state.

Never apply from stale numeric indices alone.

---

## 26. New planning-draft mutation

Phase 3E-G may add one pure helper, e.g.:

`withPlacesTransposedWithinDay(draft, dayId, leftIndex, rightIndex)`

It must:

- exchange exactly two places inside one identified day;
- preserve every other place at the same index;
- preserve day id;
- preserve accommodation boundary;
- preserve all other days by identity where unchanged;
- preserve `routeIds`;
- preserve start/end dates;
- preserve `visitStartTimes`;
- preserve accommodations;
- preserve accommodation legs;
- preserve `interHubSegments`;
- remain V7.

It must not be implemented as two asynchronous UI moves or two persisted mutations.

One domain mutation produces one final draft.

---

## 27. Inter-hub invariant

Because both swapped places stay inside one same-hub block and block endpoints remain locked:

- cross-hub adjacency does not move;
- day boundaries do not move.

Every stored manual inter-hub segment must retain:

- byte-identical stored object;
- identical assessment kind;
- identical placement;
- identical inactive reason where applicable;
- identical day ordinals where applicable.

Tests must include active same-day, active between-day and inactive segments.

---

## 28. Accommodation invariant

Day first/last place is unchanged.

Therefore:

- boundary choices remain byte-identical;
- outbound/return assessment stays identical;
- manual accommodation legs stay unchanged;
- registered accommodation minutes stay unchanged.

No hotel routing is evaluated.

---

## 29. Whole-trip composition invariant

A valid transposition may change only local movement inside the target block.

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

The whole-trip registered movement/transport delta must equal the evidenced block delta.

---

## 30. Reservation / hours / closure boundary

A transposition candidate does not claim schedule feasibility.

The same places remain on the same day/date, but two positions change.

Without chained clock-time propagation Nihon cannot prove compatibility with:

- opening times;
- reservations;
- interval fit;
- best-time text;
- queues;
- real arrival/departure times.

No temporal signal becomes a score.

The affected-set lock protects existing manual clock anchors only; it is not a schedule solver.

---

## 31. Approved claim strength

Approved:

> Este intercambio no adyacente reduce de forma demostrable el rango de traslado local registrado de este bloque.

Approved evidence detail:

> Ventaja mínima entre los rangos registrados: 8 min.

Required qualification:

> No evalúa horarios, reservas, alojamiento, puerta a puerta ni el viaje completo.

Not approved:

- “Mejor orden”
- “Ruta óptima”
- “Día optimizado”
- “Te recomendamos intercambiar...”
- “Ahorra 8 min en tu viaje”
- “Esta es la mejor alternativa”

---

## 32. UI contract

Use the existing day-card local-alternatives surface.

For each transposition show:

- both exchanged place names;
- natural-language description;
- baseline recorded block range;
- candidate recorded block range;
- minimum recorded-range gap;
- baseline/candidate evidence confidence;
- local-only qualification;
- explicit Apply.

Suggested natural copy:

> Intercambiar Kanda Myojin y Retro game hunt: Super Potato + Mandarake dentro de este bloque.

Avoid raw indices as the primary user message.

---

## 33. Empty state

Do not add another reassuring empty message.

If all three local candidate groups are empty, retain the existing neutral statement:

> No hay una alternativa local con mejora demostrable usando todos los traslados registrados necesarios para esta comparación.

Absence of a proved candidate is not a claim that the current order is optimal.

---

## 34. Persistence

No schema change.

No V8.

Same storage key:

`nihon.manualPlanningDraft`

Never persist:

- transposition candidate;
- pair indices;
- affected-place set;
- advantage;
- confidence counts;
- candidate history;
- score;
- rank;
- optimisation state.

Only the applied resulting V7 day order persists.

---

## 35. Test contract for Phase 3E-G

### Structural availability

1. no days → unavailable.
2. invalid partition → unavailable.
3. unresolved route place → unavailable.
4. valid plan → available.
5. unavailable/inverted trip bounds do not block.

### Block and transposition enumeration

6. maximal same-hub block semantics exactly reuse 3E-C.
7. no cross-hub candidate.
8. no cross-day candidate.
9. empty day produces none.
10. block length < 5 produces none.
11. block endpoints remain fixed.
12. left index is interior.
13. right index is interior.
14. left index is strictly less than right.
15. same-position pair excluded.
16. adjacent pair excluded.
17. non-adjacent pair generated.
18. exactly the two selected places exchange indices.
19. every other place stays at the same index.
20. candidate orders are unique.
21. deterministic day/block/left/right order.
22. candidate count equals `(n - 3)(n - 4)/2`.
23. comments/docs do not misstate total runtime as O(n²).

### Affected temporal set

24. affected set is the union of both predecessor/self/successor windows.
25. overlap for distance-two transposition is deduplicated.
26. time on left predecessor blocks.
27. time on left transposed place blocks.
28. time on left successor blocks.
29. time on right predecessor blocks.
30. time on right transposed place blocks.
31. time on right successor blocks.
32. timed untouched interior place outside the affected set does not block.
33. timed place elsewhere in the day does not block.
34. generation never edits/moves visit start times.

### Evidence

35. complete baseline required.
36. missing baseline edge blocks the block.
37. reverse/chaining do not repair baseline.
38. complete candidate required.
39. missing candidate edge discards that candidate.
40. no geometry/network fallback.

### Comparison and confidence

41. `b-clearly-faster` candidate emitted.
42. equivalent range rejected.
43. overlapping range rejected.
44. baseline-faster rejected.
45. incomplete comparison rejected.
46. existing advantage arithmetic reused.
47. baseline confidence tally preserved.
48. candidate confidence tally preserved.
49. estimated evidence remains visibly estimated.
50. confidence produces no score/rank.

### Separation from existing local moves

51. adjacent transposition is never emitted by 3E-G.
52. candidate order never duplicates 3E-C adjacent-swap output.
53. candidate order never duplicates 3E-E relocation output.
54. representative real five-place fixture is not improved by one adjacent swap.
55. same fixture is not improved by one single-place relocation.
56. same fixture is improved by the transposition.
57. real fixture remains fully validated-static.

### Apply / stale safety

58. generation alone applies nothing.
59. Apply requires explicit action.
60. Apply exchanges exactly two places.
61. every other place remains at the same index.
62. day id unchanged.
63. day membership unchanged.
64. routeIds unchanged.
65. accommodation boundary unchanged.
66. all other days unchanged.
67. stale baseline rejected.
68. left identity mismatch rejected.
69. right identity mismatch rejected.
70. illegal endpoint index rejected.
71. adjacent index pair rejected.
72. changed block endpoint rejected.
73. changed block hub rejected.
74. mismatched captured candidate order rejected.
75. newly timed affected place rejected.
76. stale refusal performs no mutation.

### Pure V7 mutation

77. one pure mutation produces final order directly.
78. no intermediate persisted order.
79. helper remains V7.
80. all non-day fields structurally preserved.
81. unaffected days preserve identity.
82. no async/multi-click implementation.

### Inter-hub

83. stored segment objects unchanged.
84. all segment assessments unchanged.
85. active same-day segment unchanged.
86. active between-day segment unchanged.
87. inactive reason unchanged.

### Accommodation

88. boundary assessment unchanged.
89. registered accommodation minutes unchanged.

### Whole-trip composition

90. visit composition unchanged.
91. accommodation composition unchanged.
92. inter-hub composition unchanged.
93. bounds composition unchanged.
94. day count/membership/dates unchanged.
95. local registered movement changes by exact candidate delta.
96. registered transport changes by same exact delta.
97. no local missing edge introduced.

### Persistence

98. V7 remains.
99. same storage key.
100. candidate state is not persisted.
101. indices/affected set are not persisted.
102. advantage/confidence/rank/score are not persisted.
103. reload keeps applied day order.
104. reload regenerates fresh 3E-C, 3E-E and 3E-G candidates.

### UI / browser

105. existing local-alternatives surface contains a distinct non-adjacent-swap subgroup when applicable.
106. candidate names both exchanged places.
107. natural copy does not lead with raw indices.
108. baseline/candidate ranges visible.
109. minimum recorded-range gap visible.
110. both confidence mixes visible.
111. local-only disclaimer visible.
112. no best/optimal/recommended/trip-faster claim.
113. explicit Apply.
114. Apply produces exact expected order.
115. adjacent-swap group remains functional.
116. relocation group remains functional.
117. inter-hub status unchanged.
118. accommodation status unchanged.
119. bounds warning unchanged.
120. manual time in affected set suppresses candidate.
121. manual time on untouched interior place does not suppress candidate.
122. no automatic follow-up Apply.
123. reload derives fresh alternatives.
124. console errors = 0.
125. page errors = 0.

---

## 36. Non-goals

Not approved:

- arbitrary permutation generation;
- whole-block exhaustive permutation;
- whole-day reorder;
- moving places between days;
- changing day count;
- endpoint movement;
- cross-hub transposition;
- multiple independent pair swaps in one candidate;
- slice reversal / 2-opt;
- automatic repeated transposition;
- automatic swap → relocation → transposition chaining;
- hill climbing;
- global route score;
- ranking candidates by savings;
- shortest path;
- TSP;
- beam search;
- dynamic programming over route permutations;
- live transit;
- runtime ORS/network calls;
- hotel routing;
- schedule solver;
- reservation solver;
- dataset/workbook edits;
- dependency changes;
- schema migration.

---

## 37. Acceptance gate for Phase 3E-F

Accept only if review agrees that:

1. the frontier is exactly one non-adjacent interior transposition;
2. exactly two places exchange indices;
3. all other places remain at the same index;
4. block/day endpoints stay fixed;
5. adjacent swaps remain owned by 3E-C;
6. one-place relocations remain owned by 3E-E;
7. candidate count is quadratic and baseline-derived only;
8. the exact affected temporal set is conservatively locked;
9. baseline and candidate both require complete exact directed evidence;
10. only `b-clearly-faster` is surfaced;
11. confidence remains disclosure, not score;
12. candidates remain deterministic and unranked;
13. Apply is explicit and stale-guarded;
14. one pure V7-preserving transposition mutation is allowed;
15. inter-hub/accommodation/bounds invariants remain unchanged;
16. no candidate state is persisted;
17. arbitrary/global optimisation remains deferred.

---

## 38. Conclusion

Phase 3E-E expanded Nihon's local-search frontier without creating an optimisation session.

The next useful step is still not arbitrary permutation.

A single non-adjacent interior transposition is:

- narrower than slice reversal;
- narrower than multi-swap search;
- quadratic rather than factorial in candidate count;
- expressible as one explicit user action;
- compatible with the same evidence-complete and stale-safe architecture;
- measurably useful on current real data.

The real-data audit finds **11 incremental opportunities**, including **4 fully validated-static**, that are not discovered by one adjacent swap or one single-place relocation from the same baseline.

**Approved design direction proposed:** evidence-complete, non-adjacent, two-place interior transposition inside a fixed same-hub block.

**Recommended successor: Phase 3E-G — Evidence-Complete Interior Transposition Runtime. NOT STARTED.**
