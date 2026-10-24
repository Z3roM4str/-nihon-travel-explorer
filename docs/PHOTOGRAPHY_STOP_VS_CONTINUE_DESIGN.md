# Phase 4M — Post-4L Photography Stop-vs-Continue Design Gate

Status: **design complete; PR remains Draft pending independent closure gate**

- Base: `5707c1405febdb467d2af991eb21e731b887b6cd` (`main` after Phase 4L / PR #115)
- Issue: #116
- Branch: `docs/phase-4m-photography-stop-vs-continue-gate`
- Design date: **2026-09-16 (America/Mexico_City)**

Authority:
- `docs/PHOTOGRAPHY_COVERAGE_STRATEGY_DESIGN.md` (Phase 4K design + closure review)
- `docs/AB_PHOTOGRAPHY_BATCH_II_RUNTIME.md` (Phase 4L runtime)
- `docs/AB_PHOTOGRAPHY_BATCH_RUNTIME.md`, `docs/A_GRADE_PHOTOGRAPHY_BATCH_II_RUNTIME.md`
- `docs/PHOTOGRAPHY_COVERAGE_REBALANCING_DESIGN.md`, `docs/PHOTOGRAPHY_SCALE_UP_II_DESIGN.md`
- `docs/ROADMAP.md` Phase 4K closure and Phase 4L successor-gate requirement

**This is a design/audit gate only.** No photograph was acquired, no photography metadata or
image blob changed, no runtime, gallery, ranking, recommendation, itinerary, routing or grade
behaviour changed, and no fail-closed ID was retried or researched. See §13.

**Decision: STOP.** Photography is declared complete for Nihon v1 at 144/214. No Phase 4N
acquisition is authorised. The next authorised project work is the **Nihon Release Candidate /
whole-product closure audit**. Reasoning in §8–§10; the case against is in §12.

---

## 1. Divergence found — reported, not reconciled

Issue #116 carries one figure forward from Phase 4L that does not reproduce.

| Figure | Issue #116 / Phase 4L | Independently reproduced | Status |
|---|---|---|---|
| Remaining ordinary A+B eligible universe | **45 places — 35 A / 10 B** | **44 places — 35 A / 9 B** | **diverges** |
| B ceiling if A+B is exhausted | 96.0% (24/25) | **92.0% (23/25)** | **diverges** |
| Everything else in §"Starting state to reproduce independently" | — | — | reproduces exactly |

**Cause.** The carried fail-closed set holds **two** B-grade places, not one: `JP-041`
(Unicorn Gundam at DiverCity, closed by Phase 4J) and `JP-140` (Mount Rokko night view, closed
by Phase 4L). Eleven B places are uncovered; subtracting both leaves **9** eligible, not 10.
Phase 4L's successor-gate note subtracted only `JP-041` — it computed the remaining universe
against the inherited 15-ID set in the same paragraph in which it created the sixteenth
exclusion. The error is arithmetic in a derived carry-forward figure only; Phase 4L's
acquisition, registry, assets and result are unaffected, and every mandated starting-state
figure in §"Starting state to reproduce independently" reproduces exactly.

**Consequence, which is material.** Phase 4L projected that exhausting the A+B universe would
invert the A/B ordering (A 93.2% vs B 96.0%). With the corrected universe it does **not**:
exhausting 35 A and 9 B yields **A 93.2% vs B 92.0%**, ordering preserved. The A/B inversion
risk this gate was told to police is therefore *narrower* than the carry-forward claimed — it
is a property of a B-weighted **mix**, not of exhaustion. §5 supersedes Phase 4L's projection
table in full.

This divergence is reported rather than silently reconciled. It does not change the mandated
base, branch, contract or any forbidden action, and it authorises nothing; every figure below
is recomputed from canonical data at the exact base. Phase 4L's own documents and the
ROADMAP's Phase 4L section are historical records of that phase and are **not** edited by this
gate; the correction is recorded here and in this phase's ROADMAP entry.

## 2. Reproduced starting state

Every figure was recomputed from `data/places.json` and `data/visual/photography-metadata.json`
by `scripts/analyze-phase4m-stop-vs-continue.py`, and pinned in
`scripts/test_phase4m_stop_vs_continue.py`. Nothing here is read from documentation.

| Quantity | Reproduced | Issue #116 |
|---|---|---|
| total places | **214** | 214 ✓ |
| covered | **144** | 144 ✓ |
| uncovered | **70** | 70 ✓ |
| coverage | **67.3%** | 67.3% ✓ |
| max photographs per place | **1** | 1 ✓ |
| `imageCount` field vs record count | 144 = 144 | — |
| canonical vs app registry | byte-identical | — |

### Grade coverage

| Grade | Covered | Total | % | Uncovered | of which fail-closed |
|---|---:|---:|---:|---:|---:|
| S | 28 | 32 | **87.5%** | 4 | **4** |
| A | 102 | 147 | **69.4%** | 45 | 10 |
| B | 14 | 25 | **56.0%** | 11 | **2** |
| C | 0 | 6 | 0.0% | 6 | 0 |
| D | 0 | 4 | 0.0% | 4 | 0 |

Grades sum to 214. Editorial ordering S > A > B > C > D holds today.

### Hub coverage

| Hub | Covered | Total | % |
|---|---:|---:|---:|
| Fukuoka | 1 | 1 | 100% |
| Kioto | 34 | 49 | 69.4% |
| Nagoya | 1 | 1 | 100% |
| Okinawa | 34 | 50 | 68.0% |
| Osaka | 34 | 53 | 64.2% |
| Sapporo | 3 | 3 | 100% |
| Tokio | 37 | 57 | 64.9% |

Hubs sum to 214 with no eighth hub. All seven match Issue #116 exactly.

### Fail-closed set — all 16 present, all uncovered

| Phase | IDs | Grades |
|---|---|---|
| 4D | JP-033, JP-126, JP-203, JP-204 | S ×4 |
| 4F | JP-050, JP-195 | A ×2 |
| 4H | JP-121, JP-156, JP-095, JP-079, JP-202 | A ×5 |
| 4J | JP-120, JP-211, JP-041, JP-168 | A ×3, **B ×1** |
| 4L | JP-140 | **B ×1** |

Split **4 S / 10 A / 2 B**. All 16 exist in the dataset and all 16 are uncovered.
**The four uncovered S places are exactly the four fail-closed S places** — a fact §4 turns
into the binding constraint of this gate.

### Eligible universes after the 16 exclusions

| Scope | Eligible | Grade breakdown |
|---|---:|---|
| A only | **35** | A 35 |
| A+B | **44** | A 35, **B 9** |
| A+B+C+D | **54** | A 35, B 9, C 6, D 4 |

Hub breakdown of the A+B universe: Kioto 10, Okinawa 10, Osaka 11, Tokio 13. No eligible
place sits in Fukuoka, Nagoya or Sapporo — those hubs are already complete.

### Zero-photo categories

Exactly **two** of 29 categories hold no photograph, unchanged since Phase 4K:

| Category | Sole member | Status |
|---|---|---|
| 🌌 Cielo nocturno | JP-195 Yaeyama stargazing | fail-closed (4F) |
| 🐋 Fauna y experiencias estacionales | JP-202 Kerama whale watching | fail-closed (4H) |

Both are single-member categories and both members are carried fail-closed. **Category
completion is unreachable at any grade scope and any tranche size**, without a separate
re-entry gate that this phase does not authorise.

### Phase 4L result, re-verified

| Quantity | Reproduced | Issue #116 |
|---|---|---|
| attempted | 32 | 32 ✓ |
| accepted | 31 (registry 113 → 144) | 31 ✓ |
| failed closed | JP-140 | JP-140 ✓ |
| asset delta | 9,187,992 B = **8.762 MiB** | 8.76 MiB ✓ |

## 3. Asset evidence through Phase 4L

Measured from the committed WebP files using the append-only registry boundaries. Phase 4A
predates the current resize/quality contract, so it is reported but excluded from the mean.

| Batch | Attempted | Accepted | Bytes | Mean B/asset |
|---|---:|---:|---:|---:|
| Phase 4A | — | 24 | 7,090,836 | 295,452 |
| Phase 4D | 16 | 12 | 3,607,446 | 300,620 |
| Phase 4F | 24 | 22 | 5,457,240 | 248,056 |
| Phase 4H | 32 | 27 | 7,438,738 | 275,509 |
| Phase 4J | 32 | 28 | 9,672,140 | 345,434 |
| **Phase 4L** | **32** | **31** | **9,187,992** | **296,387** |
| **4D–4L combined** | **136** | **120** | **35,363,556** | **294,696.30** |

The **11/14 MiB budget is not inherited blindly.** Recomputed with Phase 4L included:

- Weighted mean **294,696 B/asset** — essentially flat against Phase 4K's 294,107 (+0.2%).
- Observed batch-mean range **248,056 – 345,434 B/asset**, unchanged at both ends.
- **The rising trend Phase 4K flagged did not continue.** Phase 4K reported 4F → 4H → 4J
  rising and treated the most recent batch as the worst case. Phase 4L came in at 296,387,
  *below* the Phase 4J peak and within 1% of the five-batch weighted mean. The series is
  4D 300,620 → 4F 248,056 → 4H 275,509 → 4J 345,434 → 4L 296,387: noisy around ~295k, not
  monotonically rising. The asset-growth argument against a large tranche is therefore
  **weaker** than Phase 4K believed, and is not used as a reason to stop.
- Pooled acceptance rate **120/136 = 88.2%** (was 85.6% through 4J). Per batch: 75.0% /
  91.7% / 84.4% / 87.5% / 96.9%.

**Footprint at the exact base:** photography is **42,454,392 B = 40.49 MiB across 144
assets**, which is **82.1%** of the 49.33 MiB tracked repository.

Projected deltas for each candidate tranche (weighted mean, with the observed batch-mean
range as the sensitivity band):

| Size | Projected | Sensitivity | Expected accepted @ 88.2% |
|---:|---:|---|---:|
| 8 | 2.25 MiB | 1.89 – 2.64 | 7.1 |
| 12 | 3.37 MiB | 2.84 – 3.95 | 10.6 |
| 16 | 4.50 MiB | 3.79 – 5.27 | 14.1 |
| 24 | 6.75 MiB | 5.68 – 7.91 | 21.2 |
| 32 | 8.99 MiB | 7.57 – 10.54 | 28.2 |

No candidate size breaches the 14 MiB hard stop, and only n = 32's worst case approaches the
11 MiB soft budget. **Asset economics do not, on their own, forbid another tranche.** They are
recorded here so the decision rests on product value rather than on a budget scare.

## 4. The binding constraint: the editorial ordering has a permanent ceiling

This is the finding that decides the gate, and neither Phase 4K nor Phase 4L measured it.

Every phase since 4I has treated **monotonic S ≥ A ≥ B ≥ C ≥ D coverage** as an invariant:
photography must not become a signal that contradicts the dataset's own editorial grading.
Phase 4K and Phase 4L both policed that invariant at the **A/B** boundary only.

**S is frozen at 87.5% permanently.** All four uncovered S places — JP-033 teamLab Borderless,
JP-126 SUPER NINTENDO WORLD, JP-203 Tokyo Disneyland, JP-204 Tokyo DisneySea — are carried
fail-closed. No ordinary tranche can raise S at any size or scope, ever, because no ordinary
tranche may attempt them.

Therefore the invariant imposes a **hard, permanent budget on A**:

- A crosses 87.5% at 129/147 = 87.8%, i.e. after **27** further accepted A photographs.
- So at most **26** further A photographs may *ever* be accepted, across all future phases
  combined, while the ordering holds. A's permanent monotonic ceiling is **128/147 = 87.1%**.
- **9 of the 35 ordinarily eligible A places can therefore never be photographed** under the
  stated invariant, no matter how many phases run.

Combining both boundaries (S ≥ A and A ≥ B), the maximum end state any sequence of future
tranches can reach while preserving the editorial ordering is:

| | Further photos | A after | B after | Total coverage |
|---|---:|---:|---:|---:|
| **Monotonic programme ceiling** | **33** (26 A + 7 B) | 87.1% | 84.0% | **177/214 = 82.7%** |

Not 87.9% (the A+B supply ceiling) and not 92.5% (the all-grade ceiling). **82.7%, and then
the programme is structurally finished** with 37 places permanently uncovered: 16 fail-closed,
10 C/D deliberately deprioritised, 9 A and 2 B locked out by the ordering invariant itself.

Run against the incumbent coverage-balanced selector, the largest tranche that remains fully
monotonic is **n = 30** (A 26 / B 4 → A 87.1%, B 72.0%); n = 31 and above invert S ≥ A. So
continuation does not mean "one more tranche, then re-open the question". It means **exactly
one legal move remains, and it terminates the programme regardless.** The stop-versus-continue
question is really: stop at 67.3% now, or stop at ≤82.7% after one more full gate cycle.

## 5. Mix-aware A:B analysis — supersedes Phase 4L's projection table

Per Issue #116 §4, A+B is evaluated by **mix**, not by size. With `a` accepted A and `b`
accepted B photographs, B overtakes A exactly when (14 + b)/25 > (102 + a)/147.

Asymmetry, reproduced: A moves **0.680** points per photograph, B moves **4.000** — a
**5.88:1** ratio. Current gap **13.4** points. Issue #116's 4.0 / ~0.68 / 13.4 all reproduce.

**B-only inversion:** **4** B photographs with no A would invert the ordering (B 72.0% vs
A 69.4%). Issue #116 and Phase 4L both state 4; confirmed.

**Exhaustion does *not* invert** (this is where the §1 divergence bites): 35 A + 9 B gives
A 93.2% vs B 92.0%, ordering preserved on the A/B boundary. Phase 4L's table said B 96.0%
and "B overtakes A". That row is wrong and is superseded.

### Full mix sweep

Each cell is the post-tranche state. `✗` marks an A/B inversion; `‡` marks an S/A inversion
(§4); a mix is fully monotonic only when it carries neither.

| n | A:B mix | A after | B after | A−B gap | verdict |
|---:|---|---:|---:|---:|---|
| 8 | 8:0 | 74.8% | 56.0% | +18.8 | ok |
| 8 | 6:2 | 73.5% | 64.0% | +9.5 | ok |
| 8 | **4:4** | **72.1%** | **72.0%** | **+0.1** | ok — but see fragility below |
| 8 | 3:5 | 71.4% | 76.0% | −4.6 | ✗ |
| 8 | 0:8 | 69.4% | 88.0% | −18.6 | ✗ |
| 12 | 8:4 | 74.8% | 72.0% | +2.8 | ok |
| 12 | 7:5 | 74.1% | 76.0% | −1.9 | ✗ |
| 16 | 11:5 | 76.9% | 76.0% | +0.9 | ok |
| 16 | 10:6 | 76.2% | 80.0% | −3.8 | ✗ |
| 24 | 18:6 | 81.6% | 80.0% | +1.6 | ok |
| 24 | 17:7 | 81.0% | 84.0% | −3.0 | ✗ |
| 32 | 25:7 | 86.4% | 84.0% | +2.4 | ok |
| 32 | 26:6 | 87.1% | 80.0% | +7.1 | ok |
| 32 | **27:5** | **87.8%** | 76.0% | +11.8 | **‡ A overtakes S** |
| 32 | 24:8 | 85.7% | 88.0% | −2.3 | ✗ |

Maximum safe B by size: **n=8 → 4 · n=12 → 4 · n=16 → 5 · n=24 → 6 · n=32 → 7.**

### Does the selector itself bias toward B?

No. B is **20.5%** of the 44-place A+B eligible pool. The incumbent coverage-balanced selector
draws:

| n | policy mix | B share of tranche | vs 20.5% pool share | ordering |
|---:|---|---:|---|---|
| 8 | A6 B2 | 25.0% | +4.5 pts | monotonic |
| 12 | A10 B2 | 16.7% | −3.8 pts | monotonic |
| 16 | A13 B3 | 18.8% | −1.7 pts | monotonic |
| 24 | A21 B3 | 12.5% | −8.0 pts | monotonic |
| 32 | A28 B4 | 12.5% | −8.0 pts | **‡ A 88.4% > S 87.5%** |

The policy **under**-draws B at every size except n = 8, where the +4.5-point overshoot is a
rounding artefact of a 4-hub, 8-seat allocation and still leaves a 9.5-point A−B gap. There is
no structural B bias, and **no artificial B cap is required** for the incumbent policy at any
size from 8 to 30. This answers Issue #116 §4's question directly — but in an unexpected way:
the cap that *is* now required is an **A cap** (≤26, §4), which no prior phase has ever needed
and which the selector does not enforce. A continuation would have to add a per-grade ceiling
on the *primary* grade in order not to over-photograph it — which is evidence that the design
has run out of headroom, not that it has room left.

### Fragility at the mix that matters

The only continuation with a genuine product motive is prominence-targeted (§7), and it is
B-heavy: 4 of the 6 repairable high-prominence places are grade B. At n = 8 the mix A4:B4 is
"safe" by **0.1 points** — and **a single fail-closed A target inverts it** (A3:B4 → A 71.4%
vs B 72.0%). At an 88.2% pooled acceptance rate, ~0.9 failures are expected in 8 attempts, so
inversion would be the *likely* outcome, decided after acquisition by which targets happened
to fail. n = 8 is the only candidate size whose safe mix does not survive one A failure.

**A strategy whose editorial invariant is settled by sourcing luck is not a controlled
strategy.** That disqualifies the prominence-targeted tranche on its own terms.

## 6. Category and hub completeness

**Categories.** 29 total, 27 covered, 2 zero-photo — both single-member, both fail-closed.
Separating the gap as Issue #116 §7 requires:

| Class | Count | Fixable by a tranche? |
|---|---:|---|
| Unreachable because fail-closed | 16 | no — needs a re-entry gate |
| Reachable but deliberately deprioritised (C/D) | 10 | only by inverting the grade signal |
| Reachable and ordinarily eligible (A/B) | 44 | yes |

**Breadth is fully saturated.** Across A+B at every size from 8 to 32, the number of
**new** zero-photo categories unlocked is **0** — and it is 0 for A+B+C+D too, because the
only two empty categories are fail-closed. Phase 4K found breadth saturated at 13 distinct
categories per tranche; post-4L the stronger statement holds: **no tranche at any size or
scope can raise category coverage above 27/29.** 100% category completion is correctly not
forced, because the only members that could deliver it are fail-closed.

**Hubs.** Fukuoka, Nagoya and Sapporo are complete. The four large hubs span
64.2% – 69.4% — a **5.2-point spread, the tightest in the programme's history** (it was 6.0
before Phase 4L, and wider before that). There is no hub imbalance left to repair, so hub
balance cannot justify another tranche either.

