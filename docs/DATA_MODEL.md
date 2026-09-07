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
coordinates inside Japan's bounding box, and every nearby relation (reported dynamically —
403 today, not asserted as fixed — with no id referencing a place that doesn't exist; see
"Transfer / logistics domain" below for the rest of its nearby-specific checks), and that the
three Phase 2 editorial corrections
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

The saved place ids, under `nihon.savedPlaceIds` in `localStorage`, remain the "Quiero ir"
selection's only persisted state. Planning blocks, groupings, totals and concentration readings
are all recomputed from those ids and the dataset, so there is no aggregate to migrate or to
fall out of sync. Since Phase 3C-D, a second and entirely separate key persists the manual
planning draft (route order and day assignment) — see "Manual planning draft persistence" below;
the two keys are never read from or written to each other.

## Transfer / logistics domain (derived, Phase 3B1)

`app/src/lib/transfer.ts` reinterprets the same `nearby` relations as a typed domain model —
it is not a second data source. `nearby.json`'s 403 directed rows remain the only place these
relations are stored; `transfer.ts` converts them on read into:

```ts
type TransferConfidence = "estimated" | "validated-static" | "schedule-aware";

type TransferProvenance = {
  kind: "derived-geographic";
  dataset: "nearby";
  method: "haversine-speed-model";
};

type TransferEdge = {
  fromId: string;
  toId: string;
  minutes: { minMinutes: number; maxMinutes: number };
  distanceKm: number;
  mode: "walk" | "local-transit" | "disney-resort-line";
  rawMode: string;
  relation: "same-cluster" | "nearby" | "alternative";
  rawRelation: string;
  confidence: TransferConfidence;
  source: TransferProvenance;
  verifiedAt: string | null;
};
```

Every relation currently in `nearby.json` is a geographic estimate (haversine distance + a
fixed speed model — see each row's `Nota`), never a routed or schedule-aware transfer, so every
edge converted today gets `confidence: "estimated"` and `verifiedAt: null`. The taxonomy's other
two members exist so a later phase can populate a genuinely validated edge without widening
this type or touching a consumer that already reads `confidence`. Full rationale, the
confidence taxonomy, and the 3B2 boundary are documented in `docs/LOGISTICS.md`.

`lookupTransfer(fromId, toId): TransferEdge | null` is a directed dictionary lookup: it never
assumes `A → B` implies `B → A`, never computes a fallback from coordinates when no edge is
recorded, and never chains edges to find a path. There is deliberately no function that sums
transfer minutes across a `Place[]` — a selection has no order, so no such sum could be
meaningful; a future aggregation must take an explicit sequence, not a bare selection (see
`docs/LOGISTICS.md`, "No aggregation without order").

`computeLogisticsMetrics(places)` reports only factual coverage over a set of places
(`possiblePairCount`, `knownPairCount`, `pairCoverage`, `recordedDistanceRange`) — no
compact/extended classification is derived from them yet (see `docs/LOGISTICS.md`).

`scripts/validate-dataset.py` validates `nearby.json`'s shape (resolvable ids, no self edge,
positive distance/minutes, `Modo`/`Relación` within the known vocabulary, "Mismo cluster"
implying matching hub + cluster) and reports — as warnings, not errors — any divergence between
a relation and its recorded reverse direction. It does not assert a fixed relation count.

## Manual planning draft persistence (Phase 3C-D)

A second, entirely separate `localStorage` key, `nihon.manualPlanningDraft`, persists the
**canonical manual plan** the user built with Phase 3C-A's route builder and Phase 3C-C's day
assignment. It is distinct from `nihon.savedPlaceIds` in every direction: different key, written
by different code (`app/src/lib/planning-draft.ts` / `app/src/usePlanningDraft.ts`, never
`useSavedPlaces.ts`), and neither is read to reconcile or migrate the other beyond the one
explicit rule below.

```ts
type ManualPlanningDraftV1 = {
  version: 1;
  routeIds: string[];   // ordered subset of currently saved ids; may be empty
  days: string[][] | null; // null = no canonical day split yet; else an exact partition of routeIds
};
```

