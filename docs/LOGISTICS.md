# Logistics data model

Phase 3B1 gives the existing `nearby.json` relations a domain shape (`app/src/lib/transfer.ts`)
without raising their confidence, generating itineraries, or calling any external routing
service. This document explains what that layer is, what it is not, and the boundary with the
phase that follows it.

## Visit time vs. transfer data

These are two different kinds of number that this codebase has always kept apart and that
Phase 3B1 does not change:

- **Visit time** (`duration` on `Place`, aggregated in `app/src/lib/selection.ts`) is how long a
  visitor spends *at* a place.
- **Transfer data** (`nearby.json`, given domain shape by `app/src/lib/transfer.ts`) is about
  moving *between* two places.

Selection Intelligence (Phase 3A) sums visit time across a selection because a selection's
total time-on-site does not depend on order. Transfer time is the opposite: it depends entirely
on which place a visitor goes to next, which a bare selection does not specify. That is why
Phase 3B1 introduces no function that adds transfer minutes across a `Place[]` — see
"No aggregation without order" below.

## Provenance: what `nearby.json` actually is

All 403 relations currently in `nearby.json` were produced the same way: take each place's
coordinates, compute a haversine (great-circle) distance between them, and apply a fixed
speed model to turn that distance into an estimated number of minutes. Every row's `Nota` field
says as much ("Estimación geográfica; validar ruta real" — geographic estimate; validate the
real route). None of it reflects:

- an actual walking or transit route (streets, elevation, station layout, transfers);
- a real timetable or schedule;
- any external routing or mapping API call.

`app/src/lib/transfer.ts` encodes this as structured provenance on every converted edge:

```ts
type TransferProvenance = {
  kind: "derived-geographic";
  dataset: "nearby";
  method: "haversine-speed-model";
};
```

This is deliberately not a free-text string. `kind` is the extension point: a later phase that
ingests a real routing or transit provider's output adds a new `kind` value (e.g.
`"routing-provider"`, `"transit-provider"`) rather than repurposing this one, so a consumer can
always tell a geometric estimate from a validated result by checking `source.kind`, without
parsing prose.

## Confidence taxonomy

```ts
type TransferConfidence = "estimated" | "validated-static" | "schedule-aware";
```

- **`estimated`** — derived from geometry, as above. Every edge converted from the current
  `nearby.json` gets this value; nothing in Phase 3B1 assigns any other.
- **`validated-static`** — a real routed path and time (e.g. from a walking-routing provider),
  without live schedule awareness. Not produced anywhere yet.
- **`schedule-aware`** — accounts for an actual timetable (e.g. a transit provider's
  departure/arrival lookup for a specific time). Not produced anywhere yet.

`verifiedAt: string | null` sits alongside confidence: `null` for every current edge, reserved
for an ISO timestamp once a phase actually performs independent validation. No current edge
gets a non-null `verifiedAt`, and no current edge is silently promoted to `validated-static` or
`schedule-aware` — Phase 3B1 only adds the vocabulary those future states will use.

**False precision is the risk this taxonomy guards against.** Formalizing these relations into
a typed `TransferEdge` must not make them read as more trustworthy than they are; `confidence`
and `verifiedAt` exist specifically so a caller can tell an estimate from a validated result
without inspecting `source` or parsing `Nota`.

## The `TransferEdge` contract

```ts
type TransferEdge = {
  fromId: string;
  toId: string;
  minutes: { minMinutes: number; maxMinutes: number };
  distanceKm: number;
  mode: TransferMode;         // normalized; see below
  rawMode: string;            // original "Modo" text
  relation: TransferRelation; // normalized; see below
  rawRelation: string;        // original "Relación" text
  confidence: TransferConfidence;
  source: TransferProvenance;
  verifiedAt: string | null;
};
```

