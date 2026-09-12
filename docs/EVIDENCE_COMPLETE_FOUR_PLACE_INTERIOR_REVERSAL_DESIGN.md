# Phase 3E-H — Evidence-Complete Four-Place Interior Reversal Design Gate

Status: **design/audit only**  
Base audited: `17c4df45eac04742e888849af9dcd7cf859126a6` (`main` after Phase 3E-G)  
Recommended successor if accepted: **Phase 3E-I — Evidence-Complete Four-Place Interior Reversal Runtime**

---

## 1. Decision

Nihon is still **not approved for arbitrary permutation search, general 2-opt, whole-day optimisation, recursive local improvement, TSP, shortest-path search, route ranking or automatic repeated improvement**.

Existing one-step local neighbourhoods are now:

- Phase 3E-C: one adjacent interior swap;
- Phase 3E-E: one non-adjacent single-place relocation;
- Phase 3E-G: one non-adjacent interior transposition.

The next smallest distinct move with demonstrated incremental value is:

> reverse the order of exactly **four consecutive interior places** inside one existing maximal same-hub block, while keeping every place outside that four-place window at exactly the same index and keeping the block/day endpoints fixed.

Example:

```text
Current:
L → A → B → C → D → R

Candidate:
L → D → C → B → A → R
```

This document calls the move a **four-place interior reversal**.

One candidate is one explicit baseline-derived reversal. It is not an optimisation session.

No runtime is implemented by this gate.

---

## 2. Why exactly four places

A reversal of two consecutive interior places is already one Phase 3E-C adjacent swap.

```text
A B → B A
```

A reversal of three consecutive interior places:

```text
A B C → C B A
```

is exactly one Phase 3E-G non-adjacent transposition of the first and third places.

Therefore the first genuinely new contiguous reversal length is exactly four:

```text
A B C D → D C B A
```

Phase 3E-H intentionally stops there.

It does **not** approve:

- arbitrary reversal length;
- generic slice reversal;
- general 2-opt;
- multiple reversed windows;
- reversal plus another move;
- repeated automatic reversal.

A later gate would need fresh evidence before broadening beyond exactly four places.

---

## 3. Real-data incremental-value audit

The audit used the exact shipped evidence semantics on base
`17c4df45eac04742e888849af9dcd7cf859126a6`:

- 214 places;
- 403 recorded directed nearby relations;
- 325 clean validated walking results promotable through current `getBestTransfer`;
- exact directed lookup only;
- validated-static preferred only when the recorded walking result is validated and endpoint snapping is explicitly clean;
- otherwise the recorded estimate remains authoritative.

Because the first new four-place reversal requires four interior places plus two locked endpoints, the minimum audited block is six places.

The current graph yields:

- **2,131 complete ordered same-hub six-place baselines**;
- **1,693** remain after excluding any baseline already clearly improved by one Phase 3E-C adjacent swap, one Phase 3E-E single-place relocation or one Phase 3E-G non-adjacent transposition.

An exhaustive audit of all permutations of the four interior positions on those 1,693 remaining baselines found:

- **2 baselines** with any still-unowned clearly-faster interior order;
- **3 total clearly-faster unowned orders**.

Those three are:

1. one full four-place interior reversal — minimum recorded-range gap **19 min**;
2. one other compound two-transposition order — gap **18 min**;
3. one two-block rotation — gap **11 min**.

All three occur in Okinawa and all compared edges are fully `validated-static`.

The four-place reversal is selected because it is:

- the simplest named one-step transformation among the remaining orders;
- linear in candidate count;
- narrower than pair-block relocation or arbitrary compound permutations;
- the strongest measured gap among the remaining orders.

The other two transformations remain explicitly deferred.

---

## 4. Representative validated fixture

Baseline:

```text
JP-202 Whale watching in the Kerama waters
→ JP-153 Kokusai Street
→ JP-155 Tsuboya Yachimun Street
→ JP-156 Sakaemachi Arcade nightlife
→ JP-161 Okinawa Prefectural Museum & Art Museum
→ JP-154 First Makishi Public Market
```

Recorded baseline local movement:

```text
91 min
```

Reverse exactly the four interior places:

```text
JP-202 Whale watching in the Kerama waters
→ JP-161 Okinawa Prefectural Museum & Art Museum
→ JP-156 Sakaemachi Arcade nightlife
→ JP-155 Tsuboya Yachimun Street
→ JP-153 Kokusai Street
→ JP-154 First Makishi Public Market
```

Recorded candidate local movement:

```text
72 min
```

Minimum recorded-range gap:

```text
19 min
```

All five baseline edges and all five candidate edges are `validated-static`.