## 7. Product impact — who is actually uncovered

Coverage percentage is the wrong lens; *which* places lack a photograph is the product
question. The dataset's own `tourismLevel` field gives an editorially neutral prominence proxy
that this gate only reads — no ranking, grade or recommendation depends on it.

| tourismLevel | Covered | % |
|---|---:|---:|
| Alto | 45/56 | 80.4% |
| Bajo | 36/53 | 67.9% |
| Medio | 40/61 | 65.6% |
| **Extremo** | **23/44** | **52.3%** |

**Photography coverage is inverted against visitor prominence**: the most-visited tier is the
*least* photographed, 15 points below the catalogue average. That looks like the strongest
possible argument for continuing — until the 21 uncovered `Extremo` places are classified:

| Class | Count | Examples |
|---|---:|---|
| Unreachable — fail-closed | **6** | Tokyo Disneyland, Tokyo DisneySea, SUPER NINTENDO WORLD, teamLab Borderless, PokéPark KANTO, AnimeJapan 2027 |
| Reachable but graded C/D on purpose | **9** | Arashiyama Bamboo Grove, Nishiki Market, Tsukiji Outer Market, Takeshita Street, Tsutenkaku, Glico Running Man, Kuromon Ichiba, Heart Rock, Yasaka Kōshin-dō |
| **Reachable and ordinarily eligible** | **6** | **JP-072 Tenryū-ji (A)**, **JP-038 teamLab Planets (A)**, **JP-080 Kinkaku-ji (B)**, **JP-019 Tokyo Skytree (B)**, **JP-153 Kokusai Street (B)**, **JP-171 Blue Cave at Cape Maeda (B)** |

