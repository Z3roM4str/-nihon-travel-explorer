# Phase 3E-J — Evidence-Complete Two-Pair Block Swap Design Gate

Status: **design/audit only**  
Base audited: `826d1a276378e8ac1e0d215122b2d3d5c1e4fe9a` (`main` after Phase 3E-I)  
Recommended successor if accepted: **Phase 3E-K — Evidence-Complete Two-Pair Block Swap Runtime**

---

## 1. Decision

Nihon is still **not approved for arbitrary permutation search, generic block relocation, general 2-opt, whole-day optimisation, recursive local improvement, TSP, shortest-path search, route ranking or automatic repeated improvement**.

Existing one-step local neighbourhoods are now:

- Phase 3E-C: one adjacent interior swap;
- Phase 3E-E: one non-adjacent single-place relocation;
- Phase 3E-G: one non-adjacent interior transposition;
- Phase 3E-I: one exact four-place interior reversal.

After those four capabilities, the next smallest distinct move with demonstrated incremental value is:

> inside one current maximal same-hub block, take exactly four consecutive interior places `[A, B, C, D]` and exchange the two adjacent two-place blocks while preserving the internal order of each pair:
>
> `[A, B, C, D] → [C, D, A, B]`.

This document calls the move a **two-pair block swap**.

One candidate is one explicit baseline-derived swap of two adjacent two-place blocks. It is not an optimisation session.

No runtime is implemented by this gate.

---

## 2. Why this move is the next frontier

The residual real-data audit after Phase 3E-I leaves only one six-place baseline with any clearly-faster order not already owned by 3E-C / 3E-E / 3E-G / 3E-I.

That baseline has two still-unowned direct target orders:

1. a three-position cyclic rotation, 92 → 74 min;
2. a two-pair block swap, 92 → 81 min.

The cyclic rotation is the larger immediate gain, but a general three-position cyclic-rotation primitive is materially broader:

- it selects three interior positions;
- the positions need not be contiguous;
- both rotation directions are possible;
- naive candidate count grows cubically, `O(n³)`;
- its affected temporal set can be non-contiguous;
- it would add a new compound primitive even though the same final order can be reached using a simpler new move plus an existing capability.

The two-pair block swap is narrower:

- exactly four consecutive interior positions;
- exactly one transformation for each four-place window;
- candidate count `n - 5`;
- linear candidate growth;
- one contiguous six-place temporal lock;
- one direct synchronous mutation.

Most importantly, after applying the real 92 → 81 two-pair block swap, the already-shipped Phase 3E-E relocation generator produces a clearly-faster 81 → 74 candidate.

Therefore the 74-minute residual order becomes reachable through **two explicit, independently evidenced user actions**:

```text
92 → 81   Phase 3E-K proposed two-pair block swap
81 → 74   existing Phase 3E-E single-place relocation
```

No new cyclic-rotation primitive is required.

There is still **no automatic chaining**: after the first Apply, alternatives are regenerated from the new baseline and the user must explicitly choose any second move.

---

## 3. Real-data audit

The audit used the exact shipped evidence semantics on base
`826d1a276378e8ac1e0d215122b2d3d5c1e4fe9a`:

- 214 places;
- 403 recorded directed nearby relations;
- 325 clean validated walking results promotable through current `getBestTransfer`;
- validated-static is preferred only for a recorded walking result whose endpoint snapping is explicitly clean;
- every other recorded edge retains its existing estimate;
- exact directed lookup only.

Minimum six-place population:

- **2,131 complete ordered same-hub six-place baselines**.

After excluding every baseline already clearly improved by one current one-step move:

- Phase 3E-C adjacent swap;
- Phase 3E-E single-place relocation;
- Phase 3E-G non-adjacent transposition;
- Phase 3E-I exact four-place reversal;

there are:

- **1,692 eligible six-place baselines**.

Among those:

- **1 incremental two-pair block-swap opportunity** exists;
- it is in Okinawa;
- baseline and candidate are both fully `validated-static`;
- baseline = 92 min;
- candidate = 81 min;
- minimum recorded-range gap = 11 min.

The same minimum-population audit finds no additional two-pair block-swap opportunity at seven places after excluding C/E/G/I.

---

## 4. Representative fully validated fixture

Current baseline:

```text
JP-202 Whale watching in the Kerama waters
→ JP-153 Kokusai Street
→ JP-156 Sakaemachi Arcade nightlife
→ JP-161 Okinawa Prefectural Museum & Art Museum
→ JP-154 First Makishi Public Market
→ JP-155 Tsuboya Yachimun Street
```

Recorded baseline local movement:

```text
92 min
```

The four interior places are:

```text
[JP-153, JP-156] [JP-161, JP-154]
```

Swap the two adjacent pairs while preserving each pair's internal order:

```text
JP-202 Whale watching in the Kerama waters
→ JP-161 Okinawa Prefectural Museum & Art Museum
→ JP-154 First Makishi Public Market
→ JP-153 Kokusai Street
→ JP-156 Sakaemachi Arcade nightlife
→ JP-155 Tsuboya Yachimun Street
```

Recorded candidate local movement:

```text
81 min
```

Minimum recorded-range gap:

```text
11 min
```

All five baseline edges and all five candidate edges are `validated-static`.

From the original 92-minute baseline there is no clearly-faster one-step 3E-C, 3E-E, 3E-G or 3E-I candidate.

---

## 5. Explicit continuation audit

After the proposed pair-block swap is applied, the new baseline is:

```text
JP-202 JP-161 JP-154 JP-153 JP-156 JP-155
```

Recorded local movement:

```text
81 min
```

From that new baseline, existing Phase 3E-E generates one clearly-faster relocation:

```text
move JP-156 from day index 4 to final day index 2
```

Result:

```text
JP-202 JP-161 JP-156 JP-154 JP-153 JP-155
```

Recorded local movement:

```text
74 min
```

Again, all five edges are `validated-static`.

This is the same 74-minute order produced by the residual three-position cyclic rotation from the original baseline.

Consequences:

- direct cyclic rotation remains deferred;
- no automatic second Apply is approved;
- the runtime may only present the regenerated 3E-E candidate after the first Apply;
- any second improvement still requires a second explicit user action;
- UI claims for the proposed pair-block candidate remain strictly about 92 → 81, never about a speculative combined 92 → 74 action.

---

## 6. Candidate scope

A candidate belongs to exactly:

- one existing day;
- one maximal contiguous same-hub block;
- one current baseline order;
- one window of exactly four consecutive interior places;
- two adjacent two-place blocks inside that window.

For:

```text
[L, A, B, C, D, R]
```

the candidate is exactly:

```text
[L, C, D, A, B, R]
```

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
- relative order inside `[A, B]`;
- relative order inside `[C, D]`;
- accommodation choices;
- accommodation legs;
- inter-hub segment objects;
- trip bounds;
- manual visit times;
- planning-draft schema.

---

## 7. Exact semantics

For block length `n` choose one integer `windowStartIndex = s` satisfying:

```text
1 <= s <= n - 5
```

Read:

```text
A = P[s]
B = P[s + 1]
C = P[s + 2]
D = P[s + 3]
```

Produce:

```text
P[s]     = C
P[s + 1] = D
P[s + 2] = A
P[s + 3] = B
```

Every other index is unchanged.

The operation is one direct block swap.

It is not implemented as two persisted relocations.

---

## 8. Minimum block length

Two adjacent two-place blocks require four interior positions plus two fixed block endpoints.

Therefore:

```text
block length >= 6
```

A shorter block yields no candidate.

---

## 9. Candidate count and complexity

For a block of length `n >= 6`, legal window starts are:

```text
1 ... n - 5
```

Candidate count:

```text
n - 5
```

Therefore candidate count is **O(n)**.

This is only the candidate count.

If each candidate rebuilds/compares a length-`n` sequence, straightforward total directed-lookup work can be **O(n²)**.

Still prohibited:

- cubic three-position rotation search;
- arbitrary pair-block destination search;
- factorial permutation search;
- recursion over candidate orders;
- hill climbing;
- beam search;
- dynamic programming over route permutations;
- repeated automatic application.

---

## 10. Distinction from existing moves

### 3E-C adjacent swap

```text
A B C D → A C B D
```

changes two adjacent places.

Not this move.

### 3E-E one-place relocation

Moves one place and shifts intervening places.

Not this move.

### 3E-G non-adjacent transposition

Swaps exactly two identified places while all other indices remain fixed.

Not this move.

### 3E-I four-place reversal

```text
A B C D → D C B A
```

Not this move.

### Proposed 3E-K two-pair block swap

```text
A B C D → C D A B
```

All four positions change, but pair-internal order is preserved.

---

## 11. No generic block relocation

This gate does **not** approve:

- relocating a two-place block to arbitrary destination;
- swapping blocks of unequal size;
- swapping non-adjacent blocks;
- swapping blocks larger than two places;
- moving a block across endpoints;
- selecting any arbitrary pair of slices.

Only one contiguous four-place window split exactly 2+2 is allowed.

---

## 12. Structural availability

Use the existing local-alternative refusal contract:

```ts
type TwoPairBlockSwapGenerationUnavailableReason =
  | "no-day-assignment"
  | "invalid-day-partition"
  | "unresolved-route-place";
```

Rules:

- `days === null` → unavailable;
- invalid route/day partition → unavailable;
- any unresolved route place → unavailable;
- no route-only fallback;
- no silent filtering;
- no repair.

Trip bounds remain annotation and never block generation.

---

## 13. Maximal same-hub block reuse

Reuse Phase 3E-C's `deriveSameHubBlocks` semantics exactly.

Never cross:

- day boundary;
- hub boundary;
- empty day.

Both block endpoints remain locked.

---

## 14. Affected temporal window

For window start `s`, the affected transfer context is exactly:

```text
s - 1 ... s + 4
```

Six places:

1. predecessor before `A`;
2. `A`;
3. `B`;
4. `C`;
5. `D`;
6. successor after `D`.

Baseline local edges inside this six-place window:

```text
L→A
A→B
B→C
C→D
D→R
```

Candidate:

```text
L→C
C→D
D→A
A→B
B→R
```

`A→B` and `C→D` remain internally preserved, but each of A/B/C/D still participates in a changed incoming or outgoing context.

Therefore the exact conservative temporal lock is the whole six-place window.

---

## 15. Temporal lock

Suppress a candidate if any place in the exact affected six-place window has a non-empty persisted manual `visitStartTime`.

A timed place outside the window does not block.

No manual time is:

- moved;
- copied;
- recalculated;
- inferred;
- rewritten.

---

## 16. Baseline evidence gate

The entire maximal same-hub baseline block must be complete under the existing exact directed lookup.

Require:

```ts
baseline.summary.complete === true
baseline.summary.transferMinutes !== null
```

One unknown baseline edge suppresses every candidate for that block.

Unknown is never zero or infinity.

---

## 17. Candidate evidence gate

The entire candidate block must also be complete.

For the six-place minimum case, the candidate must explicitly resolve:

```text
L→C
C→D
D→A
A→B
B→R
```

No direction can be synthesized from its reverse twin.

Never repair from:

- reverse edge;
- chained path;
- geometry;
- haversine;
- runtime ORS;
- live routing;
- sibling relation;
- synthetic minutes;
- synthetic symmetry.

---

## 18. Comparison semantics

Reuse `sequenceComparisonFromLookup` unchanged.

Baseline = current maximal same-hub block.

