# Phase 4G — Photography Scale-Up II Design Gate

Status: **design complete; no acquisition authorized in this phase**

Base: `e45cd44111b867a548f0f66e457b4053e6b9d7eb`  
Issue: #104  
Design date: **2026-09-15 (America/Mexico_City)**

## 1. Live inventory

Recomputed from canonical data at the exact base:

- total places: **214**
- covered with local licensed photography: **58**
- coverage: **58/214 = 27.1%**
- uncovered: **156**
- uncovered by grade: S=4, A=117, B=25, C=6, D=4
- uncovered A by hub: Tokio 32, Okinawa 29, Kioto 28, Osaka 27, Sapporo 1

The six carried fail-closed targets are still uncovered:

- Phase 4D: JP-033, JP-126, JP-203, JP-204
- Phase 4F: JP-050, JP-195

JP-050 and JP-195 are A-grade. Excluding the carried fail-closed set leaves **115 eligible A-grade places**.

The 117 uncovered A-grade places span 21 category labels. After excluding JP-050
(🎢 Entretenimiento) and JP-195 (🌌 Cielo nocturno), the executable universe spans
**19 eligible category labels**.

## 2. Asset evidence

Observed committed photography footprint:

- first 36 assets after Phase 4D: **10,698,282 B**
- Phase 4F accepted 22 assets: **5,457,240 B / 5.20 MiB**
- current 58-asset footprint: **16,155,522 B / 15.41 MiB**
- current all-catalog mean: **278,543 B/asset**
- weighted mean of the two scale-up batches (4D + 4F): **266,608 B/asset**

A committed per-file size manifest does not exist, so this design uses exact aggregate batch
totals and two transparent means instead of inventing a median.

Projected deltas:

| Attempt size | Recent-batch mean | Current-catalog mean | Max coverage if all pass |
|---|---:|---:|---:|
| 24 | 6.10 MiB | 6.38 MiB | 82/214 = 38.3% |
| 32 | 8.14 MiB | 8.50 MiB | 90/214 = 42.1% |
| 40 | 10.17 MiB | 10.63 MiB | 98/214 = 45.8% |

Each failed target reduces realized coverage by one place (about 0.47 percentage points of the
214-place catalog). No success rate is assumed.

## 3. Grade scope

**Decision: remain A-grade-only for the next executable batch.**

Reasoning:

- 115 eligible A-grade places remain, so widening grade scope is unnecessary.
- Photography coverage must not become a recommendation/ranking signal.
- Mixing lower grades now would reduce the auditability of the deterministic successor without
  solving a coverage scarcity problem.
- The four S-grade failures remain governed by their earlier fail-closed evidence and are not
  silently retried.

## 4. Strategy comparison

### 24 targets

Advantages:
- lowest research and visual-review workload;
- projected 6.10–6.38 MiB;
- comfortably inside prior asset budgets;
- reaches all 19 currently eligible categories under the revised selector.

Disadvantages:
- max coverage only 38.3%;
- leaves substantial fixed sourcing/QA overhead for another near-term batch.

### 32 targets — selected

Advantages:
- reaches the same full 19-category breadth as 24;
- increases max coverage to 42.1%;
- projected 8.14–8.50 MiB remains below the new soft budget;
- hub allocation remains balanced: Kioto 8, Okinawa 8, Osaka 7, Sapporo 1, Tokio 8;
- materially improves coverage without the 40-target review surface.

Disadvantages:
- 33% more candidate research than 24;
- more branded/temporal/sensitive cases require explicit fail-closed review.

### 40 targets

Advantages:
- max coverage 45.8%.

Disadvantages:
- projected 10.17–10.63 MiB reaches/exceeds the proposed soft budget before any outlier;
- 25% more source/visual review than 32 for only eight additional attempted places;
- no category-breadth gain over 32;
- larger exact-head CI and repository delta.

**Decision: 32 is the best bounded tradeoff.**

## 5. Revised deterministic selector

### Eligibility

A place is eligible iff:

1. canonical place exists;
2. `grade === "A"`;
3. it has no photography record at the Phase 4G base;
4. it is not one of the six carried fail-closed IDs:
   `JP-033 JP-126 JP-203 JP-204 JP-050 JP-195`.

