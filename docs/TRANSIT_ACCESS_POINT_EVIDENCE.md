# Transit Access-Point Evidence Audit

Evidence audit deciding whether, and where, the reserved `"external-local-transit"` access
context should be populated. It applies the same official-source standard as Phase 3B2G
(`ACCESS_POINT_EVIDENCE.md`), which remains the record for the `external-walk` population.

**This is not Phase 3B3E.** No React hook, no `/api/transit/route` client, no provider request,
no provider activation. Activation stays **OFF**. The audit made **zero** requests to Ekispert,
NAVITIME, openrouteservice, or any geocoding/routing API; every source below is a public official
web page consulted directly.

**Outcome in one line:** of 78 candidate places, exactly **one** change is justified — the three
already-evidenced JP-029 gates gain `external-local-transit`. No new access point is created, no
default is created, and no coordinate is invented. `"external-local-transit"` goes from **0 to 3**
members.

---

## 1. The semantic question, settled first

Before any data change: does `external-local-transit` mean

- **(A)** "this physical point is literally a transit stop/station", or
- **(B)** "this physical point is a valid endpoint of an externally-originating route that may
  involve local transit plus first/last-mile walking"?

The two readings were both present in the repository, and they disagree. That is a real
contradiction, not a wording preference, so it is resolved here explicitly.

### Evidence for (B)

| Source | What it says |
|---|---|
| `ACCESS_POINT_DESIGN.md` §9 | `AccessPointRole` and `AccessContext` are deliberately **separate closed vocabularies**; the context list "describes **where the point may be used**, not what travel mode the global trip planner supports." |
| `ACCESS_POINT_DESIGN.md` §13 | A **`reception`** — not a stop — is given `applicableContexts: ["external-walk", "external-local-transit"]`, and: "The **context boundary**, not array position **or role naming**, controls eligibility." |
| `ACCESS_POINT_DESIGN.md` §18 | The same pairing again for JP-181: `AP-JP-181-001: reception, contexts = external-walk / external-local-transit`. |
| `ACCESS_POINT_DESIGN.md` §20 | "The access-point layer should **identify a place endpoint**, not become a timetable database." |
| `access-points.ts` | `getAccessPointsForContext` filters on `status` and `applicableContexts` and **never reads `role`**. |
| `transit.ts` | `resolveTransitEndpoint` likewise filters on context only; `transit-stop` is not required, or even mentioned. |
| `TRANSIT_PROVIDER_DECISION.md` §9 | A transit layer should "route against **every eligible point**" the context returns — eligibility, not stop-ness. |

### Evidence for (A)

Only one source, and only in prose written while populating `external-walk`:

- `ACCESS_POINT_EVIDENCE.md` §2: the Imperial Household Agency "gives *walking* times from station
  exits to each gate. That documents a pedestrian approach, **not that a gate is a transit
  endpoint**, so `external-local-transit` is not claimed for any of the three."
- `ACCESS_POINT_EVIDENCE.md` §3 and `AP-JP-181-001.notes`, in the same terms for ASMUI.

### Resolution

**(B) is the contract.** The design defines the vocabularies as orthogonal, states in terms that
role naming does not control eligibility, and gives a worked example of a non-stop point carrying
the transit context; both consumers of the data implement exactly that. Phase 3B2G's (A)-shaped
prose is the outlier — and it is prose, written to justify a conservative omission, never a
contract statement.

So, precisely:

> **`role`** answers *what this point physically is* — a gate, a reception, a trailhead, a stop.
> **`applicableContexts`** answers *which routing question this point is a legitimate endpoint
> for*. A point earns `external-local-transit` when official evidence shows it is a valid
> **arrival/departure endpoint for a trip that reaches the place using local transit** — which is
> normally the same public entrance a walker uses, and is **not** a claim that the point is itself
> a stop, and **not** a claim about which stop or line serves it.

Two consequences worth stating, because they are the guard rails on (B):

1. **(B) is not "everything gets both contexts."** A point fails the test when the place is not
   reachable by local transit at all (JP-181, below), when the point is an internal stage
   (`internal-hike`/`internal-shuttle` — design §13), or when no official source establishes the
   endpoint at all.
2. **(B) does not license inventing stops.** Under (A) one would be tempted to catalogue the
   *station*; under (B) the catalogued point stays the venue's own documented entrance, which is
   what the project actually has official coordinates for. (B) is therefore the *more*
   conservative reading in practice, not the looser one.

### Minimal documentation correction

