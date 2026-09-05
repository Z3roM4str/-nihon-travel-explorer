# Phase 3B2G — Evidenced Access-Point Population

**Data-only.** This phase populates `data/logistics/access-points.json` for the first
time, with real coordinates, and its parity copy at
`app/src/data/logistics/access-points.json`. It makes **zero** routing requests
(no openrouteservice, no Snap, no Directions, no automated geocoding against any
external provider), does not connect access points to `getBestTransfer()` or to any
other routing path, and changes no `Place` coordinate, dataset row, historical
walking result, threshold, or UI.

This document is the research record behind every record that exists — and behind
every record that deliberately does not.

## 1. Method

### Source priority actually applied

1. the venue's own managing authority/operator;
2. government (national, prefectural, municipal);
3. official tourism bodies;
4. official maps/plans/PDFs;
5. other official material directly controlled by the venue.

Google Maps as a destination, blogs, forums, Tripadvisor, aggregators, Mapbox/OSM,
and search-result snippets were used only to decide where to look. None of them is
the provenance of any record below. Where a coordinate reaches this repository
through a map-embed URL, the *publisher* of that URL is the official body named in
`provenance.sourceEntity`, and the URL recorded in `provenance.sourceUrl` is that
body's own page — never a maps URL, and never a maps URL's API key.

### Coordinate standard actually applied

- **Level A** — the official source publishes the point explicitly: a literal
  lat/lng, an official interactive map with an identifiable coordinate, or an
  official map link whose target unambiguously *is* the access point.
- **Level B** — an official plan/map georeferenced well enough to derive the point
  with high confidence, recorded as `official-derived`.
- If a derivation introduces material ambiguity, **no record is created.** Several
  candidates below were dropped under exactly this rule.

No coordinate was invented, copied from the place's display coordinate, taken from a
POI centroid, or nudged by eye on a map.

### Sources evaluated and rejected as coordinate sources

- **Imperial Household Agency illustrated maps**
  (`/wp-content/uploads/2026/03/illustrationmap-j.pdf`, `illustrationmap-e.pdf`, and
  the matching raster images) are pictorial, not georeferenced. Deriving gate
  coordinates from them would be a by-eye placement — rejected under the Level B
  ambiguity rule.
- **Geospatial Information Authority of Japan (GSI) vector tiles**
  (`cyberjapandata.gsi.go.jp/xyz/experimental_bvmap`, max zoom 16) were decoded and
  inspected. Their `label` layer points are *text-placement anchors*, not feature
  locations: several labels in the palace area stack at identical longitudes with
  fixed latitude steps, and station labels sit ~100 m from the stations they name.
  They are therefore **not** used as any record's coordinate. They are used below
  only as an independent consistency check, and that role is stated wherever it is
  relied on. GSI also carries no annotation at all for Hirakawa-mon or
  Kitahanebashi-mon, so it could not have covered JP-029 on its own.
- **MLIT National Land Numerical Information bus-stop dataset** (P11-22, Okinawa,
  file `P11-22_47_GML.zip`) was downloaded and searched: it contains no Zamami
  village entries at all, so it yields nothing for JP-185.

## 2. JP-029 — Imperial Palace East Gardens (皇居東御苑)

**Conclusion: three access points created, no default.**

### Access points created

| ID | Label | Role | Contexts | Coordinate | Confidence |
|---|---|---|---|---|---|
| `AP-JP-029-001` | Ōte-mon Gate | `visitor-entrance` | `external-walk` | 35.68596, 139.760215 | `official-explicit` |
| `AP-JP-029-002` | Hirakawa-mon Gate | `visitor-entrance` | `external-walk` | 35.689623, 139.757877 | `official-explicit` |
| `AP-JP-029-003` | Kitahanebashi-mon Gate | `visitor-entrance` | `external-walk` | 35.688868, 139.754043 | `official-derived` |

### Official sources consulted

