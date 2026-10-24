# Phase 4I — Photography Coverage Rebalancing Design

Status: **design gate complete and independently closure-reviewed; no acquisition started**

Base: `485d413c77ff679a7dc8154c23ad05afe21f3c83`  
Issue: #108  
Design date: **2026-09-15 / 2026-09-16 (America/Mexico_City)**

Authority:
- `docs/A_GRADE_PHOTOGRAPHY_BATCH_II_RUNTIME.md`
- `docs/PHOTOGRAPHY_SCALE_UP_II_DESIGN.md`
- `docs/A_GRADE_PHOTOGRAPHY_BATCH_I_RUNTIME.md`
- `docs/PHOTOGRAPHY_ATTRIBUTION_SCALE_DESIGN.md`
- Phase 4H successor boundary in `docs/ROADMAP.md`

## Decision

Phase 4I authorizes one narrow successor design:

**Phase 4J — A+B Licensed Photography Acquisition Batch**

The next acquisition tranche should contain **32 deterministic A/B-grade uncovered places**,
not another A-only tranche and not a broad all-grade tranche.

This is a coverage-balancing decision, not a recommendation/ranking change. The grade stored
on a place remains editorial data exactly as before; photography still has no effect on place
rank, itinerary, recommendation or routing behavior.

The Phase 4J fixture is fixed below. Phase 4I itself acquires **zero** photographs.

## Live inventory at the Phase 4I base

Canonical data reproduces:

- total places: **214**
- local licensed photographs: **85**
- coverage: **85/214 = 39.7%**
- uncovered: **129**

### Grade coverage

| Grade | Total | Covered | Uncovered | Coverage |
|---|---:|---:|---:|---:|
| S | 32 | 28 | 4 | 87.5% |
| A | 147 | 57 | 90 | 38.8% |
| B | 25 | 0 | 25 | 0.0% |
| C | 6 | 0 | 6 | 0.0% |
| D | 4 | 0 | 4 | 0.0% |

All four uncovered S places are already fail-closed from Phase 4D.

### Hub coverage

| Hub | Total | Covered | Uncovered | Coverage |
|---|---:|---:|---:|---:|
| Fukuoka | 1 | 0 | 1 | 0.0% |
| Kioto | 49 | 20 | 29 | 40.8% |
| Nagoya | 1 | 1 | 0 | 100% |
| Okinawa | 50 | 20 | 30 | 40.0% |
| Osaka | 53 | 21 | 32 | 39.6% |
| Sapporo | 3 | 3 | 0 | 100% |
| Tokio | 57 | 20 | 37 | 35.1% |

The sole Fukuoka record is **JP-214 — Yanagawa canal cruise**, grade B. Continuing A-only
would therefore leave an entire represented hub at zero photography coverage by construction.

### Zero-photo categories

Three categories currently have zero photographs:

- `🏛️ Arquitectura`: **0/2** — both records are grade B.
- `🌌 Cielo nocturno`: **0/1** — JP-195, carried fail-closed.
- `🐋 Fauna y experiencias estacionales`: **0/1** — JP-202, Phase 4H fail-closed.

The two architecture records are JP-123 Church of the Light and JP-138 Kobe Kitano Ijinkan.
An A-only continuation cannot cover this category.

## Carried fail-closed set

Exactly **11** IDs remain excluded:

Phase 4D:
`JP-033`, `JP-126`, `JP-203`, `JP-204`

Phase 4F:
`JP-050`, `JP-195`

Phase 4H:
`JP-121`, `JP-156`, `JP-095`, `JP-079`, `JP-202`

None re-enters Phase 4J. Re-entry requires materially new sourcing evidence in a separate gate.

After excluding covered and fail-closed places:

- eligible A-only universe: **83**
- eligible A+B universe: **108**
- eligible A+B by hub:
  - Fukuoka 1
  - Kioto 24
  - Okinawa 25
  - Osaka 27
  - Tokio 31

## Scope-strategy comparison

### A-only continuation

Advantages:
- preserves the previous grade boundary;
- every seat goes to an A place.

Disadvantages:
- leaves B at **0/25** indefinitely;
- leaves Fukuoka at **0/1**;
- cannot cover the zero-photo Architecture category;
- current eligible A universe spans only **14 categories**.

