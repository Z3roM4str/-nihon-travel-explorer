# Phase 3E-L — Evidence-Complete Local Neighbourhood Closure Audit

Status: **design/audit only — close the current local-ordering expansion**
Base audited: `e1171aa980c5726eb6a3775b562c5a2bc10c1a93` (`main` after Phase 3E-K)

**No runtime successor is recommended by this gate.**

This document does not implement a sixth local movement primitive.

---

## 1. Decision

Phase 3E's evidence-complete local-ordering neighbourhood expansion should stop here.

The runtime currently ships five bounded, explicit, baseline-derived movement families:

1. **Phase 3E-C — adjacent interior swap**
2. **Phase 3E-E — non-adjacent single-place relocation**
3. **Phase 3E-G — non-adjacent interior transposition**
4. **Phase 3E-I — exact four-place interior reversal**
5. **Phase 3E-K — exact adjacent two-pair block swap**

Every surfaced candidate:

- belongs to one existing day;
- stays inside one maximal same-hub block;
- keeps block endpoints fixed;
- uses complete exact directed transfer evidence;
- is surfaced only when `candidate.maxMinutes < baseline.minMinutes`;
- is applied only after explicit user action;
- preserves the V7 planning schema;
- regenerates alternatives from the new persisted baseline after Apply.

After Phase 3E-K, an exhaustive residual audit over complete same-hub blocks of 6, 7 and 8 places finds no evidence-based justification for adding another local primitive.

Therefore:

> **Do not add a Phase 3E-M runtime primitive.**

Generic cyclic rotation, larger reversals, arbitrary block relocation, general 2-opt, arbitrary permutations and automatic local search remain intentionally out of scope.

---

## 2. Closure question

The audit asks a stronger question than the earlier frontier gates.

Earlier gates asked:

> Is there a clearly-faster order that the currently shipped one-step neighbourhoods do not own?

After 3E-K, that question is insufficient because an unowned direct target may already be reachable through a sequence of explicit, strictly improving moves.

The closure question is:

> For a complete same-hub baseline that has **no clearly-faster C/E/G/I/K move**, does there nevertheless exist any other complete permutation of its interior places whose recorded range is clearly faster?

If the answer is no, that baseline is not merely a local minimum of the shipped neighbourhoods. It is also **undominated by every exhaustively enumerated interior permutation** under the current evidence.

That is the relevant stopping criterion.

---

## 3. Evidence semantics

The audit uses the exact shipped evidence model on base
`e1171aa980c5726eb6a3775b562c5a2bc10c1a93`.

Current data:

- **214 places**
- **403 recorded directed nearby relations**
- **325 clean validated walking results** promotable through current `getBestTransfer`

Transfer lookup remains exactly the runtime contract:

1. an edge must exist as a recorded directed nearby relation;
2. a clean validated-static walking result replaces that recorded estimate when available;
3. otherwise the recorded estimate remains authoritative;
4. no reverse-edge synthesis;
5. no chained path;
6. no geometry/haversine repair;
7. no runtime ORS;
8. no fabricated minutes.

A sequence is considered complete only when every consecutive directed edge resolves.

A candidate is clearly faster only through the existing comparison rule:

```text
candidate.maxMinutes < baseline.minMinutes
```

No scoring or ranking is introduced by this audit.

---

## 4. Current movement neighbourhoods

### 4.1 Phase 3E-C — adjacent interior swap

Swap exactly two adjacent interior places.

### 4.2 Phase 3E-E — single-place relocation

Relocate exactly one interior place to one non-adjacent interior final index.

### 4.3 Phase 3E-G — non-adjacent transposition

Swap exactly two non-adjacent interior places.

### 4.4 Phase 3E-I — four-place interior reversal

For one exact four-place interior window:

```text
A B C D → D C B A
```

### 4.5 Phase 3E-K — adjacent two-pair block swap

For one exact four-place interior window:

```text
A B C D → C D A B
```

The five families are collectively referred to below as **C/E/G/I/K**.

---

## 5. Exhaustive six-place audit

A six-place block has four interior positions.

Every possible interior ordering can therefore be exhaustively enumerated:

```text
4! = 24 permutations
```