| URL | Entity | What it establishes |
|---|---|---|
| https://www.kunaicho.go.jp/en/visit/event/higashigyoen/index.html | Imperial Household Agency | Under "Entrance and exit gates" the page names exactly three: Ote-mon Gate, Hirakawa-mon Gate and Kitahanebashi-mon Gate |
| https://www.kunaicho.go.jp/visit/higashigyoen/index.html | Imperial Household Agency | Japanese page; gives walking time to each of the three gates from its nearest station exits (Otemachi C13a / Nijubashimae 6 / JR Tokyo Marunouchi north for Ote-mon; Takebashi 1a for Hirakawa-mon and Kitahanebashi-mon) |
| https://visit-chiyoda.tokyo/app/spot/detail/19 | Chiyoda City Tourism Association | Dedicated Ote-mon spot page (former main gate of Edo Castle); its MAP block targets 35.68596, 139.760215 |
| https://visit-chiyoda.tokyo/app/spot/detail/653 | Chiyoda City Tourism Association | Dedicated Hirakawa-mon spot page (main gate of the Sannomaru); its MAP block targets 35.689623, 139.757877 |
| https://visit-chiyoda.tokyo/app/spot/detail/244 | Chiyoda City Tourism Association | Kitahanebashi spot page: the bridge of the Edo Castle Kitahanebashi-mon on the north side of the East Gardens, of which only the gate and the bridge remain; its MAP block targets 35.688867794117, 139.75404303336 |
| https://visit-chiyoda.tokyo/app/spot/detail/229 | Chiyoda City Tourism Association | Ote-mon bridge spot page, targeting 35.685861, 139.760672 — used only as a consistency check on the Ote-mon point |
| https://www.kunaicho.go.jp/en/visit/guide/illustrationmap.html | Imperial Household Agency | Official illustrated maps — evaluated and rejected as a coordinate source (pictorial, not georeferenced) |

### How each coordinate was obtained

The Imperial Household Agency establishes **which** three gates are the public
entrance/exit points; it publishes no coordinates. The Chiyoda City Tourism
Association — the official tourism body for the ward the gardens sit in — publishes
a separate spot page per gate, and each page's map block targets a coordinate for
that named gate. Ote-mon and Hirakawa-mon are therefore Level A: an official map
target that unambiguously represents the named gate (`official-explicit`).

Kitahanebashi is Level B and recorded as `official-derived`: the association's spot
is titled for the *bridge* (北桔橋), and the gate coordinate is taken from that
published point on the strength of the same page stating that this is the bridge of
the Kitahanebashi-mon and that only the gate and the bridge now remain — i.e. the
two are contiguous. The published value was rounded from
`35.688867794117, 139.75404303336` to six decimals (≈0.1 m), well inside the
uncertainty the derivation itself carries.

### Consistency checks (not provenance)

- Ote-mon (35.68596, 139.760215) sits ~42 m west of the association's separately
  published Ote-mon bridge point — the expected geometry for a gate behind its moat
  bridge.
- GSI's `大手門` annotation anchor falls ~128 m from the Ote-mon record, and its
  `皇居東御苑管理事務所` (East Gardens management office) anchor falls between the
  gate and the gardens' interior. Consistent; not used as the coordinate.
- Hirakawa-mon lies ~85 m from GSI's Takebashi station anchor, consistent with the
  agency's stated 3–5 minute walk.
- All three points lie 477–676 m from the recorded `Place` coordinate
  (35.6852, 139.7528) in three different directions, which is the shape Phase 3B2D
  predicted for this place: one display coordinate, several real entrances.

### Ambiguities and conservative decisions

- **No default.** `selection.defaultForContexts` is empty on all three. The Imperial
  Household Agency designates no preferred gate, and the right gate for a given trip
  depends on the origin, which static data cannot answer. Under
  `ACCESS_POINT_DESIGN.md` §12 this place is deliberately an ambiguous
  multi-candidate case, and a future resolver must say so rather than pick one.
- **Ordinals carry no priority.** 001/002/003 follow the order in which the Imperial
  Household Agency itself lists the gates on its East Gardens page. That order is
  recorded so the assignment is stable and auditable; it is not a ranking, and each
  record's `notes` says so.