**A continuation tranche can repair at most 6 of the 21 prominence gaps, and 4 of those 6 are
grade B** — precisely the grade the ordering invariant constrains. 15 of 21 are structurally
unreachable: either fail-closed, or famous places the dataset deliberately grades C/D on
value-for-time, which Phase 4K already ruled out photographing ahead of A-grade places.

Worse for the continuation case: **the incumbent selector does not choose them.** Its
coverage-balanced priority ranks thin *categories* first, not prominence. Its picks:

| n | top-prominence targets selected |
|---:|---|
| 8 | 2 of 6 — JP-072 Tenryū-ji, JP-019 Tokyo Skytree |
| 16 | 2 of 6 — same two |
| 32 | 4 of 6 — adds JP-038 teamLab Planets, JP-153 Kokusai Street |

**`JP-080` Kinkaku-ji is never selected, at any size up to 32.** The single most conspicuous
missing photograph in the catalogue would survive another full tranche untouched. Obtaining it
requires a *different* selector — prominence-first — which is new policy, and whose mix is
exactly the fragile B-heavy shape §5 disqualifies.

**Does the remaining gap harm discovery or planning?** The fallback is non-photographic but
graceful, and every uncovered place retains its name, grade, category, description,
differentiator, duration, hours, reservation mechanism, transport, accessibility and routing
data. Photography in Nihon is orientation and confidence, not a load-bearing planning input —
no ranking, recommendation, itinerary, planner or routing behaviour reads it. Two in three
cards carry a photograph, every hub is at or above 64%, and every reachable category is
represented. The residual harm is aesthetic and concentrated on a named, enumerable list of
six places, four of which are grade B.