`ACCESS_POINT_EVIDENCE.md` keeps its Phase 3B2G text — that document is the historical record of
what was decided then, and rewriting it would erase the decision this audit is revisiting. A
short pointer is added there instead, naming this file as the place the semantics were settled and
the JP-029 omission reversed. Nothing about the already-versioned `external-walk` data changes
meaning: those records asserted, and still assert, exactly what they always did.

---

## 2. Candidate universe, recomputed from the checkout

Derived programmatically from `data/nearby.json` and `data/places.json` at
`e6707229fcabed7b07ff91fef1a4dcd8cac51f52`, not carried over from any earlier document:

| Quantity | Value |
|---|---|
| Total relations | **403** |
| Walking (`A pie`) | **332** |
| Non-walking | **71** |
| `Transporte local` | **69** |
| `Disney Resort Line` | **2** |
| Unique places touching a non-walking relation | **78** |

Hub distribution of the 78: **Kioto 27, Tokio 21, Okinawa 20, Osaka 10**.

The full list of 78 place ids is reproduced in §6.

### The triage signal is measured, not guessed

The repository already contains a measurement of exactly the property in question: every walking
route in `walking-pilot-results.json` / `walking-scale-results.json` records `endpointSnapping`,
i.e. how far each place's **display coordinate** had to move to reach a routable way. A large
snap is direct evidence that the display coordinate is a poor logistics endpoint.

Ranking the 78 candidates by their worst measured snap:

| Place | Worst snap | Status |
|---|---|---|
| JP-029 Imperial Palace East Gardens | **198.63 m** | Already catalogued (3 gates) — §3 |
| JP-185 Furuzamami Beach | **139.31 m** | Known case — §5 |
| JP-064 Hōnen-in | 94.66 m | Design §18: insufficient evidence, no record |
| JP-069 Bishamon-dō | 77.96 m | Design §18: insufficient evidence, no record |
| JP-084 Shisen-dō | 63.49 m | Below any structural signal; see §6 |
| everything else measured | ≤ 47.22 m | Ordinary urban snapping noise |

**This is the audit's most useful negative result:** the two worst display coordinates in the
entire dataset are the two places the project had *already* identified, and no third case emerges
from the measurements. 25 of the 78 have no walking relation at all and so were never measured;
those are assessed structurally in §6 instead.

Honest limit of the signal: a small snap distance proves the coordinate is *on* the network, not
that it is the *right* endpoint. It is used here as a positive flag when large, never as a
clean bill of health when small — the structural review in §6 is what clears the rest.

---

## 3. JP-029 — Imperial Palace East Gardens → **context added**

**Outcome: context added to three existing records. No new record, no coordinate change, no
default.**

### Official evidence

- **Imperial Household Agency**, East Gardens visitor page (English):
  <https://www.kunaicho.go.jp/e-event/higashigyoen02.html> — "Entrance and exit gates: Ote-mon
  Gate, Hirakawa-mon Gate and Kitahanebashi-mon Gate." Consulted 2026-09-06. These are the
  garden's *only* official ways in or out.
- **Imperial Household Agency**, East Gardens page (Japanese), access section:
  <https://www.kunaicho.go.jp/visit/higashigyoen/index.html> — consulted 2026-09-06, publishes a
  station-to-gate approach for each gate:

  | Gate | Published approach |
  |---|---|
  | 大手門 Ōte-mon | Otemachi Stn exit C13a ≈ 5 min walk; Nijubashimae Stn (Chiyoda Line) exit 6 ≈ 10 min; JR Tokyo Stn Marunouchi north exit ≈ 15 min |
  | 平川門 Hirakawa-mon | Takebashi Stn (Tozai Line) exit 1a ≈ 5 min |
  | 北桔橋門 Kitahanebashi-mon | Takebashi Stn (Tozai Line) exit 1a ≈ 5 min |

  A verification note: the **English** pages do not carry this access block — the English
  station-and-walking-time block on `sankan.kunaicho.go.jp` belongs to the *Kikyo-mon* guided-tour
  gathering point, which is a different thing. The Phase 3B2G evidence text was checked against
  this and is correct: the Japanese page does publish it, per gate.

### Why the context applies

Each gate is documented **by the operator itself** as the point at which a named subway approach
arrives. Under §1's resolution that is precisely the (B) test: the gate is a valid endpoint for a
trip whose local-transit leg ends in a short walk. No claim is made that a gate is a stop.

### Why it is materially worth doing