- **`external-walk` only.** The agency gives *walking* times from station exits to
  each gate. That documents a pedestrian approach, not that a gate is a transit
  endpoint, so `external-local-transit` is not claimed for any of the three.
- **Role.** `visitor-entrance` rather than `gate`, because the agency's own English
  wording is "Entrance and exit gates" — it documents these specifically as the
  public visitor entry points, so the stronger role does not overstate the evidence.

## 3. JP-181 — ASMUI Spiritual Hikes (アスムイハイクス)

**Conclusion: one access point created (the external arrival/reception stage). No
trailhead record.**

### Access point created

| ID | Label | Role | Contexts | Coordinate | Confidence |
|---|---|---|---|---|---|
| `AP-JP-181-001` | ASMUI Spiritual Hikes reception | `reception` | `external-walk` | 26.8619707, 128.2550917 | `official-derived` |

### Access points not created

- **Trailhead / hiking start point** — not created. The operator documents that the
  start point exists and that reception to start point takes about 20–30 minutes
  (on foot, or 15–30 minutes by the internal shuttle on the way down), but publishes
  no coordinate for it and no georeferenced plan of the course. Under the Level B
  ambiguity rule this cannot be derived, so `internal-hike` remains unrepresented.
- **Internal shuttle stage** — not created, for the same reason.

### Official sources consulted

| URL | Entity | What it establishes |
|---|---|---|
| https://www.asmui.jp/ | ASMUI Spiritual Hikes (operator) | Publishes the facility's own location coordinate (26.8619707, 128.2550917) for its address at Ginama 1241, Kunigami, Okinawa |
| https://www.asmui.jp/howtoenjoy | ASMUI Spiritual Hikes (operator) | States reception → start point ≈ 20–30 minutes, and a shuttle bus descent of ≈ 15–30 minutes; the restaurant has moved to the "Spirit Lounge" at the course start point; free visitor car park at the facility |

### How the coordinate was obtained

The operator publishes a location coordinate for its own facility. That point is
~1.3 km from the recorded `Place` coordinate and ~1.2 km from the Ginama hamlet
centre, so it is a picked facility location rather than an address-centroid
fallback, and it is where arrival, the car park and reception are. It is recorded as
`official-derived` rather than `official-explicit` for one honest reason: the source
publishes it as *the facility's* coordinate, not as *the reception desk's*, so
identifying it as the external arrival point is an inference — a short one, but an
inference.

### Consistency check (not provenance)

GSI carries an `アスムイハイクス` annotation at 26.861369, 128.254573 — ~100 m from
the operator's published point, and clearly separate from Cape Hedo ~1.1 km north.
The national mapping authority puts the facility where the operator says it is.

### Ambiguities and conservative decisions

- **No `external-local-transit`.** No official source documents a bus stop or other
  transit endpoint at the facility; the dataset's own transport note for this place
  is car access. Claiming the context would be inference, so it is omitted.
- **The trailhead is not promoted to an external endpoint.** Per
  `ACCESS_POINT_DESIGN.md` §13 an `internal-hike` point must never be reachable by an
  external walking resolver. Here the question does not arise, because no trailhead
  record exists at all.
- **No default.** With a single active candidate a default would add nothing; the
  design's "exactly one eligible active access point" rule already covers it.

## 4. JP-185 — Furuzamami Beach (古座間味ビーチ)

**Conclusion: no record created.**

Phase 3B2D's finding is confirmed and strengthened: an official, named village bus
stop "古座間味 / Furuzamami" exists and is distinct from the beach as a place. What
could not be obtained is a defensible **coordinate** for it, or for any other
physical access to the beach.

### Official sources consulted

