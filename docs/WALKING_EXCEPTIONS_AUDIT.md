# Phase 3B2D — Walking Exceptions Audit

**Audit-only.** This phase makes no routing requests, no coordinate changes, no
threshold changes, and no dataset changes. It investigates, with independent
evidence, the large-displacement Snap cases and the five `no-route` results that
Phase 3B2B-B explicitly left open, and it ends with a methodological
recommendation — not an implementation.

## 1. Scope and methodology

### Why these cases

Phase 3B2B-B's execution audit ([WALKING_SCALE_EXECUTION.md](WALKING_SCALE_EXECUTION.md))
found a real tail of large per-endpoint Snap displacements among the 137 places the
scale-up required, and five terminal `no-route` Directions answers, all touching one
place (JP-090). It explicitly declined to set an absolute Snap threshold or to treat
`no-route` as proof of real-world inaccessibility, and deferred both questions to
"a future phase [that] should review these specific cases against independent
access/entrance evidence first." This document is that review.

### POI coordinate vs. routing access point

Every place in this dataset carries exactly one coordinate, used for two different
purposes today without distinction:

- **Display / identity**: where the place is shown on a map, what a user associates
  with "being at" the place — often a centroid, a building, a garden, a beach, or a
  broad compound.
- **Routing endpoint**: the exact point a routing provider is asked to path to/from.

For a point venue (a shop, a small shrine gate) these two purposes usually coincide.
For a large or multi-gate compound (a palace garden, a temple precinct, a beach with
a named transit stop, a multi-stage hiking facility), they can diverge sharply: the
recorded coordinate can be an entirely reasonable **POI coordinate** — correctly
identifying the place — while being a poor **routing access point**, because it sits
well inside a compound whose actual pedestrian entrances/exits are the coordinates
that matter for a real walking route.

This distinction is the organizing idea behind the rest of this audit: a large Snap
displacement or a `no-route` answer is data about the *routing endpoint*, not
automatically a claim about the *place*.

### Snap vs. Directions connectivity

These are two different, independently failing measurements, and this audit does not
conflate them:

- **Snap** (`snapped_distance`) answers "how far did this exact coordinate move to
  reach the nearest point openrouteservice's routable graph has at all?" It can
  succeed (small or even large displacement) even when the graph node it snapped to
  is not usefully connected to the rest of the network.
- **Directions** answers "is there a path this provider's graph considers routable
  between two already-snapped points?" It can fail (`no-route`) even when each
  endpoint's Snap displacement is trivially small, if the two snapped points land on
  disconnected (or graph-isolated) parts of the network.

JP-090 is the clearest illustration in this dataset: its Snap displacement is a
trivial 3.65 m (an excellent snap), yet all three of its distinct directed
neighbors returned `no-route`. A large Snap number and a `no-route` answer are
therefore evidence about different failure modes and must not be read as
interchangeable proof of the same underlying problem.

### This phase changes nothing

No `walking-*-results.json` file, no `walking-snap-places.json`, no `places.json`,
no `nearby.json`, no threshold constant, and no application code path changes as a
result of this document. Every conclusion below is a classification of existing,
already-versioned evidence, not a new measurement.

## 2. Large-displacement case table

Source for all Snap/edge figures: [WALKING_SCALE_EXECUTION.md](WALKING_SCALE_EXECUTION.md)
("Largest distinct place measurements" table) and the underlying
`data/logistics/walking-scale-results.json` / `data/logistics/walking-pilot-results.json`
`endpointSnapping` fields, read directly for this audit. A place's Snap displacement is
one measurement of that place's coordinate, independent of how many directed edges are
incident to it or which direction they run — the "incident clean edges" column below
counts *reuses* of that one measurement, not independent observations, per
`docs/WALKING_SCALE_EXECUTION.md`'s own finding ("multiple incident edges or reverse
directions do not turn it into four independent measurements").