- The display coordinate is the **worst in the dataset** (198.63 m off-network; Phase 3B2H
  established it sits inside the palace grounds).
- JP-029 has a real non-walking relation — `JP-015 Kagurazaka ↔ JP-029`, `Transporte local`,
  17 min — so a transit query for this place is an actual in-dataset case, not a hypothetical.
- Before: `resolveTransitEndpoint("JP-029", …)` → `use-place-coordinate`, i.e. a transit query
  would be answered from a point inside the grounds. After: `ambiguous`, listing all three gates.

### Why no default

Phase 3B2H measured it: the best gate **flips with the counterpart** (Hirakawa-mon from Jimbocho,
Ōte-mon from Tokyo Station), with a spread up to 859.1 m. The agency designates no preferred gate.
A static default would therefore be wrong at least as often as right, so `selection` stays `{}` and
the resolver returns `ambiguous` — the design's intended outcome, not a failure.

---

## 4. JP-181 — ASMUI Spiritual Hikes → **unchanged**

**Outcome: unchanged. `external-local-transit` deliberately still not claimed.**

Re-evaluated under (B) rather than (A), because `ACCESS_POINT_DESIGN.md` §13/§18 use this very
place as the worked example of a reception carrying both contexts — so the design's own
expectation pointed at adding it.

It still fails, on evidence rather than on semantics:

- The operator (<https://www.asmui.jp/>) documents arrival by car and a visitor car park. No
  official source documents a bus stop, ferry, or any local-transit service reaching the facility.
- `places.json` records its transport as `"Auto; cerca de Cape Hedo"` — car.
- JP-181 has **zero** non-walking relations in `nearby.json`, so the context would be exercised by
  nothing.

Under (B) the context asserts the point is a valid endpoint for a trip arriving *by local
transit*. Where no local transit reaches the place, that assertion is unsupported. Absence is the
correct record. The design's conceptual example was written before this place's actual access was
researched; the evidence outranks the illustration.

---

## 5. JP-185 — Furuzamami Beach → **no record (coordinate insufficient, unchanged)**

Re-checked for *new or better* official evidence, per the audit's remit.

- **Zamami Village (municipal government)**, village bus page:
  <https://www.vill.zamami.okinawa.jp/kurashi/shisetsu_kotsu/kokyokotsu/bus/> — consulted
  2026-09-06. Names 古座間味ビーチ as a village-bus stop (alongside 阿佐公民館前 and 青のゆくる館),
  confirming the stop officially exists.
- The same page publishes **no coordinate, no map embed and no map link** for that stop. The
  village's guide-map entry for the beach is no longer reachable (404), and the village transport
  index likewise carries no location data.

So the position is exactly as Phase 3B2G left it: **the stop is real, its coordinate is not
officially published anywhere reachable.** Per `ACCESS_POINT_DESIGN.md` §11 and the audit's own
rules, a point that would have to be placed by eye is not created. `place-coordinate` remains the
answer, and `transitWarningsForResolution` reports `no-catalogued-endpoint` honestly for it.

This is a **category 5** outcome — the concept is sound, the coordinate is not available — and it
is recorded so a later phase does not have to rediscover it.

---

## 6. The other 75 candidates

### 6.1 Disney Resort Line (JP-203 Tokyo Disneyland, JP-204 Tokyo DisneySea) → **no record**

Investigated specifically, because the two `Disney Resort Line` relations are the dataset's only
non-`Transporte local`, non-walking mode.

Official evidence found (Oriental Land Co. / Tokyo Disney Resort,
<https://www.tokyodisneyresort.jp/en/tdr/resortline/station.html>, consulted 2026-09-06): the line
has four stations, and **Tokyo Disneyland Station** is "located just outside the Main Entrance to
Tokyo Disneyland" while **Tokyo DisneySea Station** is "located in front of the Main Entrance to
Tokyo DisneySea." So a distinct, officially-named endpoint concept genuinely exists, and the
display coordinates are park centroids ~810 m apart — the material distinction is real.

Two independent reasons stop it here anyway:

1. **No defensible coordinate.** The resort publishes addresses and prose, not coordinates, and
   its park/resort maps are illustrated — explicitly disqualified as a coordinate source. Deriving
   a station point from them would be placing it by eye.
2. **The vocabulary does not fit, and must not be stretched.** `TransferMode` deliberately
   separates `disney-resort-line` from `local-transit`, and `AccessContext` has no corresponding
   member. Tagging a Disney station `external-local-transit` would assert eligibility for a
   context the dataset's own mode vocabulary says this is not. Adding a new context value to fix
   that would be code-and-schema expansion by anticipation, for a consumer that does not exist.

**Category 5.** If a later phase wants these, it needs an official coordinate *and* a deliberate
decision about the context vocabulary — recorded here so both are visible.

### 6.2 Ferry-served islands (JP-184 Zamami, JP-186 Aka, JP-197 Iriomote) → **no record**

The most credible remaining structural case: for an island, the **port** is genuinely a different
logistics endpoint from the island's display centroid, and these places do carry real
`Transporte local` relations (`JP-184↔JP-186`, `JP-185↔JP-186`, `JP-197↔JP-198`).

Checked: <https://www.vill.zamami.okinawa.jp/kurashi/shisetsu_kotsu/kokyokotsu/> (Zamami Village,
consulted 2026-09-06) names the village sea route and bus but publishes **no coordinate, map
embed or map link** for 座間味港 or 阿嘉港.

Same disposition as §5 — real concept, no publishable coordinate, **category 5**, no record.

### 6.3 Car-access Okinawa places → **place-coordinate adequate**

JP-166, JP-167, JP-175, JP-176, JP-177, JP-179, JP-180, JP-192, JP-193, JP-194, JP-195, JP-198.
`places.json` records their access as `Auto`, `Auto/taxi`, `Auto + sendero` or `Tour desde …`. The
JP-181 reasoning in §4 applies unchanged: where the documented arrival is by car or an operator's
own tour, an `external-local-transit` endpoint claim is unsupported. **Category 1/6.**

### 6.4 Places already ruled insufficient by an earlier phase → **no record**

- **JP-064 Hōnen-in** (94.66 m) and **JP-069 Bishamon-dō** (77.96 m): `ACCESS_POINT_DESIGN.md` §18
  records these as the canonical "insufficient evidence → no access-point records" cases. Nothing
  in this audit changes that; large snap alone is not provenance.
- **JP-089 Nijō Castle** (2 × `no-route`), **JP-092**, **JP-102**: the design's JP-090 ruling
  applies verbatim — "`no-route` itself is not provenance." A routing failure is a reason to look,
  not evidence of where an endpoint is. **Category 6.**

### 6.5 The remaining urban candidates → **place-coordinate adequate**

The other 45 of the 78 carry **no empirical red flag at all**: measured snap ≤ 47.22 m, every
snapping assessment `clean`, no `no-route`, and no structural signal in `places.json` (each is a
single-entrance museum, market, temple, shopping street or viewpoint whose display coordinate is
its entrance for practical purposes). Per the audit's governing rule — *a nearby station is not a
reason to create a record* — these get **no access point**. `use-place-coordinate` is the correct,
deliberate answer for them, and the resolver already says so explicitly rather than silently.

For the record, the full candidate list of 78:

```
Tokio (21):  JP-015 JP-019 JP-022 JP-023 JP-027 JP-028 JP-029 JP-030 JP-031 JP-032 JP-033
             JP-037 JP-038 JP-039 JP-040 JP-041 JP-042 JP-043 JP-053 JP-203 JP-204
Kioto (27):  JP-060 JP-062 JP-063 JP-064 JP-066 JP-067 JP-068 JP-069 JP-070 JP-077 JP-078
             JP-079 JP-081 JP-082 JP-083 JP-084 JP-089 JP-091 JP-092 JP-093 JP-094 JP-095
             JP-096 JP-097 JP-098 JP-100 JP-102
Osaka (10):  JP-106 JP-112 JP-114 JP-116 JP-117 JP-118 JP-129 JP-133 JP-143 JP-144
Okinawa (20):JP-154 JP-166 JP-167 JP-173 JP-174 JP-175 JP-176 JP-177 JP-179 JP-180 JP-184
             JP-185 JP-186 JP-192 JP-193 JP-194 JP-195 JP-197 JP-198 JP-202
```

Scope note, stated plainly: §§6.3–6.5 are decided on the measured snapping evidence, the
`places.json` access text, and the design's existing rulings — not on a fresh official-source
search for each of the 75. That is the deliberate reading of the audit's own rule that a record
exists only where there is a *material* reason to separate display coordinate from logistics
endpoint. Where a future phase finds such a reason for a specific place, this file's absence of a
record is a starting point, not a closed door.

---

## 7. Data changes

| | Before | After |
|---|---|---|
| Access-point records | 4 | **4** (none created, none removed) |
| Records modified | — | **3** (`AP-JP-029-001/002/003`) |
| `external-walk` members | 4 | 4 |
| `external-local-transit` members | **0** | **3** |
| Defaults (`defaultForContexts`) | 0 | **0** |
| Coordinates changed | — | **0** |
| Roles changed | — | **0** |
| `data/` ↔ `app/src/data/` parity | byte-identical | **byte-identical** |

Each modified record's `provenance.evidence` gained the Imperial Household Agency station-to-gate
approach and the reason the second context follows from it; `notes` records that the audit added
the context, on what date, and that no default is claimed for it either. `consultedAt` is
deliberately **not** bumped: the coordinate provenance is the Chiyoda City spot page, which this
audit did not re-verify, so moving its date would overstate what was checked. The re-consultation
date for the added fact is stated inline in the evidence text instead.

### Behavioural effect

`resolveTransitEndpoint("JP-029", getAccessPointsForContext("JP-029", "external-local-transit"))`
changes from `use-place-coordinate` to
`ambiguous { AP-JP-029-001, AP-JP-029-002, AP-JP-029-003 }`. Every other place still resolves to
`use-place-coordinate` with the honest `no-catalogued-endpoint` warning. Nothing consumes this at
runtime yet: there is no transit UI and activation is OFF.

### Test coverage added

The behaviour that changed had no regression test, so three were added (172 tests total, from
169):

- the catalog offers all three gates for `external-local-transit` and marks none default;
- JP-181 stays out of that context (with the car-access reason in a comment);
- the real-catalog resolution for JP-029 is `ambiguous` and emits no `no-catalogued-endpoint`,
  while JP-185 still resolves to `use-place-coordinate` **and** does emit it.

The JP-029 test was mutation-checked: reverting the context in the app-facing copy makes it fail.
No existing test was weakened or removed. `validate-access-points.py` needed no change — it
already enforces context vocabulary, roles, provenance, id namespacing, duplicate defaults,
deprecated-default behaviour and source/app parity, and its parity check was verified to fire on
induced drift.

### A real gap the change exposed

`scripts/test_walking_access_points.py::test_build_manifest_is_deterministic` failed on the first
legitimate catalog edit — a genuine catch, and worth recording rather than quietly fixing.

Phase 3B2H's revalidation manifest records `sourceContext.accessPointsDigest`: the sha256 of
`access-points.json` **as it was when that batch was built**. The test asserted that rebuilding the
manifest today reproduces the committed document exactly, which silently made the assertion *"the
access-point catalog never changes"* — something the roadmap explicitly planned to do (design
Stage 2: "add records only for cases with sufficiently strong official evidence") and that this
audit has now done. Exactly one leaf differed; the builder itself is deterministic.