## 8. Strategy comparison

All rows recomputed at the exact base. "New categories" is the count of zero-photo categories
a tranche would unlock. Ordering is the full S ≥ A ≥ B ≥ C ≥ D test, not A/B alone.

| Strategy | Max coverage | A after | B after | Ordering | New categories | Prominence gaps repaired | Verdict |
|---|---|---:|---:|---|---:|---|---|
| **STOP** | 144 = **67.3%** | 69.4% | 56.0% | **monotonic** | 0 | **0 of 6** | **selected** |
| A-only n=8 | 152 = 71.0% | 74.8% | 56.0% | monotonic | 0 | 1 of 6 | rejected |
| A-only n=16 | 160 = 74.8% | 80.3% | 56.0% | monotonic | 0 | 1 of 6 | rejected |
| A-only n=24 | 168 = 78.5% | 85.7% | 56.0% | monotonic | 0 | 2 of 6 | rejected |
| A-only n=32 | 176 = 82.2% | **91.2%** | 56.0% | **‡ broken** | 0 | 2 of 6 | rejected |
| A+B n=8 | 152 = 71.0% | 73.5% | 64.0% | monotonic | 0 | 2 of 6 | rejected |
| A+B n=16 | 160 = 74.8% | 78.2% | 68.0% | monotonic | 0 | 2 of 6 | rejected |
| A+B n=24 | 168 = 78.5% | 83.7% | 68.0% | monotonic | 0 | 2 of 6 | rejected |
| A+B n=30 | 174 = 81.3% | 87.1% | 72.0% | monotonic (max) | 0 | 2 of 6 | rejected |
| A+B n=32 | 176 = 82.2% | **88.4%** | 72.0% | **‡ broken** | 0 | 4 of 6 | rejected |
| A+B+C+D n=32 | 176 = 82.2% | 83.0% | 68.0% | **broken — C 100%** | 0 | 2 of 6 | rejected (counterfactual) |