Only ids and user-authored structure are stored. Never persisted: `Place` objects, names,
durations, transfer edges or results, visit-time summaries, transfer totals, confidence tallies,
or any other value the app can recompute from the current dataset and domain logic — all of
that is still derived on every read, exactly as everywhere else in this document.

Phase 3C-B's comparison candidates ("Orden A"/"Orden B") are deliberately **not** part of this
schema. They stay component-local, rebuilt fresh from the route each time the comparison view
opens and discarded on close.

Reading this key back always reconciles it against the current `savedIds` first: a stored route
id no longer saved is pruned from `routeIds` and from any `days` bucket that referenced it, and a
newly saved id is never auto-added to either. A stored `days` is retained only if it still
exactly partitions the (possibly-pruned) `routeIds` — checked via the same `validateDayPartition`
`day-assignment.ts` uses internally, so persistence and the day-assignment domain layer can never
disagree about what counts as a valid split; otherwise `days` becomes `null` rather than being
patched. Malformed JSON, an unrecognised shape, an unsupported `version`, non-string ids, or a
`localStorage` exception on read or write all fall back to treating the draft as absent — no
migration is invented for a version this schema doesn't recognise, and nothing here ever throws
into the UI.

## Manual calendar anchoring (Phase 3C-E)

Since Phase 3C-E, `nihon.manualPlanningDraft` (the same key described above — never a second
key) carries one more field, and the schema version above it moved from `1` to `2`:

```ts
type ManualPlanningDraftV2 = {
  version: 2;
  routeIds: string[];
  days: string[][] | null;
  startDate: string | null; // YYYY-MM-DD, or null: no manual calendar anchor chosen yet
};
```

`startDate` is the user's manual anchor for "Día 1" — a plain civil-date string
(`app/src/lib/civil-date.ts`), never a serialized `Date`, a derived weekday, or a month name.
"Día N" is `startDate` offset by `N − 1` calendar days, computed on every read; no per-day date
is ever stored. A draft written under the old `version: 1` shape (no `startDate` field) is
migrated deterministically on load — `routeIds`/`days` pass through unchanged, `startDate` is
always `null`, never invented.

`startDate` is validated as a real calendar date (rejecting, for instance, `2027-02-30` or a
non-leap-year `2027-02-29`) and is independent of `routeIds`/`days`: a route or day-assignment
change never touches it, and it is never itself used to derive, validate, or invalidate the
route or the day assignment. `place.bestTime`, `schedule.hours`, and `schedule.closures` are not
read anywhere in this feature — anchoring a date is a fact the user asserts about their own
calendar, not a computation over the dataset.

## Temporal data audit (derived, Phase 3D-A)

`place.schedule.hours`, `place.schedule.closures`, `place.bestTime`,
`place.reservation.required`/`leadTime`/`raw`, and `place.febMar2027.status`/`warning`/`action`
remain exactly what they always were on `Place` — free editorial strings (plus one boolean),
untouched by this phase. Phase 3D-A adds a read-only, offline classification **over** those
fields, analogous to how `app/src/lib/transfer.ts` classifies `nearby.json` without duplicating
it: `scripts/temporal_data_lib.py` maps each field's current value to a pattern-family category
and one of four confidence tiers (SAFE / PARTIAL / OPAQUE / UNKNOWN), and
`scripts/audit-temporal-data.py` reports exact counts over the live dataset — nothing here is
hardcoded, and a legitimate future workbook change simply reclassifies on the next run.

