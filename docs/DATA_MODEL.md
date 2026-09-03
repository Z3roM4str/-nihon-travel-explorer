# Nihon Application Data Model

## Source-to-application rule

The workbook is the editorial source. The web app consumes generated JSON and must not silently rewrite research decisions. Editorial corrections (renamed regions, fixed relations, reclassifications) are made in the workbook, with CHANGELOG_V2 traceability, and then re-exported — never patched directly into the JSON.

```text
data/source/Nihon-Base-Maestra-v2.xlsx   (editorial source of truth, versioned in git)
        ↓ scripts/export-dataset.py       (canonical exporter — see "Regenerating the dataset")
data/*.json                               (checked-in export output)
        ↓ copied as-is
app/src/data/*.json                       (application build input)
        ↓
map, filters, place drawer, nearby panel, time estimator
```

## Regenerating the dataset

The exporter (`scripts/export-dataset.py`) is a standalone Python script with one
dependency (`openpyxl`), reading the workbook directly — no LibreOffice, no cached
formula values, no non-installable packages. `Precio MXN mín/máx` are computed
deterministically as `Precio JPY × Configuración!B4`, so the workbook does not need to
have been recalculated in Excel/LibreOffice first.

```bash
# 1. Install dependencies (once, or whenever scripts/requirements.txt changes)
python3 -m pip install -r scripts/requirements.txt

# 2. Regenerate data/*.json from the workbook
python3 scripts/export-dataset.py data/source/Nihon-Base-Maestra-v2.xlsx data

# 3. Validate the result
python3 scripts/validate-dataset.py data

# 4. Copy into the application build input
cp data/places.json data/nearby.json data/clusters.json data/seasonal-alerts.json app/src/data/
```

`scripts/validate-dataset.py` checks: exactly 214 places with unique ids, valid
coordinates inside Japan's bounding box, exactly 403 nearby relations with no id
referencing a place that doesn't exist, and that the three Phase 2 editorial corrections
(Okinawa region split, Naoshima region, the Tokyo Disneyland/DisneySea nearby relation)
are present.

## Place object

```ts
type Place = {
  id: string;
  hub: string;
  region: string;
  prefecture: string;
  municipality: string;
  neighborhood: string;
  cluster: string;
  name: string;
  japaneseName?: string;
  mapTitle: string;
  category: string;
  type: string;
  grade: "S" | "A" | "B" | "C" | string;
  description: string;
  differentiator: string;
  experience: string;
  duration: { raw: string; minMinutes?: number; maxMinutes?: number; planningBlock?: string; variability?: string };
  bestTime: string;
  bestSeason: string;
  crowdLevel: string;
  tourismLevel: string;
  price: { currency: "JPY" | string; min: number; max: number; mxnMin?: number; mxnMax?: number };
  reservation: { required: boolean; leadTime: string; raw: string };
  schedule: { hours: string; closures: string };
  transport: string;
  accessibility: string;
  coordinates: { lat: number; lng: number };
  officialUrl: string;
  googleMapsUrl: string;
  imageBrief: string;
  imageStatus: "brief-only" | "assets-ready" | "verified" | string;
  nearbyIds: string[];
  hiddenGemStatus?: string;
  alternativeTo?: string;
  updatedAt: string;
  febMar2027: { status: string; warning: string; action: string };
};
```

## Supporting collections

- `clusters`: map grouping, center coordinates, place IDs, and UI description. **Secondary
  metadata, not authoritative** — see "Cluster membership" below.
- `nearby`: directed relations with distance, walking estimate, mode, relation type, and note.
- `seasonalAlerts`: February–March 2027 operational and seasonal records.
- `sources`: official sources and consultation dates.

## Normalization rules

- Preserve original Spanish editorial text in `raw` fields where parsing is uncertain.
- Parse numeric coordinate, price, distance, and walking-minute columns as numbers.
- Normalize `Sí`/`No` reservation values to booleans while keeping the original value.
- Convert duration text only when a safe range is clear; otherwise keep `raw` and leave numeric values empty.
- Do not infer an image URL from an image brief.
- Keep official URLs and consultation dates attached to the relevant records.

## Cluster membership

A place's cluster is authoritative from the place itself: **`hub` + `cluster`**. Both parts
are needed — cluster names happen to be globally unique in the current dataset, but that is a
property of today's data, not a guarantee.

`clusters.json` is exported alongside the places and kept for auditing and possible later
use, but the application never reads its `IDs`, `N.º fichas` or `S/A` columns: those are
persisted aggregates that have drifted from the places. Deriving membership and every count
from the places instead means a cluster with no place simply does not exist in the interface,
and refreshing the workbook is enough to change what is shown.

`scripts/validate-dataset.py` reports each divergence as a `WARNING` and still exits 0. An
empty `cluster` or `hub` on a place is an `ERROR`, because that is authoritative data.

## Planning blocks (derived)

Planning blocks are **derived at runtime** from `duration`, never stored. Nothing writes them
to `places.json`, and the exporter does not produce them; `duration.planningBlock` and
`duration.variability` remain unused optional fields in the type.

The dataset's durations fall into two families that must not be mixed:

- **Quantified** — a numeric range. Classified by its **upper bound**: `brief` (≤ 60 min),
  `short` (≤ 120), `medium` (≤ 240), `long` (> 240). The upper bound is the planning-safe
  reading, and the label is always shown next to the original range because most editorial
  ranges cross a boundary.
- **Day-scale** — an editorial commitment expressed in days or nights: `half-day`,
  `half-to-full-day`, `full-day`, `overnight-plus`. These are **never converted to minutes**.
  They are counted and listed separately from any hour total.

`unknown` covers anything neither family recognises. `scripts/validate-dataset.py` fails if
any place lands there, so the taxonomy cannot silently fall behind the workbook.

**Classification and filter matching are different operations.** Classification gives one
label per place. Filtering uses **range overlap**: a place matches a quantified block when its
range intersects that block's window, so "1–2 h" is offered both under "hasta 1 h" and under
"1–2 h". Day-scale blocks carry no minutes and match by identity only; the two families never
match across.

## Selection Intelligence (derived)

`app/src/lib/selection.ts` aggregates a set of places — the saved selection today, any set
later. Everything it returns is derived on read:

- `visitTime` sums only quantified durations, adding minima to minima and maxima to maxima.
  No average, median or midpoint is ever taken.
- `commitments` counts the day-scale places per block and is never folded into `visitTime`.
- `withoutEstimate` holds the unclassifiable ones; `nonQuantified` is both groups together.
- Groups by hub, prefecture and hub + cluster hold references to the same `Place` objects,
  never copies.

The only persisted user state remains the saved place ids, under `nihon.savedPlaceIds` in
`localStorage`. Planning blocks, groupings, totals and concentration readings are all
recomputed from those ids and the dataset, so there is no aggregate to migrate or to fall out
of sync.