No carried failure may re-enter unless a future design gate documents materially new sourcing
evidence that changes the earlier failure basis.

### Hub quotas

For tranche size 32:

1. assign one seat to every eligible hub;
2. allocate remaining seats proportionally to residual eligible count `eligibleCount - 1`;
3. use Hamilton/largest remainder;
4. tie by binary UTF-16/code-unit hub ordering.

Result:

- Kioto: **8**
- Okinawa: **8**
- Osaka: **7**
- Sapporo: **1**
- Tokio: **8**

### Round order

Selection proceeds in rounds over hubs in binary UTF-16 ascending order. A hub participates until
its quota is full.

### Candidate priority tuple

Within each participating hub, sort remaining candidates by:

1. **global selected count for the candidate category ascending** — categories not yet represented
   are selected first;
2. **temporal-risk ascending** — ordinary subjects before temporal/event subjects when category
   representation is equal;
3. **eligible-universe count for that category ascending** — rarer eligible categories first;
4. **currently photographed count for that category across all grades ascending**;
5. **place ID ascending by binary UTF-16/code-unit order**.

This is deliberately different from Phase 4E: the old temporal-first tuple now yields only
17 distinct categories at 24/32/40. The revised tuple reaches **all 19 eligible categories within
the first 24 selections** while still delaying temporal subjects within the same category-coverage
state.

No locale-aware sorting and no editorial override table are permitted.

### Temporal risk

Temporal risk is true if:

- category is `🎆 Eventos`; or
- category is `🐋 Fauna y experiencias estacionales`; or
- case-insensitive name contains `festival`, `tournament`, or `animejapan`.

Temporal imagery must never imply a 2027 edition, schedule, availability or operating state unless
the source independently proves that proposition.

## 6. Exact 32-target successor fixture

| # | ID | Hub | Place | Category |
|---:|---|---|---|---|
| 1 | JP-101 | Kioto | Gion Corner | 🎭 Cultura tradicional |
| 2 | JP-156 | Okinawa | Sakaemachi Arcade nightlife | 🌃 Nocturno |
| 3 | JP-121 | Osaka | Expo ’70 Park + Tower of the Sun | 🧩 Extraño/peculiar/único |
| 4 | JP-207 | Sapporo | Lake Shikotsu Ice Festival | 🎆 Eventos |
| 5 | JP-028 | Tokio | Jimbocho Book Town | 🛍️ Compras |
| 6 | JP-070 | Kioto | Yamashina Canal | 🌿 Naturaleza |
| 7 | JP-161 | Okinawa | Okinawa Prefectural Museum & Art Museum | 🏛️ Museos |
| 8 | JP-111 | Osaka | Abeno Harukas 300 | 🌅 Miradores |
| 9 | JP-008 | Tokio | Shibuya PARCO + Nintendo TOKYO | 🎮 Videojuegos |
| 10 | JP-090 | Kioto | Kyoto Imperial Palace | 🏯 Historia y patrimonio |
| 11 | JP-180 | Okinawa | Hiji Falls | 🥾 Senderismo/aventura |
| 12 | JP-151 | Osaka | Ine Funaya | 🌊 Playa/mar/islas |
| 13 | JP-046 | Tokio | Nakano Broadway | 👾 Anime/manga |
| 14 | JP-095 | Kioto | teamLab Biovortex Kyoto | 🎨 Arte |
| 15 | JP-159 | Okinawa | Kinjo-cho Stone-Paved Road | 🏙️ Ciudad y barrios |
| 16 | JP-128 | Osaka | Kishiwada Castle Hachijin Garden | 🌸 Jardines y paisajes |
| 17 | JP-016 | Tokio | Sensō-ji | ⛩️ Templos y santuarios |
| 18 | JP-079 | Kioto | Kyoto Rakusai Bamboo Park | 🌿 Naturaleza |
| 19 | JP-202 | Okinawa | Whale watching in the Kerama waters | 🐋 Fauna y experiencias estacionales |
| 20 | JP-127 | Osaka | Sakai traditional knife experience | 🎭 Cultura tradicional |
| 21 | JP-208 | Tokio | Kawazu Cherry Blossom Festival | 🌸 Naturaleza |
| 22 | JP-098 | Kioto | Byōdō-in | 🏯 Historia y patrimonio |
| 23 | JP-167 | Okinawa | Koza music district | 🌃 Nocturno |
| 24 | JP-146 | Osaka | Tomogashima | 🧩 Extraño/peculiar/único |
| 25 | JP-026 | Tokio | Retro game hunt: Super Potato + Mandarake | 🎮 Videojuegos |
| 26 | JP-061 | Kioto | Murin-an | 🌸 Jardines y paisajes |
| 27 | JP-182 | Okinawa | Cape Hedo | 🌅 Miradores |
| 28 | JP-118 | Osaka | Osaka Museum of History | 🏛️ Museos |
| 29 | JP-049 | Tokio | Ikebukuro anime district | 👾 Anime/manga |
| 30 | JP-058 | Kioto | Kennin-ji | ⛩️ Templos y santuarios |
| 31 | JP-181 | Okinawa | ASMUI Spiritual Hikes | 🥾 Senderismo/aventura |
| 32 | JP-015 | Tokio | Kagurazaka backstreets | 🏙️ Ciudad y barrios |