Current graph contains:

- **2,131 complete ordered same-hub six-place baselines**

For each baseline:

1. generate every legal C/E/G/I/K move;
2. resolve its complete exact evidence;
3. check whether any move is clearly faster;
4. if at least one clearly-faster current move exists, the baseline is not a local minimum and requires no new primitive;
5. if none exists, exhaustively evaluate all 24 interior permutations.

Result:

- **1,691** baselines are local minima under C/E/G/I/K;
- among those 1,691, **0** have any other clearly-faster complete interior permutation;
- total clearly-faster residual permutation orders from those minima: **0**.

Therefore every audited six-place C/E/G/I/K local minimum is undominated by every **complete** permutation in the exhaustively enumerated six-place interior space under current evidence.

---

## 6. Exhaustive seven-place audit

A seven-place block has five interior positions.

Full interior permutation space:

```text
5! = 120 permutations
```

Current graph contains:

- **2,970 complete ordered same-hub seven-place baselines**

Result:

- **2,219** baselines are local minima under C/E/G/I/K;
- among those 2,219, **0** have a clearly-faster complete interior permutation;
- total clearly-faster residual permutation orders from those minima: **0**.

Again, every audited local minimum is undominated by every **complete** permutation in the exhaustively enumerated interior space under current evidence.

---

## 7. Exhaustive eight-place audit

An eight-place block has six interior positions.

Full interior permutation space:

```text
6! = 720 permutations
```

Current graph contains:

- **4,127 complete ordered same-hub eight-place baselines**

Result:

- **2,825** baselines are local minima under C/E/G/I/K;
- among those 2,825, **0** have a clearly-faster complete interior permutation;
- total clearly-faster residual permutation orders from those minima: **0**.

This extends the same closure property through eight-place blocks.

---

## 8. Consolidated result

| Block size | Complete baselines | C/E/G/I/K local minima | Local minima with any clearly-faster interior permutation | Residual faster orders |
|---|---:|---:|---:|---:|
| 6 | 2,131 | 1,691 | 0 | 0 |
| 7 | 2,970 | 2,219 | 0 | 0 |
| 8 | 4,127 | 2,825 | 0 | 0 |

Across all three exhaustively audited sizes:

- **9,228 complete baselines**
- **6,735 C/E/G/I/K local minima**
- **0 local minima with a clearly-faster complete interior permutation**

This is the principal closure evidence.

---

## 9. Why the result is stronger than “no sixth pattern found”

The audit did not merely test one proposed successor pattern.

It exhaustively enumerated every interior permutation for local minima at the audited sizes.

Therefore the result does not say:

> “we did not happen to find another useful move.”

It says:

> For every complete 6-, 7- and 8-place baseline that cannot improve by one shipped C/E/G/I/K action, there is no other complete interior ordering that is clearly faster under the same recorded evidence.

That makes a sixth movement primitive unsupported for the audited state space.

---

## 10. Strict-improvement continuation property

Every runtime candidate is required to satisfy:

```text
candidate.maxMinutes < baseline.minMinutes
```

So every explicit Apply moves to a strictly lower recorded range.

The state space is finite.

Therefore any user-driven sequence of C/E/G/I/K improvements must eventually stop.

For the exhaustively audited block sizes, every stopping state has now been shown to have no clearly-faster **complete** interior permutation under current evidence.

Consequently, within those audited spaces:

- users can safely follow any sequence of surfaced strict improvements;
- once no C/E/G/I/K candidate remains, the evidence does not support a hidden better interior order;
- no generic solver is required to reveal an otherwise missed clearly-faster permutation.

This is a property of the current evidence model and audited sizes, not a claim of mathematical shortest-path optimality.

---

## 11. The former 92 → 74 residual is no longer a counterexample

Before Phase 3E-K, the Okinawa baseline:

```text
JP-202 JP-153 JP-156 JP-161 JP-154 JP-155
```

had an unowned direct 74-minute order.

Phase 3E-K deliberately did not add the broader direct cyclic-rotation primitive.

Instead:

```text
92 → 81   explicit 3E-K pair-block swap
81 → 74   explicit existing 3E-E relocation
```