From that same baseline, no one-step Phase 3E-C adjacent swap, Phase 3E-E single-place relocation or Phase 3E-G non-adjacent transposition is clearly faster.

---

## 5. Candidate scope

A candidate belongs to exactly:

- one existing day;
- one maximal contiguous same-hub block;
- one current baseline order;
- one window of exactly four consecutive interior places.

It changes only the order of those four places.

Fixed:

- day count;
- day id;
- day membership;
- route membership;
- block hub;
- block first place;
- block last place;
- day first place;
- day last place;
- every place outside the four-place window stays at the same index;
- accommodation choices;
- accommodation legs;
- inter-hub segment objects;
- trip bounds;
- manual visit times;
- planning-draft schema.

---

## 6. Exact reversal semantics

For block length `n`:

```text
[P0, P1, ... P(n-1)]
```

choose one integer `startIndex` satisfying:

```text
1 <= startIndex <= n - 5
```

The four reversed positions are:

```text
startIndex
startIndex + 1
startIndex + 2
startIndex + 3
```

Their final order is:

```text
P(start+3), P(start+2), P(start+1), P(start)
```

Every other index is unchanged.

The two block endpoints can never move.

---

## 7. Minimum block length

Four interior positions plus two fixed block endpoints require:

```text
n >= 6
```

A block shorter than six places yields no Phase 3E-I candidate.

---

## 8. Candidate count and complexity

For a block of length `n >= 6`, legal four-place interior windows start at:

```text
1 ... n - 5
```

Candidate count:

```text
n - 5
```

Therefore candidate count is **O(n)**.

This is only the number of candidates.

If each candidate is evaluated by rebuilding a length-`n` sequence, straightforward total directed-lookup work may be **O(n²)**.

No factorial search is approved.

No candidate is derived from another candidate.

---

## 9. Structural availability

Reuse the existing local-alternative refusal contract:

```ts
type FourPlaceInteriorReversalGenerationUnavailableReason =
  | "no-day-assignment"
  | "invalid-day-partition"
  | "unresolved-route-place";
```

Rules:

- `days === null` → unavailable;
- invalid route/day partition → unavailable;
- any unresolved route place → unavailable;
- no silent filtering;
- no route-only fallback;
- no repair.

Trip bounds remain annotation and do not block candidate generation.

---

## 10. Same-hub block semantics

Reuse Phase 3E-C's `deriveSameHubBlocks` semantics exactly.

Never cross:

- day boundary;
- hub boundary;
- empty day.

Both maximal block endpoints remain locked.

---

## 11. Affected temporal set

For a four-place window beginning at block index `s`, the changed transfer context spans exactly:

```text
s - 1 ... s + 4
```

That is:

- predecessor before the reversed window;
- all four reversed places;
- successor after the reversed window.

Example:

```text
L A B C D R
  ^^^^^^^
```

Reversal changes the two boundary edges and reverses the internal directed adjacency/order, so every one of those six places participates in changed immediate transfer context.

A timed place outside this six-place affected window does not block the candidate.

---

## 12. Temporal lock

Suppress a candidate if any place in its exact affected six-place window has a non-empty persisted manual `visitStartTime`.

No manual time is:

- moved;
- copied;
- rewritten;
- recalculated;
- inferred.

A manual time elsewhere in the same day remains unrelated.

---

## 13. Baseline evidence

The entire maximal same-hub baseline block must be complete under the existing exact directed lookup.

Require:

```ts
baseline.summary.complete === true
baseline.summary.transferMinutes !== null
```

One unknown baseline edge suppresses every four-place reversal candidate for that block.

Unknown is neither zero nor infinity.

---

## 14. Candidate evidence

The entire candidate block must also be complete.

A missing exact directed candidate edge discards that candidate.

Never repair from:

- reverse edge;
- chained path;
- geometry;
- haversine;
- runtime ORS;
- live routing;
- sibling relation;
- synthetic minutes.

---

## 15. Comparison

Reuse `sequenceComparisonFromLookup` unchanged.

Surface only:

```ts
outcome === "b-clearly-faster"
```

Therefore:

```text
candidate.maxMinutes < baseline.minMinutes
```

No new savings arithmetic is introduced.

---

## 16. Confidence disclosure

Preserve:

- baseline confidence counts;
- candidate confidence counts;
- validated-static vs estimated distinctions.

Confidence is disclosure only.

Never turn confidence into:

- score;
- bonus;
- penalty;
- rank;
- winner.

---

## 17. Separation from 3E-C / 3E-E / 3E-G

A four-place reversal is not generated by those earlier neighbourhoods.