This audit itself is Python-only, offline, and — as of Phase 3D-A — had no `app/src/` consumer.
Phase 3D-B (below) is the first runtime consumer, and only for one narrow slice of it
(`schedule.closures`'s candidate-recurring-weekday family); every other field this audit
classifies (`schedule.hours`, `bestTime`, `reservation`, `febMar2027`) still has no TypeScript
type and no UI reading its classification. See
[`TEMPORAL_DATA_CONTRACT.md`](TEMPORAL_DATA_CONTRACT.md) for the full taxonomy, the exact
coverage numbers, two real findings (`reservation.required` losing the `"Recomendable"` nuance
for 39/214 places; `data/seasonal-alerts.json` being an unconsumed, non-place-id-keyed collection
distinct from `febMar2027`), and a sketched — not implemented — future domain shape a later phase
would build against.

## Weekday closure signals (derived, Phase 3D-B)

The first RUNTIME consumer of the Phase 3D-A audit above — deliberately narrow: it reads only
`place.schedule.closures`, never `schedule.hours`, `bestTime`, or `febMar2027`, and it answers
only whether a user-chosen civil date's weekday matches a candidate recurring-weekday closure
extracted from that text. It is not an opening-hours solver and asserts no open/closed judgment.

`app/src/lib/temporal-availability.ts` derives a `ClosureFact` from `place.schedule.closures` on
every read — nothing is added to `Place` or persisted. `interpretClosureText()` is a direct,
partial TypeScript port of `scripts/temporal_data_lib.py`'s `classify_closures()` (same category
names, same priority order, same tier per category) — the audit is the ceiling this module keeps
to, never exceeding an OPAQUE/UNKNOWN Python-audit family into a stronger runtime fact.
`app/src/lib/civil-date.ts` gained one small addition, `getCivilWeekday()`, mapping a valid civil
date to a `CivilWeekday` (timezone-invariant, `null` for an invalid date) — it still knows dates
only, never a `Place` or a closure. `app/src/lib/day-weekday-signal.ts` is the `Place[]`-aware
layer `OrderedSequenceBuilder.tsx`'s day-assignment view actually calls, mirroring this
codebase's existing `transfer.ts` → `ordered-sequence.ts` → `day-assignment.ts` layering.

Nothing here is persisted: `nihon.manualPlanningDraft`'s schema (`ManualPlanningDraftV2`, still
the current version) is unchanged, and no new `localStorage` key was introduced. The signal is
recomputed on every render from the day's already-derived date (Phase 3C-E's `startDate` offset
by the day index) and each place's existing raw `schedule.closures` text. See
[`TEMPORAL_DATA_CONTRACT.md`](TEMPORAL_DATA_CONTRACT.md) for the exact parity rules this runtime
layer must hold to, and `docs/ROADMAP.md`'s Phase 3D-B entry for the UI and product boundary.

## Reservation semantics (derived, Phase 3D-C)

A second, narrower runtime consumer of the Phase 3D-A audit — this one fixes a real gap the audit
proved mechanically rather than merely classifying something new. `place.reservation.required` is
declared `boolean` in the `Place` type above and remains exactly that: unchanged, still exported,
still internally consistent with `scripts/export-dataset.py`'s own `required = raw.lower() ==
"sí"` rule. What Phase 3D-C changes is that no UI/filter code may decide "requires reservation"
from that boolean **alone** anymore, because it collapses `"Recomendable"`/`"Opcional"`/`"No para
espectador"` into the same `false` a plain `"No"` gets — a real information loss `reservation.raw`
already avoids.

`app/src/lib/reservation.ts` derives a `ReservationFact` (`category`, `tier`,
`consistentWithDerivedBoolean`) from `reservation.raw` + `reservation.required` on every read —
nothing is added to `Place` or persisted. `classifyReservationCategory()` is a direct TypeScript
port of `scripts/temporal_data_lib.py`'s `classify_reservation_raw()` (same 7 category names, same
tier per category, same expected-boolean mapping), protected by the same source-check pattern
`temporal-availability.ts` established for `schedule.closures`. The same module also exports the
one predicate `App.tsx`'s filtering calls (`matchesReservationFilter`, backing the closed
`Filters.reservation: ReservationFilterValue` union) and the one function `PlaceDetail.tsx` calls
to render a tag and a practical-info row (`describeReservationForUi`) — a single domain module
covering classification, filtering, and display, deliberately not split into a separate
`*-display.ts` file the way `transfer.ts`/`transfer-display.ts` are, because the display surface
here is small enough that splitting it would be unjustified ceremony.