The final 74-minute order is therefore reachable by two independent evidence-complete actions.

After 3E-K, that original 92-minute baseline is no longer a local minimum and is excluded from the closure-minimum set for exactly the right reason.

This validates the design choice to prefer a narrow reusable movement primitive over a broader cubic cyclic-rotation primitive.

---

## 12. What this audit does NOT prove

This gate must not be overclaimed.

It does **not** prove:

- global route optimality;
- shortest paths;
- travel-time optimality outside recorded edge evidence;
- schedule optimality;
- hotel optimality;
- whole-trip optimality;
- permutation closure for every possible block length;
- closure for blocks of 9+ places;
- closure under future dataset changes;
- closure if transfer evidence changes;
- closure if endpoints are allowed to move;
- closure across hubs or days.

The exhaustive proof is specifically for:

- complete same-hub blocks;
- fixed endpoints;
- interior permutations;
- block lengths 6, 7 and 8;
- current shipped transfer evidence;
- current C/E/G/I/K semantics.

---

## 13. Why no 9+ exhaustive audit is required for this gate

The closure decision is evidence-driven, not a claim that larger factorial spaces are impossible.

At nine places, seven interior positions already imply:

```text
7! = 5,040
```

candidate permutations per baseline.

A generic exhaustive extension would increasingly resemble the arbitrary permutation machinery Phase 3E has intentionally avoided.

No current real-data counterexample has been produced that justifies paying that complexity cost.

Therefore:

- do not add runtime permutation search;
- do not add a new primitive “just in case”;
- do not claim 9+ closure;
- reopen the frontier only if a concrete evidence-complete 9+ counterexample or a changed product requirement demonstrates a real gap.

---

## 14. No generic cyclic rotation

Do not add the previously deferred three-position cyclic rotation.

Reasons:

1. its only motivating six-place residual is already reachable through K then E;
2. all six-place local minima are now exhaustive-permutation closed;
3. all seven- and eight-place local minima are also exhaustive-permutation closed;
4. the primitive introduces a broader non-contiguous O(n³) candidate family without demonstrated incremental value.

---

## 15. No larger reversal

Do not generalize four-place reversal into:

- five-place reversal;
- variable-length reversal;
- arbitrary slice reversal;
- generic 2-opt.

No audited local minimum requires one.

---

## 16. No generic block relocation

Do not generalize K into:

- moving a two-place block to arbitrary destination;
- unequal block swaps;
- non-adjacent block swaps;
- larger blocks;
- arbitrary slice rotation.

No audited local minimum requires one.

---

## 17. No automatic local-search loop

Do not add:

- “apply best until stable”;
- hill climbing;
- greedy loop;
- auto-chain;
- recursive candidate application;
- beam search;
- simulated annealing;
- TSP;
- dynamic programming over route orders.

The current product contract remains:

1. derive evidence-complete alternatives;
2. show them without ranking;
3. user chooses;
4. Apply exactly one move;
5. persist exactly that new baseline;
6. regenerate.

The closure result makes automatic chaining less necessary, not more justified.

---

## 18. No ranking or “best order” language

Closure does not change the claim boundary.

The app still must not claim:

- “best order”;
- “optimal route”;
- “optimized day”;
- “recommended route”;
- “fastest route”;
- whole-trip savings.

A state with no current alternative may be described only in evidence-bounded terms, for example:

> No hay una alternativa local con mejora demostrable usando todos los traslados registrados necesarios para esta comparación.

Do not replace that neutral copy with an optimality claim.

---

## 19. Current five-group UI remains the ceiling

The existing surface remains:

> Alternativas locales con evidencia completa

with at most five movement groups:

1. Intercambios adyacentes
2. Reubicaciones de un lugar
3. Intercambios no adyacentes
4. Reversiones de cuatro lugares
5. Intercambios de bloques de dos lugares

This gate approves no sixth group.

No UI runtime change is required.

---

## 20. Persistence remains unchanged

Authoritative storage remains:

```text
ManualPlanningDraftV7
nihon.manualPlanningDraft
```

No solver state, search frontier, visited-set, optimisation history, score or rank should be persisted.

---