Candidate = one exact two-pair block swap.

Surface only when:

```ts
outcome === "b-clearly-faster"
```

Therefore:

```text
candidate.maxMinutes < baseline.minMinutes
```

No new arithmetic is approved.

---

## 19. Confidence disclosure

Preserve:

- baseline confidence counts;
- candidate confidence counts;
- validated-static vs estimated distinctions.

Confidence remains disclosure only.

Never create:

- confidence score;
- penalty;
- bonus;
- ranking;
- winner.

---

## 20. Cross-group deduplication

A genuine unique-id two-pair block swap is structurally distinct from C/E/G/I.

Still, the future UI should defensively deduplicate by exact `candidateDayPlaceIds` against already-shown groups:

1. 3E-C;
2. 3E-E;
3. 3E-G;
4. 3E-I;
5. proposed 3E-K.

Earlier groups always retain ownership if a future schema ever creates an exact duplicate.

Nothing is ranked by gap or confidence.

---

## 21. Deterministic enumeration

Enumerate in:

1. day order;
2. maximal same-hub block order;
3. `windowStartIndex` ascending.

Never sort by:

- advantage;
- minutes;
- confidence;
- hub;
- place grade.

---

## 22. Suggested candidate shape

A runtime may use a shape such as:

```ts
type EvidenceCompleteTwoPairBlockSwapAlternative = {
  dayId: string;
  dayOrdinal: number;
  hub: string;

  blockStartPlaceId: string;
  blockEndPlaceId: string;
  blockStartDayIndex: number;
  blockEndDayIndex: number;

  windowStartDayIndex: number;

  firstPairPlaceIds: readonly [string, string];
  secondPairPlaceIds: readonly [string, string];
  swappedWindowPlaceIds: readonly [string, string, string, string];

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

Derived only.

Never persisted.

---

## 23. Apply semantics

Apply only after explicit user action.

Suggested button:

> Aplicar este intercambio de bloques

After Apply:

1. stale-check the captured candidate;
2. perform one direct 2+2 block-swap mutation;
3. persist the resulting V7 day order;
4. re-render;
5. regenerate all local-alternative groups from the new baseline.

Never auto-apply the newly available 3E-E relocation.

---

## 24. Stale guard

Immediately before mutation verify:

- days still exist;
- target day still exists;
- current day ids exactly equal captured baseline day ids;
- `windowStartDayIndex` is an integer;
- the four-place window remains strictly interior to the captured block;
- the first pair identities still match;
- the second pair identities still match;
- block start/end ids still match;
- current block exactly equals captured baseline block;
- every block place still resolves to captured hub;
- one exact two-pair swap of the current four ids yields captured candidate day order;
- exact six-place affected set equals captured affected set;
- no affected place gained a manual start time.

Any failure → no mutation.

Never apply from the start index alone.

---

## 25. Pure V7 mutation

A future runtime may add a pure helper such as:

```ts
withTwoPairBlocksSwappedWithinDay(
  draft,
  dayId,
  windowStartIndex
)
```

It should transform exactly:

```text
A B C D → C D A B
```

in one synchronous mutation.

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
- unaffected day objects where possible.

No V8.

No second persisted state.

No intermediate order.

---

## 26. Inter-hub invariant

Because the move remains within one same-hub block and its endpoints stay fixed:

- stored inter-hub segment objects remain unchanged;
- segment placement remains unchanged;
- active same-day assessment remains unchanged;
- active between-day assessment remains unchanged;
- inactive reason remains unchanged.

---

## 27. Accommodation invariant

Because day/block endpoints stay fixed:

- accommodation boundary choices remain unchanged;
- accommodation legs remain unchanged;
- accommodation assessment remains unchanged;
- registered accommodation minutes remain unchanged.

---

## 28. Whole-trip composition invariant

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
- corresponding registered transport range;
- local movement confidence mix.

Registered movement/transport delta must equal the exact evidenced local delta.

No missing local edge may be introduced.

---

## 29. Persistence

Remain authoritative:

```text
ManualPlanningDraftV7
nihon.manualPlanningDraft
```

Do not persist:

- candidate;
- window start;
- pair identities;
- swapped window;
- affected set;
- evidence ranges;
- advantage;
- confidence;
- score;
- rank;
- history;
- optimisation-session state.

---

## 30. UI

Extend the existing single surface:

> Alternativas locales con evidencia completa

Existing groups remain:

- Intercambios adyacentes
- Reubicaciones de un lugar
- Intercambios no adyacentes
- Reversiones de cuatro lugares

Proposed fifth group:

> Intercambios de bloques de dos lugares

Natural candidate copy may be:

> Intercambiar los bloques de dos lugares Kokusai Street → Sakaemachi Arcade nightlife y Okinawa Prefectural Museum & Art Museum → First Makishi Public Market dentro del bloque de Okinawa.

Show:

- current recorded block range;
- candidate recorded range;
- minimum recorded-range gap;
- baseline confidence mix;
- candidate confidence mix;
- local-only disclaimer;
- explicit Apply.

Do not lead with array indices.

---

## 31. Claim boundary

Approved:

> Este intercambio de bloques reduce de forma demostrable el rango de traslado local registrado de este bloque.

Approved fixture evidence:

> Ventaja mínima entre los rangos registrados: 11 min.

Required qualification:

> No evalúa horarios, reservas, alojamiento, puerta a puerta ni el viaje completo.

Do not claim the future 74-minute second step before it is regenerated from the applied 81-minute baseline.

Forbidden:

- Mejor orden
- Ruta óptima
- Día optimizado
- Recomendado
- Te conviene
- Ahorras
- Mejor alternativa
- 18 min de ahorro total
- 92 → 74 as one candidate
- fastest route
- best route
- whole-trip saving

---

## 32. Browser acceptance fixture

Primary fixture:

```text
baseline:
JP-202 JP-153 JP-156 JP-161 JP-154 JP-155

