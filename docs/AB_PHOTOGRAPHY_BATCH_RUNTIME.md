# Phase 4J — A+B Licensed Photography Acquisition Batch

Status: **implemented and exact-head validated; PR remains Draft pending independent closure gate**

Base: `abe55efc53137ece436c99f3ccfd3f706af16c8e`  
Issue: #110  
PR: #111  
Acquisition/validation date: **2026-09-16 (America/Mexico_City)**

Authority:
- `docs/PHOTOGRAPHY_COVERAGE_REBALANCING_DESIGN.md`
- `docs/A_GRADE_PHOTOGRAPHY_BATCH_II_RUNTIME.md`
- `docs/PHOTOGRAPHY_ATTRIBUTION_COMPLETENESS_RUNTIME.md`
- Phase 4I ROADMAP successor contract

## Outcome

The Phase 4I selector reproduced exactly the authorized 32-target fixture
(`trancheSize` 32, `eligibleCount` 108, `distinctCategoryCount` 19, grade mix 23 A / 9 B,
hub quotas Fukuoka 1 / Kioto 7 / Okinawa 7 / Osaka 8 / Tokio 9).

- attempted targets: **32**
- accepted local photographs: **28** (20 A-grade, 8 B-grade)
- failed closed: **4** (3 A-grade, 1 B-grade)
- coverage: **85 → 113 / 214 = 52.8%**
- new-asset delta: **9,672,140 bytes (9.22 MiB)**
- soft batch budget: **10 MiB**
- hard review threshold: **14 MiB**

The batch finished **below the 10 MiB soft budget**, slightly above the design's projected
7.57–9.17 MiB envelope for 32 attempts because the accepted source files skewed large. No
quality-floor, source-policy or license-policy relaxation was used, and no target was
substituted: there is no replacement queue, so each of the 32 targets was attempted
independently and every failure remains uncovered.

### Rebalancing goals

Phase 4I authorized the A+B widening for two specific reasons. Both are met:

- **Fukuoka**: the hub held **0/1** covered places. JP-214 Yanagawa canal cruise was
  accepted, so Fukuoka is now **1/1** and every hub in the dataset has at least one
  photograph.
- **Architecture**: the category held **0** photographs and was not reachable under an
  A-only tranche. JP-123 Church of the Light and JP-138 Kobe Kitano Ijinkan were both
  accepted, so Architecture is now **2/2**.

Phase 4J is also the first batch to cover B-grade places at all.

## Accepted targets

One local WebP photograph was accepted for each of:

`JP-214`, `JP-100`, `JP-163`, `JP-123`, `JP-013`, `JP-073`, `JP-183`,
`JP-022`, `JP-055`, `JP-194`, `JP-014`, `JP-059`, `JP-189`, `JP-124`,
`JP-078`, `JP-165`, `JP-117`, `JP-043`, `JP-060`, `JP-138`, `JP-006`,
`JP-081`, `JP-198`, `JP-105`, `JP-039`, `JP-212`, `JP-011`, and `JP-047`.

All accepted records use Wikimedia Commons source pages and the pre-existing supported
license allowlist (CC0, CC BY and CC BY-SA variants). No NC, ND, fair-use or AI-generated
substitute was introduced. Canonical metadata remains the source of truth and the
app-facing copy is byte-identical.

## Failed-closed targets

### JP-120 — teamLab Botanical Garden Osaka

Commons holds no photograph of the teamLab installation itself; four targeted discovery
queries returned zero files. The only license-allowed results are daytime photographs of
Nagai Botanical Garden, the **host venue**, which would present the host park as if it
were the named digital-art exhibition.

### JP-211 — AnimeJapan 2027

No defensible factual venue scene exists under the allowlist. The available AnimeJapan
files are branded booth interiors dominated by protected characters, cosplayer portraits
in which private individuals and branded costumes dominate the frame, and an admission
ticket for a single past edition. The dataset also locates this target in Osaka while the
available imagery is from Tokyo Big Sight.

### JP-041 — Unicorn Gundam at DiverCity

The named target is a modern protected character statue that dominates the entire frame in
every candidate depicting it, which the Phase 4 subject-matter rule cannot bound — the
same basis as the Phase 4H JP-121 Tower of the Sun fail-closed. The DiverCity alternatives
show the shopping complex rather than the named target, and the 2012-dated "Gundam Odaiba"
files depict the earlier RX-78-2 statue, not the Unicorn Gundam.

### JP-168 — Yachimun no Sato