Still, a future UI should defensively deduplicate candidate day orders against all earlier local-alternative groups.

Group ownership remains:

- adjacent swap → 3E-C;
- one-place relocation → 3E-E;
- two-place non-adjacent transposition → 3E-G;
- exactly-four-consecutive-place reversal → proposed 3E-I.

No group ranks another.

---

## 18. Why not the other remaining six-place orders

The exhaustive minimum-block audit found two other unowned clearly-faster orders.

One is a compound two-transposition pattern.

One is a two-block rotation equivalent to relocating a two-place contiguous block across another two-place block.

They are not approved here because they require a broader primitive than the exact four-place reversal.

Their measured gaps are also smaller than the selected reversal on current data.

A future phase may audit them independently.

---

## 19. Deterministic enumeration

Enumerate in:

1. day order;
2. maximal same-hub block order;
3. `startIndex` ascending.

Never sort by:

- advantage;
- confidence;
- minutes;
- hub;
- place grade.

Candidate order is positional only.

---

## 20. Suggested candidate shape

A future runtime may use:

```ts
type EvidenceCompleteFourPlaceInteriorReversalAlternative = {
  dayId: string;
  dayOrdinal: number;
  hub: string;

  blockStartPlaceId: string;
  blockEndPlaceId: string;
  blockStartDayIndex: number;
  blockEndDayIndex: number;

  windowStartDayIndex: number;
  originalWindowPlaceIds: readonly [string, string, string, string];
  reversedWindowPlaceIds: readonly [string, string, string, string];
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

Derived only. Never persisted.

---

## 21. Apply semantics

Apply only after explicit user action.

Suggested button:

> Aplicar esta reversión de cuatro lugares

After Apply:

1. stale-check the captured candidate;
2. perform one direct reversal mutation;
3. persist the resulting V7 day order;
4. re-render;
5. regenerate all local-alternative groups from the new baseline.

Never automatically apply a second improvement.

---

## 22. Stale guard

Immediately before mutation verify:

- days still exist;
- target day still exists;
- current day ids exactly equal captured baseline day ids;
- `windowStartDayIndex` is an integer;
- four-place window remains strictly interior to the captured block;
- the four expected place ids still occupy the captured window;
- block start/end ids still match;
- current block equals captured baseline block;
- every block place still resolves to the captured hub;
- reversing exactly those four current ids yields the captured candidate day order;
- exact affected six-place set equals the captured affected set;
- no affected place gained a manual start time.

Any failure → no mutation.

---

## 23. Pure V7 mutation

A future runtime may add a pure helper such as:

```ts
withFourPlacesReversedWithinDay(
  draft,
  dayId,
  windowStartIndex
)
```

It should reverse exactly four contiguous ids in one synchronous mutation.

Preserve:

- V7;
- routeIds;
- day ids;
- dates;
- visitStartTimes;
- accommodation boundaries;
- accommodations;
- accommodation legs;
- interHubSegments;
- all unaffected day objects where possible.

No V8.

No intermediate persisted order.

---

## 24. Inter-hub invariant

Because the move stays inside one same-hub block and block endpoints remain fixed:

- stored inter-hub segment objects must remain unchanged;
- segment placement must remain unchanged;
- active same-day assessment must remain unchanged;
- active between-day assessment must remain unchanged;
- inactive reason must remain unchanged.

---

## 25. Accommodation invariant

Because day and block endpoints remain fixed:

- accommodation boundary choices remain unchanged;
- accommodation legs remain unchanged;
- accommodation assessment remains unchanged;
- registered accommodation minutes remain unchanged.

---

## 26. Whole-trip composition invariant

Unchanged:

- visit composition;
- accommodation composition;
- inter-hub composition;
- bounds composition;
- day count;
- route/day membership;
- dates.

May change only:

- local movement sequence;
- complete recorded local movement range;
- matching registered transport range;
- local movement confidence mix.

The registered movement/transport delta must equal the exact evidenced local delta.

No missing edge may be introduced.

---

## 27. Persistence

Remain authoritative:

```text
ManualPlanningDraftV7
nihon.manualPlanningDraft
```

Do not persist:

- reversal candidate;
- start index;
- original/reversed window;
- affected set;
- evidence ranges;
- advantage;
- confidence;
- score;
- rank;
- history;
- optimisation session.

---

## 28. UI

Extend the existing single surface:

> Alternativas locales con evidencia completa

Existing groups remain:

- Intercambios adyacentes
- Reubicaciones de un lugar
- Intercambios no adyacentes

Proposed fourth group:

> Reversiones de cuatro lugares

Natural candidate copy may be:

> Revertir el orden de A, B, C y D dentro del bloque de Okinawa.

Show:

- current block recorded range;
- candidate recorded range;
- minimum recorded-range gap;
- baseline confidence mix;
- candidate confidence mix;
- local-only disclaimer;
- explicit Apply.

Do not lead with array indices.

---

## 29. Claim boundary

Approved:

> Esta reversión de cuatro lugares reduce de forma demostrable el rango de traslado local registrado de este bloque.

Approved evidence detail:

> Ventaja mínima entre los rangos registrados: 19 min.

Required qualification:

> No evalúa horarios, reservas, alojamiento, puerta a puerta ni el viaje completo.

Not approved:

- Mejor orden
- Ruta óptima
- Día optimizado
- Recomendado
- Te conviene
- Ahorras
- Mejor alternativa
- fastest route
- best route
- whole-trip saving

---

## 30. Browser acceptance fixture

Use the real fully validated Okinawa fixture from §4.

Baseline:

```text
JP-202 JP-153 JP-155 JP-156 JP-161 JP-154
```

Expected Apply result:

```text
JP-202 JP-161 JP-156 JP-155 JP-153 JP-154
```

Expected recorded ranges:

```text
91 min → 72 min
```

Expected minimum gap:

```text
19 min
```

Both sides:

```text
5 validated-static edges
```

Browser acceptance should also prove the three earlier local groups remain functional on suitable fixtures.

---

## 31. Test contract for proposed Phase 3E-I

### Structural availability

1. no days → unavailable.
2. invalid partition → unavailable.
3. unresolved route place → unavailable.
4. valid plan → available.
5. trip-bounds status does not block.

### Same-hub block and enumeration

6. reuse maximal same-hub block semantics.
7. no cross-hub candidate.
8. no cross-day candidate.
9. empty day yields none.
10. block length < 6 yields none.
11. block endpoints stay fixed.
12. window start is interior.
13. four-place window end is interior.
14. exactly four consecutive positions are selected.
15. window of two is never generated.
16. window of three is never generated.
17. window longer than four is never generated.
18. exactly four selected ids reverse.
19. every outside id stays at same index.
20. candidate orders are unique.
21. deterministic day/block/start order.
22. candidate count equals `n - 5`.
23. candidate count is documented as O(n).
24. total evaluation is not misclaimed as O(n).
25. no recursion/candidate chaining.

### Temporal lock

26. affected set begins at window predecessor.
27. affected set contains all four reversed places.
28. affected set ends at window successor.
29. exact affected size is six.
30. time on predecessor blocks.
31. time on first reversed place blocks.
32. time on second reversed place blocks.
33. time on third reversed place blocks.
34. time on fourth reversed place blocks.
35. time on successor blocks.
36. timed place outside the six-place window does not block.
37. timed place elsewhere in day does not block.
38. generation never edits manual times.

### Evidence

39. complete baseline required.
40. one missing baseline edge blocks the block.
41. reverse/chaining do not repair baseline.
42. complete candidate required.
43. one missing candidate edge discards candidate.
44. no geometry/network fallback.
45. candidate internal reversed directions must be explicitly recorded.
46. no synthetic symmetry.

### Comparison/confidence

47. b-clearly-faster candidate emitted.
48. equivalent range rejected.
49. overlapping range rejected.
50. baseline-faster rejected.
51. incomplete comparison rejected.
52. existing advantage arithmetic reused.
53. baseline confidence preserved.
54. candidate confidence preserved.
55. estimated evidence remains estimated.
56. confidence creates no score/rank.

### Separation from earlier neighbourhoods

57. two-place reversal remains 3E-C.
58. three-place reversal remains 3E-G.
59. four-place reversal is distinct from 3E-C.
60. four-place reversal is distinct from 3E-E.
61. four-place reversal is distinct from 3E-G.
62. candidate order is defensively deduped against 3E-C.
63. candidate order is defensively deduped against 3E-E.
64. candidate order is defensively deduped against 3E-G.
65. representative Okinawa baseline has no faster 3E-C candidate.
66. same baseline has no faster 3E-E candidate.
67. same baseline has no faster 3E-G candidate.
68. same baseline has a faster four-place reversal.
69. fixture baseline is 91 min.
70. fixture candidate is 72 min.
71. fixture gap is 19 min.
72. fixture baseline has five validated-static edges.
73. fixture candidate has five validated-static edges.

### Apply/stale safety

74. generation alone mutates nothing.
75. Apply requires explicit action.
76. Apply produces exact four-place reversal.
77. outside indices remain unchanged.
78. day id unchanged.
79. day membership unchanged.
80. routeIds unchanged.
81. accommodation boundary unchanged.
82. other days unchanged.
83. stale baseline rejected.
84. changed window identity rejected.
85. non-integer start rejected.
86. window touching block start rejected.
87. window touching block end rejected.
88. changed block endpoint rejected.
89. changed block hub rejected.
90. mismatched candidate order rejected.
91. mismatched affected set rejected.
92. newly timed affected place rejected.
93. stale refusal mutates nothing.

### Pure V7 mutation

94. one pure mutation creates final order.
95. exactly four ids reverse.
96. no splice-based relocation semantics.
97. no multiple draft writes.
98. no intermediate persisted order.
99. draft stays V7.
100. non-day fields preserved.
101. unaffected day objects preserved where possible.

### Larger-plan invariants

102. stored inter-hub objects unchanged.
103. same-day inter-hub assessment unchanged.
104. between-day inter-hub assessment unchanged.
105. inactive inter-hub reason unchanged.
106. accommodation boundary assessment unchanged.
107. accommodation minutes unchanged.
108. visit composition unchanged.
109. accommodation composition unchanged.
110. inter-hub composition unchanged.
111. bounds composition unchanged.
112. day count/membership/dates unchanged.
113. local movement changes by exact evidenced delta.
114. registered transport changes by same delta.
115. no local missing edge introduced.

### Persistence

116. V7 remains.
117. storage key remains `nihon.manualPlanningDraft`.
118. candidate/start/window/affected set not persisted.
119. advantage/confidence/rank/score not persisted.
120. reload preserves applied order.
121. reload regenerates all four local-alternative groups.

### UI/browser

122. fourth subgroup appears only when applicable.
123. candidate names all four reversed places, shows both ranges/confidence and the local-only disclaimer, contains no forbidden optimisation claim, and requires explicit Apply.
124. browser Apply yields the exact Okinawa order, reload derives fresh alternatives, and the existing 3E-C / 3E-E / 3E-G Apply paths remain functional on suitable regression fixtures.
125. console errors = 0 and page errors = 0.

---

## 32. Non-goals

Not approved:

- reversal of 2 places as a new group;
- reversal of 3 places as a new group;
- reversal of 5+ places;
- arbitrary slice reversal;
- generic 2-opt;
- pair-block relocation;
- block rotation;
- compound two-transposition order;
- multiple reversals in one candidate;
- candidate-from-candidate generation;
- automatic follow-up Apply;
- hill climbing;
- global route score;
- ranking by savings;
- whole-day reorder;
- cross-day movement;
- cross-hub movement;
- endpoint movement;
- shortest path;
- TSP;
- beam search;
- dynamic programming over permutations;
- runtime ORS/network calls;
- live transit;
- hotel routing;
- schedule solver;
- reservation solver;
- dataset/workbook edits;
- dependency changes;
- schema migration.

---

## 33. Acceptance gate for Phase 3E-H

Accept only if review agrees that:

1. the frontier is exactly one reversal of exactly four consecutive interior places;
2. four is the first reversal length not already owned by 3E-C or 3E-G;
3. every place outside the window remains at the same index;
4. block/day endpoints remain fixed;
5. candidate count is `n - 5`, linear and baseline-derived only;
6. generic 2-opt and arbitrary reversal length remain deferred;
7. exact six-place affected temporal window is locked;
8. baseline and candidate both require complete exact directed evidence;
9. only `b-clearly-faster` is surfaced;
10. confidence remains disclosure, not score;
11. candidates remain deterministic and unranked;
12. Apply is explicit and stale-guarded;
13. one pure V7-preserving four-place reversal mutation is allowed;
14. inter-hub/accommodation/bounds invariants remain unchanged;
15. persistence schema/key remain unchanged;
16. the real-data basis is the one fully validated 91 → 72 Okinawa opportunity after excluding C/E/G;
17. pair-block rotation and compound transformations remain separate future questions.

---

## 34. Conclusion

After Phase 3E-G, the current minimum six-place data leaves very little unowned local-search value.

Among 1,693 complete six-place baselines not already improved by C/E/G, only two baselines have any clearly-faster unowned four-interior order.

The strongest remaining order is a simple exact four-place reversal:

```text
91 min → 72 min
```

with a **19-minute minimum recorded-range gap** and fully validated-static evidence on both sides.

The proposed frontier is therefore intentionally tiny:

> reverse exactly four consecutive interior places, once, from the current baseline, inside one fixed same-hub block.

**Recommended successor: Phase 3E-I — Evidence-Complete Four-Place Interior Reversal Runtime. NOT STARTED.**
