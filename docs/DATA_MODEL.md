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

- `clusters`: map grouping, center coordinates, place IDs, and UI description.
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