At 32 targets, A-only would allocate Kioto 8 / Okinawa 8 / Osaka 7 / Tokio 9 and
would still have no Fukuoka seat.

### A+B coverage-balanced

Advantages:
- keeps A as the dominant grade while allowing B only where it materially improves visual
  breadth;
- gives Fukuoka a deterministic seat;
- makes Architecture eligible;
- spans **19 categories**;
- preserves 108 eligible records, enough for later bounded gates without needing C/D;
- a 32-target fixture is still **23 A + 9 B** (71.9% A).

This is the selected policy.

### All-grade coverage-balanced

Advantages:
- expands the eligible universe to 118;
- reaches **21 categories**.

Disadvantages:
- starts consuming C and D places before the A+B universe is close to exhausted;
- the extra category breadth over A+B is only two categories at the evaluated tranche sizes;
- a 32-target fixture would pull 4 C and 3 D records while 83 non-failed A places still remain.

The marginal breadth is not enough to justify widening to C/D now. C/D stay deferred.

## Tranche-size comparison

Recent accepted-asset evidence:

| Phase | Accepted | Bytes | Mean bytes/accepted |
|---|---:|---:|---:|
| 4D | 12 | 3,607,446 | 300,620.50 |
| 4F | 22 | 5,457,240 | 248,056.36 |
| 4H | 27 | 7,438,738 | 275,508.81 |
| **Combined** | **61** | **16,503,424** | **270,547.93** |

Projected batch delta from the weighted mean and the observed batch-mean envelope:

| Attempts | Weighted projection | Observed envelope | Max total coverage |
|---:|---:|---:|---:|
| 24 | 6.19 MiB | 5.68–6.88 MiB | 109/214 = 50.9% |
| 32 | **8.26 MiB** | **7.57–9.17 MiB** | **117/214 = 54.7%** |
| 40 | 10.32 MiB | 9.46–11.47 MiB | 125/214 = 58.4% |

Strategy breadth at each size:

| Strategy | 24 | 32 | 40 |
|---|---|---|---|
| A-only | 24 A · 14 categories | 32 A · 14 categories | 40 A · 14 categories |
| A+B | 15 A + 9 B · 19 categories | **23 A + 9 B · 19 categories** | 30 A + 10 B · 19 categories |
| A+B+C+D | 13 A + 7 B + 3 C + 1 D · 21 categories | 17 A + 8 B + 4 C + 3 D · 21 categories | 26 A + 7 B + 4 C + 3 D · 21 categories |

### Chosen size: 32

Why 32:

- 24 has lower review cost, but its A+B mix is only 15 A / 9 B; increasing to 32 adds eight
  more A seats while preserving the same nine B seats produced by the deterministic selector.
- 32 stays below the existing **10 MiB soft budget even at the highest recent batch mean**
  (9.17 MiB).
- 40 has only one additional B seat and no category-breadth gain over 32, while its weighted
  projection is already **10.32 MiB**, above the soft budget.
- 32 therefore gives the best current balance of breadth, A priority, repository weight and
  manual source-review workload.

No acceptance-rate assumption is used to promise a resulting coverage number. The
117/214 figure is only the mathematical ceiling if all 32 targets pass sourcing.

## Deterministic Phase 4J selector

### Eligibility

A place is eligible only if:

1. it is grade A or B;
2. it has no registered local photograph;
3. its ID is not in the 11 carried fail-closed IDs.

At the Phase 4I base this yields exactly **108** candidates.

### Hub allocation

1. Sort nonempty eligible hubs by stable code-unit order.
2. Give one seat to each hub.
3. Allocate the remaining seats proportionally over residual eligible counts
   (`eligibleCount - 1`) using largest remainder.
4. Break equal remainders by stable UTF-16/code-unit hub key.

For a 32-place tranche this yields:

- Fukuoka: **1**
- Kioto: **7**
- Okinawa: **7**
- Osaka: **8**
- Tokio: **9**

Total: **32**.

### Within-hub priority

At each round, among candidates remaining in a hub, order by:

1. number already selected in the current tranche for that category — fewer first;
2. current catalog photograph count for that category — fewer first;
3. grade priority — A before B;
4. temporal-risk flag — non-temporal before temporal;
5. eligible count for the category — rarer first;
6. stable UTF-16/code-unit `placeId`.

This is intentionally not a hard A-first selector. A B place can precede an A place when it
repairs a materially weaker category-coverage position. Grade remains a tie-breaker inside the
coverage-balancing policy.

Temporal-risk detection keeps the existing event-category/name-token concept. The selector
does not infer current or 2027 event availability.

## Exact Phase 4J fixture

The selector above produces this exact 32-place set, in deterministic selection order:

| # | ID | Hub | Grade | Place |
|---:|---|---|:---:|---|
| 1 | JP-214 | Fukuoka | B | Yanagawa canal cruise |
| 2 | JP-100 | Kioto | B | Uzumasa Kyoto Village / Toei Kyoto Studio Park |
| 3 | JP-163 | Okinawa | A | Valley of Gangala |
| 4 | JP-123 | Osaka | B | Church of the Light |
| 5 | JP-013 | Tokio | A | Golden Gai |
| 6 | JP-073 | Kioto | A | Ōkōchi Sansō Garden |
| 7 | JP-183 | Okinawa | A | Gesashi Bay Mangrove Kayak |
| 8 | JP-120 | Osaka | A | teamLab Botanical Garden Osaka |
| 9 | JP-022 | Tokio | B | Ameyoko |
| 10 | JP-055 | Kioto | B | Sannenzaka and Ninenzaka |
| 11 | JP-194 | Okinawa | A | Banna Park |
| 12 | JP-211 | Osaka | A | AnimeJapan 2027 |
| 13 | JP-014 | Tokio | B | Omoide Yokocho |
| 14 | JP-059 | Kioto | A | Kōdai-ji |
| 15 | JP-189 | Okinawa | A | Irabu Bridge |
| 16 | JP-124 | Osaka | A | Osaka Aquarium Kaiyukan |
| 17 | JP-041 | Tokio | B | Unicorn Gundam at DiverCity |
| 18 | JP-078 | Kioto | A | Saiho-ji (Koke-dera) |
| 19 | JP-165 | Okinawa | A | Kudaka Island |
| 20 | JP-117 | Osaka | A | Osaka Castle Park and exterior |
| 21 | JP-043 | Tokio | A | SMALL WORLDS Miniature Museum |
| 22 | JP-060 | Kioto | A | Nanzen-ji |
| 23 | JP-168 | Okinawa | A | Yachimun no Sato |
| 24 | JP-138 | Osaka | B | Kobe Kitano Ijinkan |
| 25 | JP-006 | Tokio | A | Nezu Museum |
| 26 | JP-081 | Kioto | A | Ryōan-ji |
| 27 | JP-198 | Okinawa | A | Pinaisara Falls |
| 28 | JP-105 | Osaka | A | Hozenji Yokocho |
| 29 | JP-039 | Tokio | B | Toyosu Market |
| 30 | JP-212 | Osaka | A | Grand Sumo Tournament Osaka 2027 |
| 31 | JP-011 | Tokio | A | Tokyo Metropolitan Government Observatory |
| 32 | JP-047 | Tokio | A | Edo-Tokyo Open Air Architectural Museum |

Fixture properties:

- **32** targets
- **23 A / 9 B**
- hub quotas: Fukuoka 1 / Kioto 7 / Okinawa 7 / Osaka 8 / Tokio 9
- **19 distinct categories**
- zero C/D targets
- zero carried fail-closed IDs
- no currently covered place

Phase 4J must independently reproduce this exact output from the Phase 4I base before any
acquisition. If it differs, stop rather than reconciling the fixture manually.

## Sensitive and temporal subjects

The fixture intentionally does not pre-delete difficult subjects solely because they may be
harder to source. Acquisition remains fail-closed.

Notable sensitive/branded candidates include, at minimum:

- JP-120 teamLab Botanical Garden Osaka
- JP-041 Unicorn Gundam at DiverCity
- JP-043 SMALL WORLDS Miniature Museum