Eight discovery queries across English and Japanese returned no license-allowed photograph
of Yachimun no Sato in Yomitan, Okinawa. The single allowed result is a kiln in **Seto,
Aichi Prefecture**, an unrelated pottery district in the wrong prefecture.

These are fail-closed acquisition outcomes, not legal-clearance conclusions. No substitute
target was used for any of them, and each place keeps its existing no-photograph fallback.

## Carried fail-closed targets

The eleven carried fail-closed IDs — `JP-033`, `JP-126`, `JP-203`, `JP-204`,
`JP-050`, `JP-195`, `JP-121`, `JP-156`, `JP-095`, `JP-079`, `JP-202` — were
excluded from the eligible universe, were never attempted, and did not re-enter. They may
re-enter only through a future design gate with materially new sourcing evidence.

## Branded and sensitive subjects

The three targets flagged sensitive by the contract resolved differently:

- **JP-043 — SMALL WORLDS Miniature Museum**: accepted through the building **exterior and
  signage** frame. The interior candidates were rejected: the museum's dioramas are
  themselves creative works, and the available interior photographs additionally place
  visitors, including children, prominently in the foreground.
- **JP-120 — teamLab Botanical Garden Osaka**: failed closed (above).
- **JP-041 — Unicorn Gundam at DiverCity**: failed closed (above).

No other accepted target proved to have equivalent branded characteristics. Commons
reported **no restriction flag** on any of the 28 accepted files.

## Temporal subjects

- **JP-212 — Grand Sumo Tournament Osaka 2027** uses a prior-edition (March 2010)
  photograph of the recurring Osaka tournament, confirmed by the Commons
  `2010 March Grand Sumo Tournament` category. Shipped alt copy reads "durante una
  edición anterior del torneo de sumo de marzo en Osaka".
- **JP-211 — AnimeJapan 2027** failed closed, so no temporal claim arises for it.

The browser audit asserts that neither the rendered attribution block nor the image alt
text contains "2027". No 2027 schedule, availability or operating state is inferred from
photography.

## Preserved invariants

Validation proved:

- all **85** pre-Phase-4J metadata records are unchanged;
- all **85** pre-Phase-4J image blobs are byte-identical by SHA to the exact base;
- canonical/app photography metadata are byte-identical;
- there are exactly **113** registered images and exactly **113** WebP assets;
- no place has more than one registered photograph;
- no duplicate `placeId`, and no duplicate Commons source, acquisition URL or asset path
  anywhere in the catalog;
- the supported license allowlist is unchanged, every `licenseUrl` is an https
  creativecommons.org URL and every `sourceUrl` an https Commons file page;
- the four failed-closed places retain the no-photograph fallback;
- photography remains local/offline at runtime;
- no Commons, Wikipedia or Creative Commons photography request occurs during rendering;
- no ranking, recommendation, itinerary, grade, routing or planning behavior changed, and
  no gallery redesign occurred. `data/places.json` is untouched.

## Browser QA

The Phase 4J browser audit covers:

1. ordinary acquired A-grade subject — JP-013 Golden Gai;
2. acquired B-grade subject — JP-022 Ameyoko;
3. Fukuoka's first photograph — JP-214 Yanagawa canal cruise;
4. branded/sensitive subject resolved through an exterior frame — JP-043 SMALL WORLDS;
5. temporal subject with no 2027 claim in attribution or alt text — JP-212;
6. failed-closed fallback — JP-120;
7. zero runtime photography-provider fetches.

It ran twice in the validating run, alongside the Phase 4H, 4F, 4D and 4C browser
regression audits. Console and page errors were zero in every pass.

## Harness corrections

Two harness fixtures used places that Phase 4J acquired, so they no longer modelled "no
photograph yet". Both were moved to **carried fail-closed** places, which cannot gain a
photograph without a separate design gate, so the assertions survive later batches:

- the frontend registry test moved from JP-006 to JP-121;
- the Phase 4C browser audit moved from Nezu Museum to PokéPark KANTO.

Neither change altered runtime or data behavior, and no assertion was weakened.

## Historical selector fixtures

The Phase 4E and Phase 4G selector fixtures each rebuilt their historical baseline from the
live catalog, and both broke when Phase 4J appended 28 records: Phase 4G reconstructed 86
records instead of 58, and the Phase 4E manifest glob introduced in Phase 4H did not match
the Phase 4J manifest name, so it reconstructed 64 instead of 36.

Both now delegate to `scripts/photography_baseline.py`, which derives every historical
baseline twice and requires the two derivations to agree:

- *semantically*, by dropping every place ID claimed by an acquisition batch selected after
  that baseline;
- *positionally*, by taking the leading N records, which the append-only canonical registry
  guarantees is that historical era.

The batch manifests are now held in one **explicit registry** rather than a name glob, and
a completeness guard fails loudly, naming the file, if a batch manifest exists that the
registry does not know about. That closes the failure mode Phase 4J actually hit. The
behavior was verified against a simulated future batch: the fixtures still reproduce at a
120-record catalog once the new manifest is registered, and fail loudly with an actionable
message when it is not.

Record content is still read live from the canonical registry, so attribution corrections
flow through rather than rotting in a frozen copy. Every expected count and downstream
assertion is unchanged.

## Exact-head validation

Validated executable/test HEAD:

`2c75e009cc2063d1887daba33367ae77da46d598`

GitHub Actions run:

`35055595875` — **SUCCESS**

The run passed every gate:

- exact Phase 4J selector reproduction (32 targets, 23 A / 9 B, 19 categories, hub quotas);
- photography validator;
- full Python test suite (**475 tests**);
- `npm ci`;
- focused photography tests (3 files);
- full Vitest (**65 files, 2439 tests**);
- lint;
- build;
- Phase 4J invariants and asset-budget gate;
- Chromium installation;
- Phase 4J browser audit twice;
- Phase 4H, 4F, 4D and 4C browser regression audits;
- whitespace gate.

The temporary exact-head workflow checked out the executable/test SHA above explicitly, so
later documentation and workflow-removal commits do not alter the validated executable
tree.

## Hostile review

An independent hostile review was run against live Wikimedia Commons after the automated
gates passed. It found **one real defect, which was corrected**:

- **Acquisition URLs carried Commons tracking parameters.** All 28 accepted records stored
  the `utm_source`/`utm_campaign`/`utm_content` query string that the Commons API now
  appends to `imageinfo.url`. Those parameters have nothing to do with file identity, all
  85 pre-existing records store a clean URL, and the acquisition pipeline already compares
  ignoring the query string — so the stored URLs were the outlier. The query string was
  stripped from the 28 records and from the preparation step, the pipeline was re-resolved
  against Commons to confirm every declared URL still matches its live file, and the
  exact-head validation was repinned to the corrected head.

Everything else verified clean:

- all 28 Commons source pages resolve; none is missing or deleted;
- recorded `license` matches the live Commons `LicenseShortName` for all 28;
- recorded dimensions match live Commons dimensions for all 28;
- every `credit` is drawn from the live Commons `Artist` field;
- every `licenseUrl` matches its license name and is https;
- `originalTitle`, `sourceUrl` and `acquisitionUrl` filenames agree once percent-encoding
  is decoded, for all 28;
- no duplicate Commons source across the whole 113-record catalog;
- subject and location match confirmed for all 28 against Commons descriptions and
  categories;
- Commons reports no restriction flag on any accepted file;
- branded/sensitive and temporal handling as described above;
- the 85 prior records and blobs are unchanged; canonical/app parity holds;
- asset delta reproduces at exactly 9,672,140 bytes;
- no second image, no runtime external photography fetch, no ranking, recommendation,
  itinerary, routing or grade drift, and no gallery redesign.

Manual inspection during selection rejected several candidates that metadata alone would
have accepted, including a Nanchan Temple in Wutai, **China** returned for Nanzen-ji
(identical kanji), a LEGOLAND Discovery Center returned for Osaka Aquarium Kaiyukan, a
Katsuren Peninsula panorama returned for Kudaka Island, and an Osaka Business Park skyline
returned for Osaka Castle Park.

One observation was recorded as a **non-defect**: the dataset assigns JP-138 (Kobe, Hyogo
Prefecture) to the Osaka hub. That is a pre-existing `data/places.json` fact carried by the
pinned Phase 4I fixture; `data/places.json` is unchanged in Phase 4J and altering it would
be out-of-scope drift.

## Scope boundary

Phase 4J does **not** authorize:

- second images for already-covered places;
- gallery redesign;
- license-policy widening;
- runtime Commons fetching;
- ranking/recommendation changes;
- itinerary/routing/planning changes;
- grade changes;
- replacement targets for the four failed-closed IDs;
- re-entry of the eleven carried fail-closed IDs;
- an unbounded continuation through the remaining catalog.

Any further scale-up requires a separate successor design gate that re-establishes target
priority, batch size, asset budget and sourcing constraints.