| ID | Place | Snap (m) | Incident clean edges | Type of place | Official evidence found | Interpretation | Confidence | Likely needs future access point? | Evidence still missing |
|---|---|---:|---:|---|---|---|---|---|---|
| JP-029 | Imperial Palace East Gardens | 198.63 | 4 (JP-028↔JP-029, JP-029↔JP-030) | Large walled public garden inside the Imperial Palace grounds | Imperial Household Agency, [higashigyoen/index.html](https://www.kunaicho.go.jp/en/visit/event/higashigyoen/index.html) (fetched 2026-09-04): names exactly three visitor gates for the East Gardens — **Ōte-mon, Hirakawa-mon, Kitahanebashi-mon** | **Hypothesis 1** (POI coordinate is interior/visual, not a gate) | **High** — an official source enumerates named gates distinct from a generic garden coordinate, and the dataset coordinate (35.6852, 139.7528) is not any of them | Yes | Which of the 3 gates (or more than one) should be the override, and its verified coordinates — not established here |
| JP-185 | Furuzamami Beach | 139.31 | 1 (JP-185→JP-184; pilot's `JP-184→JP-185` is the same pair) | Beach on Zamami Island | Zamami Village Tourism Association, [transport](https://www.zamamitourism.com/en/transport) (fetched 2026-09-04): the village bus network lists **"Furuzamami Beach"** as one of its named scheduled stops | **Hypothesis 1**, plausible | **Medium** — confirms a distinct, named official access point exists separate from "the beach" as a place, but does not give that stop's coordinates, so the size of the gap between it and the recorded beach coordinate is not established | Plausible | The bus stop's actual coordinates, and how far they sit from the recorded beach coordinate |
| JP-064 | Hōnen-in | 94.66 | 7 (JP-060/062/063/065↔JP-064) | Temple precinct, Kyoto | Official site [honen-in.jp](https://www.honen-in.jp/) returned **HTTP 503** on two independent fetch attempts (2026-09-04); no content retrieved | **Evidence insufficient** | — | Unknown | The entire official-source check for this place; needs a re-attempt when the site is reachable |
| JP-181 | ASMUI Spiritual Hikes | 80.69 | 2 (JP-181↔JP-182) | Multi-stage nature/hiking facility | Official site [asmui.jp](https://www.asmui.jp/) (fetched 2026-09-04): explicitly separates **reception**, a **shuttle bus** ("9:40–16:00, 20-minute intervals") to a lounge, and the hiking **starting point**, stating reception→starting point takes **approximately 20–30 minutes** | **Hypothesis 1**, strong | **High** — this is not a simple gate ambiguity but direct evidence that "ASMUI Spiritual Hikes" cannot be one interchangeable physical point for external navigation vs. the hike's actual start | Yes (more than a simple gate — likely mode-specific: arrival point vs. trailhead) | Which specific stage (reception vs. trailhead) an external walking edge should target, and its coordinates |
| JP-069 | Bishamon-dō | 77.96 | 1 (JP-069→JP-070; pilot's `JP-070→JP-069` is the same pair) | Temple precinct, Kyoto | Official site [bishamon.or.jp/visiting_and_transportation_information](https://www.bishamon.or.jp/visiting_and_transportation_information/) (fetched 2026-09-04): confirms ~20-minute walk from Yamashina Station; does **not** describe multiple gates or entrances | **Hypothesis 1**, unconfirmed / **evidence insufficient** to distinguish from a plain "coordinate placed inside precinct" case | **Low** | Plausible but unconfirmed | Any source distinguishing an approach path/gate from the recorded coordinate — none found |

No coordinate, gate assignment, or override value is proposed anywhere in this table.
Where "high confidence" is recorded, it describes confidence that **hypothesis 1
explains the case**, not a recommended replacement coordinate — none is chosen, per
this phase's audit-only scope.

## 3. Kyoto Imperial Palace no-route audit (JP-090 and its four neighbors)

The five `no-route` results are documented together deliberately: all five touch
JP-090 (Kyoto Imperial Palace), either as `fromId` or `toId`, and independently
verifying each destination's real-world accessibility does not explain why *routing
to/from JP-090 specifically* failed in every one of its three distinct directed
neighbor pairs.

| Edge (from → to) | Directions result | Same underlying pair as |
|---|---|---|
| JP-089 → JP-090 | `no-route` | JP-090 → JP-089 (reverse) |
| JP-090 → JP-089 | `no-route` | JP-089 → JP-090 (reverse) |
| JP-090 → JP-092 | `no-route` | — |
| JP-090 → JP-102 | `no-route` | JP-102 → JP-090 (reverse) |
| JP-102 → JP-090 | `no-route` | JP-090 → JP-102 (reverse) |

That is **three distinct directed *pairs*** (JP-089↔JP-090, JP-090→JP-092, JP-090↔JP-102),
each contributing one or two directions, not five independent failures — consistent
with the audit's rule against treating incident/reverse edges as independent
measurements.

### JP-090's own Snap measurement

JP-090's Snap displacement is **3.65 m** — one of the smallest in the entire scale-up
(see [WALKING_SCALE_EXECUTION.md](WALKING_SCALE_EXECUTION.md), "Terminal results and
Snap coverage"). Snap succeeded cleanly; Directions failed on every route that used
that snapped point. This is the pattern the "Snap vs. Directions connectivity"
distinction in Section 1 exists to describe: a trivially good snap does not certify
that the snapped node is usefully connected to the rest of the routable network.

### Independent real-world accessibility evidence

- **JP-090 (Kyoto Imperial Palace)** — Imperial Household Agency,
  [sankan.kunaicho.go.jp/.../kyoto](https://sankan.kunaicho.go.jp/multilingual/lang/en/kyoto/index.html)
  and [.../information](https://sankan.kunaicho.go.jp/multilingual/lang/en/information.html)
  (fetched 2026-09-04): public visitor access is offered (a walk-in registration
  meeting spot is described), and access is given as **~5 minutes from Imadegawa
  Station** (subway or bus) and **~20 minutes from Demachiyanagi Station** (Keihan
  Railway) — ordinary, unremarkable pedestrian/transit access. The official visitor
  route map PDF ([junro-kyotogosho.pdf](https://sankan.kunaicho.go.jp/info/pdf/junro-kyotogosho.pdf))
  could not be parsed as text in this environment (binary PDF, no renderer
  available), so a specific gate name is **not independently confirmed here** and is
  not asserted as fact in this document.
- **JP-089 (Nijō Castle)** — official site,
  [nijo-jocastle.city.kyoto.lg.jp/access](https://nijo-jocastle.city.kyoto.lg.jp/access/?lang=en)
  (fetched 2026-09-04): normal public access from Kyoto Station (subway/bus/JR),
  Sanjo Keihan Station (subway), and Hankyu Karasuma Station (bus) — no access
  restriction of any kind described.
- **JP-092 (Kyoto International Manga Museum)** — official site,
  [kyotomm.jp/en/access](https://kyotomm.jp/en/access/) (fetched 2026-09-04):
  **~2-minute walk** from Karasuma Oike Station Exit 2 — a short, ordinary urban
  walking distance.
- **JP-102 (Demachi Masugata Shopping Arcade)** — official site,
  [masugata.demachi.jp/access](https://masugata.demachi.jp/access/) (fetched
  2026-09-04): walkable from Demachiyanagi Station (cross Demachi Bridge) or an
  8-minute walk from Imadegawa Station, plus bus access — again ordinary public
  access.

None of the four neighboring places' own official sources describe any restriction
that would make walking between them and the Imperial Palace grounds implausible.
Three of the four (JP-089, JP-090, JP-092) share the same "Central Kyoto" cluster in
this dataset, at recorded distances of 0.85–1.78 km (`nearby.json`); these are
ordinary intra-city walking distances, not a case of the dataset linking obviously
unwalkable places.

### Determination

The evidence supports classifying this cluster of five `no-route` results as a
**provider/endpoint connectivity anomaly centered on JP-090's snapped node**, not
real-world pedestrian inaccessibility:

- The pattern (uniform failure, always involving one specific node; trivially small
  Snap displacement at that node) is the signature Section 1 describes for a
  snapped point landing on a graph fragment not usefully connected to the wider
  network — plausible for a coordinate inside a large palace/park grounds whose
  interior paths may not join the public street graph at the point actually
  encoded in OpenStreetMap's data at query time.
- Every other place involved has strong, independent, official evidence of ordinary
  public pedestrian/transit accessibility, with no restriction that would explain a
  real-world "cannot be walked between" reading.

This determination is **moderate-to-high confidence for "connectivity anomaly"**,
and **high confidence for excluding "real-world inaccessibility"** as the
explanation for these five results, given the strength and directness of the
official accessibility sources for all four places involved. It is not proof of
the exact graph mechanism (this audit did not — and could not, without ORS
requests — inspect openrouteservice's graph directly), so it is not classified as
fully conclusive. **Inaccessibility is not supported by the evidence gathered.**

This finding does not change how `getBestTransfer` treats these five edges: they
remain `no-route`, they are not reclassified, and they continue to fall back to the
recorded `nearby.json` estimate exactly as before (see
[LOGISTICS.md](LOGISTICS.md), "Phase 3B2B-C — Walking Scale Integration").

## 4. Threshold decision

**Question:** does the evidence gathered in this audit justify setting a value for
`SNAP_SIGNIFICANT_PER_ENDPOINT_ABSOLUTE_METERS` now?

**Answer: No.** The working hypothesis is confirmed by this audit, on the following
grounds — evaluated, not assumed:

- **The evidence explains cases by place type, not by displacement magnitude.**
  JP-029 (198.63 m) has strong, specific evidence (three named official gates).
  JP-181 (80.69 m) has strong, specific evidence (a documented multi-stage venue).
  JP-069 (77.96 m) — a *smaller* displacement than JP-181 — has only weak,
  unconfirmed evidence for the same hypothesis. A single absolute cutoff would
  either have to draw a line between JP-181 and JP-069 despite both being
  well-evidenced-vs-not for reasons unrelated to their meter values, or lump them
  together and be wrong about one of them.
- **JP-064 cannot be evaluated at all right now** (official source unreachable),
  yet at 94.66 m it would sit inside almost any plausible cutoff being discussed.
  Setting a threshold today would silently reclassify a case this audit could not
  actually verify.
- **The scale of the affected population remains small and does not, by itself,
  argue for urgency.** Per `docs/WALKING_SCALE_EXECUTION.md`, only 2 of 137 required
  places exceed 100 m; this audit adds no new displacement data, only interpretation
  of the existing 5-place tail.
- **No independently labelled ground truth exists.** As `WALKING_SCALE_EXECUTION.md`
  already concluded, there is still no verified set of "acceptable" vs.
  "unacceptable" access-point errors to calibrate a defensible cutoff against; this
  audit's case-by-case evidence, while useful, is per-place qualitative evidence, not
  a labelled dataset a numeric threshold could be fit to. Picking the P95 (~57.8–62.3 m
  depending on population), a round 100 m, or any other number here would repeat the
  exact "unreviewed heuristic dressed up as a metric" pattern this codebase has
  already declined once (see `docs/LOGISTICS.md`'s "No compact/extended
  classification" decision for the same reasoning applied to a different metric).

No threshold is proposed. `SNAP_SIGNIFICANT_PER_ENDPOINT_ABSOLUTE_METERS` remains
`None`, unchanged, exactly as `scripts/logistics_common.py` already has it.

## 5. Architectural recommendation

**Recommendation: prefer separating the POI display coordinate from a per-place
logistics access point over any global absolute Snap threshold.**

The evidence gathered in Section 2 makes a magnitude-only rule look like the wrong
instrument, independent of what magnitude is chosen:

- JP-029's problem is not "too far from a road" in the abstract — it is that the
  recorded coordinate is inside a gated compound with three named, official entry
  points the dataset does not represent at all. No absolute-meter cutoff fixes that;
  only recording an actual entrance would.
- JP-185's problem is that an official, separately-named transit stop exists for the
  destination, distinct from "the beach" as a place — again a structural gap a
  threshold cannot close, only flag.
- JP-181's problem is not a simple entrance offset at all: reception, a shuttle stop,
  and the actual trailhead are three different points ~20–30 minutes apart from each
  other by the venue's own description. A single override coordinate would still be
  an approximation; a single global threshold says nothing useful about this shape
  of problem.
- JP-090's problem (Section 3) is not a coordinate-accuracy problem in the sense a
  threshold addresses at all — it is a suspected graph-connectivity anomaly at a
  well-snapped point. Threshold tuning targets Snap displacement; it would not have
  flagged or fixed this case regardless of its value, since JP-090's own Snap
  displacement (3.65 m) is nowhere near any plausible cutoff.

A **display coordinate vs. logistics access point** model fits what the evidence
actually shows: the visual POI coordinate (center, building, garden, beach, precinct,
natural area — whatever correctly represents "where this place is" to a user) stays
exactly as it is; a *separate*, optional, evidenced field records where a routing
request should actually target (a gate, visitor entrance, reception, trailhead, or
bus/road access point) when the two differ enough to matter. This is preferable to a
global threshold because the underlying problem this audit found is not "some
coordinates are noisy by degree" but "some places have a structurally different
correct answer for 'where do you walk to' than for 'where is this place,'" which a
per-place, evidenced override models directly and a blanket numeric cutoff does not.

This recommendation is **not implemented by this phase.**

## 6. Proposed next phase (design only — not started, not implemented)

If pursued, a future phase should be scoped narrowly and reversibly:

**Phase 3B2E (proposed name, not started) — Access-Point Override Design**, which
would:

- Design (not yet build) a schema for an optional, per-place logistics access point
  that **layers on top of, and never replaces,** the existing display/POI
  coordinate.
- Require **provenance** on every override: the official source URL, the entity, and
  the consultation date — mirroring the sourcing discipline this audit itself used
  (Section "Fuentes"/table above), never a coordinate asserted without a citable
  origin.
- Apply an override **only where evidence supports it** — this audit's own JP-064
  and JP-069 findings (insufficient/unconfirmed evidence) show that not every
  large-displacement case should or could get one yet; a future phase must not
  backfill placeholder overrides for cases it can't evidence.
- Be **specific per travel mode where relevant** — JP-181's evidence already shows a
  walking access point and a hiking start point are not necessarily the same point;
  a schema that assumes one override per place regardless of mode would misrepresent
  cases like this one.
- **Support more than one access point per place** — JP-029's three official gates
  are a direct example of a place that cannot be correctly modeled by a single
  override value.
- Be **auditable**: versioned, documented, and reviewable the same way the pilot and
  scale-up artifacts are, not embedded as an untracked or undocumented convention.
- **Not auto-convert every POI to an "entrance" system** — most of this dataset's
  places have no evidence of a display/access mismatch at all (only 2 of 137
  required places even exceed 100 m); a schema that forces every place through an
  entrance model would manufacture exactly the kind of unreviewed assumption this
  audit avoided.
- **Never silently alter historical routing results** — `walking-pilot-results.json`
  and `walking-scale-results.json` remain what they are: precomputed answers for the
  coordinate pairs actually queried. An access-point override changing what a
  *future* query targets must not be read backward onto results already recorded
  under the original coordinates.

This phase is a proposal for evaluation, not a commitment, and nothing in this
document begins it.

## Sources consulted (2026-09-04)

Priority order followed: (1) public body/managing authority, (2) place's own
official site, (3) public tourism authority, (4) reputable secondary source only if
unavoidable. No blog, forum, or aggregator was used to support any conclusion in
this document.

| URL | Entity | Supports |
|---|---|---|
| https://www.kunaicho.go.jp/en/visit/event/higashigyoen/index.html | Imperial Household Agency | JP-029: names the three East Gardens gates (Ōte-mon, Hirakawa-mon, Kitahanebashi-mon) |
| https://www.kunaicho.go.jp/en/learn/institution/shisetsu/kokyo-map.html | Imperial Household Agency | General Imperial Palace gate/station walking times (Kikyo-mon, Ōte-mon, Hirakawa-mon, Kita-hanebashi-mon); does not itself map gates to the East Gardens specifically |
| https://sankan.kunaicho.go.jp/multilingual/lang/en/kyoto/index.html | Imperial Household Agency | JP-090: public walk-in access described; specific visitor entrance/exit gate name not confirmed from this page's fetched content |
| https://sankan.kunaicho.go.jp/multilingual/lang/en/information.html | Imperial Household Agency | JP-090: station access times (~5 min Imadegawa, ~20 min Demachiyanagi, ~5 min Karasuma-Imadegawa bus stop) |
| https://sankan.kunaicho.go.jp/info/pdf/junro-kyotogosho.pdf | Imperial Household Agency | JP-090 visitor route map — **not verifiable in this session** (binary PDF, no text/renderer available); no gate-name claim from this document is asserted as confirmed |
| https://nijo-jocastle.city.kyoto.lg.jp/access/?lang=en | Nijō Castle (City of Kyoto) | JP-089: ordinary public transit/walking access, no restriction described |
| https://kyotomm.jp/en/access/ | Kyoto International Manga Museum | JP-092: ~2-minute walk from Karasuma Oike Station Exit 2 |
| https://masugata.demachi.jp/access/ | Demachi Masugata Shopping Arcade | JP-102: walkable access from Demachiyanagi and Imadegawa Stations |
| https://www.zamamitourism.com/en/transport | Zamami Village Tourism Association | JP-185: confirms "Furuzamami Beach" as a named official village-bus stop, distinct from the beach as a POI |
| https://www.asmui.jp/ | ASMUI (official site) | JP-181: confirms reception / shuttle bus / hiking start point are distinct stages, ~20–30 min apart |
| https://www.bishamon.or.jp/visiting_and_transportation_information/ | Bishamon-dō (official site) | JP-069: confirms ~20-minute walk from Yamashina Station; does not describe multiple gates |
| https://www.honen-in.jp/ | Hōnen-in (official site) | JP-064: **unreachable (HTTP 503) on two attempts** — no content verified |

No URL above was used to justify a coordinate, threshold, or dataset change — this
phase makes none.
