# Phase 4K — Photography Coverage Strategy Design Gate

Status: **design complete; PR remains Draft pending independent closure gate**

- Base: `caccf2518f7f9adbf2c6c40a1a7f9ae045764221` (`main` after Phase 4J / PR #111)
- Issue: #112
- Branch: `docs/phase-4k-photography-coverage-strategy-design`
- Design date: **2026-09-16 (America/Mexico_City)**

Authority:
- `docs/AB_PHOTOGRAPHY_BATCH_RUNTIME.md`
- `docs/PHOTOGRAPHY_COVERAGE_REBALANCING_DESIGN.md`
- `docs/A_GRADE_PHOTOGRAPHY_BATCH_II_RUNTIME.md`
- `docs/PHOTOGRAPHY_SCALE_UP_II_DESIGN.md`
- `docs/ROADMAP.md` Phase 4J successor boundary

**This is a design/audit gate only.** No photograph was acquired, no photography metadata
or image blob changed, no runtime or dataset behavior changed, and no fail-closed ID was
retried. See *Design-only proof*.

## 1. Reproduced starting state

Every figure below was recomputed from `data/places.json` and
`data/visual/photography-metadata.json` by `scripts/analyze-phase4k-coverage-strategy.py`,
not read from documentation, and is pinned in `scripts/test_phase4k_coverage_strategy.py`.

| Quantity | Reproduced |
|---|---|
| total places | **214** |
| covered | **113** |
| uncovered | **101** |
| coverage | **52.8%** |
| max photographs per place | **1** |

### Grade coverage

| Grade | Covered | Total | % | Uncovered |
|---|---:|---:|---:|---:|
| S | 28 | 32 | 87.5% | 4 |
| A | 77 | 147 | 52.4% | 70 |
| B | 8 | 25 | 32.0% | 17 |
| C | 0 | 6 | 0.0% | 6 |
| D | 0 | 4 | 0.0% | 4 |

### Hub coverage

| Hub | Covered | Total | % |
|---|---:|---:|---:|
| Fukuoka | 1 | 1 | 100% |
| Kioto | 27 | 49 | 55.1% |
| Nagoya | 1 | 1 | 100% |
| Okinawa | 26 | 50 | 52.0% |
| Osaka | 27 | 53 | 50.9% |
| Sapporo | 3 | 3 | 100% |
| Tokio | 28 | 57 | 49.1% |

### Fail-closed set

All **15** carried fail-closed IDs are present in the dataset and **all 15 remain
uncovered**: `JP-033`, `JP-126`, `JP-203`, `JP-204` (4D); `JP-050`, `JP-195` (4F);
`JP-121`, `JP-156`, `JP-095`, `JP-079`, `JP-202` (4H); `JP-120`, `JP-211`, `JP-041`,
`JP-168` (4J). By grade they are 4 S, 10 A, 1 B — which is why the four uncovered S places
are absent from ordinary eligibility.

### Eligible universes after exclusions

| Scope | Eligible |
|---|---:|
| A only | **60** |
| A+B | **76** |
| all remaining grades (A+B+C+D) | **86** |

### Zero-photo categories

Exactly two of 29 categories hold no photograph: `🌌 Cielo nocturno` (sole member JP-195)
and `🐋 Fauna y experiencias estacionales` (sole member JP-202). **Both members are
carried fail-closed**, so neither category is reachable at any grade scope without a
separate re-entry gate. Category completion is therefore not an available objective for
any successor, at any size.

### Real asset evidence

Measured from the committed WebP assets using the append-only registry boundaries:

| Batch | Accepted | Bytes | Mean B/asset |
|---|---:|---:|---:|
| Phase 4D | 12 | 3,607,446 | 300,620 |
| Phase 4F | 22 | 5,457,240 | 248,056 |
| Phase 4H | 27 | 7,438,738 | 275,509 |
| Phase 4J | 28 | 9,672,140 | 345,434 |
| **combined** | **89** | **26,175,564** | **294,107.46** |

Observed batch-mean range: **248,056 – 345,434 B/asset**. The per-asset mean is **rising**,
and the most recent batch is the highest observed. That trend is used below rather than
assumed away.

Photography footprint measured at the Phase 4K base: **31.73 MiB across 113 assets**, which
is **78.5%** of the 40.39 MiB tracked repository at that commit. (The share dilutes slightly
as non-asset files are added; all figures here are the base-state values.)

## 2. Methodology

`scripts/analyze-phase4k-coverage-strategy.py` is pure and offline. It:

1. recomputes the live state from canonical files;
2. measures per-batch asset bytes from the committed assets;
3. generalises the Phase 4I coverage-balanced policy over a parameterised grade scope,
   tranche size and exclusion set;
4. evaluates every scope × size combination and reports grade mix, hub quotas, category
   breadth, temporal-risk count, coverage ceiling and byte projections.

**Policy fidelity is proven, not asserted.** Replaying the generalised selector against the
Phase 4J baseline (the registry's first 85 records) with the 11-ID exclusion set Phase 4J
actually used reproduces the pinned `data/visual/a-b-photography-batch.json` fixture
**exactly and in order** — same 108 eligible, same hub quotas, same 23 A / 9 B, same 19
categories, same 32 IDs in the same sequence. Any behavioural difference in this analysis
therefore comes from the inputs (scope, size, exclusion set), never from a drifted policy.

Projections use the weighted mean with the observed batch-mean range as a sensitivity band.
No acceptance-rate assumption is used to promise a coverage figure; where an expected value
is quoted it is labelled as such and derived from the pooled observed acceptance rate.

## 3. Strategy comparison

Coverage ceiling and byte projection are **identical across grade scopes** for a given
tranche size — *n* attempts can cover at most *n* more places whatever their grade. Raw
coverage percentage therefore cannot discriminate between these strategies at all, which is
precisely why it is not used as the objective. What differs is composition.

The decisive measurement is what each strategy does to the relationship between editorial
grade and photographic coverage, at a 32-target tranche (maximum case):

| Strategy | S | A | B | C | D | Grade→coverage ordering |
|---|---:|---:|---:|---:|---:|---|
| *current* | 88% | 52% | 32% | 0% | 0% | monotonic |
| Stop now | 88% | 52% | 32% | 0% | 0% | monotonic |
| A-only | 88% | **74%** | 32% | 0% | 0% | monotonic, A/B gap widens 20 → 42 pts |
| **A+B** | 88% | 69% | **60%** | 0% | 0% | **monotonic, A/B gap narrows to 9 pts** |
| A+B+C+D | 88% | 65% | 56% | **100%** | 50% | **broken — C exceeds S, A and B** |

### Stop photography scale-up at 52.8%

Rejected, but not weakly. The genuine achievements are real: every hub now has at least one
photograph, and every category that *can* be covered is covered. The remaining category
gaps are fail-closed and unreachable.

It is rejected because the dominant remaining gap is inside the primary editorial grade:
**70 of 147 A-grade places (47.6%) still render the "Sin fotografía disponible todavía"
fallback**, and 60 of them are ordinarily eligible. That is a visible product gap on the
grade the dataset itself ranks highest, and there is ample defensible supply to close part
of it. Stopping would freeze that gap for no reason other than fatigue.

### Continue A-only

Rejected. It maximises A movement (52% → 74%) but **leaves B frozen at 32%**, widening the
A/B gap from 20 to 42 points. Phase 4I opened B eligibility specifically to repair that
imbalance, and Phase 4J delivered on it (B moved 0% → 32%, and Fukuoka and Architecture were
unlocked). Reverting to A-only now would abandon a rebalancing that is only half done, and
would leave B — 25 places, a real slice of the catalogue — as the conspicuous weak grade.

### Continue A+B coverage-balanced — **selected**

Selected. It is the only strategy that both moves the primary grade materially (A 52% → 69%)
and continues repairing the secondary grade (B 32% → 60%), while preserving the monotonic
grade→coverage ordering. Supply is comfortable: 76 eligible, leaving 44 after a 32-target
tranche — enough for one further bounded batch before the question must be re-opened.

### Widen to A+B+C+D

Rejected, on three independent grounds.

**It inverts the editorial signal.** At 32 targets C would reach **100%** coverage — higher
than S (88%), A (65%) and B (56%). The current monotonic relationship between grade and
coverage would not merely weaken; it would reverse. A user browsing the app would find
complete photography on a deliberately de-prioritised grade and gaps on the top grade.
Photography coverage would become an *implicit recommendation signal pointing the wrong
way*. This is the specific risk Issue #112 asks about, and it is measured here, not assumed.

**The selector over-weights C/D structurally.** Because the coverage-balanced policy ranks
thin categories first, and C/D places sit in thin categories, widening does not merely admit
them — it front-loads them. At 16 targets C would take **25% of the tranche while being 7%
of the eligible pool — a 3.58× over-representation** (2.69× at 32). A third of a scarce
manual-research budget would go to the lowest-graded places while 60 A-grade places remain
uncovered.

**The breadth argument for widening is empirically false.** The four categories reachable
only through C/D — `🍜 Gastronomía`, `🛍️ Compras`, `📷 Fotografía`, `🎢 Entretenimiento` —
**already hold photographs** (4, 3, 1 and 1 respectively). C/D widening unlocks **zero** new
zero-photo categories. The only two genuinely empty categories are fail-closed. The apparent
breadth gain (13 → 16-17 distinct categories *within a tranche*) is within-tranche variety,
not repaired coverage.

The ten eligible C/D places are not obscure — they include Arashiyama Bamboo Grove, Nishiki
Market, Tsukiji Outer Market, Tsutenkaku and the Glico Running Man sign. That is the point:
they are famous places the dataset **deliberately grades low**, presumably on
value-for-time. Photographing them ahead of A-grade places would use photography to
contradict an editorial judgement the dataset makes on purpose. If those grades are wrong,
the correct fix is a grading review, not a photography batch — and grade changes are out of
scope for every phase in this series.

**Conclusion:** C and D stay intentionally uncovered while substantial A/B supply remains.
This is a deliberate, revisitable position, not an oversight.

## 4. Tranche size comparison

All rows use the reproduced figures; projections use the weighted mean with the observed
batch-mean sensitivity band. Grade mix and breadth shown for the selected A+B scope.

| Size | Grade mix | Categories | Hub quotas (K/Ok/Os/T) | Max coverage | Expected¹ | Projected | Sensitivity | A+B left |
|---:|---|---:|---|---|---|---:|---|---:|
| 16 | A14 B2 | 13 | 4/4/4/4 | 129 = 60.3% | ~59.2% | 4.49 MiB | 3.79–5.27 | 60 |
| 24 | A18 B6 | 13 | 5/6/6/7 | 137 = 64.0% | ~62.4% | 6.73 MiB | 5.68–7.91 | 52 |
| **32** | **A25 B7** | **13** | **7/8/8/9** | **145 = 67.8%** | **~65.6%** | **8.98 MiB** | **7.57–10.54** | **44** |
| 40 | A29 B11 | 13 | 9/10/10/11 | 153 = 71.5% | ~68.8% | 11.22 MiB | 9.46–13.18 | 36 |

¹ Expected coverage uses the pooled observed acceptance rate of **85.6%** (89 accepted of
104 attempted across 4D/4F/4H/4J). Per-batch acceptance was 75.0% / 91.7% / 84.4% / 87.5%.
The maximum column is the ceiling if every target passes sourcing; it is not a forecast.

**Category breadth does not discriminate.** A+B reaches **13 distinct categories at every
size from 16 to 40** — +8 targets buys +0 categories at every step. Breadth saturates
immediately, which is a genuine diminishing-return signal: no size can be justified on
breadth grounds. The remaining objective is per-place visual completeness within A and B.

**40 is rejected on asset risk.** Its sensitivity band reaches **13.18 MiB**, within 6% of a
14 MiB hard stop. That is not a remote tail: the high end of the band is the *most recent*
batch's mean (Phase 4J, 345,434 B/asset), and the trend across 4F → 4H → 4J is rising as
A-grade supply depletes and accepted sources skew larger. A tranche whose likely-case
projection sits just under the hard stop leaves no room for the batch to be slightly worse
than the last one. It also consumes supply fastest, leaving 36 eligible.

**16 and 24 are rejected on fixed-cost efficiency.** Each tranche carries the same fixed
overhead regardless of size: a design gate, a selector preflight, exact-head CI, browser QA,
a runtime document, workflow cleanup and an independent closure review. Phases 4H and 4J
each attempted 32 and each completed in one bounded session with full manual inspection of
every accepted candidate, so 32 is a demonstrated-sustainable workload, not an estimate.
Choosing 16 would roughly double the number of gates needed for the same coverage, spending
review capacity on process rather than photographs.

**32 is selected.** It matches demonstrated throughput, projects 8.98 MiB centrally with a
worst-observed case of 10.54 MiB that stays far below the hard stop, moves A by 17 points
and B by 28, and leaves 44 eligible — enough for exactly one more comparable tranche before
the strategy must be re-examined. It remains meaningfully bounded: 32 of 76 eligible, a
single reviewable batch.

## 5. Asset budget re-evaluation

The 10 MiB soft / 14 MiB hard thresholds are **not inherited blindly**.

The 10 MiB soft budget is now mis-calibrated. At 32 accepted assets, the highest observed
batch mean projects **10.54 MiB** — the soft budget would be breached by a batch that is
merely as heavy as the last one. A soft budget that fires on the expected-to-high case stops
being a signal and becomes noise, and Phase 4J already landed at 9.22 MiB for only 28
accepted.

**Revised budget for the successor:**

- **soft budget: 11 MiB** — set just above the worst observed per-asset mean applied to 32
  accepted (10.54 MiB), so it flags a genuinely unusual batch rather than an ordinary one.
  Crossing it still requires explicit documentation.
- **hard stop / review threshold: 14 MiB — unchanged.** Reaching it at 32 accepted would
  require **458,752 B/asset, 33% above the worst observed batch mean**. It remains a real
  safety margin, so there is no evidence-based reason to move it.

This raises the soft threshold and leaves the hard control untouched. Budget pressure must
still never cause license or source widening, quality-floor reduction, substitutions or
second images; if the hard stop is approached, acquisition stops for review before accepting
further assets.

## 6. Selector design

**The Phase 4I coverage-balanced selector is retained.** It is kept because its behaviour
was validated in production, not because it is incumbent: Phase 4J's outcome is exactly what
the policy was designed to produce — Fukuoka's first photograph, both Architecture places,
and hub quotas that tracked eligible supply. The replay test in §2 proves the policy
reproduces Phase 4J's pinned fixture exactly, so retaining it is a verified no-change.

Rules, unchanged from Phase 4I:

**Eligibility.** A place is eligible only if it is grade A or B, has no registered local
photograph, and is not in the carried fail-closed set.

**Hub allocation.** Sort nonempty eligible hubs by stable code-unit order; give one seat to
each; allocate remaining seats proportionally over residual eligible counts
(`eligibleCount - 1`) by largest remainder; break equal remainders by stable code-unit hub
key.

**Within-hub priority.** At each round, among remaining candidates in a hub, order by:
1. count already selected in this tranche for that category — fewer first;
2. current catalogue photograph count for that category — fewer first;
3. grade priority — A before B;
4. temporal-risk flag — non-temporal before temporal;
5. eligible count for the category — rarer first;
6. stable code-unit `placeId`.

Grade remains a tie-break inside a coverage-balancing policy rather than a hard A-first
sort, so a B place may precede an A place when it repairs a materially weaker category
position.

### The one required change

The Phase 4J selector script hard-codes **11** fail-closed IDs. Phase 4J closed four more
(`JP-120`, `JP-211`, `JP-041`, `JP-168`). A successor that reused
`scripts/select-ab-photography-batch.py` unchanged would **silently re-admit all four
failed-closed places into its fixture**.

The successor must therefore ship its **own selector script** carrying the full **15**-ID
exclusion set. It must not edit `scripts/select-ab-photography-batch.py`, because that file
is pinned by `scripts/test_ab_photography_selector.py` to reproduce the Phase 4J fixture
exactly; changing its exclusion set would break that historical regression. This matches the
established repository pattern, where each phase ships a selector carrying the exclusion set
as of its own design (4 → 6 → 11 → 15).

**No replacement queue.** Each target is attempted independently and every failure remains
uncovered. No concrete advantage for a replacement queue was found: it would reintroduce
selection order dependence on sourcing outcomes, making the fixture non-reproducible from
canonical data alone — the property every phase since 4E has relied on for preflight.

**No manual cherry-picking.** The fixture below is the verbatim selector output.

## 7. Exact successor fixture

Pinned at `data/visual/phase4k-successor-fixture.json`, generated by
`python3 scripts/analyze-phase4k-coverage-strategy.py --fixture-out …` and byte-stable
across repeated runs.

Properties: **32** targets · **25 A / 7 B** · **13** distinct categories · hub quotas
Kioto 7 / Okinawa 8 / Osaka 8 / Tokio 9 · eligible universe **76** · zero C/D · zero
fail-closed · zero already-covered · one intended image each.

| # | ID | Hub | Grade | Place |
|---:|---|---|:---:|---|
| 1 | JP-084 | Kioto | A | Shisen-dō |
| 2 | JP-190 | Okinawa | A | Toriike Ponds |
| 3 | JP-149 | Osaka | A | MIHO Museum |
| 4 | JP-012 | Tokio | B | Kabukicho |
| 5 | JP-062 | Kioto | A | Eikan-dō |
| 6 | JP-176 | Okinawa | A | Kouri Island and bridge |
| 7 | JP-122 | Osaka | A | Minoh Falls |
| 8 | JP-213 | Tokio | B | Tokyo Marathon 2027 |
| 9 | JP-087 | Kioto | A | Hōsen-in |
| 10 | JP-200 | Okinawa | A | Yonaguni Island and underwater monument |
| 11 | JP-112 | Osaka | A | Umeda Sky Building |
| 12 | JP-053 | Tokio | A | Edo-Tokyo Museum |
| 13 | JP-064 | Kioto | A | Hōnen-in |
| 14 | JP-158 | Okinawa | A | Tamaudun Royal Mausoleum |
| 15 | JP-113 | Osaka | A | Grand Green Osaka |
| 16 | JP-007 | Tokio | A | Ota Memorial Museum of Art |
| 17 | JP-063 | Kioto | B | Philosopher's Path |
| 18 | JP-185 | Okinawa | A | Furuzamami Beach |
| 19 | JP-130 | Osaka | B | Nara Park deer |
| 20 | JP-042 | Tokio | B | Odaiba Seaside Park + Rainbow Bridge |
| 21 | JP-065 | Kioto | A | Ginkaku-ji |
| 22 | JP-172 | Okinawa | B | Cape Manzamo |
| 23 | JP-139 | Osaka | A | Nunobiki Falls and Herb Gardens |
| 24 | JP-051 | Tokio | A | Mount Takao |
| 25 | JP-067 | Kioto | A | Tōfuku-ji |
| 26 | JP-169 | Okinawa | A | Zakimi Castle Ruins |
| 27 | JP-114 | Osaka | A | Nakanoshima waterfront |
| 28 | JP-020 | Tokio | A | The Sumida Hokusai Museum |
| 29 | JP-186 | Okinawa | A | Aka Island |
| 30 | JP-140 | Osaka | B | Mount Rokko night view |
| 31 | JP-052 | Tokio | A | Mount Mitake and Musashi Mitake Shrine |
| 32 | JP-017 | Tokio | A | Asakusa Culture Tourist Information Center |

Category spread: Templos 4; Jardines 3; Arte 3; Nocturno 3; Playa/mar/islas 3;
Senderismo 3; Miradores 3; Extraño 2; Naturaleza 2; Historia 2; Ciudad 2; Eventos 1;
Museos 1.

### Flagged sourcing risks

The fixture is not pre-filtered for difficulty; acquisition remains fail-closed. Targets the
successor should expect to scrutinise:

- **JP-213 Tokyo Marathon 2027** — the only temporal-risk target (1 of 32). Prior-edition
  imagery only, and no inference of a 2027 date, route, entry or operating state.
- **JP-053 Edo-Tokyo Museum** — under long-term renovation closure; any photograph
  necessarily depicts a prior state and must not imply current operating status.
- **JP-113 Grand Green Osaka** — a recent development; Commons supply may be thin or absent.
- **JP-130 Nara Park deer** and **JP-200 Yonaguni underwater monument** — subject-match
  care: the named place, not generic wildlife or generic diving imagery.
- **JP-149 MIHO Museum** — architectural work; the existing architecture handling applies.

These are notes for the successor's manual review, not pre-emptive exclusions.

## 8. Preserved contracts

**First-photo-first**, unchanged: maximum one registered photograph per place; no
second-image expansion; no gallery redesign; no photography-derived ranking, recommendation,
itinerary, routing or grade behaviour.

**Source/license/runtime**, unchanged: Wikimedia Commons only; existing CC0 / CC BY / CC BY-SA
allowlist; no NC, ND, fair-use or AI substitutes; verify current file page, creator, license,
license URL, Commons filename, acquisition URL and dimensions; attribution title only when
separately source-backed; local WebP derivatives; zero runtime photography-provider requests;
fail closed on uncertain license, source, location, privacy or subject match; no
legal-clearance claims.

## 9. Fail-closed policy

All **15** IDs remain excluded from ordinary selector eligibility. The successor fixture
contains none of them. No fail-closed target was retried, and no new imagery was researched,
in Phase 4K.

Re-entry requires materially new sourcing evidence and a separately documented design
decision. Two observations are recorded for a possible future re-entry gate, and are
explicitly **not** acted on here:

- `JP-195` and `JP-202` are the sole members of the only two zero-photo categories, so they
  are the only targets whose re-entry could change category coverage at all. That is a
  reason to consider a dedicated re-entry research gate eventually — not a reason to retry
  them inside an ordinary tranche.
- `JP-120`, `JP-211` and `JP-041` failed on subject/venue availability and protected-subject
  grounds rather than on a licensing error, so a future gate would need materially new
  Commons supply, not a re-reading of the same files.

Nothing above authorises a retry.

## 10. Successor contract — Phase 4L

One narrow executable successor is authorised. It is **not started by Phase 4K**.

- **Exact base:** the merge commit of the Phase 4K design PR into `main`.
- **Grade scope:** A and B only. No C, no D, no S.
- **Exact fixture:** the 32 IDs above, reproduced byte-for-byte from
  `data/visual/phase4k-successor-fixture.json` before any acquisition.
- **Max attempts:** 32. No replacement queue, no substitutions.
- **Selector:** a new script carrying the full 15-ID exclusion set;
  `scripts/select-ab-photography-batch.py` must not be modified.
- **Fail-closed semantics:** each target attempted independently; any sourcing, license,
  location, privacy, subject-match or temporal failure leaves the place uncovered.
- **Asset budget:** 11 MiB soft (documented if crossed), 14 MiB hard stop/review.
- **Preflight:** verify base, reproduce 214/113/101, reproduce the 76-place A+B eligible
  universe, reproduce the exact fixture in order, confirm all 15 fail-closed still excluded
  and uncovered; stop and report on any divergence rather than reconciling.
- **Validation:** photography validator; full Python suite; focused selector/photo/
  attribution tests; full Vitest; lint; build; exact target-set, grade-mix and hub-quota
  invariants; accepted/fail-closed report; asset-budget assertion; all 113 prior metadata
  records unchanged; all 113 prior blobs byte-identical; no second image; canonical/app byte
  parity; license allowlist unchanged; zero runtime photography-provider requests;
  whitespace gate.
- **Browser QA:** ordinary acquired A target; acquired B target; temporal target if accepted
  (JP-213); any branded/sensitive target if accepted; a fail-closed fallback if any target
  fails; zero runtime photography fetches. Run the Phase 4L audit twice and re-run the
  Phase 4J/4H/4F/4D/4C regressions.
- **Exact-head CI:** repository-native workflow pinned to the exact executable/test HEAD.
- **Cleanup:** remove temporary Phase 4L workflows and prove zero drift in `scripts/`,
  `app/src/`, `app/scripts/`, `data/` and `app/public/images/` from the validated HEAD.
- **Registry hygiene:** when Phase 4L checks in its acquisition manifest under
  `data/visual/*-batch*.json`, it must register it in
  `scripts/photography_baseline.py::ACQUISITION_BATCH_MANIFESTS`, or the completeness guard
  will fail the historical selector fixtures. The Phase 4K design fixture is deliberately
  named outside that glob because it is not an acquisition manifest.
- **Stop condition:** leave the Phase 4L PR **Draft** after exact-head validation and
  documentation. Do not mark Ready, do not merge, do not close its issue.

### Mandatory re-evaluation after Phase 4L

Phase 4L authorises **no** automatic successor. After it, A+B eligible supply falls to about
44, A coverage reaches roughly 69% and B roughly 60%. At that point the stop-versus-continue
question must be re-opened in a fresh design gate, with the C/D question re-examined against
the grade→coverage ordering evidence in §3 rather than re-litigated from scratch.

## 11. Scope boundary

Phase 4K does **not** authorise: acquiring photographs; changing photography metadata or
image blobs; changing runtime, gallery, ranking, recommendation, itinerary, routing or grade
data; retrying any fail-closed ID; starting Phase 4L; second images; license or source
policy widening; or grade changes to make C/D places eligible.

## 12. Design-only proof

`scripts/test_phase4k_coverage_strategy.py` asserts against the exact Phase 4K base
`caccf2518f7f9adbf2c6c40a1a7f9ae045764221` that:

- `data/visual/photography-metadata.json` is byte-identical to the base;
- `app/src/data/photography-metadata.json` is byte-identical to the base;
- `data/places.json` is byte-identical to the base;
- canonical and app photography metadata remain in byte parity;
- the entire `app/public/images/places/` tree is identical to the base, blob for blob.

Phase 4K adds only: this document, the ROADMAP entry, the analysis script, its tests, and
the pinned successor fixture.

## 13. Independent closure review

Reviewed against the exact base `caccf2518f7f9adbf2c6c40a1a7f9ae045764221`, at design HEAD
`ddf67e34342001946f65d22edf804c7eede7785f`, on 2026-09-16.

The review deliberately did **not** rely on the Phase 4K tests or import
`scripts/analyze-phase4k-coverage-strategy.py`. Every material figure was re-derived from
the canonical files by a separate implementation, so agreement is corroboration rather than
tautology.

### Independently reproduced

- 214 places, 113 covered, 101 uncovered, 52.8%, maximum one photograph per place, and the
  `imageCount` field agreeing with the record count.
- Grade coverage S 28/32, A 77/147, B 8/25, C 0/6, D 0/4, summing to 214.
- Hub coverage Fukuoka 1/1, Kioto 27/49, Nagoya 1/1, Okinawa 26/50, Osaka 27/53,
  Sapporo 3/3, Tokio 28/57, summing to 214 with no eighth hub.
- All 15 carried fail-closed IDs exist, remain uncovered, and split 4 S / 10 A / 1 B; the
  four uncovered S places are exactly the fail-closed S set.
- Eligible universes A 60, A+B 76, A+B+C+D 86, the last breaking down A 60 / B 16 / C 6 /
  D 4, consistent with 17 uncovered B minus one fail-closed B.
- Exactly two zero-photo categories, each with a single member, both fail-closed.
- Asset evidence re-measured from the real WebP files, with the batch boundaries re-derived
  from the registry's git history rather than taken from the script: 4D 12/3,607,446 B,
  4F 22/5,457,240 B, 4H 27/7,438,738 B, 4J 28/9,672,140 B, combined 89/26,175,564 B,
  weighted mean 294,107.46 B/asset, batch means rising 248,056 → 275,509 → 345,434.
- All four projections and sensitivity bands, the 10.54 MiB worst case at 32 that justifies
  moving the soft budget to 11 MiB, and the 458,752 B/asset (≈33% above the worst observed
  mean) that justifies leaving the 14 MiB hard stop untouched.
- The grade→coverage tables for all three strategies at 32, the monotonicity break under
  C/D, C over-representation of 3.58× at n=16 and 2.69× at n=32, the four
  C/D-only categories all already holding photographs, and breadth saturating at 13.

### Selector and fixture

The documented policy was re-implemented from the design text and the historical Phase 4J
temporal definition. That independent implementation reproduces:

- the pinned Phase 4J fixture **exactly and in order** from the 85-record baseline with the
  historical 11-ID exclusion set, confirming the policy is unchanged; and
- the pinned Phase 4K successor fixture **exactly and in order**, confirming the fixture is
  the deterministic output of the written rules and not cherry-picked.

The shipped script is deterministic across repeated runs, regenerates the checked-in fixture
byte-for-byte, contains no hard-coded place-ID list, performs no network access, and writes
nothing unless an output path is passed. Editing the historical Phase 4J selector to carry
15 IDs was simulated and does break its pinned regressions (4 failures), confirming the
successor needs its own selector; the file was restored and re-verified green.

### Finding: the A/B ordering is safe at 32 but not at 40

The design states that A+B preserves the monotonic grade→coverage ordering, scoped to a
32-target tranche. That is accurate at 32 (S 88 ≥ A 69 ≥ B 60). A size sweep run during this
review shows the property is **size-dependent**: under A+B, **B overtakes A at n = 40**
(A 72.1%, B 76.0%), because B's denominator is only 25 places, so each accepted B photograph
moves B by 4 points against 0.68 points for A. The first inverting size is exactly 40; every
size from 16 to 39 preserves the ordering.

This does not weaken the decision — it strengthens it. It supplies a **second, independent
reason to reject 40**, which the design rejected on asset-budget grounds alone, and it
confirms the selected size of 32 sits safely below the crossover.

It does, however, matter for what comes after. The authorised tranche leaves A at ~69% and
B at ~60% with 35 A and 9 B eligible. A later tranche that drew heavily on the remaining B
supply could invert the ordering that this gate went to some trouble to protect. The
mandatory re-evaluation after Phase 4L must therefore check the projected A/B ordering
explicitly, not only the asset budget, before authorising any further size or scope.

No other defect was found. Recorded as a documentation finding; no executable, data, asset
or fixture change was required.

### Gates re-run at closure

Phase 4K tests 20 OK · full Python suite 495 OK · photography validator OK · selector and
manifest regressions 30 OK · Phase 4E/4G historical baselines reconstruct at 36 and 58 ·
acquisition-manifest registry guard complete, with the Phase 4K fixture correctly not
treated as an acquisition manifest · full Vitest 2439 tests / 65 files OK · lint clean ·
build OK · whitespace gate clean.

### Scope re-proved at closure

Against the exact base: `data/visual/photography-metadata.json`,
`app/src/data/photography-metadata.json` and `data/places.json` byte-identical;
canonical/app parity holds; `app/public/images/places/` identical blob-for-blob across all
113 blobs; exactly five changed files; no runtime, gallery, ranking, recommendation,
itinerary, routing or dataset file touched; no grade changed; no photograph acquired and no
fail-closed ID retried.

### Closure decision

The evidence supports the Phase 4K decision. **Approved for merge**: one bounded A+B
coverage-balanced successor tranche of 32, soft budget 11 MiB, hard stop 14 MiB, all 15
fail-closed IDs excluded, followed by a fresh stop-versus-continue gate that must also check
the projected A/B ordering.

The next authorised work is **Phase 4L — A+B Licensed Photography Acquisition Batch II**,
based on the new `main` after this merge. Phase 4L executes the fixture pinned here and does
not redesign the strategy unless it finds a real divergence during its own preflight.
Phase 4L is **not started** by this closure.