"Prominence gaps repaired" counts the six *reachable* high-prominence places enumerated in §7,
not all 21 uncovered `Extremo` places — the other 15 are unreachable by any A/B tranche. The
A+B n=30 row is the largest fully monotonic tranche the incumbent policy can produce (§4); its
prominence figure is 2, the same as n = 8. The A+B+C+D row scores 2 on the same six, and would
additionally cover 8 of the 9 deliberately-deprioritised C/D `Extremo` places — which is not a
point in its favour: it closes the prominence gap precisely by inverting the grade signal the
ordering invariant exists to protect.

### STOP — selected

Selected on the evidence below, not by default. See §9 and §10.

### A-only — rejected

It moves the primary grade fastest, but **freezes B at 56.0% and re-widens the A−B gap from
13.4 points to as much as 35.2** at n = 32 — reviving exactly the imbalance Phase 4I opened B
eligibility to repair and Phase 4J and 4L spent two tranches closing. It also hits the S
ceiling soonest: at n = 32 it puts A at 91.2%, 3.7 points *above* S. And it repairs at most 2
of the 6 reachable prominence gaps, because 4 of those 6 are B.

### A+B with explicit mix control — rejected

The only continuation that is internally coherent, and still rejected. At its largest legal size
(n = 30) it buys **+14.0 points** of raw coverage and nothing else: no breadth, no hub repair,
and 2 of the 6 reachable prominence gaps — 4 only at n = 32, which breaks the S ≥ A ordering.
Never Kinkaku-ji. It now requires **two** simultaneous caps (A ≤ 26 permanently, B ≤ 4–7 by
size) where every prior phase needed none, and it can run **at most once more** before §4's
ceiling ends the programme anyway at ≤82.7%.

