# Phase 4E — A-Grade Photography Scale-Up Design Gate

Status: **design/audit only — no photography acquisition in this phase**

Base: `73c359fa990c940b599a117e708be161c380258d` (`main` after Phase 4D closeout / PR #99)

Issue: #100

Design date: **2026-09-15 (America/Mexico_City)**

Authority:
- `docs/PHOTOGRAPHY_ATTRIBUTION_SCALE_DESIGN.md`
- `docs/PHOTOGRAPHY_ATTRIBUTION_COMPLETENESS_RUNTIME.md`
- `docs/PHOTOGRAPHY_S_GRADE_BATCH_RUNTIME.md`
- `docs/ROADMAP.md` Phase 4D successor boundary

---

## 1. Decision

Authorize one later executable successor only:

**Phase 4F — A-Grade Licensed Photography Acquisition Batch I**

Phase 4F may research and attempt **exactly the deterministic 24-place target set produced by
the selector contract in this document**, with at most one photograph per place and no replacement
target when a place fails closed.

Phase 4E itself acquires **zero** images, changes **zero** photography metadata records, changes
**zero** image blobs, changes no acquisition/runtime code and authorizes no gallery redesign.

---

## 2. Live coverage audit

The candidate universe was recomputed from current repository data at the Phase 4E base rather than
from a hardcoded count.

- total places: **214**
- current local photographs: **36**
- coverage: **36/214 = 16.8%**
- uncovered: **178**

Uncovered by grade:

| grade | uncovered |
|---|---:|
| S | 4 |
| A | **139** |
| B | 25 |
| C | 6 |
| D | 4 |

The four uncovered S-grade places are exactly the Phase 4D failed-closed set:
JP-033, JP-126, JP-203 and JP-204. They are outside Phase 4E's A-only universe and remain explicitly
ineligible for Phase 4F unless a later source-drift/design gate finds materially new evidence.

Uncovered A-grade places by hub:

| hub | A-grade uncovered |
|---|---:|
| Tokio | 37 |
| Kioto | 34 |
| Okinawa | 33 |
| Osaka | 32 |
| Sapporo | 2 |
| Nagoya | 1 |
| **total** | **139** |

The A-grade universe spans 28 current category labels. The largest gaps are temples/shrines (23),
gardens/landscapes (12), art (11), city/neighborhoods (10), history/heritage (9),
beach/sea/islands (9) and hiking/adventure (8).

---

## 3. Asset-budget audit

Current catalog footprint recorded after Phase 4D:

- 36 assets: **10,698,282 bytes**
- current mean: **297,174.5 bytes / asset**
- Phase 4A/4C 24-asset footprint: **7,090,836 bytes** (**295,451.5 bytes / asset**)
- Phase 4D 12-asset delta: **3,607,446 bytes** (**300,620.5 bytes / asset**)
- current observed maximum: **476,750 bytes**
- acquisition pipeline soft per-asset target remains approximately **300 KB**, with quality floor 60

Projection using the actual current 36-asset mean:

| tranche | projected delta | projected maximum coverage | selector category breadth |
|---|---:|---:|---:|
| 16 | 4,754,792 B / 4.53 MiB | 52/214 = 24.3% | 16 categories |
| **24** | **7,132,188 B / 6.80 MiB** | **60/214 = 28.0%** | **24 categories** |
| 32 | 9,509,584 B / 9.07 MiB | 68/214 = 31.8% | 26 categories |

### Batch budget

For Phase 4F:

- **soft batch budget: 8 MiB**
- **hard review threshold: 12 MiB**

The soft budget is deliberately above the 6.80 MiB projection for 24 assets. The hard threshold is
a stop-and-review boundary, not permission to weaken quality or sourcing. If accepted assets would
push the batch above 12 MiB, Phase 4F must stop and report rather than lower the existing quality
floor, alter the license policy or substitute a different place solely to save bytes.

### Why 24

16 is safe but underuses the already-proven pipeline and reaches only 24.3% maximum coverage.
32 adds eight more research/visual-review obligations for only two additional categories under the
current selector, pushes the expected batch above the 8 MiB soft budget and exposes more
brand-sensitive candidates.

24 is the best balance: six-hub representation, 24 distinct categories in the current base,
a projected 6.80 MiB delta and a bounded review surface comparable to the original 24-place pilot.

---

## 4. Deterministic selector contract

Phase 4F must implement this selector in code and pin its output in tests before acquisition.

### 4.1 Eligibility

A place is eligible when all are true:

1. it exists in the current canonical place dataset;
2. `grade === "A"`;
3. it has no current photography-metadata record;
4. it is not one of the carried Phase 4D failed-closed IDs
   `JP-033`, `JP-126`, `JP-203`, `JP-204`.

The explicit failed-closed exclusion is intentionally redundant at the current base because those
four places are S-grade. It preserves the fail-closed decision if unrelated data later changes.

### 4.2 Hub quotas

For a tranche size of 24:

1. give one seat to every hub with at least one eligible place;
2. distribute the remaining seats proportionally to each hub's residual eligible count
   `max(eligibleCount - 1, 0)`;
3. use largest-remainder allocation;
4. break equal remainder ties by exact hub string ascending.

At the Phase 4E base this yields:

| hub | quota |
|---|---:|
| Kioto | 6 |
| Nagoya | 1 |
| Okinawa | 5 |
| Osaka | 5 |
| Sapporo | 1 |
| Tokio | 6 |
| **total** | **24** |

### 4.3 Candidate priority inside quotas

Selection proceeds in rounds over hubs in exact ascending string order. A hub participates until its
quota is filled.

For each hub seat, sort remaining eligible candidates by this tuple:

1. **temporal-risk flag ascending** — ordinary before temporal;
2. **number already selected in that category globally ascending**;
3. **number of currently photographed places in that category across all grades ascending**;
4. **placeId ascending**.

The temporal-risk flag is true when:
- category is `🎆 Eventos`; or
- category is `🐋 Fauna y experiencias estacionales`; or
- the case-insensitive place name contains `festival`, `tournament` or `animejapan`.

This delays edition-sensitive material without making it ineligible. It also avoids hand-curated
category priority tables.

### 4.4 Current deterministic output

Applied to the Phase 4E base, the selector produces:

| ID | hub | place | category |
|---|---|---|---|
| JP-068 | Kioto | Fushimi Sake District | 🍶 Gastronomía |
| JP-210 | Nagoya | Takayama Sanmachi Historic District | 🏯 Historia y patrimonio |
| JP-155 | Okinawa | Tsuboya Yachimun Street | 🎭 Cultura tradicional |
| JP-103 | Osaka | Dotonbori | 🌃 Nocturno |
| JP-206 | Sapporo | Otaru Snow Light Path | 🎆 Eventos |
| JP-009 | Tokio | Daikanyama T-SITE | 🧩 Extraño/peculiar/único |
| JP-099 | Kioto | Uji tea experience | 🍵 Cultura tradicional |
| JP-195 | Okinawa | Yaeyama stargazing experience | 🌌 Cielo nocturno |
| JP-108 | Osaka | Den Den Town | 🎮 Videojuegos |
| JP-018 | Tokio | Kappabashi Kitchen Town | 🛍️ Compras |
| JP-085 | Kioto | Kurama-dera to Kibune hike | 🥾 Senderismo/aventura |
| JP-164 | Okinawa | Cape Chinen Park | 🌅 Miradores |
| JP-115 | Osaka | Nakanoshima Museum of Art | 🎨 Arte |
| JP-037 | Tokio | Zōjō-ji + Tokyo Tower view | 📷 Fotografía |
| JP-093 | Kioto | Kyoto Railway Museum | 🚂 Experiencias especiales |
| JP-160 | Okinawa | Shikina-en Royal Garden | 🌸 Jardines y paisajes |
| JP-141 | Osaka | Arima Onsen | 🧖 Onsen/bienestar |
| JP-040 | Tokio | Miraikan | 🤖 Tecnología |
| JP-102 | Kioto | Demachi Masugata Shopping Arcade | 🍜 Gastronomía |
| JP-174 | Okinawa | Bise Fukugi Tree Road | 🌿 Naturaleza |
| JP-116 | Osaka | Osaka Museum of Housing and Living | 🏛️ Museos |
| JP-050 | Tokio | PokéPark KANTO | 🎢 Entretenimiento |
| JP-092 | Kioto | Kyoto International Manga Museum | 👾 Anime/manga |
| JP-005 | Tokio | Cat Street | 🏙️ Ciudad y barrios |

The current output covers **24 distinct categories in 24 targets**.

This table is a reproducibility fixture for the stated base, not a substitute for the selector.
If Phase 4F starts from a different base, preflight must stop unless the design gate is explicitly
reconciled.

---

## 5. Sensitive and seasonal handling

### 5.1 Branded/copyright-sensitive subjects

Selection does not silently exclude branded places. That would turn legal/source difficulty into an
undocumented editorial ranking signal.

For any selected branded/copyright-sensitive target — JP-050 is the current obvious example —
Phase 4F carries forward the Phase 4D rule:

- prefer defensible exterior, architecture, entrance/signage or broad general scene;
- reject a candidate whose subject is dominated by copyrighted artwork/characters when the risk
  cannot be bounded;
- reject location mismatch;
- reject a frame dominated by an identifiable private individual when a safer representative frame
  is unavailable;
- do not claim legal clearance.

Failure is per place and leaves `imageBrief`; there is no substitute target.

### 5.2 Events and seasonal subjects

Temporal-risk places remain eligible but sort after ordinary candidates. JP-206 remains selected
because Sapporo's A-grade universe is itself event-heavy.

A prior-edition photograph may represent a recurring event only when it clearly depicts the named
event/place and the visible attribution/alt text does not imply that the photograph is the 2027
edition. If event identity, location or subject match is ambiguous, fail closed.

No current-event availability, schedule or 2027 operating claim may be inferred from a photograph.

---

## 6. Phase 4F sourcing contract

For each of the 24 targets independently:

- Wikimedia Commons only;
- existing supported license allowlist only;
- exact file-page source, creator/credit, license, license URL, Commons filename, acquisition URL
  and current source state verified;
- attribution title only when separately source-backed;
- manual visual/subject-match review before acceptance;
- one photograph maximum;
- existing local WebP pipeline unchanged;
- no runtime Commons/network dependency;
- no AI-generated substitute;
- no silent place substitution;
- if sourcing fails, leave the place on `imageBrief` and document why.

The selector controls research priority only. Photography presence must never become ranking,
recommendation, itinerary, grade or routing input.

---

## 7. Phase 4F validation contract

The executable successor must, at minimum:

1. preflight exact base/head and reproduce the 24-target selector output;
2. re-check each accepted Commons source on implementation day;
3. visually inspect every accepted candidate;
4. acquire using the unchanged existing pipeline, one place at a time;
5. run the photography validator;
6. run Python tests;
7. run focused photography/attribution/selector tests;
8. run full Vitest;
9. run lint;
10. run build;
11. assert the batch budget and exact target-set invariant;
12. browser-QA representative ordinary, branded/sensitive and temporal-risk records when they pass;
13. browser-QA at least one failed-closed fallback if any target fails;
14. verify all pre-existing blobs and records remain unchanged;
15. verify no place has a second image;
16. verify canonical/app metadata byte parity;
17. verify zero runtime Commons photography requests;
18. run hostile review;
19. validate an exact executable HEAD in repository-native CI;
20. remove any temporary workflow and prove zero executable tree drift.

Phase 4F must remain Draft after validation. It may not mark Ready or merge itself.

---

## 8. Forbidden scope

Phase 4E and its authorized Phase 4F successor do not authorize:

- second photographs for already-covered places;
- gallery/lightbox redesign;
- license-allowlist expansion;
- NC/ND/fair-use material;
- runtime Commons fetching;
- changing image availability into a ranking/recommendation signal;
- routing, itinerary, day planning, grade or recommendation changes;
- a fallback from a failed target to an unselected place;
- unbounded acquisition of all remaining 139 A-grade places;
- retrying the four Phase 4D failed-closed S-grade places without a separate evidence/design gate.

---

## 9. Outcome

**Outcome A — authorize a bounded 24-place successor.**

The design has enough evidence to authorize Phase 4F narrowly. The batch size is bounded by review
cost and repository weight, the selection is reproducible, category/hub coverage is explicit, and
fail-closed sourcing remains intact.

Phase 4F is **authorized but not started** by this document.