Phase 4J must prefer defensible exterior, entrance, architecture, signage or broad factual
place scenes where relevant and reject dominated protected artwork/character frames when the
existing subject-matter rule cannot be satisfied.

Temporal candidates include:

- JP-211 AnimeJapan 2027
- JP-212 Grand Sumo Tournament Osaka 2027

Prior-edition imagery may be accepted only when it accurately represents the named recurring
event/place and visible copy does not imply the photograph is from the 2027 edition. Photography
must not be used to infer 2027 schedule, availability or operating state.

## Failure semantics

**No replacement queue.**

Each of the exact 32 targets is attempted independently. A failed target remains uncovered.
No extra place is pulled in to preserve the count or asset utilization.

This keeps research scope bounded and makes the attempted set fully auditable.

## Asset budget

Phase 4J inherits:

- **10 MiB soft batch budget**
- **14 MiB hard stop/review threshold**

The 32-target observed envelope is 7.57–9.17 MiB, so the tranche is sized to remain below the
soft boundary under all three recent batch means.

Crossing 10 MiB is not automatically a defect, but must be documented. Approaching or
exceeding 14 MiB requires stopping before accepting additional assets.

Budget pressure never authorizes:

- quality-floor reduction solely for size;
- source/license-policy widening;
- replacing a heavy/failed target with another place;
- changing the one-photo-per-place rule.

## Preserved photography contract

Phase 4J must preserve:

- Wikimedia Commons only;
- current supported CC0 / CC BY / CC BY-SA allowlist;
- no NC, ND, fair-use or AI-generated substitute;
- current source provenance and visible attribution chain;
- separately source-backed attribution title only;
- unchanged local WebP derivative pipeline unless an independent blocking defect is found;
- canonical `data/visual/photography-metadata.json` as source of truth;
- byte-identical app-facing metadata copy;
- zero runtime Commons/Wikipedia/Creative Commons photography fetches;
- maximum one photograph per place;
- no legal-clearance claims.

## Phase 4J successor contract

Phase 4J is authorized only after Phase 4I itself passes its independent closure gate and is
merged.

Minimum Phase 4J preflight:

1. `main` must equal the exact Phase 4I merge commit.
2. Recompute the 85-photo starting registry and the 108-place A+B eligible universe.
3. Reproduce the exact 32-place fixture above and exact hub quotas.
4. Pin that fixture in focused tests before acquisition.
5. Confirm all 11 carried fail-closed IDs remain excluded.

Execution:

- maximum **32 attempts**;
- one image maximum per selected place;
- no substitutions;
- current source/license rules;
- manual visual/subject-match review for every accepted file;
- fail closed independently per place;
- preserve all pre-existing 85 blobs and records unless a separate source-drift defect is
  discovered and reported before mutation.

Validation minimum:

1. photography validator;
2. full Python test suite;
3. focused selector/photography/attribution tests;
4. full Vitest;
5. lint;
6. build;
7. exact target-set and grade-mix invariant;
8. exact accepted/fail-closed report;
9. batch-budget assertion;
10. all pre-existing 85 image blobs unchanged;
11. all pre-existing 85 metadata records unchanged;
12. canonical/app metadata byte parity;
13. one-photo-per-place invariant;
14. license allowlist unchanged;
15. zero runtime photo-provider fetches;
16. browser QA covering:
    - ordinary acquired A target;
    - acquired B target;
    - Fukuoka target if accepted;
    - sensitive/branded target if accepted;
    - temporal target if accepted;
    - failed-closed fallback if any;
17. hostile review;
18. repository-native exact-head CI;
19. temporary-workflow cleanup plus zero executable/data/test/asset drift proof.

Stop condition:

- leave the Phase 4J implementation PR **Draft** after exact-head validation and documentation;
- do not mark Ready;
- do not merge;
- do not close the implementation issue until a later independent closure gate.

## Phase 4I scope proof

Phase 4I is documentation/design only.

It authorizes no:
- image acquisition;
- metadata mutation;
- image-blob mutation;
- gallery/runtime change;
- ranking/recommendation/grade change;
- itinerary/routing/planning change;
- fail-closed retry;
- Phase 4J implementation work.

The only intended repository changes in this gate are this design document and the ROADMAP
record.