### A+B+C+D — rejected counterfactual, evaluated not assumed

Measured, not inherited. At n = 32 it drives **C to 100%** — above S (87.5%), A (83.0%) and
B (68.0%) — reversing the editorial signal exactly as Phase 4K found. The selector still
front-loads C/D structurally: at n = 8 it takes **5 C and 1 D of 8 seats (75%)** while C/D is
18.5% of the eligible pool, a **4.05× over-representation**. And it unlocks **zero** new
categories, because the four C/D-only categories already hold photographs and the two genuinely
empty ones are fail-closed. Phase 4K's rejection holds with stronger numbers. Retained as a
counterfactual only; it was never a candidate.

## 9. Diminishing returns

Marginal value per tranche, measured across the whole programme:

| Batch | Accepted | Cumulative | Points added |
|---|---:|---:|---:|
| Phase 4A | 24 | 11.2% | +11.2 |
| Phase 4D | 12 | 16.8% | +5.6 |
| Phase 4F | 22 | 27.1% | +10.3 |
| Phase 4H | 27 | 39.7% | +12.6 |
| Phase 4J | 28 | 52.8% | +13.1 |
| Phase 4L | 31 | 67.3% | +14.5 |

**Raw coverage points per tranche are still rising, and that is exactly the trap.** Percentage
is the one metric that cannot discriminate here — Phase 4K established that *n* attempts cover
at most *n* places whatever their grade, so every strategy in §8 shows an identical coverage
column. The dimensions that carry product value have all flattened to zero:

| Dimension | Phase 4J → 4L | Post-4L, next tranche |
|---|---|---|
| New categories unlocked | 1 (Architecture, 4J) → 0 (4L) | **0 at every size and scope** |
| Hub spread repaired | 6.0 → 5.2 points | **nothing left — 5.2 is the programme minimum** |
| Prominence gaps repairable | — | **6 of 21, and the selector picks 2 at every legal size** |
| Grades still movable | A, B | **A by ≤26 ever; B by ≤7** |
| Headroom before an invariant breaks | comfortable | **one tranche, ≤30** |

The programme is not on a diminishing-returns curve. It has reached a **structural terminus**:
the remaining gap is 37 places that can never be photographed under the project's own stated
rules, plus a rationed 33 that can. Every further tranche buys percentage and nothing else.

## 10. Release-candidate framing — the product question

> **Would another photography tranche materially improve Nihon v1 enough to justify delaying
> Release Candidate work?**

**No.**

What one more tranche would buy: up to +14 points of raw coverage (67.3% → ≤81.3% at the
largest monotonic size), ~8.4 MiB of new assets, and **2** of the 6 repairable prominence gaps (4 only at n = 32, which breaks the ordering).

What it would not buy: any new category (0, structurally), any hub repair (none outstanding),
Kinkaku-ji (never selected), any planning, routing, ranking or recommendation improvement
(photography feeds none of them), or an end to the question — because §4's ceiling ends the
programme at ≤82.7% either way.

What it would cost: a full acquisition cycle — design gate, selector preflight, manual
sourcing and visual inspection of every candidate, exact-head CI, browser QA, runtime
document, workflow cleanup, hostile review and an independent closure gate. The established
pattern is two phases and two review cycles per tranche. Photography would rise from 82.1% to
roughly 85% of the tracked repository.

Set against that, the Release Candidate / whole-product closure audit is **entirely undone**,
and it covers the parts of Nihon that actually carry release risk: dataset validity, temporal
and reservation correctness for the Feb–Mar 2027 window, routing and walking integration,
planner behaviour, accessibility and the end-to-end product surface. A missing photograph
degrades a card; an unaudited reservation deadline or routing defect degrades a trip.