## 21. Reopen criteria

The local-neighbourhood frontier should be reopened only when at least one concrete condition is met.

### 21.1 New evidence-complete counterexample

A current C/E/G/I/K local minimum has a clearly-faster complete interior permutation.

Required evidence:

- exact baseline;
- exact candidate;
- complete directed edges on both sides;
- current comparison outcome;
- proof no current C/E/G/I/K move improves the baseline.

### 21.2 Material dataset change

Examples:

- new nearby edges;
- corrected directed edges;
- materially changed validated-static ranges;
- new access-point evidence changing promoted walking results.

Then rerun the closure audit before considering a new primitive.

### 21.3 Product requirement changes

Examples:

- endpoints become movable;
- cross-day movement becomes part of automatic assistance;
- cross-hub local ordering is intentionally introduced;
- explicit solver/optimizer mode becomes a product requirement.

Those are new product contracts and require a fresh design gate, not an implicit extension of Phase 3E.

### 21.4 Concrete 9+ counterexample

A complete block of 9+ places is shown to be a C/E/G/I/K local minimum while another complete interior order is clearly faster.

Do not add factorial search merely to speculate about this possibility.

---

## 22. Recommended engineering consequence

Stop adding local-order movement modules.

Do not create:

- `evidence-complete-three-position-cycle.ts`;
- `evidence-complete-five-place-reversal.ts`;
- `evidence-complete-generic-block-relocation.ts`;
- `evidence-complete-two-opt.ts`;
- generic permutation-search infrastructure.

The existing five modules should now be treated as a bounded completed subsystem.

Future changes should be driven by a concrete user-planning capability outside this already-closed movement frontier, or by one of the reopen conditions above.

---

## 23. Regression expectation

Because this is documentation-only, runtime validation is not newly required by this gate.

The most recent runtime record remains Phase 3E-K:

- focused 3E-K: **131/131**
- C/E/G/I regression: **472/472**
- planning-draft / whole-trip / inter-hub / accommodation: **141/141**
- full suite: **2147/2147**
- Chromium audit: passed twice consecutively
- console errors: 0
- page errors: 0

This gate does not amend those records.

---

## 24. Scope

This phase changes documentation only.

It does not change:

- runtime TypeScript;
- UI;
- CSS;
- tests;
- package manifests;
- datasets;
- workbook;
- walking artifacts;
- access-point evidence;
- transfer semantics;
- sequence comparison;
- trip bounds;
- inter-hub semantics;
- accommodation semantics;
- persistence;
- schema version.

---

## 25. Acceptance gate

Accept Phase 3E-L only if review agrees that:

1. current C/E/G/I/K semantics are represented accurately;
2. the 6-place audit is exhaustive across all 24 interior permutations;
3. the 7-place audit is exhaustive across all 120 interior permutations;
4. the 8-place audit is exhaustive across all 720 interior permutations;
5. the complete-baseline counts are 2,131 / 2,970 / 4,127;
6. the local-minimum counts are 1,691 / 2,219 / 2,825;
7. none of those 6,735 local minima has any clearly-faster complete interior permutation;
8. no claim is made about 9+ closure;
9. no claim of route optimality is introduced;
10. no sixth movement primitive is authorized;
11. no automatic local-search loop is authorized;
12. generic cyclic rotation, larger reversal, generic block relocation and 2-opt remain deferred;
13. the five-group UI remains the local-alternative ceiling;
14. V7 persistence remains unchanged;
15. the frontier has explicit evidence-based reopen criteria;
16. **no runtime successor is recommended by this gate**.

---

## 26. Conclusion

Phase 3E has reached an evidence-supported stopping point.

Across **9,228 complete same-hub baselines** of 6–8 places, the current five movement families produce **6,735 local minima**.

Exhaustive enumeration of every interior permutation at those sizes finds:

```text
0 local minima with any clearly-faster complete interior permutation
0 residual faster orders
```

There is therefore no measured gap that justifies another local movement primitive.

The correct next action is not to broaden the solver.

It is to **close the current local-neighbourhood expansion** and move future development to a different product capability unless new evidence reopens this frontier.

**No Phase 3E-M runtime is recommended.**