The manifest was **not** regenerated. Doing so would have back-dated a historical artifact,
asserting the 2026-09-05 openrouteservice batch had been built against today's catalog —
`ACCESS_POINT_DESIGN.md` §15 forbids exactly that, and the digest's whole purpose is to say what
the batch actually ran against. Nothing enforces this digest against the live file at runtime
(`validate-walking-access-point-results.py` never reads it), so no validator was misreporting; only
the test's expectation was wrong.

The test was made to assert what it actually means, and ends up stronger than before: the builder
is deterministic across calls, it hashes the file it claims to hash (a check the original did not
make), and every substantive part of the manifest — candidates, target set, historical lineage,
selection method, the dataset and historical-results digests — still rebuilds byte-for-byte. Only
the one build-time input digest is allowed to differ from the live catalog's hash. Mutation-checked
both ways: tampering with a candidate fails it, and pointing the builder at the wrong file fails it.

---

## 8. What this audit did not do

- No provider account, plan, API key, secret, or request — Ekispert, NAVITIME **and**
  openrouteservice. Activation gate untouched and still **OFF**.
- No geocoding or routing API of any kind; no Google Maps, Mapbox, OSM/Nominatim, or ORS. Sources
  are official web pages read directly.
- No coordinate invented, derived by eye, or copied from `Place.coordinates` to fill a record.
- No new access point, no default, no role change, no deprecation.
- No change to `places.json`, `nearby.json`, the workbook, the walking pilot/scale artifacts, the
  walking access-point results, any threshold, or `getBestTransfer()`.
- No React hook, no `/api/transit/route` client, no UI, no deployment choice, no caching.
- No Phase 3C work: no ordering, no shortest path, no optimisation, no itinerary generation, no
  day assignment, no unordered summing, no reverse-edge inference, no edge chaining.