Photography at 67.3% is a **complete, coherent, internally consistent** state: monotonic
editorial ordering intact with a 13.4-point A−B margin, every hub at or above 64%, the tightest
hub spread the programme has achieved, every reachable category represented, a graceful
documented fallback, one photograph per place, and zero runtime provider requests. It is a
defensible place to stop and the last state in which the editorial ordering holds with real
margin rather than by arithmetic on a cap.

**Decision: STOP. Photography is complete for Nihon v1.**

## 11. Successor contract — no Phase 4N acquisition

### Photography v1 completion, defined

Photography for Nihon v1 is **complete at 144/214 = 67.3%**, with:

- exactly one registered photograph per covered place, 144 records, 144 WebP assets, 40.49 MiB;
- Wikimedia Commons as the sole source, CC0 / CC BY / CC BY-SA only, no legal-clearance claim;
- 27 of 29 categories represented; all seven hubs represented; four hubs at 64.2–69.4% and three
  at 100%;
- monotonic editorial ordering S 87.5% > A 69.4% > B 56.0% > C 0% > D 0%;
- 16 carried fail-closed IDs permanently excluded from ordinary eligibility;
- a documented non-photographic fallback for all 70 uncovered places;
- zero runtime photography-provider requests.

**No further acquisition is authorised for v1.** This is a completion, not a pause.

### Explicitly not authorised

**No Phase 4N acquisition phase exists or is authorised.** No fixture is pinned, no selector is
shipped, no grade scope or A:B mix is approved, and no asset budget is allocated, because there
is no successor tranche. Any future acquisition requires a **new** design gate that starts from
this document's §4 ceiling, not from Phase 4K's or Phase 4L's superseded projections.

### Post-v1 optional backlog — recorded, not scheduled

Carried forward for consideration **after** v1 ships. None of these is authorised work, none
blocks the Release Candidate, and each would need its own gate:

1. **Prominence-targeted first photographs.** The six reachable high-prominence gaps —
   JP-080 Kinkaku-ji, JP-019 Tokyo Skytree, JP-072 Tenryū-ji, JP-038 teamLab Planets,
   JP-153 Kokusai Street, JP-171 Blue Cave at Cape Maeda. Highest product value per photograph
   of anything remaining. Would require a new prominence-first selector **and** an explicit
   decision about the A/B ordering invariant, since 4 of the 6 are grade B (§5).
2. **Fail-closed re-entry research gate.** The 16 excluded IDs, and in particular JP-195 and
   JP-202 — the sole members of the only two zero-photo categories, and therefore the only
   targets whose re-entry could change category coverage at all. Re-entry requires materially
   new sourcing evidence, not a re-reading of the same files. Re-entry of any S place is also
   the only thing that could ever lift the §4 ceiling.
3. **Bounded A/B completion tranche**, if and only if the ordering invariant is first
   re-examined: at most 26 further A and 7 further B, ending at 82.7%.
4. **A grading review** for the nine deliberately-deprioritised high-prominence C/D places.
   This is an editorial question about grades, not a photography question, and photography must
   not be used to pre-empt it.

### Next authorised project work

**Nihon Release Candidate / whole-product closure audit.** Photography is out of its scope
except as a completed subsystem to be verified, not extended. That phase is **not started** by
Phase 4M and requires its own issue and design gate.

## 12. Hostile review of this gate's own conclusion

Reviewed adversarially against the strongest available case for continuation.

**Objection 1 — "Kinkaku-ji has no photograph. That alone justifies another tranche."**
The strongest objection, and it is conceded as stated: Kinkaku-ji, Tokyo Skytree, Tenryū-ji and
teamLab Planets are conspicuous absences, and STOP freezes them. It does not survive as an
argument *for a tranche*, because the instrument does not hit the target: the incumbent selector
never picks JP-080 at any size up to 32 (§7). The objection argues for a prominence-first
selector — new policy, 4 of 6 targets grade B, and a mix that inverts the ordering on a single
sourcing failure (§5). **Recorded as backlog item 1, and named in §11 rather than buried.** The
honest position is that STOP leaves six named places visibly uncovered; the dishonest position
would be to authorise a tranche that would not fix them.

**Objection 2 — "A is at 69.4%. Nearly a third of the primary grade shows a fallback."**
True, and it is the reason Phase 4K rejected stopping at 52.8%. It is weaker now: A may rise by
at most 26 more places *ever* (§4), so even a maximal programme leaves A at 87.1% with 9
eligible A places permanently unphotographed. "Finish A" is not on the table at any budget —
only "move A partway, then stop anyway".

**Objection 3 — "The S ceiling is an artefact. Just drop the monotonicity invariant."**
Legitimate, and out of scope: the invariant is inherited from Phase 4I and was the stated basis
on which Phases 4J, 4K and 4L were each approved. Abandoning it is a design decision that must
be argued in its own gate, not assumed by a phase that wants headroom. Noted as a live question
for backlog item 3. If it were dropped, the A+B ceiling would be 87.9% — still not 100%, and
still zero new categories.