| URL | Entity | What it establishes |
|---|---|---|
| https://www.vill.zamami.okinawa.jp/kurashi/shisetsu_kotsu/kokyokotsu/bus/ | Zamami Village Office | Official village bus page; contact is the village's Shipping & Tourism Division |
| https://www.vill.zamami.okinawa.jp/userfiles/files/kmpz4urgxwwe.pdf | Zamami Village Office | September timetable: 古座間味 / "To Furuzamami" is a scheduled stop on the village bus network; 5–10 min from Zamami Port. No coordinate, no map |
| https://www.vill.zamami.okinawa.jp/userfiles/files/r1ubk38b4ry1.pdf | Zamami Village Office | Alternate-service timetable; same stop, same absence of any coordinate |
| https://www.zamamitourism.com/en/transport | Zamami Village Tourism Association | Names Furuzamami Beach as a bus destination/area; publishes no coordinate |
| https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-P11-v3_0.html | Ministry of Land, Infrastructure, Transport and Tourism | National bus-stop dataset; the Okinawa file (P11-22_47) contains no Zamami village stops, so the stop is absent from national government data |

### Why nothing was created

- The **bus stop** is officially named but has no officially published position. A
  `transit-stop` record would need a coordinate the evidence does not supply.
- The only coordinate reachable for anything called 古座間味ビーチ is GSI's
  place-name annotation for the beach itself (26.224479, 127.309392, annotation
  category "coast"). That is precisely the *visual centre of the beach* this phase
  is forbidden to use, and it is a text anchor besides.
- The **road access** and the **pedestrian entrance** to the beach are not documented
  as distinct points by any official source found.

Under the phase rule "if you cannot obtain a sufficiently defensible coordinate, do
not create a record", **no record was created for JP-185.**

### Observation, not acted upon

The recorded `Place` coordinate for JP-185 (26.22, 127.3004) sits close to GSI's
`座間味港` (Zamami Port) annotation and ~900 m west of GSI's `古座間味ビーチ`
annotation. This phase changes no `Place` coordinate and asserts no conclusion from
a label anchor; it is noted only so a future audit knows the question exists.

## 5. Cases deliberately left without an access point

### JP-064 — Hōnen-in

No record. Phase 3B2D found the official site unreachable (HTTP 503 on two attempts)
and declared the evidence insufficient. Re-checked for this phase on 2026-09-05:
`https://www.honen-in.jp/` now fails TLS verification in this environment
(certificate subject does not match the host), so it still cannot be read. Nothing
has changed the audit's determination, and the phase brief excludes this place from
population. Absence is the correct representation, not a placeholder.

### JP-069 — Bishamon-dō

No record. Phase 3B2D confirmed the official visiting page describes a ~20-minute
walk from Yamashina Station but does **not** describe multiple gates or a distinct
entrance, and rated the hypothesis "low confidence". Re-checked on 2026-09-05: the
page is reachable, and the only coordinate anywhere in it belongs to a map-embed
*viewport centre* (~34.9906, 135.7875), roughly 2 km from the temple — a map view
parameter, not an identified access point. No access point is created, and the phase
brief excludes this place from population.

### JP-090 — Kyoto Imperial Palace

No record, deliberately. The five `no-route` results centred on JP-090 are provider
behaviour, and provider behaviour is not physical provenance. Phase 3B2D itself
classified the cluster as a probable graph-connectivity anomaly at a well-snapped
node (3.65 m displacement) and explicitly declined to treat `no-route` as evidence
for a replacement endpoint. Creating an access point here to "fix" routing would
invert the discipline this whole model exists to protect. If a concrete public
visitor entrance for the Kyoto palace is ever evidenced with a coordinate, that is a
separate, source-backed decision.

## 6. Summary

| Place | Records created | Records not created |
|---|---|---|
| JP-029 Imperial Palace East Gardens | 3 (Ote-mon, Hirakawa-mon, Kitahanebashi-mon) | — |
| JP-181 ASMUI Spiritual Hikes | 1 (reception) | trailhead, internal shuttle stage |
| JP-185 Furuzamami Beach | 0 | bus stop, road access, pedestrian entrance |
| JP-064 Hōnen-in | 0 | all — source still unreadable |
| JP-069 Bishamon-dō | 0 | all — no gate/entrance distinction evidenced |
| JP-090 Kyoto Imperial Palace | 0 | all — `no-route` is not provenance |

**4 access points, 2 place IDs, 0 defaults.** Routing does not consume any of them.