pair-block candidate:
JP-202 JP-161 JP-154 JP-153 JP-156 JP-155
```

Expected recorded ranges:

```text
92 min → 81 min
```

Expected minimum gap:

```text
11 min
```

Both sides:

```text
5 validated-static edges
```

After explicit Apply and regeneration, browser acceptance should additionally prove:

- the applied 81-minute order is persisted;
- the pair-block candidate itself is gone;
- existing Phase 3E-E now surfaces the independently evidenced relocation to:
  `JP-202 JP-161 JP-156 JP-154 JP-153 JP-155`;
- that second candidate is not auto-applied;
- if the browser audit explicitly clicks that 3E-E candidate in a separate/continued acceptance step, it yields 74 min / exact expected order;
- the audit must not represent the two clicks as one atomic optimisation.

The earlier C/G/I Apply paths should remain functionally exercised on suitable regression fixtures as well.

---

## 33. Test contract for proposed Phase 3E-K

### Structural availability

1. no days → unavailable.
2. invalid partition → unavailable.
3. unresolved route place → unavailable.
4. valid plan → available.
5. trip bounds do not block.

### Block and enumeration

6. reuse maximal same-hub block semantics.
7. no cross-hub candidate.
8. no cross-day candidate.
9. empty day yields none.
10. block length < 6 yields none.
11. block endpoints remain fixed.
12. window start is interior.
13. window end is interior.
14. exactly four consecutive interior places selected.
15. first pair has exactly two places.
16. second pair has exactly two places.
17. pair blocks are adjacent.
18. pair-internal order is preserved.
19. first pair moves after second pair.
20. second pair moves before first pair.
21. every outside place stays at same index.
22. candidate orders unique.
23. deterministic day/block/start order.
24. candidate count equals `n - 5`.
25. candidate count documented as O(n).
26. total evaluation not misclaimed as O(n).
27. no generic block destination search.
28. no candidate chaining.

### Temporal lock

29. affected window begins at predecessor.
30. affected window contains all four moved places.
31. affected window ends at successor.
32. affected size exactly six.
33. time on predecessor blocks.
34. time on first first-pair place blocks.
35. time on second first-pair place blocks.
36. time on first second-pair place blocks.
37. time on second second-pair place blocks.
38. time on successor blocks.
39. timed place outside affected window does not block.
40. timed place elsewhere in day does not block.
41. generation never edits manual times.

### Evidence

42. complete baseline required.
43. one missing baseline edge blocks block.
44. reverse/chaining do not repair baseline.
45. complete candidate required.
46. missing `L→C` discards candidate.
47. missing preserved `C→D` discards candidate.
48. missing bridge `D→A` discards candidate.
49. missing preserved `A→B` discards candidate.
50. missing `B→R` discards candidate.
51. reverse twins do not synthesize candidate edges.
52. no geometry/network fallback.

### Comparison/confidence

53. b-clearly-faster candidate emitted.
54. equivalent range rejected.
55. overlapping range rejected.
56. baseline-faster rejected.
57. incomplete comparison rejected.
58. existing advantage arithmetic reused.
59. baseline confidence preserved.
60. candidate confidence preserved.
61. estimated evidence remains estimated.
62. confidence creates no score/rank.

### Separation from prior neighbourhoods

63. exact 2+2 swap is distinct from 3E-C.
64. exact 2+2 swap is distinct from 3E-E.
65. exact 2+2 swap is distinct from 3E-G.
66. exact 2+2 swap is distinct from 3E-I.
67. candidate is defensively deduped against 3E-C.
68. candidate is defensively deduped against 3E-E.
69. candidate is defensively deduped against 3E-G.
70. candidate is defensively deduped against 3E-I.
71. representative Okinawa baseline has no faster 3E-C candidate.
72. same baseline has no faster 3E-E candidate.
73. same baseline has no faster 3E-G candidate.
74. same baseline has no faster 3E-I candidate.
75. same baseline has one faster proposed pair-block candidate.
76. fixture baseline is 92 min.
77. fixture candidate is 81 min.
78. fixture gap is 11 min.
79. fixture baseline has five validated-static edges.
80. fixture candidate has five validated-static edges.

### Continuation without automatic chaining

81. generation from original baseline does not emit the 74-minute three-position cycle.
82. applying only the pair-block candidate yields exactly the 81-minute order.
83. after regeneration from the 81-minute order, existing 3E-E emits the 74-minute relocation.
84. regenerated 3E-E candidate has exact final order.
85. regenerated 3E-E baseline is 81 min.
86. regenerated 3E-E candidate is 74 min.
87. regenerated 3E-E gap is 7 min.
88. regenerated 3E-E comparison remains fully validated-static.
89. second move is not auto-applied.
90. no UI claim combines both moves into one 18-minute candidate.

### Apply / stale safety

91. generation alone mutates nothing.
92. Apply requires explicit action.
93. Apply produces exact 2+2 swap.
94. outside indices unchanged.
95. day id unchanged.
96. day membership unchanged.
97. routeIds unchanged.
98. accommodation boundary unchanged.
99. all other days unchanged.
100. stale baseline rejected.
101. changed first-pair identity rejected.
102. changed second-pair identity rejected.
103. non-integer start rejected.
104. window touching block start rejected.
105. window touching block end rejected.
106. changed block endpoint rejected.
107. changed block hub rejected.
108. mismatched captured candidate order rejected.
109. mismatched affected set rejected.
110. newly timed affected place rejected.
111. stale refusal mutates nothing.

### Pure V7 / larger invariants

112. one pure mutation creates final order.
113. no intermediate persisted order.
114. draft stays V7 and same storage key.
115. non-day fields preserved.
116. unaffected days preserved where possible.
117. stored inter-hub objects/assessments unchanged.
118. accommodation boundary/legs/minutes unchanged.
119. visit/accommodation/inter-hub/bounds composition unchanged.
120. local movement and registered transport change by exact evidenced delta with no missing edge.

### Persistence / UI / browser

121. candidate/window/pairs/affected/evidence/advantage/confidence/rank/score are not persisted.
122. reload preserves the applied 81-minute order and regenerates fresh local alternatives.
123. fifth subgroup appears only when applicable, shows natural pair-block copy/ranges/confidence/disclaimer and requires explicit Apply.
124. executable browser audit proves exact 92→81 Apply, regenerated 3E-E 81→74 availability without auto-Apply, and functional regression of prior local groups.
125. console errors = 0 and page errors = 0.

---

## 34. Non-goals

Not approved:

- generic three-position cyclic rotation;
- arbitrary three-place cycles;
- two-place block relocation to arbitrary destination;
- non-adjacent block swap;
- unequal-size block swap;
- 1+3 or 3+1 block rotation;
- blocks larger than two;
- multiple block swaps;
- generic slice rotation;
- generic 2-opt;
- arbitrary permutation;
- candidate-from-candidate generation inside one generation pass;
- automatic pair-block → relocation chaining;
- automatic repeated Apply;
- whole-day reorder;
- moving places between days;
- endpoint movement;
- cross-hub movement;
- global route score;
- ranking by savings;
- shortest path;
- TSP;
- beam search;
- dynamic programming over route permutations;
- runtime ORS/network calls;
- live transit;
- hotel routing;
- schedule solver;
- reservation solver;
- dataset/workbook edits;
- dependency changes;
- schema migration.

---

## 35. Acceptance gate for Phase 3E-J

Accept only if review agrees that:

1. the frontier is exactly `[A,B][C,D] → [C,D][A,B]` for one four-place interior window;
2. each two-place block preserves internal order;
3. every outside place remains at the same index;
4. block/day endpoints stay fixed;
5. candidate count is exactly `n - 5`, linear and baseline-derived only;
6. generic block relocation and three-position cyclic rotation remain deferred;
7. the exact six-place affected temporal window is locked;
8. baseline and candidate both require complete exact directed evidence;
9. only `b-clearly-faster` is surfaced;
10. confidence remains disclosure, not score;
11. candidates remain deterministic and unranked;
12. Apply is explicit and stale-guarded;
13. one pure V7-preserving direct 2+2 swap mutation is allowed;
14. inter-hub/accommodation/bounds invariants remain unchanged;
15. persistence schema/key remain unchanged;
16. the real-data basis is the one fully validated 92 → 81 Okinawa opportunity;
17. the residual 74-minute order is intentionally reached later through the already-existing 3E-E 81 → 74 candidate, with a second explicit user action;
18. no automatic chaining or combined 18-minute UI claim is approved.

---

## 36. Conclusion

After Phase 3E-I, Nihon's minimum six-place residual search space is nearly exhausted.

Among 1,692 complete six-place baselines not already clearly improved by C/E/G/I, only one baseline still has any clearly-faster unowned order.

A direct three-position cyclic rotation could jump from 92 to 74 minutes, but adding that primitive would introduce a cubic, non-contiguous compound search unnecessarily.

The exact two-pair block swap:

```text
[A,B][C,D] → [C,D][A,B]
```

is narrower and linear.

On current real data it produces:

```text
92 → 81 min
```

with an 11-minute minimum recorded-range gap and five validated-static edges on both sides.

After that explicit Apply, the already-shipped 3E-E relocation naturally exposes:

```text
81 → 74 min
```

as a second independently evidenced user choice.

This reaches the strongest remaining order without creating a redundant cyclic-rotation primitive and without automatic optimisation.

**Recommended successor: Phase 3E-K — Evidence-Complete Two-Pair Block Swap Runtime. NOT STARTED.**