**Objection 4 — "Asset budget and rising per-asset cost justify stopping."**
Rejected as a reason, by this gate's own evidence. §3 shows Phase 4L came in *below* the Phase
4J peak and the weighted mean is flat (+0.2%), so Phase 4K's rising-cost trend did not continue.
No candidate size breaches the hard stop. **STOP is not justified on asset grounds and this
document does not claim it is** — an argument this review specifically looked for and removed.

**Objection 5 — "You found the divergence convenient. Does it drive the decision?"**
No, and this was tested directly. Re-running §4, §5, §8 and §9 with the erroneous 10-B universe
changes: the B ceiling (96.0% vs 92.0%), the exhaustion row (inverted vs preserved), and
maxSafeB at n = 8 (unchanged at 4). It does **not** change the S ceiling, the 26-A budget, the
82.7% programme ceiling, breadth saturation, hub saturation, the prominence classification, or
the selector's failure to pick Kinkaku-ji. **The decision is identical under both figures.** The
divergence is reported because it is real and because Phase 4L's projection table is wrong, not
because it is load-bearing.

**Objection 6 — "STOP is fatigue dressed as analysis."**
Phase 4K rejected stopping in exactly these words and was right to: at 52.8% the dominant gap
was 60 ordinarily eligible A places with comfortable supply, a real hub imbalance and an
unrepaired B grade. Every one of those conditions has since been discharged. What distinguishes
this gate is that the case rests on four measurements that did not exist then — a permanent S
ceiling, zero unlockable categories, a hub spread at its programme minimum, and a prominence gap
that is 71% structurally unreachable — and each is reproduced in `scripts/` and pinned in tests.

**Objection 7 — "The prominence proxy is invented for this gate."**
`tourismLevel` is a pre-existing canonical field on all 214 places, populated before any
photography phase, read-only here, and feeding no ranking, grade or recommendation. The
inversion it reveals (Extremo 52.3% vs Alto 80.4%) is not an artefact of the choice: the same
conclusion follows from `crowdLevel` and from simply reading the names in §7's third row.

**Objection 8 — "Continuation at n ≤ 30 preserves every invariant. Why not just do it?"**
It does, and this is the cleanest surviving case for continuation. It is rejected on value, not
legality. What it delivers: **+14.0 points** of raw coverage, 0 new categories, 0 hub repair,
2 of 6 reachable prominence gaps, no Kinkaku-ji — and then a permanent stop at 81.3%, 1.4 points
short of the 82.7% ceiling, with the programme structurally finished either way. The price is a
full two-phase gate cycle while the Release Candidate audit is entirely undone. That is a trade
of review capacity for a percentage, on a subsystem no planning behaviour reads. If the project
decides the percentage is worth it, backlog item 3 is where to argue it, with the ceiling stated
up front rather than discovered in the next gate.

**No defect was found in the reproduced figures, the policy-fidelity replay, or the mix
arithmetic.** Two documentation findings are recorded: the §1 eligible-universe divergence and
Phase 4K's rising-asset-cost trend not continuing. Neither required an executable, data, asset
or fixture change.

## 13. Design-only proof

`scripts/test_phase4m_stop_vs_continue.py` asserts against the exact base
`5707c1405febdb467d2af991eb21e731b887b6cd` that:

- `data/visual/photography-metadata.json` is byte-identical to the base;
- `app/src/data/photography-metadata.json` is byte-identical to the base;
- `data/places.json` is byte-identical to the base;
- canonical and app photography metadata remain in byte parity;
- the entire `app/public/images/places/` tree is identical to the base, blob for blob, across
  all 144 assets;
- no fail-closed ID appears in the registry;
- Phase 4M's changed-file set is confined to documentation, this analysis script and its tests.

Phase 4M adds only: this document, the ROADMAP entry,
`scripts/analyze-phase4m-stop-vs-continue.py` and `scripts/test_phase4m_stop_vs_continue.py`.
It pins **no fixture**, because it authorises no acquisition.

**Policy fidelity.** The analysis module's selector is the Phase 4I/4K coverage-balanced policy
with only the exclusion set parameterised. It is proven unchanged, not asserted: replaying the
historical 113-record Phase 4K baseline with the historical 15-ID exclusion set reproduces the
pinned `data/visual/phase4k-successor-fixture.json` **exactly and in order** — same 32 targets,
same 76 eligible, same 25 A / 7 B, same hub quotas. Any difference in this gate's figures is
therefore attributable to its inputs, never to a drifted policy.

## 14. Scope boundary

Phase 4M does **not**: acquire or download photographs; change photography metadata or image
blobs; add or remove image assets; retry, research or re-enter any of the 16 fail-closed IDs;
change gallery or runtime behaviour; change ranking, recommendation, itinerary, planner, routing
or grade data; start any Phase 4N; widen the licence or source policy; or add a second image to
any place.

It does not edit `docs/AB_PHOTOGRAPHY_BATCH_II_RUNTIME.md`, the ROADMAP's Phase 4L section, or
any Phase 4K/4L artifact. Those are historical records; the §1 correction is recorded here.
