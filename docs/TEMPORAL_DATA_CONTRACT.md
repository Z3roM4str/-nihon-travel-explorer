# Temporal data contract (Phase 3D-A)

Phase 3C ended with a user who can build a route, split it into ordinal day buckets, and anchor
"Día 1" to a real civil date (`app/src/lib/civil-date.ts`). The next question Nihon will
eventually need to answer is:

> Given the date the user chose, what temporal facts can Nihon safely state about the places
> assigned to that day?

This document is **not** that answer. It is the audit-and-contract phase that decides which parts
of the existing dataset are safe enough to support that future answer, and which are not — so that
a later phase builds an opening-hours feature on top of evidence, not assumption. It is produced
entirely by the deterministic, offline, read-only script `scripts/audit-temporal-data.py`
(`scripts/temporal_data_lib.py` holds the pure classification rules it and
`scripts/test_temporal_data_audit.py` both import). Re-running that script against an unchanged
`data/places.json` reproduces every number in this document byte-for-byte; nothing here is
manually transcribed from a one-off inspection.

## Scope of this phase

**In scope:** inventory and classify the existing editorial fields (`schedule.hours`,
`schedule.closures`, `bestTime`, `reservation.required`/`leadTime`/`raw`, `febMar2027.status`)
into pattern families with an honest confidence tier, and define the normalization contract
those tiers imply.

**Explicitly out of scope, none of it started here:**

- An opening-hours feasibility solver, or any "this day works / doesn't work" judgment.
- Any UI — no calendar warning, no per-place time slot, no new component.
- Clock-time, timezone, or per-place scheduling of any kind. Phase 3C-E's `startDate` is a civil
  date only; this phase adds no time-of-day to anything.
- Automatic date recommendation, rescheduling, place-moving, or itinerary generation.
- Any live verification against an official source, a provider, or an API. Zero network requests
  were made to produce this document.

Phase 3C-E's own boundary statement stands unmodified: *"This phase reads none of
`place.bestTime`, `schedule.hours`, or `schedule.closures`, ... no opening-hours solver."* Phase
3D-A does not change that — the planning draft and civil-date anchoring still read none of these
fields. This document is about the dataset, not about wiring it into the planner.

## Method

`scripts/audit-temporal-data.py <data-dir>` (default `data/`, the canonical source per
`docs/DATA_MODEL.md` — never `app/src/data/`, though the two are verified byte-identical) reads
`places.json`, fails loudly on any structural surprise (missing field, wrong type, empty/non-array
JSON), and classifies every place's value for each audited field through a fixed, ordered set of
regex rules in `scripts/temporal_data_lib.py`. Every category is tagged with exactly one of four
tiers:

| Tier | Meaning |
|---|---|
| **SAFE** | Deterministically parseable into a structured fact without guessing. |
| **PARTIAL** | Part of the statement is safely extractable; part is not, and that part must stay opaque. |
| **OPAQUE** | Depends on something a static dataset cannot resolve (weather, an unnamed third party, a festival calendar, tides, an operator's own variable schedule) — must stay editorial text, indefinitely, not just "until parsed better." |
| **UNKNOWN** | Genuinely unclassifiable, missing, or an explicit "variable"/"pending" signal. **Never** coerced to open, closed, or any other tier — this is the rule item 5 of the phase brief calls out by name, and it is enforced by `temporal_data_lib.py` never having a fallback branch that resolves to SAFE or PARTIAL. |

Running the script is the only way to reproduce the numbers below:

```bash
python3 scripts/audit-temporal-data.py data
```

## 1. `schedule.hours` — 214 places, 157 distinct raw strings

| Category | Count | Tier | Representative examples |
|---|---:|---|---|
| `fixed-interval-clean` | 65 | SAFE | `"09:00–17:00"`, `"Aprox. 09:00–20:00"` |
| `known-24h` | 19 | SAFE | `"Espacio público 24 h"`, `"Parque 24 h"` |
| `explicit-unknown-variable` | 49 | UNKNOWN | `"Variable por fecha"`, `"Ferry variable"` |
| `qualitative-uncategorized` | 16 | UNKNOWN | `"Tours en horas fijas"`, `"Horario asignado"` |
| `seasonal-variable` | 15 | PARTIAL | `"09:00–16:00/17:30 según temporada"` |
| `fixed-interval-with-caveat` | 12 | PARTIAL | `"10:00–17:00 aprox.; verificar exposición"` |
| `daytime-qualitative` | 10 | PARTIAL | `"Diurno"`, `"Templo diurno; torre variable"` |
| `third-party-operator-dependent` | 13 | OPAQUE | `"Según comercio"`, `"Según tienda, aprox. 11:00–20:00"` |
| `weather-or-tide-dependent` | 6 | OPAQUE | `"Ferry estacional y meteorológico"`, `"Según marea y operador"` |
| `solar-relative` | 4 | PARTIAL | `"Amanecer–atardecer; varía por mes"` |
| `ambiguous-alternative-interval` | 3 | PARTIAL | `"09:00–16:00/16:30"` |
| `partial-single-bound` | 2 | PARTIAL | `"Muy temprano–14:00 aprox."` |

**Coverage: SAFE 84/214, PARTIAL 46/214, OPAQUE 19/214, UNKNOWN 65/214.**

A `fixed-interval-clean` hours string is safe to read structurally (an approximate open/close
clock interval) precisely because it carries no other qualifier — the moment a caveat clause,
season dependency, or third-party/weather dependency is present, the string moves to PARTIAL or
OPAQUE and the interval must not be treated as unconditionally valid. `known-24h` is the one
category safe to read as "always open" without any interval at all.

## 2. `schedule.closures` — 214 places, 89 distinct raw strings

| Category | Count | Tier | Representative examples |
|---|---:|---|---|
| `no-known-closure` | 61 | SAFE | `"Sin cierre ordinario"`, `"Sin cierre"` |
| `weather-or-tide-dependent` | 48 | OPAQUE | `"Clima"`, `"Clima/tifones"`, `"Oleaje/alertas"` |
| `recurring-weekday-named` | 30 | PARTIAL | `"Lunes; verificar"`, `"Martes; verificar"` |
| `third-party-operator-dependent` | 18 | OPAQUE | `"Según comercio"`, `"Según edificio"` |
| `qualitative-uncategorized` | 19 | UNKNOWN | `"Interiores limitados"`, `"Según baño"` |
| `temporary-specific-closure` | 11 | OPAQUE | `"Solo durante el festival"`, `"Durante montaje"` |
| `explicit-unknown-variable` | 10 | UNKNOWN | `"Cierres variables"`, `"Variable"` |
| `scheduled-but-unspecified` | 10 | UNKNOWN | `"Cierres programados"`, `"Mantenimientos programados"` |
| `irregular-weekday-pattern` | 6 | OPAQUE | `"Muchos domingos"`, `"Miércoles/domingo variable"` |
| `no-ordinary-closure-with-caveat` | 1 | PARTIAL | `"Sin cierre ordinario; clima"` |

**Coverage: SAFE 61/214, PARTIAL 31/214, OPAQUE 83/214, UNKNOWN 39/214.**

**A real, explicit weekday closure exists in the dataset** (item 12 of the phase brief asked to
confirm this rather than assume it): 30 places carry a single named weekday
(`Lunes`/`Martes`/`Miércoles`/…), always suffixed with an uncertainty marker in this checkout — the
raw text is never just `"Lunes"`, it is `"Lunes; verificar"` or a combination like `"Martes y
montaje"`. That is exactly why `recurring-weekday-named` is **PARTIAL, not SAFE**: the weekday
itself is a safe, extractable fact, but this dataset never asserts the closure with the
confidence a SAFE tier would require — "verificar" ("verify") is the editor's own word for it.
**`irregular-weekday-pattern` is deliberately a different, OPAQUE category**: `"Muchos domingos"`
("many Sundays") uses a weekday name but explicitly denies that it means *every* Sunday, so it
must never be classified alongside a plain single-weekday closure — doing so would fabricate a
recurring rule the source text does not make.

## 3. `bestTime` — the boundary the phase brief calls out by name

All 214 places have a non-empty `bestTime` from a closed, 10-value editorial vocabulary
(`Mañana` 131, `Tarde` 39, `Noche` 19, `Atardecer` 16, `Apertura` 3, and five smaller
combinations). **Every one of them classifies as `editorial-recommendation`, tier OPAQUE, with no
exception** — `classify_best_time()` takes no branch on the field's content at all, only on
whether it is present, specifically so a value that happens to look time-shaped can never leak
into the hours domain. `bestTime` answers "when is this experience nicest," not "when is this
place open" — `"Atardecer"` ("sunset") does not mean the place opens or closes at sunset, and nothing
here computes a clock time from it. `schedule.hours` is never overridden by `bestTime`, and no
future feature may treat `bestTime` as a partial or safe hours source without an explicit new
product decision that this document does not make.

## 4. `reservation` — a real defect this audit found

`reservation.raw` has exactly 5 distinct values across 214 places:

| Raw value | Count | `reservation.required` boolean | Audit category | Tier |
|---|---:|---|---|---|
| `"No"` | 134 | `false` | `not-required` | SAFE |
| `"Sí"` | 41 | `true` | `required` | SAFE |
| `"Recomendable"` | 37 | `false` | `recommended-not-required` | PARTIAL |
| `"Opcional"` | 1 | `false` | `optional-not-required` | PARTIAL |
| `"No para espectador"` | 1 | `false` | `not-required-role-specific` | PARTIAL |

**Finding: `reservation.required` silently collapses 39/214 places (18 %) into `false`, even
though their raw editorial text is neither `"No"` nor `"Sí"`.** `"Recomendable"` ("recommended")
is a materially different statement from a plain `"No"` — the export pipeline
(`scripts/export-dataset.py`'s `normalize_place`) already preserves the original string in
`reservation.raw`, so no information is lost from the dataset, but any consumer that reads only
the boolean (as `PlaceDetail.tsx` and `place.ts` currently do, via `place.reservation.required`)
cannot tell "not needed" from "recommended but optional" apart. This is recorded here as a
finding, not corrected — per the phase's "no live verification, no silent dataset correction"
rule, Phase 3D-A does not touch the workbook or `places.json`.

`reservation.leadTime` is far more heterogeneous — 66 distinct strings. 128/214 places have no
reservation at all (`"—"`, `not-applicable`, SAFE by definition). Of the remaining 86, 21 are a
bare magnitude phrase (`"Semanas"`, `"1–2 semanas"` — PARTIAL, a coarse days/weeks/months bucket
is extractable) and 65 are opaque, entity- or mechanism-specific text (`"Lotería 3 meses antes;
revisar liberaciones"`, `"App obligatoria para timed entry desde 2026"`) that cannot be reduced to
a bucket without losing the actual mechanism the editor is warning about.

**Coverage: `reservation.raw` SAFE 175/214, PARTIAL 39/214. `reservation.leadTime` SAFE 128/214,
PARTIAL 21/214, OPAQUE 65/214.**

## 5. `febMar2027` — its own axis, deliberately never merged with weekly hours/closures

`febMar2027.status` has 24 distinct values across 214 places (every place has one; none is
empty). This audit classifies `status` alone — `classify_feb_mar_status()` takes exactly one
argument, verified by a regression test (`test_never_reads_warning_or_action_text`) — because
`warning` and `action` are free prose meant for a human, never a second input to a rule engine.

| Category | Count | Tier | Representative examples |
|---|---:|---|---|
| `pending-verification` | 152 | UNKNOWN | `"CALENDARIO / CONDICIÓN PENDIENTE"` |
| `seasonal-risk` | 32 | OPAQUE | `"RIESGO ESTACIONAL"`, `"ALTO RIESGO DE CIERRE"` |
| `open-with-condition` | 14 | PARTIAL | `"ABIERTO; FLORACIÓN NO GARANTIZADA"` |
| `confirmed` | 6 | SAFE | `"ABIERTO CONFIRMADO"`, `"CONFIRMADO 2027"` |
| `seasonal-opportunity` | 3 | OPAQUE | `"OPORTUNIDAD ESTACIONAL"` |
| `sale-or-lottery-limited` | 2 | OPAQUE | `"VENTA FUTURA / CUPO LIMITADO"` |
| `maintenance-or-works` | 2 | OPAQUE | `"MANTENIMIENTO 2027 PENDIENTE"`, `"OBRAS ACTIVAS"` |
| `partial-closure-in-effect` | 1 | PARTIAL | `"CIERRE PARCIAL DESDE 24 MAR"` |
| `historical-pattern-inference` | 1 | OPAQUE | `"PATRÓN HISTÓRICO / MUY PROBABLE"` |
| `ritual-access-restriction-pending` | 1 | OPAQUE | `"CIERRES SAGRADOS PENDIENTES"` |

**Coverage: SAFE 6/214, PARTIAL 15/214, OPAQUE 41/214, UNKNOWN 152/214.**

`febMar2027.warning`/`febMar2027.action` are heavily deduplicated: only **34 unique warnings**
and **34 unique actions** across 214 places (the single largest status bucket, `"CALENDARIO /
CONDICIÓN PENDIENTE"` at 141 places, shares one identical warning/action pair). They are audited
here for uniqueness only and are never structurally parsed — see the boundary rule below.

**The critical boundary, stated explicitly because the phase brief calls it out by name:** a
`febMar2027` status answers *"how confident is Nihon that this place's February–March 2027
situation is understood,"* a trip-window-level question. It never answers *"is this place closed
on Tuesdays."* A warning such as *"Reconfirmar en la web oficial al fijar fechas"* is a call to
re-verify, not a machine-readable closure rule, and `pending-verification` — 152/214 places, by
far the largest bucket — is tiered **UNKNOWN**, not OPAQUE, specifically because "the calendar
isn't published yet" carries no partial structure to extract at all; conflating it with a real
closure signal would be a stronger claim than the source text makes. `alertSeverity()` in
`app/src/lib/place.ts` already derives a coarse visual severity (`confirmed`/`risk`/`pending`)
from this same field for the UI's February–March 2027 card — that is pre-existing, unrelated
display logic this phase leaves untouched, not a second classification this document introduces.

### A second finding: `data/seasonal-alerts.json` is not the same collection

The exporter also writes a **separate** `seasonal-alerts.json` — 33 entries, keyed by `Hub` +
`"Lugar / tema"` free text, **not by place id** — distinct from the 214 per-place `febMar2027`
objects above. `data/DATA_MODEL.md` already documents it as its own supporting collection. This
audit additionally confirms, by grepping `app/src/`, that **nothing in the application currently
reads it** — no component, hook, or lib module references `seasonal-alerts.json` or a
`seasonalAlerts` identifier anywhere. It is exported, versioned, and unused. A future phase must
not assume it can be joined to `Place` records by name-matching `"Lugar / tema"` against
`place.name` — no such join exists today, and this document does not create one.

## The normalization contract

1. **Raw editorial data is authoritative and is preserved exactly as-is.** Every field audited
   here already keeps its original Spanish string on the `Place` object (`schedule.hours`,
   `schedule.closures`, `bestTime`, `reservation.raw`, `febMar2027.status`/`warning`/`action`).
   Nothing in this phase touches `data/places.json`, `app/src/data/places.json`, or the workbook.
   A future structured fact is always **derived alongside** the raw string, never a replacement
   for it — exactly the precedent `duration.raw` plus derived `minMinutes`/`maxMinutes` already
   set in Phase 1, and `TransferProvenance` already set for logistics in Phase 3B1.

2. **Safe structured facts** are the SAFE-tier categories above: `known-24h` and
   `fixed-interval-clean` for hours; `no-known-closure` for closures; `not-required`/`required`
   for `reservation.raw`; `not-applicable` for `reservation.leadTime`; `confirmed` for
   `febMar2027.status`. These can be turned into a typed fact **without guessing** — nothing about
   them depends on information outside the string itself.

3. **Partially structurable data** (`seasonal-variable`, `fixed-interval-with-caveat`,
   `daytime-qualitative`, `solar-relative`, `ambiguous-alternative-interval`,
   `partial-single-bound` for hours; `recurring-weekday-named`, `no-ordinary-closure-with-caveat`
   for closures; the three non-binary `reservation.raw` categories; `bare-magnitude` lead times;
   `open-with-condition`/`partial-closure-in-effect` for `febMar2027`) carry one extractable part
   (a candidate weekday, a numeric interval, a coarse magnitude) **and** one part that must stay
   opaque (a caveat clause, "según temporada," "verificar"). A future structured type may expose
   the extractable part, but must carry the opaque remainder forward as unstructured text — never
   drop it.

4. **Opaque, non-deterministic data** (`weather-or-tide-dependent`,
   `third-party-operator-dependent`, `temporary-specific-closure`, `irregular-weekday-pattern` for
   hours/closures; `opaque-entity-or-mechanism-specific` lead times; every non-`confirmed`,
   non-`pending`, non-`open-with-condition` `febMar2027` category; `bestTime` in its entirety)
   depends on something this static dataset cannot resolve — weather, tides, an unnamed operator,
   a festival calendar, a lottery. These values must remain editorial text **indefinitely**. They
   are not "not yet parsed"; they are not parseable from this data source at all, regardless of
   how much future engineering effort is spent, because the actual answer lives outside the
   dataset (an operator's own live calendar, real-time weather).

5. **Unknown must remain unknown.** `explicit-unknown-variable`, `qualitative-uncategorized`,
   `scheduled-but-unspecified` (hours/closures), `unrecognized-value` (reservation),
   `pending-verification`/`uncategorized` (febMar2027), and a genuinely missing field all tier as
   UNKNOWN. **No code path in `temporal_data_lib.py` ever resolves an UNKNOWN classification to
   SAFE, PARTIAL, or OPAQUE** — there is no fallback branch that defaults to "probably open" or
   "probably fine." `test_unrecognized_text_stays_unknown_never_promoted` and its siblings pin
   this down as a regression test, not just a design intention.

## Proposed domain model — sketched, not implemented

Following the precedent of Phase 3B2E ("Access-Point Override Design," which decided a model
without shipping any code, coordinates, or routing behavior), this phase **describes** the
smallest plausible future domain shape and explains why it is shaped that way — it does not add a
new TypeScript file, export, or type to `app/src/`. Writing an unused type now, with no consumer
and no solver to exercise it, would be exactly the kind of premature abstraction the rest of this
codebase's conventions avoid (see `duration.planningBlock`/`variability`, which stayed unused
optional fields for an entire phase rather than being wired in speculatively).

A future phase's derived temporal domain — analogous to how `app/src/lib/transfer.ts` derives a
typed domain from `nearby.json` without a second copy of the data — would need to represent
**at most** these distinctions, each directly justified by a tier found above, and nothing more:

```ts
type TemporalTier = "safe" | "partial" | "opaque" | "unknown";

type HoursFact =
  | { kind: "known-24h" }
  | { kind: "known-interval"; raw: string }       // fixed-interval-clean only
  | { kind: "conditional-interval"; raw: string }  // PARTIAL hours categories, interval + caveat
  | { kind: "opaque"; raw: string }                // OPAQUE hours categories
  | { kind: "unknown"; raw: string | null };

type ClosureFact =
  | { kind: "no-known-closure" }
  | { kind: "candidate-weekday"; raw: string }     // recurring-weekday-named ONLY — never
                                                     // irregular-weekday-pattern, which stays opaque
  | { kind: "opaque"; raw: string }
  | { kind: "unknown"; raw: string | null };

type TemporalAvailability = {
  hours: { fact: HoursFact; tier: TemporalTier; raw: string };
  closures: { fact: ClosureFact; tier: TemporalTier; raw: string };
};
```

Load-bearing constraints on this sketch, each traceable to a finding above:

- **It is derived on read, never stored.** Exactly like `TransferEdge`, `PlanningBlock`, and
  `ManualPlanningDraftV2`'s own derived fields — nothing here would be a new column on `Place` or
  a new persisted field in the planning draft.
- **`tier` is mandatory on every fact**, not an afterthought — a consumer must be structurally
  unable to read `fact` without also seeing how much to trust it, the same discipline
  `TransferConfidence` already enforces for logistics.
- **`raw` is never dropped**, even on a `"known-24h"`/`"no-known-closure"` SAFE fact — the
  contract's rule 1 above.
- **It must never imply stronger knowledge than the source carries.** There is deliberately no
  `"open"`/`"closed"` boolean anywhere in this sketch, because no field audited here safely
  supports one: even the SAFE tier only supports "this interval/24h/no-ordinary-closure is what
  the editor recorded," never "this place is open right now" or "on this date." A `"candidate-weekday"`
  fact is exactly that — a candidate, carrying its own raw caveat text forward — never a boolean
  "closed that day."
- **`bestTime` and `febMar2027` are excluded from this type entirely**, on purpose. Section 3 and
  section 5 above establish why: `bestTime` is a recommendation axis, and `febMar2027` is a
  trip-window-confidence axis. Neither is an hours/closures fact, and folding either in would
  misrepresent what they actually assert.
- **DATE ≠ TIME**: nothing above accepts or produces a clock time, a timezone, or a specific
  calendar date. Even a future consumer holding both a `TemporalAvailability` and Phase 3C-E's
  `startDate`-derived civil date for a day bucket would still have no basis to assign a visit a
  start time — that remains explicitly unscheduled work (see `docs/ROADMAP.md`, "Later
  (unscheduled)").

## What this phase does not do

- No opening-hours solver, feasibility check, or "this day works" judgment of any kind.
- No UI change. `PlaceDetail.tsx` and `OrderedSequenceBuilder.tsx` are unmodified; `place.bestTime`,
  `place.schedule.hours`, `place.schedule.closures`, and `place.febMar2027` render exactly as
  before.
- No clock-time, timezone, arrival/departure, or per-place scheduling of any kind.
- No dataset change. `data/places.json`, `app/src/data/places.json`,
  `data/seasonal-alerts.json`, the workbook, and every logistics/access-point/walking artifact are
  byte-identical to `main`.
- No live verification. Zero requests to any official source, provider, or API.
- No new TypeScript type or domain module shipped — the sketch above is documentation for a future
  phase to justify against, not code landed ahead of a consumer.
- No Phase 3D-B (or any later phase) work started.