`minutes` is always a range, never a bare number — the same discipline
`app/src/lib/duration.ts` and `MinuteRange` already use for visit time. For every edge
converted from the current dataset, `minMinutes === maxMinutes`, because `nearby.json` records
one `Min aprox.` value per relation. Phase 3B1 does **not** fabricate a ±10%/±20% tolerance to
turn that single number into a spread — the uncertainty is represented honestly by
`confidence: "estimated"`, not by invented bounds that would look more precise than the data
supports.

### Mode

```ts
type TransferMode = "walk" | "local-transit" | "disney-resort-line";
```

This normalizes only the `Modo` values that exist in the current 403 relations today (`A pie`,
`Transporte local`, `Disney Resort Line`). It is intentionally not a general transport catalogue
— Shinkansen, flights, and ferries are out of scope for 3B1 because none of them appear in
`Modo` yet, and adding them now would be speculative. `normalizeTransferMode` throws on any
other value rather than accepting an arbitrary string, so a future workbook change that
introduces a new mode fails loudly (in tests, in `scripts/validate-dataset.py`, and in
`toTransferEdge`) instead of silently degrading the domain model. `rawMode` is kept on every
edge for auditability regardless.

### Relation kind

```ts
type TransferRelation = "same-cluster" | "nearby" | "alternative";
```

Normalizes the current `Relación` values (`Mismo cluster`, `Cercano`,
`Alternativas/complementos`). This describes how two places relate editorially — it carries no
claim about transfer quality on its own; a `same-cluster` edge is still `confidence:
"estimated"` today.

## Directed lookup

```ts
function lookupTransfer(fromId: string, toId: string): TransferEdge | null;
```

This is a plain directed dictionary lookup:

- It resolves an edge that is actually recorded in `nearby.json` — never a synthesized one.
- It never assumes `A → B` implies `B → A`. Most of today's 403 relations happen to be
  recorded in both directions, but that is a property of the current data, not something the
  lookup relies on or fabricates when it is missing.
- It never computes distance or time from coordinates when no edge is recorded — that would
  reintroduce the exact haversine estimation this module is meant to make explicit and bounded,
  as an unbounded fallback.
- It never chains edges, joins them, or searches for a shortest path.

When there is no recorded edge in the requested direction, it returns `null`. A caller that
wants to know whether *any* relation is recorded between two places, in either direction, must
check both `lookupTransfer(a, b)` and `lookupTransfer(b, a)` explicitly — `computeLogisticsMetrics`
does exactly this to decide whether a pair of places is "known," and only for that purpose; it
never treats a found `A → B` edge as describing the `B → A` trip.

## No aggregation without order

`app/src/lib/transfer.ts` contains no function shaped like `sumTransfers(places: Place[])`. This
is a deliberate omission, not a gap to fill casually in a later phase:

A `Place[]` selection has no sequence. Summing transfer time across it would require inventing
an order — array order, alphabetical order, or a shortest-path search — and presenting that
invented order's total as if it described the selection is misleading: it would look like a
plan when the module was only ever given an unordered set. `app/src/lib/transfer.test.ts`
includes a regression test asserting this module exports nothing named `sumTransfers`,
`selectionTransferTotal`, `hubTransferTotal`, or `clusterTransferTotalMinutes`.

A correct aggregation belongs to a later phase (3C, day/route planning) and must take an
**explicit sequence** of place ids or edges as its input — never a bare, unordered `Place[]`.

## Logistics metrics (factual, no classification)

`computeLogisticsMetrics(places: Place[])` reports only counts and ranges that are true of the
recorded data, with no interpretation layered on top:

- `possiblePairCount` — unordered pairs among the given places (`n(n-1)/2`).
- `knownPairCount` — how many of those pairs have a recorded edge in either direction.
- `pairCoverage` — `knownPairCount / possiblePairCount` (`0` when no pair is possible).
- `recordedDistanceRange` / `maxRecordedDistance` — the min/max `distanceKm` across the known
  pairs' recorded edges, or `null` when none are known.

### No compact/extended classification (3B1 decision)