`reservation.leadTime` is shown as **raw text only**, appended verbatim when present and omitted
entirely when the raw value is `"—"`/empty — never normalized into a day count, a booking
deadline, or a comparison against any date. See `docs/ROADMAP.md`'s "Later (unscheduled)" for why
lead-time/deadline intelligence remains a distinct, unstarted future phase, and the Phase 3D-C
entry for the exact per-category UI wording.

## Reservation lead-time signals (derived, Phase 3D-D)

A third runtime consumer of the Phase 3D-A audit, this one over `reservation.leadTime` rather than
`reservation.raw`. It answers a narrower question than a booking deadline: *"what kind of
advance-reservation information is recorded for a place the user already selected?"* — never *"when
must I book"* or *"am I already too late."*

`app/src/lib/reservation-lead-time.ts` derives a `ReservationLeadTimeFact` from
`place.reservation.leadTime` on every read — nothing is added to `Place` or persisted.
`classifyLeadTimeCategory()` is a direct TypeScript port of `scripts/temporal_data_lib.py`'s
`classify_lead_time()` (same 3 category names, same tier per category, same anchored whole-string
`_BARE_MAGNITUDE_RE` semantics — a magnitude-shaped substring inside a longer sentence, e.g. `"3
meses"` inside `"Lotería 3 meses antes; revisar liberaciones"`, never qualifies as
`bare-magnitude`). For a `bare-magnitude` string only, a closed `LeadTimeMagnitude` bucket (`days`
/ `weeks` / `months` / `days-to-weeks` / `weeks-to-months`) is additionally derived — never a
numeric range: `"1–2 semanas"` becomes `magnitude: "weeks"` with `raw: "1–2 semanas"` preserved
verbatim, and no `minDays`/`maxDays` is ever computed from it. `ReservationLeadTimeFact` is a
discriminated union keyed on `kind` (`"not-applicable"` / `"coarse-magnitude"` /
`"specific-mechanism"`), so a `magnitude` field cannot exist on an opaque or not-applicable fact at
the type level.

This module is deliberately kept separate from `lib/reservation.ts`, which keeps owning
reservation-*necessity* semantics (required/recommended/optional/role-specific) from Phase 3D-C.
The two axes are composed, never merged: `app/src/lib/reservation-planning.ts`'s
`buildReservationPreparationSummary(places)` pairs each place's `ReservationFact` and
`ReservationLeadTimeFact` into a `ReservationPreparationItem`, over an explicit, already-ordered
list of places (the current canonical route, Phase 3C-A) — preserving that exact order, never
resorting by magnitude, reservation category, or any derived urgency. A `not-applicable` lead time
omits the place from the summary; `bare-magnitude` and `opaque-entity-or-mechanism-specific` are
both included, since neither is "safe to ignore" — an opaque record often carries the most
operationally important information (a lottery, timed entry, a release schedule), just not in a
form this dataset can safely reduce to a magnitude. A duplicate `place.id` in the input is a
fail-loud invariant violation, not a case this function silently repairs: it throws immediately,
naming the offending id, since the canonical route is already supposed to be duplicate-free
(`planning-draft.ts`'s own shape validation rejects a stored route with a repeated id) — a
duplicate reaching this far would mean an upstream regression, which silently deduplicating would
hide rather than surface.

`OrderedSequenceBuilder.tsx`'s "Construir recorrido" view renders this as one route-wide,
read-only "Reservas por preparar" section, built from the current route regardless of whether it
has been split into days yet — it reads no `startDate`, no derived day date, and performs no date
arithmetic of any kind. `PlaceDetail.tsx` is unchanged: its existing raw-text-only `leadTime`
suffix (Phase 3D-C) remains the only per-place surface; this phase's structured signal lives in the
route-wide planning surface only.

See [`TEMPORAL_DATA_CONTRACT.md`](TEMPORAL_DATA_CONTRACT.md) for the exact parity rules this
runtime layer must hold to, and `docs/ROADMAP.md`'s Phase 3D-D entry for the full UI/product
boundary — in particular, everything this phase deliberately does **not** do: convert a magnitude
into a day count, know today's date, compute a booking-by date, compare against `startDate`,
interpret a lottery/release mechanism, or claim availability.