Distinct eligible categories represented: **19/19**.

## 7. Sensitive/branded handling

The selector does not silently exclude branded or copyright-sensitive places.

Notable examples in the fixture include JP-008, JP-026 and JP-095.

For any such target, the executable successor must prefer a defensible exterior, entrance,
architecture, signage or broad factual place scene. It must reject a candidate when:

- copyrighted artwork/characters dominate and subject-matter risk cannot be bounded;
- the location match is uncertain;
- a private individual dominates the frame and a safer representative frame is not available;
- the image represents a nearby business/venue rather than the named place.

Failure remains fail-closed. No legal-clearance claim may be encoded.

## 8. Asset budget

For the 32-attempt successor:

- expected working range: **8.14–8.50 MiB**
- **soft budget: 10 MiB**
- **hard stop/review threshold: 14 MiB**

The 10 MiB soft budget sits above both evidence-based projections while still making a 40-target
batch visibly less attractive. The 14 MiB hard threshold allows source-image/compression outliers
without turning budget pressure into a reason to weaken sourcing, licensing or quality rules.

Crossing 10 MiB is documented, not automatically rejected. Approaching or exceeding 14 MiB requires
stopping for review before accepting more assets.

Never lower the existing quality floor, widen license/source policy, or substitute targets merely
to fit the budget.

## 9. Failure and replacement semantics

**Decision: no replacement queue.**

Each of the exact 32 targets is researched independently. If a target fails sourcing, subject,
license, location, privacy or temporal review, it remains uncovered.

Reasons:

- preserves exact auditability of the deterministic fixture;
- prevents a failed candidate from silently expanding research scope;
- Phase 4F demonstrated that a bounded batch remains useful even with failed targets.

## 10. Preserved sourcing/runtime contract

The executable successor must preserve:

- Wikimedia Commons only;
- current CC0 / CC BY / CC BY-SA allowlist only;
- no NC, ND, fair-use or AI-generated substitute;
- exact Commons file-page provenance;
- separately source-backed attribution title only;
- unchanged local WebP derivative pipeline;
- maximum one registered photo per place;
- zero runtime photography-provider request;
- canonical/app metadata byte parity;
- no gallery redesign;
- no photography-derived ranking, recommendation, grade, itinerary or routing effect.

## 11. Authorized successor

**Authorized successor: Phase 4H — A-Grade Licensed Photography Acquisition Batch II.**

Phase 4H may:

- start only from the exact merged Phase 4G design base;
- attempt exactly the 32-place fixture above;
- pin the selector output in focused tests before acquisition;
- accept at most one photograph per target;
- use no replacements;
- preserve the six carried fail-closed IDs outside the attempt set;
- use 10 MiB soft / 14 MiB hard asset thresholds;
- run photography validator, Python, focused selector/attribution/photo tests, full Vitest, lint,
  build, asset/invariant checks and browser QA;
- include browser cases for ordinary, branded/sensitive, temporal and failed-closed outcomes;
- validate an exact executable HEAD in repository-native CI;
- remove any temporary workflow and prove zero executable/data/test/asset drift;
- stop with the implementation PR **Draft**.

Phase 4G itself authorizes **no acquisition**.