The Phase 3B audit suggested that a cluster's `pairCoverage` and recorded distances could
eventually support labelling it "compact" or "extended." Phase 3B1 deliberately does **not**
implement that: the audit did not establish a fully specified threshold for what counts as
"high coverage" or "low distance," and inventing one now would be an unreviewed heuristic
dressed up as a metric. Phase 3B1 exposes the raw metrics; a later phase can classify them
against an explicit, documented threshold if one is agreed on. Until then, no `compact`,
`extended`, `efficient`, or `inefficient` label exists anywhere in this codebase for a cluster.

## The 2026 dataset audit (documentation only)

The Phase 3B audit that this phase formalizes characterized the current 403 relations as:

- 332 proximity-only relations (geographic estimate, nothing more);
- 67 candidates identified as worth prioritizing for future routing validation;
- 4 Kerama-area relations that the audit flagged as obviously not routing-grade (they connect
  islands that a haversine distance cannot meaningfully route between on foot or by a single
  local transfer).

These numbers describe the audit's findings about **today's** dataset. They are recorded here
as documentation only — no production code (`transfer.ts`, `scripts/validate-dataset.py`, or
anywhere else) hardcodes 332, 67, or 4, because a legitimate future update to the workbook
changing these relations must not fail validation or break the domain layer just because a
count changed.

## The 3B2 boundary

Everything below is explicitly out of scope for Phase 3B1. `TransferConfidence`,
`TransferProvenance.kind`, and `TransferMode` are designed so 3B2 can extend them, but none of
the following is implemented, called, or configured yet:

- Any external routing or mapping API call, of any kind.
- Any API key, SDK, or dependency for a routing/transit provider.
- A validation pipeline that ingests provider output into `verifiedAt` / `validated-static` /
  `schedule-aware`.
- Real walking-route or transit-schedule validation for any of the current 403 relations.
- A full transport-mode catalogue (Shinkansen, flights, ferries) beyond the three modes that
  exist in the dataset today.

### Provider research (architectural notes only, no integration)

For **walking** validation, the preferred candidate researched for 3B2 is
**openrouteservice**, built on OpenStreetMap data: it offers global walking routing, its
results can be used with CC BY attribution, and it fits an offline/versioned validation
pipeline (call once, commit the result, re-validate on demand) rather than a live per-request
dependency. A reproducible, self-hostable alternative is **Valhalla** self-hosted against an
OSM extract, which trades operational effort for not depending on a third party's uptime or
terms at all. Phase 3B1 does not call openrouteservice, does not create an API key for it, and
does not build any pipeline around it — 3B2 will decide the exact pipeline fields and
attribution handling.

For **transit** (schedule-aware) validation, Phase 3B1 does **not** choose a provider in code.
Commercial providers investigated include Google Routes, NAVITIME, Ekispert, and HERE, but
their standard terms constrain caching/storing responses as static, versioned repository data
without further permission or a different architecture (e.g. calling live rather than
precomputing). That evaluation is deferred to 3B2, alongside the architecture decision it
implies (live lookup vs. a licensed, cacheable batch export).

#### Google Routes: why it is out of scope now, specifically

- Most Routes API response content is subject to caching/storage restrictions that conflict
  with committing its output as static repository data.
- Its transit schedule lookup only supports queries up to 100 days into the future.
- This project's target window (February–March 2027) is currently outside that 100-day
  horizon and will remain so for some time — so even a permitted integration could not yet
  produce a validated result for the dates that matter here.

No Google API key exists anywhere in this repository, and none is created by Phase 3B1.

## What Phase 3B1 does not touch

- `data/nearby.json` / `app/src/data/nearby.json` — unchanged, still 403 rows, still the single
  source `app/src/lib/transfer.ts` reads from (no duplicated copy of the relations).
- The source workbook.
- Any UI component (`SelectionAnalysis.tsx`, `SelectionPanel.tsx`, `PlaceDetail.tsx`,
  `FilterPanel.tsx`, `App.tsx`/`App.css`, and the rest) — the existing nearby-navigation UI reads
  `getNearby()` exactly as it did before this phase.
- Itinerary generation, place ordering, or city-sequence comparison — all still 3C-or-later.
