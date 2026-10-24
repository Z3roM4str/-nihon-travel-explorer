# Opening-Hours Feasibility Design Gate (Phase 3D-M)

**Design and audit only.** This phase adds no runtime `.ts`/`.tsx`/`.css`, no UI, no persistence,
no schema change, no dataset change, no dependency, and no solver. It does not implement an
opening-hours feasibility model, and — unlike Phase 3D-I and Phase 3D-K, which each recommended a
narrow successor — it does **not** recommend one.

Phase 3D-K approved and Phase 3D-L shipped a strictly bounded piece of arithmetic: for one place on
one assigned day, does the recorded visit duration fit in the time remaining inside **the recorded
clock interval** after a start time the user typed by hand? This gate asks the question that
naturally comes next, and the one this codebase has deferred since Phase 3D-A: is there anything
*stronger* that Nihon may now safely say?

---

## 0. Executive decision (stated up front, restated in full in §28)

**DO NOT IMPLEMENT.**

No subset of the evidence Nihon can derive conservatively today — civil visit date, a manually
chosen local `HH:mm` start time, a recorded duration, a recorded-hours fact, a closure fact, and
the existing hours/closure composition — is strong enough to support a reliable real-world
open/closed judgment or a visitability/admission judgment. Weaker composed recorded-evidence
products are possible, but the reachable safe products merely juxtapose facts already owned by
Phases 3D-B, 3D-J and 3D-L; this audit identifies no new, non-redundant proposition worth a
successor now.

The three findings that close the question, each re-derived for this gate (§4):

1. **Zero places in the dataset carry SAFE evidence on all three temporal axes.** Of 214 places,
   31 have both SAFE hours and a SAFE closure fact; **0** of those 31 also have a SAFE
   `febMar2027` status, and **0** of the 65 SAFE recorded-interval places do. The strongest
   combination that actually exists in the data is *SAFE interval + SAFE closure + UNKNOWN
   trip-window confidence* (17 places). This strongly corroborates rejection of a trip-specific
   OPEN/VISITABLE claim; it does not invalidate independently true record-level arithmetic.
2. **The dataset's own strongest closure phrase excludes the claim in its own words.** All 20
   SAFE-closure records inside the 65 read exactly `"Sin cierre ordinario"` — "no *ordinary*
   closure". A record that scopes itself to ordinary closures cannot be read as evidence that no
   extraordinary closure applies on a given date.
3. **The schedule-field contract lacks the coverage and currency needed for those judgments.**
   `place.schedule` has exactly two keys, `hours` and `closures`: no dedicated last-admission,
   holiday-calendar, dated-extraordinary-closure, capacity or queue fields, and no source/
   `verifiedAt` linkage for an individual hours or closure assertion. Broader editorial provenance
   does exist (`officialUrl`, `updatedAt`, the exporter column mappings and `data/sources.json`),
   but it does not prove that a particular schedule assertion was reverified or will remain current
   for a future visit date.

This is not a request to collect more of the same unscoped text. Crossing from recorded evidence to
a real-world opening claim requires a stronger authoritative/current schedule contract. Field-level
provenance and currency are necessary ingredients for that claim, but not sufficient: extraordinary
closures, holidays, last admission, scope and admission restrictions remain independent concerns.
§28.2 therefore gives claim-specific reopening gates rather than one universal checklist.

Three near-miss alternatives that look safer than a solver were evaluated individually and are
refused with reasons in §26. Nothing in this document authorises any code.

---

## 1. The question this gate resolves

**Asked:** given only the facts Nihon can already derive conservatively — a civil visit date
(Phase 3C-E), a manually chosen local `HH:mm` start time (Phase 3D-L), a recorded duration
(`duration.ts`), a recorded-hours fact (Phase 3D-E), a closure fact (Phase 3D-B), and the existing
hours/closure composition (Phase 3D-I/3D-J) — does there exist any subset of evidence strong enough
to assert something more than *"the duration fits inside the recorded interval"*, without turning
editorial data into a false claim of openness or visitability?

**Answered here:** a full solver, a reliable real-world open/closed judgment and a reliable
visitability/admission judgment are not justified. A closed product can truthfully carry several
record-level facts, but §14 shows that the safe reachable products add no new semantic fact beyond
what 3D-B/3D-J/3D-L already ship. The present recommendation is therefore no successor, based on
redundancy and lack of a new proposition rather than logical impossibility.

**Not asked, and not answered anywhere in this document:** whether any place is open, whether any
visit is possible, or whether any day works. This gate produces no runtime answer to its own
question, and it approves none.

---

## 2. Method and reproducibility

Every figure in §4 was re-derived for this phase against the **live TypeScript modules**
(`recorded-hours.ts`, `temporal-availability.ts`, `hours-closure-composition.ts`,
`recorded-interval-fit.ts`, `feb-mar-status.ts`, `duration.ts`, `place.ts`) and the live dataset.
Nothing was copied from `docs/TEMPORAL_DATA_CONTRACT.md`, from
`docs/OPENING_HOURS_CLOSURE_COMPOSITION_DESIGN.md`, from `docs/VISIT_TIME_FEASIBILITY_DESIGN.md`,
or from `docs/ROADMAP.md`; where a figure coincides with one of theirs, §4 says so as a **verified
match**, not as an inherited value.

Procedure — three temporary Vitest harnesses under `app/src/lib/`, each run with
`npx vitest run <file>` and **deleted immediately after**, so this phase's diff contains no `.ts`
file:

1. Every place's `schedule.hours` through `interpretPlaceHours()` — the real classifier, with its
   real priority order.
2. Every place's `schedule.closures` through `interpretClosureText()`, and weekday outcomes through
   the real `assessWeekdayClosure()` over a representative civil week.
3. Every place's `febMar2027.status` through `interpretPlaceFebMarStatus()`.
4. Composition classes from the real `classifyHoursClosureComposition()`.
5. Every place's `duration` through `resolveDuration()`, including its `duration.raw` fallback.
6. **Interval tokens through the SHIPPED `parseRecordedInterval()`**, not through a candidate
   parser. This is a genuine improvement in evidence quality over Phase 3D-K, which necessarily
   used an audit-only parser because none existed yet.
7. Outcome reachability through the SHIPPED `evaluateRecordedIntervalFit()`, enumerating every
   minute-granularity start strictly inside each recorded interval.
8. Confounder vocabulary scanned with `normalizeText()` over `schedule.hours`,
   `schedule.closures` and `reservation.raw` for all 214 places.

Base commit: `d1f0d12` (`main`, Phase 3D-L merged). Test suite at that commit re-run for this
phase: **950 passing across 27 files**.

---

## 3. Architecture and contracts audited (code read, not inferred from the ROADMAP)

### 3.1 Phase 3C-E — civil date anchoring (`civil-date.ts`, `day-assignment.ts`)

`civil-date.ts` converts a `YYYY-MM-DD` string, offsets it by whole calendar days, and derives a
weekday. It is deliberately timezone-free: every function reads and writes components through
`Date.UTC`/`getUTC*` and formats with `timeZone: "UTC"`, so the civil date the user picked is the
civil date they see. It knows nothing about places, schedules or hours.

`day-assignment.ts` partitions an ordered route into ordinal day buckets. `Día 1` is anchored to a
`startDate` the user typed; later days are `addCivilDays(startDate, index)`.

**What this gives a feasibility question:** a *calendar date* and a *weekday*. **What it does not
give:** any instant, any clock time, any timezone, and — critically — any statement that the user
will actually be at the place on that date. The date is a plan, not an observation.

### 3.2 Phase 3D-B — weekday closure assessment (`temporal-availability.ts`)

`interpretClosureText()` is a port of `scripts/temporal_data_lib.py`'s `classify_closures()`, with
the same 11 categories, the same priority order and the same tiers. It folds them into exactly
three fact kinds: `no-known-closure` (SAFE), `candidate-weekday` (PARTIAL, carrying machine-readable
weekdays), and `not-evaluable` (everything else, PARTIAL/OPAQUE/UNKNOWN).

`assessWeekdayClosure()` produces a five-variant closed vocabulary —
`possible-weekday-closure-match`, `no-weekday-match`, `no-known-closure`, `not-evaluable`,
`not-assessed` — and its own doc states the boundary this gate must respect verbatim: `"no-weekday-match"`
**"does NOT mean open, feasible, compatible, or 'no closure' — it means only that this one recorded
candidate didn't match this one date"**, and `"no-known-closure"` is **"still not a claim that the
place is open on this date"**.

That is not a stylistic caution. It is the contract, and §8 shows the data agrees with it.

### 3.3 Phase 3D-E — recorded hours signals (`recorded-hours.ts`)

`interpretHoursText()` classifies `schedule.hours` into 14 categories over four tiers and exposes
five fact kinds. `intervalRaw` — the matched clock token — exists on `recorded-interval` **only**.
The module header states its own refusal explicitly, and it names this gate's question among the
questions it will not answer: *"it never answers 'will this place be open when I arrive,' 'can I
visit this on Day 2,' 'this closes before your visit ends,' or 'this day works.'"*

Phase 3D-K §3.8 reconciled the third of those with Phase 3D-L's
`recorded-duration-exceeds-interval` outcome: that sentence scopes *that module*, the refused
question is about the *place* while the shipped outcome is about the *record*. **This gate is where
the first two questions land**, and the reconciliation that worked for 3D-L is unavailable here:
"will this place be open when I arrive" is exactly a claim about the place, not the record. The
module's refusal applies to this phase directly, with nothing to reconcile.

### 3.4 Phase 3D-I / 3D-J — hours/closure composition (`hours-closure-composition.ts`)

`classifyHoursClosureComposition(hoursTier, closureTier)` selects one of four **presentation**
classes from the weaker of the two tiers: `jointly-presentable`, `present-with-caveat`,
`keep-separate`, `not-composable`. The module's own doc is unambiguous about what the vocabulary
is: *"It describes how two recorded facts may be displayed; it does not make a claim about a visit
or the place's real-world state."*

`deriveHoursClosureVisitDate()` is the strict, six-guard date prerequisite (valid partition, valid
`startDate`, place in exactly one bucket, valid derived civil date, no partial fallback) that Phase
3D-L reuses unchanged.

**The load-bearing property for this gate:** the composition class is a function of *tiers only*.
It never reads a weekday, a clock value, or a date. `jointly-presentable` means "both records are
SAFE enough to show side by side" — it does not mean the two records agree, and it certainly does
not mean the place is open. A future phase that treated `jointly-presentable` as an eligibility
gate for a stronger claim would be reading a display decision as an evidence decision.

### 3.5 Phase 3D-K / 3D-L — visit-time feasibility (`recorded-interval-fit.ts`)

The shipped module takes exactly three operands — the parsed recorded interval, the chosen start
time, and the recorded duration — and reads **no** `ClosureFact`, `WeekdayClosureAssessment`,
`CompositionClass`, `bestTime`, `febMar2027`, transfer edge, or `Date`. Its eligibility narrows the
discriminated union on `.kind === "recorded-interval"`, never on `.tier === "safe"` (which would
also admit `recorded-24h`). Its result is a closed eight-variant union with no boolean and no
catch-all, every variant named after *the recorded interval* rather than the place.

Phase 3D-K §10 already recorded the argument this gate inherits and extends: gating the arithmetic
on a closure composition class *"would silently delete 42 of 62 places, and the deletion would
itself read as a claim"*. §19 below shows the same asymmetry applies to every composition rule this
gate considered.

### 3.6 `docs/TEMPORAL_DATA_CONTRACT.md` (Phase 3D-A)

Normalization contract rule 1: **raw editorial data is authoritative and is preserved exactly
as-is.** §3 records that `bestTime` is an editorial recommendation and never an hours source. §5
records that `febMar2027` answers *"how confident is Nihon that this place's February–March 2027
situation is understood"* — a trip-window-level question — and **"never answers 'is this place
closed on Tuesdays'"**. §5 also records that `febMar2027.warning`/`action` are 214/214 OPAQUE
editorial prose that is never structurally parsed.

### 3.7 Existing editorial provenance, and the narrower schedule-field gap

The repository is not provenance-free. `Place.officialUrl` and `Place.updatedAt` are populated;
`scripts/export-dataset.py` maps them from the workbook columns `"Página oficial/fuente"` and
`"Actualizado"`; and `data/sources.json` records named sources, URLs, source types and consultation
dates. Substantial official-source provenance therefore exists at dataset/place editorial level.
The shared `2026-09-01` value may describe the current export/research batch, but the audit cannot
prove that it is *merely* an export stamp, nor that it means each hours assertion was reverified.

The opening-hours gap is narrower and still decisive for a real-world claim: `place.schedule` has
exactly **two** keys, `hours` and `closures`, with no source link or `verifiedAt` semantics attached
to either individual assertion. `officialUrl` identifies a place-level verification destination;
it does not structurally say that `schedule.hours` or `schedule.closures` came from that URL. Nor
does `place.updatedAt` guarantee that either schedule field was reverified on that date, that the
record covers the whole site, that it is complete for future exceptions, or that it remains current
for the visit date. There is no runtime/live verification.

Other limitations must also be classified precisely:

- **Structurally absent:** dedicated `lastAdmission`, holiday-calendar, dated
  `temporaryClosures`, capacity/queue, and schedule-field source/verification fields.
- **Present only in raw editorial text:** `JP-038`'s last-admission phrase, public-holiday mentions,
  maintenance/installation/temporary prose, and operator-discretion wording.
- **Represented on independent axes:** `febMar2027`, reservation fields where relevant, and the
  broader `officialUrl`/`updatedAt`/source-catalog provenance metadata.

No module in the repository asserts that a place is open, closed, available, feasible, visitable, or
that a day works. That is not an accident of scope — it is the invariant every Phase 3D document
has protected, and this gate does not break it.

---

## 4. Real-data inventory (re-derived, 214 places)

### 4.1 `schedule.hours` — fact kinds and tiers

| Fact kind | Tier | Count |
|---|---|---:|
| `recorded-interval` (`fixed-interval-clean`) | safe | **65** |
| `recorded-24h` (`known-24h`) | safe | **15** |
| `conditional` (7 PARTIAL categories) | partial | 50 |
| `external-dependency` (weather/tide, third-party) | opaque | 19 |
| `unknown` (missing, explicit-variable, uncategorized) | unknown | 65 |
| | **total** | **214** |

Tier totals SAFE 80 / PARTIAL 50 / OPAQUE 19 / UNKNOWN 65. **Verified match** with Phase 3D-K §4.1
and `docs/TEMPORAL_DATA_CONTRACT.md` §1.

### 4.2 `schedule.closures` — fact kinds and tiers (all 214)

| Fact kind | Category | Tier | Count |
|---|---|---|---:|
| `no-known-closure` | `no-known-closure` | safe | **61** |
| `candidate-weekday` | `recurring-weekday-named` | partial | **30** |
| `not-evaluable` | `no-ordinary-closure-with-caveat` | partial | 1 |
| `not-evaluable` | `weather-or-tide-dependent` | opaque | 48 |
| `not-evaluable` | `third-party-operator-dependent` | opaque | 18 |
| `not-evaluable` | `temporary-specific-closure` | opaque | 11 |
| `not-evaluable` | `irregular-weekday-pattern` | opaque | 6 |
| `not-evaluable` | `qualitative-uncategorized` | unknown | 19 |
| `not-evaluable` | `scheduled-but-unspecified` | unknown | 10 |
| `not-evaluable` | `explicit-unknown-variable` | unknown | 10 |
| | | **total** | **214** |

Tier totals SAFE 61 / PARTIAL 31 / OPAQUE 83 / UNKNOWN 39. Kind totals: `not-evaluable` 123,
`no-known-closure` 61, `candidate-weekday` 30.

**The SAFE tier is three phrasings, and every one of them is an editorial absence statement:**
`"Sin cierre ordinario"` ×38, `"Sin cierre"` ×21, `"Sin cierre general"` ×2. The single
`no-ordinary-closure-with-caveat` record is `JP-019` Tokyo Skytree, `"Sin cierre ordinario; clima"`
— the same sentence, with the caveat made explicit, demoted to PARTIAL by the `;`.

### 4.3 The 65 SAFE recorded-interval places, crossed with closure evidence

| Closure evidence | Kind | Tier | Count | Composition class |
|---|---|---|---:|---|
| `"Sin cierre ordinario"` (all 20 identical) | `no-known-closure` | safe | **20** | `jointly-presentable` |
| Named recurring weekday | `candidate-weekday` | partial | **18** | `present-with-caveat` |
| Weather/operator/temporary/irregular | `not-evaluable` | opaque | **17** | `keep-separate` |
| Variable/uncategorized/unspecified | `not-evaluable` | unknown | **10** | `not-composable` |
| | | **total** | **65** | |

Composition classes over all 214: `jointly-presentable` 31, `present-with-caveat` 43,
`keep-separate` 56, `not-composable` 84. **Verified match** with Phase 3D-I §3.1 and Phase 3D-K
§4.8.

Weekday sets among the 18 `candidate-weekday` interval places: Tuesday ×8, Monday ×6, Wednesday ×4.
**Every one of the 18 raw strings carries a qualifier alongside the weekday** — `"verificar"` ×14,
`"montaje"`/`"mantenimiento"` ×3 (`JP-035`, `JP-036`, `JP-044`), and `"fin de año"` ×1 (`JP-089`).
The record asks to be verified, in its own text, in every single case.

`JP-089` is worth naming: `"Martes en meses específicos; fin de año"` scopes its Tuesday closure to
unnamed months. `interpretClosureText` extracts `tuesday` and `assessWeekdayClosure` will report
`possible-weekday-closure-match` for **every** Tuesday, including ones the record excludes. The
result therefore over-warns relative to the unidentified month scope. It remains deliberately
PARTIAL/candidate semantics — never "closed" — so this is conservative coarse shipped behaviour,
not a newly discovered current correctness defect.

**"Sufficiently structured for any proposed composition"** — closure facts carrying either a SAFE
absence statement or machine-readable weekdays: **38 of 65** (20 + 18); **37** of those also have a
numeric duration. The remaining **27 of 65** have no structure a composition could consume at all.

### 4.4 Durations

- **62 of 65** recorded-interval places resolve to a numeric range; **3 do not** — `JP-121`
  (`"Medio día"`), `JP-147` (`"Medio día–día completo"`), `JP-211` (`"Día completo"`).
- **0 of 62 are point values.** Every one is a range; spreads run 25–180 min (30 min ×22,
  60 min ×21, 120 min ×10, 90 min ×5, 45 min ×2, 180 min ×1, 25 min ×1). 15 distinct ranges.
- All **15** `recorded-24h` places have numeric durations. Across all 214, **177** do.

**Verified match** with Phase 3D-K §4.2.

### 4.5 Interval tokens, through the shipped parser

- **65 of 65 parse** under `parseRecordedInterval()`. **0** unparseable, **0** `crossesMidnight`,
  **0** degenerate, **0** out-of-range.
- **29 distinct tokens**, every one `HH:MM–HH:MM` with U+2013.
- Only **4 of 65** records are the bare token alone (`JP-031`, `JP-044`, `JP-080`, `JP-084`).
  **58** carry `"aprox."`. **7** attribute the interval to a sub-facility or an external
  announcement: `JP-004`/`JP-025`/`JP-028`/`JP-108` `"Tiendas aprox. …"`, `JP-018`
  `"Mayoría 09:00–17:00"`, `JP-032` `"Muchos locales 06:00–14:00"`, `JP-211`
  `"09:00–17:00 según anuncio"`.

Phase 3D-K derived the same figures against a candidate parser; this gate confirms them against the
shipped one. **93.8% of the SAFE interval universe is hedged in its own text**, and that is the
single most important number in this document for §5 and §21.

### 4.6 `febMar2027` and the triple-SAFE test — trip-specific corroboration

Tiers over all 214: UNKNOWN 152, OPAQUE 41, PARTIAL 15, **SAFE 6**.

Within the 65 recorded-interval places: UNKNOWN 52, OPAQUE 6, PARTIAL 6, **SAFE 1**. The one SAFE
record is `JP-211` AnimeJapan 2027 (`"CONFIRMADO 2027"`) — which is also one of the three places
with **no numeric duration**, and whose hours string is the `"según anuncio"` hedge of §4.5.

The six SAFE `febMar2027` places in the whole dataset, with their hours fact kind:

```
JP-033 teamLab Borderless          ABIERTO CONFIRMADO   hours: unknown
JP-038 teamLab Planets TOKYO       ABIERTO CONFIRMADO   hours: unknown
JP-157 Shurijo Castle Park         ABIERTO CONFIRMADO   hours: unknown
JP-211 AnimeJapan 2027             CONFIRMADO 2027      hours: recorded-interval
JP-212 Grand Sumo Tournament       CONFIRMADO 2027      hours: conditional
JP-213 Tokyo Marathon 2027         CONFIRMADO 2027      hours: unknown
```

**The triple-SAFE intersection is empty.**

| Test | Result |
|---|---:|
| Places with SAFE hours **and** SAFE closure (all 214) | **31** (20 interval + 11 24 h) |
| …of those, also SAFE `febMar2027` | **0** |
| Places with SAFE `recorded-interval` **and** SAFE closure **and** SAFE `febMar2027` | **0** |

`febMar2027` tiers across those 31: UNKNOWN 23, PARTIAL 5, OPAQUE 3, SAFE 0. Across the 20
strongest interval places (§4.3 row 1): UNKNOWN 17, PARTIAL 2, OPAQUE 1, SAFE 0.

There is no place in this dataset about which Nihon holds SAFE evidence on all three temporal axes
at once. This is strong corroborating evidence against a trip-specific OPEN/VISITABLE confirmation
for February–March 2027. Because `febMar2027` is orthogonal, it is not a necessary precondition for
an ordinary recorded-hours statement, recorded interval arithmetic, or a confidence-preserving
product of independently true recorded facts.

### 4.7 Confounder representation inventory

Scanned with `normalizeText()` across `schedule.hours`, `schedule.closures` and `reservation.raw`
for all 214 places, then again restricted to the 65:

| Confounder | Field scanned | Mentions in 214 | Mentions within the 65 | Structured field? |
|---|---|---:|---:|---|
| Last admission / ticket-office close | `hours` | **1** (`JP-038`, hours UNKNOWN) | **0** | no |
| Capacity / `aforo` / `cupo` | all three | **0** | **0** | no |
| Queue / waiting time | all three | **0** | **0** | no |
| Public holidays | `closures` | **2** (`JP-018`, `JP-039`) | **1** (`JP-018`, OPAQUE) | no |
| Temporary works / `mantenimiento` / `montaje` | `closures` | 19 | 6 | no |
| Temporary works / `mantenimiento` / `montaje` | `hours` | 1 | 0 | no |
| Operator discretion (`según`, `verificar`, `variable`) | `closures` | 64 | **31 of 65** | no |

The `Structured field?` column must not be confused with corpus absence: several concepts are
present in raw prose but have no dedicated structure, while `febMar2027`, reservations and broader
provenance live on independent axes (§3.7).

`JP-038`'s single last-admission mention (`"Variable; última entrada 1 h antes"`) is instructive:
the one record in the dataset that states a last-admission rule classifies **UNKNOWN**, so it can
never reach interval arithmetic at all. The information exists in the corpus exactly where the
arithmetic cannot see it.

`JP-018` Kappabashi (`"Muchos domingos/festivos"`) is the only holiday mention inside the 65, and it
classifies `irregular-weekday-pattern` / OPAQUE. **Japan's ~16 national holidays and the widespread
Japanese museum convention of closing the following day are represented nowhere in this dataset**,
in any field, in any tier.

`reservation.required` is true for **4 of 65** (`JP-044`, `JP-112`, `JP-121`, `JP-211`) — and for
**0 of the 20** strongest places, which means the reservation axis contributes nothing to the one
group where a stronger claim might otherwise have been argued.

### 4.8 Reachability, and what stays ambiguous after a manual `HH:mm`

Enumerating every minute-granularity start strictly inside each recorded interval
(`open ≤ t < close`) through the shipped `evaluateRecordedIntervalFit()`:

- **62 of 62** evaluable places reach all three informative outcomes (`fits`, `only the minimum
  fits`, `exceeds`); the distinct-outcome-count distribution is `{3: 62}` with no place reaching
  fewer. **Verified match** with Phase 3D-K §4.7 against the shipped evaluator.

That confirms Phase 3D-L's arithmetic is informative. It says nothing about openness, and the
ambiguity ledger after a manual `HH:mm` is total:

| After a valid date + manual `HH:mm` + duration fit, what is still unresolved | Places |
|---|---:|
| Extraordinary closure on that specific date (no field exists) | **65 / 65** |
| Public holiday on that specific date (no calendar exists) | **65 / 65** |
| Whether the interval covers the whole site or a sub-facility | **7** explicitly hedged, unknowable for the other 58 |
| Whether `"aprox."` shifts the bound by minutes or hours | **58 / 65** |
| Last admission before the closing bound | **65 / 65** (0 records) |
| Capacity, queue, or admission refusal | **65 / 65** (0 records) |
| Trip-window (Feb–Mar 2027) confidence not SAFE | **64 / 65** |
| Closure evidence not even structured | **27 / 65** |

**Every one of the 65 remains ambiguous on at least four axes after the user supplies a manual
time.** The manual `HH:mm` resolves the one variable Phase 3D-I lacked; it resolves none of these.

### 4.9 Representative place ids for every meaningful class

| Class | n | Representatives |
|---|---:|---|
| **A** SAFE interval + numeric duration + SAFE closure | **20** | `JP-017`, `JP-024`, `JP-062`, `JP-065`, `JP-069`, `JP-072`, `JP-073`, `JP-075`, `JP-080`, `JP-086`, `JP-088`, `JP-098`, `JP-111`, `JP-119`, `JP-131`, `JP-134`, `JP-148`, `JP-158`, `JP-170`, `JP-175` |
| **B** SAFE interval + numeric duration + PARTIAL `candidate-weekday` | **17** | `JP-020` (`"Lunes; verificar"`), `JP-035` (`"Martes y montaje"`), `JP-093` (`"Miércoles; verificar"`) |
| **C** SAFE interval + numeric duration + OPAQUE closure | **16** | `JP-004` (`"Según comercio"`), `JP-018` (`"Muchos domingos/festivos"`), `JP-112` (`"Clima/mantenimiento"`) |
| **D** SAFE interval + numeric duration + UNKNOWN closure | **9** | `JP-058` (`"Variable"`), `JP-074` (`"Inicio de año; verificar"`), `JP-083` (`"Variable"`) |
| **E** SAFE interval, duration not evaluable | **3** | `JP-121`, `JP-147`, `JP-211` |
| **F** SAFE `recorded-24h` (no interval operands) | **15** | `JP-016` (hall `06:00–17:00` discarded), `JP-066`, `JP-144` |
| **G** PARTIAL interval-shaped, deliberately ineligible | **12** | `fixed-interval-with-caveat`, e.g. `"Variable por fecha; 09:00–17:00"` |
| **H** OPAQUE with a parseable-looking token | — | `JP-026` `"Según tienda, aprox. 11:00–20:00"` |

A + B + C + D + E = 65. Class A is the strongest group selected for attempting a **real-world
openness/visitability claim**, because it maximises the currently structured interval, duration and
ordinary-closure evidence. It is not the only relevant class for weaker record-level products:
classes B–D also support truthful classified or arithmetic facts, but those facts are already
shipped and combining them does not create a new proposition. §6 tests Class A at its stated scope.

---

## 5. Design question 1 — the three claim strengths, and where the evidence stops

The gate brief distinguishes three strengths. Restated precisely, with the verdict for each:

Before comparing their strength, keep six propositions separate:

| Proposition | Subject | Current status |
|---|---|---|
| Ordinary recorded-hours statement | the stored hours record | truthful when reported as recorded evidence |
| Recorded interval arithmetic | the parsed recorded interval and duration | shipped by Phase 3D-L |
| Composed recorded evidence | the conjunction/product of existing recorded facts and caveats | safely reachable without strengthening, but currently redundant |
| Trip-window confidence | Nihon's `febMar2027` understanding | orthogonal; can weaken a trip-specific presentation, not erase another fact |
| Real-world opening fact | the place on a civil date/time | unsupported under the current schedule contract |
| Visitability/admission | the user's ability to complete the visit | unsupported; requires opening plus admission-specific evidence |

### 5.1 A mathematical interval comparison — **already shipped, nothing to add**

*"The recorded duration fits inside the time remaining in the recorded interval after the start
time you chose."* Its truth conditions are entirely internal to one record plus one user input: it
is true iff `duration.maxMinutes ≤ intervalEndMinutes − chosenStartMinutes`, and nothing about the
world can falsify it. Evidence required: a `recorded-interval` fact, a parseable token, a numeric
duration, a valid assigned day, and a manual `HH:mm`.

**Verdict: supported, for 62 of 65 places, and Phase 3D-L already delivers exactly this.** This gate
adds nothing to it and proposes no rewording of it.

### 5.2 A "recorded-hours compatibility" statement — **refused as a rewording, not a strengthening**

*"Your visit is compatible with the recorded hours."* This sounds like a step up from §5.1 and is
not one: it has identical truth conditions and merely relocates the subject from the record to the
visit. That relocation is precisely what makes it unsafe — Phase 3D-K §14 already excluded
`compatible` by name from every variant, field and property, and Phase 3D-L pins the exclusion with
a source scan over every reachable outcome.

A compatibility statement would also inherit §4.5's hedging problem without acknowledging it: for
58 of 65 records the "recorded hours" are explicitly approximate, and for 7 they describe a
sub-facility or an announcement rather than the place.

**Verdict: refused.** It is not a stronger claim; it is the same claim with a more dangerous
subject, and the vocabulary is already forbidden.

### 5.3 A visitability / open claim — **refused; the evidence stops well short**

*"This place is open then"* or *"you can visit at that time."* Its truth conditions are external and
cumulative. Minimally required:

| Requirement | Available in Nihon today? |
|---|---|
| An authoritative statement of opening hours for the whole site | **Not established** — place/dataset-level editorial provenance exists, but no field-level source linkage or scope guarantee ties a particular schedule assertion to it (§3.7) |
| That statement being current for the visit date | **Not established** — `updatedAt` exists, but has no schedule-field re-verification semantics or future-date currency guarantee |
| Absence of a recurring closure on that weekday | **Partial at best** — 18 of 65 carry weekdays, all PARTIAL and all self-qualified in their own text |
| Absence of an extraordinary closure on that date | **No** — no field exists; 19 of 214 closure strings mention temporary works only in free text |
| Absence of a public holiday closure | **No** — no calendar; 2 incidental mentions in 214 |
| Last admission earlier than the closing bound | **No** — 1 mention in 214, on an UNKNOWN-hours place |
| Capacity / queue / admission refusal | **No** — 0 mentions in 214 |
| Reservation state, where required | **Partial** — `reservation.required` exists, but 0 of the 20 strongest places use it |
| Trip-window confidence for Feb–Mar 2027 | **No for a strong trip-specific confirmation** — 0 of 214 are triple-SAFE (§4.6); orthogonal and not required for record-level arithmetic |

The table deliberately mixes different failure shapes: some fields are structurally absent; some
concepts occur only in raw prose; provenance exists broadly but lacks schedule-field linkage and
currency semantics; and `febMar2027` is a represented, orthogonal confidence axis whose relevant
intersection is empty. None of those distinctions rescues a real-world claim, but calling them all
"absent" would overstate the audit.

**Verdict: refused, decisively.** The gap is not marginal and not closable by better arithmetic.

---

## 6. Design question 2 — can the strongest existing combination justify a stronger result?

**Tested directly on class A (§4.9): the 20 places with a SAFE recorded interval, a numeric
duration, a SAFE `no-known-closure` fact, a valid civil visit date, and a manual `HH:mm` that lands
strictly inside the interval, producing `recorded-duration-fits-interval`.**

This is the strongest class selected for a real-world openness/visitability attempt. It still fails
at that scope, on four independent grounds:

1. **The SAFE closure record excludes the claim in its own words.** All 20 read exactly
   `"Sin cierre ordinario"` — *no ordinary closure*. The adjective is the record's own scoping, and
   the dataset proves the distinction is real: `JP-019` is the identical sentence with `"; clima"`
   appended, and that demotes it to PARTIAL. A record that scopes itself to ordinary closures
   cannot support "not closed on 19 February 2027".
2. **The hours record is hedged for 19 of the 20.** `JP-080` (`"09:00–17:00"`) is the only bare
   token in class A; the other 19 carry `"aprox."`. This does not invalidate arithmetic over the
   parsed recorded token — Phase 3D-L truthfully computes that relation while preserving `raw`.
   It does prevent silently strengthening the numeric bound into an exact real-world opening or
   closing guarantee.
3. **Not one of the 20 has SAFE trip-window confidence** — 17 UNKNOWN, 2 PARTIAL, 1 OPAQUE (§4.6).
   For 17 of them Nihon's own `febMar2027` axis says, in the dataset's words,
   `"CALENDARIO / CONDICIÓN PENDIENTE"`: the calendar is not published yet. This blocks a strong
   trip-window confirmation; under the Phase 3D-G/H orthogonality rule it must not suppress an
   independently true record-level fact and may instead require a caveat in its own surface.
4. **The current evidence contract cannot establish the remaining requirements in §5.3.** Some are
   structurally absent, others exist only as raw prose or broader metadata without the field-level
   linkage and semantics needed for the claim.

**Answer at the tested scope: no real-world opening or visitability result.** A SAFE recorded
interval plus a valid visit date, manual start time, duration fit and closure evidence can be
truthfully carried together while the record remains the subject. But it cannot, with the present
contract, justify a real-world claim about the place. The weaker product is reachable and redundant;
the stronger claim remains unsupported.

---

## 7. Design question 3 — what happens at each closure-evidence tier

The answer is the same at every tier, which is itself the finding: **the fit result does not change,
because it never reads closure evidence at all.** Phase 3D-K §10 decided this and Phase 3D-L
enforces it structurally. This gate re-tests the decision and confirms it, tier by tier:

| Closure evidence | n (of 65) | What it licenses | Effect on the fit result |
|---|---:|---|---|
| **SAFE** `no-known-closure` | 20 | "no *ordinary* closure is recorded" — an absence statement about the record, scoped by its own adjective | **None.** Must not upgrade the result, must not add an openness qualifier, must not change styling |
| **PARTIAL** `candidate-weekday` | 18 | "a recurring weekday closure is recorded, and the record asks to be verified" | **None.** Phase 3D-B's notice already renders the match or non-match on its own; the fit result stays silent about it |
| **OPAQUE** `not-evaluable` | 17 | nothing structured; the closure depends on weather, an operator, or a specific event | **None.** Must not suppress or hide the fit result — suppression communicates by omission (§19) |
| **UNKNOWN** `not-evaluable` | 10 | nothing at all | **None.** Same as OPAQUE: the arithmetic is still true of the record |

The asymmetry makes "just gate on closure tier" a serious UX/product risk: showing the fit line
**only** where closure evidence is SAFE would show it for 20 of 65 places and hide it for 45. A
repeated selective pattern can plausibly teach a reader that absence carries clearance meaning.
That is sufficient to refuse this particular selective-display proposal without neutral framing or
user testing. It is not proof that omission is logically identical to an explicit positive claim,
nor that the underlying record-level arithmetic is impossible.

---

## 8. Design question 4 — absence of a matching recurring closure is **not** evidence of openness

**Answer: NO, and the current data contract proves it rather than merely failing to disprove it.**
The gate brief instructs us to assume NO unless the contract proves otherwise; here three
independent lines of evidence make it a positive finding.

1. **`assessWeekdayClosure`'s own contract says so, in the source.** `"no-weekday-match"` **"does
   NOT mean open, feasible, compatible, or 'no closure'"**; `"no-known-closure"` is **"still not a
   claim that the place is open on this date"**. Reading either as openness would contradict the
   module that produces it.
2. **`no-weekday-match` is the ordinary classifier result in a synthetic week, not openness
   evidence.** The denominator is a generated matrix: 18 candidate-weekday interval records × 7
   weekdays = **126 synthetic cells**, split **108 `no-weekday-match` / 18
   `possible-weekday-closure-match`**. These are not observed visits, independent records or user
   behaviour. The matrix demonstrates classifier asymmetry: `JP-020` (`"Lunes; verificar"`) matches
   Monday and not the other six weekdays. Any conclusion about how users interpret omission is a
   UX hypothesis, not an empirical result of these 126 cells.
3. **The SAFE absence statement scopes itself.** `"Sin cierre ordinario"` (§4.2, §6.1) excludes
   ordinary closures only. And even the strongest reading of it says nothing about the 19 of 214
   places whose free text mentions temporary works, the 2 that mention holidays, or the Japanese
   holiday calendar that appears nowhere.

**Rule for any future phase:** `no-weekday-match` states only that this recorded weekday candidate
did not match this civil date. No wording, variant name, icon, colour or layout may strengthen it
into "open" or "no closure". Selective omission based on it requires explicit neutral framing or
UX evidence because absence may plausibly acquire unintended meaning.

---

## 9. Design question 5 — `febMar2027` remains orthogonal to the current arithmetic

**Answer for the current products: orthogonal to the arithmetic, and it may compose only as a
separately identified caveat that does not change another component's truth conditions.**

`docs/TEMPORAL_DATA_CONTRACT.md` §5 fixes the axis: `febMar2027` answers *how confident is Nihon
about this place's Feb–Mar 2027 situation*, and **never** *is this place closed on Tuesdays*. It is a
trip-window confidence axis, not a schedule.

Two consequences, and they point in opposite directions — which is exactly why it must stay
orthogonal rather than being folded in:

- **It can never strengthen a result.** A SAFE `febMar2027` is not evidence about hours; only 6
  places have one, and the only interval place among them (`JP-211`) has no numeric duration and a
  `"según anuncio"` hedge. Folding it in as a promoter would be a fourth kind of confidence
  laundering.
- **It cannot strengthen or erase an independent fact.** A non-SAFE status prevents a strong
  trip-specific confirmation and may weaken presentation in the surface that owns this axis. It
  does not make recorded interval arithmetic false and must not suppress it. This preserves the
  Phase 3D-G/H orthogonality principle: a weak second axis carries a caveat without destroying an
  independently computable first-axis result.

**Presentation-time rule:** `PlaceDetail.tsx`'s existing Feb–Mar 2027 card (Phase 3D-F,
`feb-mar-status.ts`) continues to own the axis today. A future Level-2.5 product may explicitly
compose its status or caveat with another independently true recorded fact while keeping each
component and provenance boundary identifiable. It may not turn the pair into a combined
OPEN/VISITABLE verdict or use it to suppress arithmetic. `warning`/`action` remain 214/214 OPAQUE
prose that the current runtime never structurally parses.

---

## 10. Design question 6 — `bestTime` must remain completely excluded

**Answer: YES, completely excluded from feasibility, with no exception and no read.**

Phase 3D-A §3 classifies it as editorial recommendation, never an hours source. Phase 3D-K §15
falsified every plausible reading against real records, and this gate re-confirms the distribution
inside the 65: `Mañana` 45, `Tarde` 15, `Atardecer` 4, `Apertura` 1 — 45 places whose recommendation
is "morning" while their recorded intervals open anywhere from 06:00 to 10:30.

The single `Apertura` record inside the 65 deserves the same treatment: "opening" names a *preferred
moment relative to* the opening, which is a recommendation about crowds and light, not a clock value
and not a permission. Prefilling any start time from it — the most tempting misuse — would convert
an editorial preference into a decision the user never made, which Phase 3D-K §7 already refuses by
name.

**Rule:** no feasibility, fit, or hours surface may read `place.bestTime` for any purpose: not as an
operand, not as a default, not as a tiebreaker, not as a sort key, and not as a fallback when a
manual time is absent.

---

## 11. Design question 7 — `recorded-24h` has no bounded interval operand

**Answer for Phase 3D-L arithmetic: it stays excluded because there is no bounded closing
interval.** This is not a blanket claim that the fact can participate in no safe signal.

Phase 3D-K §11 refused it because there is no operand, because 3 of 15 records narrow themselves in
their own text, and because a 24 h span is not evidence about a visit. All three re-confirm here:
`JP-016` `"Recinto exterior 24 h; salón aprox. 06:00–17:00"`, `JP-066` `"Montaña 24 h; oficinas
diurnas"`, `JP-144` `"Sendero 24 h; salón diurno"`.

**The fourth reason is specific to this gate.** 11 of the 15 `recorded-24h` places also have a SAFE
closure fact (§4.6: 31 SAFE+SAFE = 20 interval + 11 24 h). That makes them, by tier arithmetic
alone, the most "confidently documented" group in the dataset — and all 15 have numeric durations,
so every one would produce a trivially successful fit. A feasibility model built on tiers rather
than on operands would rank Sensō-ji as its strongest positive result while discarding the
`06:00–17:00` hall interval its own record states. **The tier is not the evidence**, and this group
is the clearest proof.

**Rule:** remaining-minutes eligibility is narrowed on `.kind === "recorded-interval"`; `.tier ===
"safe"` is insufficient, and no `recorded-24h` record's `raw` may be re-scanned to invent a closing
bound. The same `recorded-24h` fact may already participate truthfully in Phase 3D-J's hours/closure
presentation composition. This gate identifies no new arithmetic or stronger opening signal for it.

---

## 12. Design question 8 — overnight intervals remain unsupported

**Answer: YES, they remain unsupported, and this gate strengthens the deferral from "no records" to
"no records and no way to interpret one if it appeared."**

Re-derived against the shipped parser: **0 of 65** tokens cross midnight, **0** are degenerate, and
the dataset opens no earlier than 06:00 and closes no later than 22:30. Phase 3D-K §12 already
enumerated what an overnight model would have to settle; this gate adds the reason it now matters
more, not less: an overnight interval spans two civil dates, so `assessWeekdayClosure` would have
one weekday for the start date and a different one for the end date, and **Phase 3D-B's contract
says nothing about which applies**. A feasibility claim over an overnight interval would therefore
have to invent a closure semantics that no document in this repository defines.

**Rule:** `crossesMidnight` stays a named refusal (`overnight-interval-not-supported`), `00:00` as
an end bound stays refused, and `00:00` as a start bound stays ordinary. Nothing here authorises
building the overnight model.

---

## 13. Design question 9 — holidays, irregular and temporary closures, last admission, capacity, queues, and operator discretion

**Answer: jointly and severally, they prevent a reliable open/closed or visitability judgment under
the present contract.** §4.7 is the measurement; this is what it means. The audit distinguishes
structurally absent fields from concepts present only in raw text and from independent axes.

- **Public holidays.** No calendar exists in the dataset, in any field. Two incidental free-text
  mentions in 214 records, one of them (`JP-018`) inside the 65 and classified OPAQUE. Japan has
  roughly sixteen national holidays, and the widespread museum convention of closing the following
  day is not represented anywhere. A February–March 2027 trip window contains national holidays;
  Nihon cannot name one.
- **Irregular closures.** 6 places classify `irregular-weekday-pattern` (OPAQUE) precisely because
  their text (`"Muchos domingos"`) resists a rule. The classifier's refusal is correct and is not
  something a downstream phase may undo.
- **Temporary closures.** 11 `temporary-specific-closure` records, and 19 of 214 closure strings
  mention temporary works, `"montaje"` or `"mantenimiento"` — 6 of those inside the 65, including
  `JP-035` and `JP-036`, which pair a real
  weekday with an installation caveat in the same sentence. There is no date range, no start, and no
  end: the record says a temporary closure exists, never when.
- **Last admission.** No dedicated field exists, but one raw mention exists in 214 (`JP-038`), on a
  place whose hours classify UNKNOWN. This
  is the sharpest single confounder for interval arithmetic: a place recorded `09:00–17:00` with a
  16:00 last admission makes a 16:30 start structurally impossible while the arithmetic reports 30
  minutes remaining. **Nihon cannot detect this for a single one of the 65 places.**
- **Capacity and queues.** Zero mentions in 214 records, across all three temporal text fields, and
  no field to hold them. Timed-entry, same-day tickets and queue length are precisely what decides
  admission at the busiest places in this dataset.
- **Operator discretion.** 31 of the 65 closure records — nearly half — contain `"según"`,
  `"verificar"` or `"variable"`. The dataset's own editorial voice defers the decision to the
  operator for half the eligible universe.

**Consequence.** Even a hypothetical place with a bare unhedged token, a SAFE closure, a SAFE
trip-window status and a numeric duration would still be unjudgeable, because the holiday,
last-admission and capacity semantics needed for that claim are not structurally available. Some
related concepts occur in raw prose, but cannot be consumed as complete dated rules. **No place in
this dataset has even that hypothetical starting point** (§4.6). This blocks the real-world claim;
it does not block a conjunction of record-level facts.

---

## 14. Design question 10 — could an explicit closed product express a safe recorded result?

**Answer: yes, it is type-theoretically and semantically reachable — but no new domain model is
justified now because its safe products are redundant.**

The union discipline itself is not in question and is not the constraint that fails. This codebase
has repeatedly shown that a closed union with no boolean, no `null`, no catch-all and named refusals
prevents an entire class of overclaiming, and Phase 3D-L's eight variants — every one named after
*the recorded interval* rather than the place — are the standing proof. Any continuation that says
it preserves this record-subject arithmetic contract would inherit that discipline unchanged: no
`open`, `available`, `feasible`, `visitable`, `works`, `compatible`, `valid` or `ok` as a variant, a
field, a property, or a boolean. A future claim with a stronger claim-specific evidence contract
would be a different product contract, governed by §28.2 rather than this inheritance rule.

But a type only constrains what a value may *say*; it cannot manufacture evidence for a stronger
claim. A closed product can trivially carry, without promotion:

- `RecordedIntervalDurationFit`;
- `WeekdayClosureAssessment` or the `ClosureFact` that produced it;
- `HoursClosureComposition`;
- every original `raw` value and caveat.

For example, "the recorded duration fits the recorded interval" + "this recorded weekday candidate
does/does not match" + "no ordinary closure is recorded" is constructible and truthful while the
**record** remains the subject. This is **juxtaposition/presentation composition**: a conjunction or
product of independently true facts. Phase 3D-I/J explicitly permits it. It is not a solver.

**Composition**, in the stronger sense relevant to a new domain feature, would derive a genuinely
new proposition from several inputs. The reachable product above does not: interval fit is already
3D-L, weekday candidate match/non-match and ordinary-closure wording are already 3D-B, and the
confidence-preserving hours/closure presentation is already 3D-J. Wrapping them creates no new
semantic fact.

Candidate *stronger* variants remain unsupported:

| Candidate variant | Evidence it would require | Status |
|---|---|---|
| `recorded-hours-permit-this-visit` | authoritative/current schedule evidence with relevant scope | unsupported — no schedule-field provenance/currency or completeness guarantee (§3.7) |
| `no-recorded-closure-on-this-date` | complete closure coverage incl. holidays and one-offs | unreachable — no holiday calendar, no temporary-closure dates (§13) |
| `visit-window-confirmed-for-trip` | SAFE `febMar2027` alongside the rest | unreachable — triple-SAFE intersection empty (§4.6) |
| `all-recorded-evidence-consistent` as a new world-facing fact | defined semantics stronger than the inputs | unsupported — a product is reachable, but no non-redundant proposition is identified |

**Therefore: a closed union/product is possible but not presently valuable as a new feature.** The
safe variants are redundant combinations or presentation products of shipped signals; the variants
that would assert OPEN/VISITABLE lack the required evidence. The rejection rests on semantic/product
novelty, not on a false claim that every post-3D-L value is unreachable.

---

## 15. Design question 11 — constraints on a continuation of the current arithmetic contract

Recorded so the Phase 3D-L boundary survives this decision. **These are conditions on a follow-up
that explicitly preserves Phase 3D-L's current evidence model and arithmetic surface; that phase is
not approved, and this is not a specification for one.** Within such a contract-preserving
continuation, all six hold and none is negotiable. They do not govern every claim-specific future
revisit under §28.2:

1. **Informational only.** No action, no gating, no blocking, no disabling of any control, no
   validation error, and no effect on saving, ordering, or day assignment.
2. **Based solely on a manual user time.** No default, no inference from `bestTime`, opening bound,
   route order, transfers, duration, reservations, closures, another place, or the current clock.
   An empty value stays an explicit "no time chosen" state.
3. **Non-optimizing.** No best time, no ranking, no scoring, no "tightest fit", no slack
   maximisation, no comparison between places or between days.
4. **Non-recommending.** No suggestion to arrive earlier, no "consider visiting on another day", no
   nudge of any kind. Phase 3C-A through 3C-C established that Nihon does not choose on the user's
   behalf.
5. **Non-rescheduling.** No automatic move between day buckets, no reordering, no derived arrival or
   departure time, no chaining between places, and no interaction with `getBestTransfer()`.
6. **No new evidence class within that continuation.** No network request, no `Date.now()`, no
   "now", no timezone, no absolute instant and no holiday table. Nihon already consumes externally
   sourced editorial research; Phase 3D-L and a continuation preserving its contract do not add
   runtime/live verification or a stronger curated static schedule-field provenance/currency
   contract.

§28.2 separately governs stronger future propositions. A claim may legitimately require
live/runtime verification, a stronger curated static contract, or both; choosing one would make it
a different evidence/product contract, not weaken or retroactively change Phase 3D-L. Nothing here
selects, schedules or approves such an implementation.

---

## 16. Design question 12 — the exact boundaries between the levels

The distinction this whole gate turns on, including the confidence-preserving intermediate level
that reconciles it with Phase 3D-I/J.

**Level 1 — Recorded evidence.** The raw editorial strings (`schedule.hours`, `schedule.closures`,
`duration.raw`, `bestTime`, `febMar2027.status`), preserved verbatim per Phase 3D-A contract rule 1,
plus the classified facts derived from them (`RecordedHoursFact`, `ClosureFact`, `FebMarStatusFact`).
A fact answers *what kind of information is recorded for this place*. It never answers *what is true
of this place*. `intervalRaw` is level 1: it is the matched token, carried alongside `raw`, never
instead of it.

**Level 2 — Arithmetic derived from recorded evidence.** Phase 3D-L's comparison of a duration
against the minutes remaining in a parsed token after a user-chosen start. Its subject is the
record; its truth conditions are internal; nothing in the world can falsify it. Level 2 is a
*restatement* of level 1 in numbers, and its value is exactly the value of the record it restates —
which for 58 of 65 places is explicitly approximate.

**Level 2.5 — Composed recorded evidence / confidence-preserving composition.** A closed product or
presentation carrying the level-2 interval-fit result, a candidate weekday-closure assessment or
"no ordinary closure recorded", and every raw caveat together. Its subject remains the records.
The output semantics are exactly the conjunction/product of its components: no component is
strengthened and no OPEN/CLOSED/VISITABLE proposition appears. This level is reachable and is the
kind of composition Phase 3D-I/J permits; today its useful facts are already shipped separately.

**Level 3 — A genuine opening-hours fact.** An assertion that a named place admits visitors between
two clock times on a named civil date. It requires what levels 1 and 2 do not contain: an
authoritative/current schedule contract, relevant scope and coverage for the date in question.
Nihon has broader dataset/place provenance, but no schedule-field source/verification linkage,
refresh guarantee or completeness semantics sufficient for this claim.

**Level 4 — A visitability claim.** An assertion that a specific user can complete a specific visit.
It requires level 3 **plus** closure completeness, a holiday calendar, last admission, capacity,
queue, reservation state, and reachability by the chosen time.

**The crossing rules, which are the operative output of this section:**

- **1 → 2 is permitted, under a gate.** Phase 3D-K gated it and Phase 3D-L built it. The crossing is
  legitimate only because the *subject stays the record*.
- **1/2 → 2.5 is permitted when confidence is preserved.** A weak or pending orthogonal axis may
  require a caveat, but cannot suppress an independently computable fact. The product must add no
  semantics beyond the components.
- **2.5 → 3 is the forbidden leap under the current contract.** A stronger authoritative/current
  schedule contract is required. Field-level provenance and currency are necessary ingredients,
  not a magic bridge: they remain insufficient without extraordinary-closure, holiday,
  last-admission, relevant-scope and admission semantics appropriate to the proposed claim.
- **3 → 4 is out of scope for a static dataset**, and would remain so even if level 3 were somehow
  achieved.
- **Wording follows the level, not the confidence.** A level-2 result must be phrased about the
  record («el intervalo registrado») and never about the place («el lugar»). This is why §21's
  constraints are stated as grammar rather than as tone.

---

## 17. Eligibility rules

**No new eligibility rule is defined by this phase, because no new computation is authorised.** What
follows is the eligibility contract for the existing Phase 3D-L arithmetic surface. A successor
inherits it verbatim only if it explicitly claims to preserve that same arithmetic contract.

1. **Union narrowing, never tier.** Only `fact.kind === "recorded-interval"` may enter interval
   arithmetic. `tier === "safe"` is never the test — it admits `recorded-24h` (§11), and 11 of those
   15 also hold SAFE closure facts, making them the highest-tier group in the dataset with no
   operands at all.
2. **Classification first, arithmetic second.** An excluded fact's `raw` text is never re-scanned for
   a usable interval. `JP-026` `"Según tienda, aprox. 11:00–20:00"` (OPAQUE) and the 12
   `fixed-interval-with-caveat` PARTIAL records stay excluded despite carrying parseable tokens —
   a PARTIAL fact must never be promoted by a second parser.
3. **Record-level refusals precede user-input refusals.** A place whose duration or token can never
   be evaluated says so before asking for a time (`JP-121`, `JP-147`, `JP-211`).
4. **The date gate is Phase 3D-H/3D-J's, reused unchanged** via `deriveHoursClosureVisitDate`: valid
   partition, valid `startDate`, exactly one containing bucket, valid derived civil date, no partial
   fallback. No second date contract may be invented.
5. **Closure evidence is never an eligibility input for this arithmetic surface** (§7, §19). Not as
   a gate, not as a filter, not as a sort key, and not as a reason to hide its control.
6. **Overnight and degenerate tokens are named refusals, not exclusions** (§12).

A future proposition with different truth conditions may legitimately read or compose closure or
`febMar2027` evidence. That does not alter the arithmetic result, and reading those inputs does not
by itself license an OPEN/CLOSED/FEASIBLE/VISITABLE inference.

---

## 18. Failure and unknown states

The standing contract, unchanged and reaffirmed: every refusal is **named and visible**, never a
silent skip, never a `null` that the view renders as blank, and never a fallback to a weaker true
statement that reads as a stronger one.

Phase 3D-L's eight-variant union already covers every failure this gate examined:
`visit-date-not-evaluable`; `interval-not-evaluable` with reasons `hours-not-a-recorded-interval`,
`interval-token-unparseable`, `overnight-interval-not-supported`; `duration-not-evaluable`;
`no-start-time-chosen`; `start-time-outside-recorded-interval`; and the three informative outcomes.

**This gate adds no state, and specifically refuses to add the two that a feasibility model would
want:**

- **No `unknown-openness` / `cannot-determine-if-open` state.** It would imply the question is one
  Nihon is in the business of answering and merely lacks data for today, which would make its
  eventual absence read as a positive answer. Nihon does not answer that question at all.
- **No `insufficient-evidence-for-a-stronger-claim` state.** Same failure, one level of indirection
  further: a per-place badge saying "we cannot say more here" invites the inference that elsewhere
  Nihon *can*, which is false for all 214 places.

---

## 19. Composition rules

These rules preserve the existing arithmetic while leaving room for a differently specified
record-subject product.

**Rule 1 — The current arithmetic derives from its own operands only.** Its truth value reads no
`ClosureFact`, `WeekdayClosureAssessment`, `CompositionClass`, `febMar2027`, `bestTime`, reservation
field or transfer edge. This preserves Phase 3D-L. The resulting fact may nevertheless be carried
beside other recorded facts in a Level-2.5 product without changing its truth conditions.

**Rule 2 — Juxtaposition/presentation composition is allowed; semantic strengthening is not.** Phase 3D-J's
`HoursClosureCompositionNotice` and Phase 3D-B's `WeekdayClosureNotice` render alongside the fit
line. A closed wrapper may truthfully carry all of those existing facts and raw caveats together
while its semantics remain exactly their conjunction. It may not derive or present a new
OPEN/CLOSED/AVAILABLE/VISITABLE verdict from them.

**Rule 3 — Selective omission is a UX/product risk.** Showing the fit line only where closure
evidence is SAFE would show it for 20 of 65 and hide it for 45. The pattern can plausibly teach
users that absence carries meaning, so this specific proposal is refused absent user testing or
explicit neutral framing. Omission is not declared logically equivalent to an explicit claim, and
the classifier matrix is not UX evidence.

**Rule 4 — `febMar2027` remains orthogonal** (§9). It cannot promote a result, and a weak status
cannot suppress independently valid arithmetic. It may contribute a separately owned caveat or a
confidence-preserving presentation, never an OPEN/VISITABLE verdict.

**Rule 5 — A weakening cross-reference still needs neutral semantics.** The proposal in §26.2 is
refused because selectively showing it creates a plausible inverse-reading risk. That is a product
judgment about this presentation, not proof that the underlying recorded facts cannot compose.

---

## 20. Proposed closed domain model — reachable, evaluated, and **not justified now**

A Level-2.5 closed product is type-theoretically and semantically reachable. It could carry a
`RecordedIntervalDurationFit`, the existing weekday/closure facts and every raw caveat without
asserting that the place is open or visitable. That possibility is not an authorised design, and
no implementation is approved.

The product is refused **now** for lack of semantic novelty:

1. Its interval component is exactly the Phase 3D-L result.
2. `no-known-closure` and candidate weekday match/non-match are already Phase 3D-B information;
   Phase 3D-J already owns hours/closure presentation.
3. Carrying these facts in one wrapper is truthful juxtaposition, but creates no new proposition.
4. Any variant that crosses from that conjunction to OPEN/CLOSED/VISITABLE remains unsupported by
   the evidence and contracts in §5/§13/§16.
5. An "evidence incomplete" badge remains a separate UX proposal with the selective-absence risk
   described in §18/§19; it is not a type-theoretic impossibility.

**What stands instead:** the existing independently owned signals, unchanged. No new type is
proposed because no new, non-redundant safe proposition has been identified — not because every
conceivable composition is unreachable.

---

## 21. UI wording constraints

No UI is authorised by this phase. These constraints bind the existing Phase 3D-L surface — which
must not drift — and any successor that explicitly preserves the same record-subject arithmetic
contract.

**Forbidden within that contract, in any language, on its feasibility, fit, or hours surface:**
«abierto», «cerrado», «disponible», «visitable», «factible», «funciona», «compatible», «válido»,
«confirmado», «garantizado», «puedes visitar», «podrás entrar», «es posible visitar», «te da
tiempo», «llegas a tiempo», and every English equivalent (`open`, `closed`, `available`,
`feasible`, `visitable`, `works`, `compatible`, `valid`, `confirmed`, `guaranteed`). The word
«confirmado» is forbidden even where `febMar2027.status` literally contains `"ABIERTO CONFIRMADO"`
— that string is the dataset's own editorial voice on its own axis, and it may be shown as recorded
text in its own card, never borrowed into an hours sentence.

**Required, and these are grammatical requirements rather than tone preferences:**

1. **The subject is the record, never the place.** «La duración registrada cabe en el intervalo
   registrado» — never «el lugar está abierto», and never «tu visita cabe» (which relocates the
   subject to the visit; §5.2).
2. **«registrado» appears in every evaluated sentence.** It is the word that keeps the subject
   attached to the record.
3. **The original recorded text is always shown beside the result** — `Dato: «10:00–17:00 aprox.»`.
   The parsed token is derivative evidence, and 61 of 65 records carry editorial hedging that the
   token silently drops (§4.5). This is the single constraint the data forces most directly.
4. **No sentence may combine an hours statement with a closure statement.** Two facts, two
   sentences, two surfaces (§19 rule 2).
5. **No temporal urgency.** No «hoy», «ahora», «quedan», «todavía», countdown or deadline framing —
   there is no current time anywhere in this product.
6. **A refusal states what is missing about the record, never about the place.** «No hay intervalo
   registrado evaluable», never «no sabemos si abre».

A different future proposition needs wording derived from its exact truth conditions, legitimate
inputs, provenance/currency limits and non-claims. Level 2.5 remains record-subject and may not use
OPEN/CLOSED/FEASIBLE/VISITABLE wording; a stronger claim may use only the vocabulary its own
claim-specific evidence contract actually supports. No such UI is approved here.

---

## 22. Styling constraints

These constraints apply to the current arithmetic surface and to a successor that explicitly
preserves its contract:

1. **One neutral treatment for all outcomes.** No per-outcome class name, no green check, no red
   cross, no warning triangle, no success/error/danger badge, no colour that encodes approval or
   rejection. Phase 3D-L verified in-browser that every result line computes to the same colour on
   the same background; that property must be preserved.
2. **Do not reuse Phase 3D-J's composed-notice styling for the arithmetic result itself.** Borrowing
   it there would make that result look like it carries closure evidence — the visual form of the
   §19 rule 1 violation. A distinct Level-2.5 product could deliberately carry closure and seasonal
   caveats and choose styling derived from that exact proposition; it would need to keep the
   arithmetic component's truth conditions and the caveats visually unambiguous. No such product or
   styling is approved here.
3. **No ordering, grouping, sorting, or emphasis by outcome.** A day card must not float "fitting"
   places to the top, tint them, or collapse the others: layout is a claim (§19 rule 3).
4. **No iconography for evidence strength.** No tier badges, no confidence meters, no traffic
   lights, no progress bars toward "verified" — a completeness indicator is the §18 refused state
   rendered as a picture.
5. **The raw recorded text is never styled as secondary to the derived result.** It is the evidence;
   the result is the derivative.

---

## 23. Persistence decision

**Decision: no persistence change of any kind. `ManualPlanningDraftV3` stays exactly as Phase 3D-L
shipped it, and `PLANNING_DRAFT_VERSION` stays at 3.**

`planning-draft.ts` persists **user decisions**, never derived results — the rule Phase 3D-K §17
stated and Phase 3D-L pinned with a test asserting the serialised draft contains exactly its five
schema keys and no parsed minutes, parsed interval, resolved duration, comparison result, derived
visit date, or formatted sentence.

This gate authorises no new user decision, so there is nothing to persist. Specifically refused:
storing a fit result or any feasibility verdict (derived, and it would go stale against a dataset
update while the draft claims otherwise); storing an evidence-completeness score (derived, and it is
§18's refused state given a durable home); storing a per-place "I verified this myself" flag (a real
user decision, but one that would license exactly the openness claim this gate refuses, now
laundered through the user); and a V4 migration, which has nothing to migrate.

---

## 24. Test strategy for a possible implementation

Recorded for completeness, and because a future reader must be able to see what *would* have been
required to preserve the current product. **No implementation is approved, so none of this is
scheduled.** A continuation that says it preserves the Phase 3D-L arithmetic surface would need, at
minimum:

1. **Reachability tests over the real dataset, re-derived rather than pasted** — the discipline
   Phase 3D-K and 3D-L established: counts computed from the live classifiers inside the test, never
   hardcoded into behaviour.
2. **A forbidden-vocabulary source scan**, comment-stripped, over every new runtime and every
   reachable serialised outcome, covering the full §21 list in both languages.
3. **An isolation test proving the new module reads no closure, `febMar2027`, `bestTime`,
   reservation, transfer, `Date` or timezone symbol** — the import-surface assertion Phase 3D-L
   already uses for `deriveHoursClosureVisitDate` (a test asserts it is the sole symbol imported
   from that module).
4. **An omission test**: for every place in the eligible universe, the presence or absence of the
   surface must depend only on inputs the surface actually uses — the executable form of §19 rule 3.
5. **Adversarial eligibility tests** pinning that `recorded-24h` (all 15), `fixed-interval-with-caveat`
   (all 12), and `JP-026`'s OPAQUE parseable token never reach arithmetic, and that no excluded
   fact's `raw` is re-scanned.
6. **A styling parity test** asserting one computed treatment across all outcomes.
7. **A `recorded-hours.ts` immutability check** — byte-identical to its pre-phase state, as Phase
   3D-L asserted.
8. **Migration and staleness tests** only if persistence were ever justified, which §23 says it is
   not.

This list is not the universal test contract for every implementation considered under §28.2. A
different future proposition needs tests derived from the exact proposition it emits, the inputs it
legitimately needs, its semantic invariants, its provenance/currency limits and its explicit
non-claims. Such tests may permit reading or composing closures or `febMar2027`; that permission
does not itself establish OPEN/CLOSED/FEASIBLE/VISITABLE. A Level-2.5 implementation must remain
record-subject, preserve the semantics of every component, avoid real-world openness/visitability
inference, and have provenance/currency sufficient for the precise claim it makes.

---

## 25. Explicit non-goals

Nothing below is started, designed, scheduled, or implied by this phase. These are non-goals of the
current Phase 3D-M decision, not permanent prohibitions on a claim-specific future design:

- Any opening-hours solver, feasibility engine, or open/closed judgment about any place.
- Any composition that strengthens an hours fact, closure fact, `febMar2027` status, `bestTime` or
  reservation field into OPEN/CLOSED/AVAILABLE/VISITABLE. Confidence-preserving juxtaposition of
  independently true recorded facts remains permitted by Phase 3D-I/J.
- `Date.now()`, "now", the current clock, urgency, countdowns, or deadline framing.
- Timezones, IANA zones, absolute instants, DST handling, or epoch values.
- Holiday calendars, special calendars, observance rules, or "closed the day after a holiday" logic.
- Live or temporary verification against any source in this phase — zero network requests, and no
  use of `place.officialUrl` beyond the existing link. §28.2 records when a different future claim
  could require a new evidence decision.
- Last-admission, capacity, queue, timed-entry, or admission-refusal modelling.
- Overnight interval support, `recorded-24h` arithmetic, or promotion of any PARTIAL/OPAQUE/UNKNOWN
  fact by a second parser.
- Derived arrival or departure times, chaining between places, transport interaction, or any use of
  `getBestTransfer()` in a temporal claim.
- Automatic itinerary generation, route optimisation, day-quality scoring, rescheduling, hotel-origin
  modelling, or live transit.
- Any dataset, workbook, `seasonal-alerts.json`, schema, `package.json`, lockfile, or dependency
  change.

---

## 26. Alternatives evaluated and refused

Three proposals that are strictly weaker than a solver were worked individually. They are not all
domain impossibilities: the latter two can carry truthful record-level facts. They are refused as
current product features because they add no non-redundant proposition and/or create an untested
selective-presentation risk.

### 26.1 A "recorded evidence completeness" disclosure

*Show, per eligible place, which axes have SAFE evidence and which do not.* **Refused.** It is §18's
`insufficient-evidence-for-a-stronger-claim` state rendered as a widget: a per-place completeness
display implies a scale whose top end means "we can tell you it is open", and **no place in the
dataset reaches that top end** (§4.6). It would teach users to read three green marks as permission
while the intersection that would produce three green marks is empty.

### 26.2 A weakening cross-reference between the closure notice and the fit line

*When `assessWeekdayClosure` returns `possible-weekday-closure-match` for the visit date, annotate
the fit line: "this comparison may not apply".* **Refused**, and this is the most interesting of the
three, because the direction really is conservative — it only ever reduces confidence.

The concern is §19 rule 3. If the annotation appears on match and is absent otherwise, its absence
may plausibly be read as clearance. §8's **108 of 126** figure describes a synthetic classifier
matrix, not observed UX behaviour, so it cannot prove that users make that inference. The risk is
still sufficient to refuse this selective presentation absent neutral framing or user testing —
especially because Phase 3D-J already renders the candidate match separately beside the fit line.

### 26.3 Restricting the existing fit line to `jointly-presentable` places

*Only show Phase 3D-L's result where both axes are SAFE, i.e. the 20 class-A places.* **Refused**,
and it would be a regression of shipped behaviour rather than an addition. Phase 3D-K §10 already
refused it as a design; the measurement holds — it would hide the line for 45 of 65 places, and the
pattern would read as "we only tell you this where it is safe to go". It also misreads the
composition class, which is a *display* decision computed from tiers alone (§3.4), as an *evidence*
decision. This is a product/UX rejection of selective display, not a denial that the underlying
record-level facts can be composed truthfully.

---

## 27. Unresolved risks

Recorded rather than resolved, because a future reader needs them and this phase changes no code:

1. **`JP-211` `"09:00–17:00 según anuncio"` still classifies SAFE.** `"anuncio"` is absent from the
   third-party regex word list. Phase 3D-K recorded it; it remains. The SAFE interval universe is
   therefore not free of source hedging, and any successor that preserves the current SAFE
   eligibility/classifier contract inherits that. **Not fixed here — this phase is not authorised
   to edit data or the classifier.**
2. **`JP-016`'s recorded `06:00–17:00` hall interval is discarded** by the `known-24h` priority
   branch. Recorded by Phase 3D-K; unchanged. §11 shows why it matters more once tiers are used as
   evidence.
3. **`JP-038`'s last-admission rule is invisible to arithmetic** because its hours classify UNKNOWN
   (§4.7). The one record that states the confounder is the one record that cannot reach the
   computation, so no incorrect fit is produced today. Existing tests contain no regression
   specifically protecting a last-admission-bearing record from future promotion to an apparently
   clean fixed interval. This is **existing feature-hardening debt / a future correctness protection
   gap**, not a current runtime correctness defect; this documentation-only PR does not add a test.
4. **`"aprox."` has no defined magnitude.** 58 of 65 records are approximate, and nothing states
   whether that means five minutes or an hour. It does not invalidate arithmetic over the parsed
   recorded token; it blocks treating the resulting numeric boundary as an exact real-world
   opening/closing guarantee. Phase 3D-L already preserves `raw`, so this uncertainty must not be
   counted a second time against the mathematical proposition.
5. **The composition class is a display decision that reads like an evidence decision.** Its name
   (`jointly-presentable`) is honest, but a future reader may reach for it as a gate. §7, §19 and
   §26.3 exist to make that harder.
6. **`docs/DATA_MODEL.md` still does not mention Phase 3D-G, 3D-H, 3D-I, 3D-J, 3D-K or 3D-L.**
   Recorded by Phase 3D-I and again by Phase 3D-K; recorded again here so it is not lost, and again
   not fixed — it is unrelated to the question this gate decides.

---

## 28. Executive conclusion and recommendation

### 28.1 Recommendation: **DO NOT IMPLEMENT**

The corrected product decision is claim-specific:

- **A. No full opening-hours solver with the current evidence: PROVEN.**
- **B. No reliable real-world open/closed judgment: PROVEN.**
- **C. No reliable visitability/admission judgment: PROVEN.**
- **D. No possible additional composed recorded-evidence signal: NOT PROVEN.** Level 2.5 products
  are reachable when they preserve every component and keep the record as subject.
- **E. No justified NEW composed recorded-evidence feature right now: SUPPORTED.** The safe
  reachable products repeat Phase 3D-B weekday/ordinary-closure facts, Phase 3D-J presentation and
  Phase 3D-L arithmetic rather than deriving a new proposition.
- **F. No future work whatsoever on this temporal axis: NOT PROVEN.** A future revisit can be valid
  if data semantics improve, a new non-redundant record-level proposition is identified, or product
  scope changes.

The measured triple-SAFE result remains strong corroboration against a trip-specific OPEN/VISITABLE
claim. Class A remains the strongest subset for testing that stronger claim. Broader provenance and
raw-text confounders are stated at their actual scopes, and §14 recognises safe composition as
reachable but redundant.

**This phase therefore recommends no immediate successor.** The reason is that no new,
non-redundant safe proposition has been identified under current data/contracts — not that every
conceivable successor signal is logically impossible.

### 28.2 Claim-specific conditions for a future revisit

Not a plan, schedule or recommendation. These are not five universal prerequisites for every
record-level question; their necessity depends on the proposed claim:

1. **Schedule-field source plus a meaningful verification date.** Strictly necessary for a strong
   authoritative/current opening-hours claim and insufficient by itself. Not required for arithmetic
   explicitly scoped to a parsed recorded token.
2. **Structured extraordinary-closure coverage.** Necessary for a strong "not closed on this date"
   claim and insufficient by itself. Not required to state which ordinary closure text is recorded.
3. **A last-admission field.** Necessary for admission/visitability claims where last admission may
   precede closing and insufficient by itself. Not universally required for a recorded-hours
   statement.
4. **Scope resolution and semantics for `"aprox."`.** Important for claims that include ambiguous
   records or demand exact real-world bounds. Not universally necessary if future eligibility
   explicitly excludes those records. `"aprox."` does not invalidate arithmetic over the parsed
   recorded token.
5. **Product/evidence decision.** Nihon already contains externally sourced editorial research.
   A genuinely different decision would introduce live/runtime verification, a stronger curated
   static contract with field-level provenance/currency and refresh guarantees, or both. It is
   necessary only when the proposed future claim depends on that stronger evidence class.

These claim-specific gates take precedence over §15's narrower inheritance rules whenever a future
proposal does not preserve the current Phase 3D-L evidence model and arithmetic surface.

Accordingly: reopening a real-world OPEN claim needs items 1 and 2 plus claim-relevant scope/
currentness coverage; visitability may additionally require item 3 and admission constraints;
weaker record-level arithmetic needs none of them merely to remain truthful; and a new Level-2.5
feature first needs a non-redundant proposition, even if no stronger data contract is required.

### 28.3 What stands after this gate

- Phase 3D-B's weekday closure notice: unchanged.
- Phase 3D-E's recorded-hours summary: unchanged.
- Phase 3D-J's hours/closure composition notice: unchanged.
- Phase 3D-L's manual visit-start-time fit: unchanged; it remains the current arithmetic result, not
  an absolute ceiling against every future data/product contract.
- `docs/TEMPORAL_DATA_CONTRACT.md`'s boundaries: unchanged and reconfirmed against live data.

---

## 29. What this phase changed

This document and one `docs/ROADMAP.md` entry. Nothing else.

No `.ts`, `.tsx` or `.css` file was added or modified. No test was added or modified. No
`data/places.json`, `app/src/data/places.json`, source workbook, `seasonal-alerts.json`,
`package.json` or lockfile was touched. No dependency was added. No schema, no persistence version,
and no planning-draft shape was changed. No prior design document was rewritten — Phase 3D-I's,
3D-K's and Phase 3D-A's contracts are cited here, never edited. The three audit harnesses used to
re-derive §4 were deleted before commit, so this phase's diff contains no TypeScript at all.

---

## 30. Independent hostile corrective review

The corrective review found four **MAJOR reasoning-scope defects**: (1) provenance/currency was
overstated as absent; (2) triple-SAFE was used beyond `febMar2027`'s orthogonal scope; (3) closed-
union reachability was confused with semantic/product novelty; and (4) five reopening conditions
were overclaimed as universally necessary.

**Changed:** the rationale is narrower; dataset/place-level editorial provenance is acknowledged
while the schedule-field contract gap is stated precisely; composed recorded-evidence products are
recognised as possible but currently redundant; and future reopening gates are claim-specific.

**Unchanged:** no full solver, no real-world open/closed judgment, no visitability/admission
judgment, no implementation, and no immediate successor recommendation. Phase 3D-N was not started.

A second corrective read found two residual **MAJOR scope contradictions**. First, §15's six
constraints were phrased as if they governed every §28.2 revisit, including claims whose own gate
could require live/runtime verification or a stronger static contract. Second, §§17/21/22/24
universalised the current arithmetic surface's input isolation, wording, styling and test contracts
to every future proposition. Those rules now bind Phase 3D-L and only successors that explicitly
preserve its contract; a different proposition is governed by its exact claim, legitimate inputs,
semantic invariants, provenance/currency limits and non-claims. The four original MAJOR findings are
therefore finally resolved after this second corrective pass, without authorising any future
implementation.

Corrective validation: 950 Vitest tests across 27 files, 82 temporal-audit tests, oxlint, TypeScript,
production build, dataset/geography/logistics validators and `git diff --check` all pass. The
corrective diff remains limited to this document and `docs/ROADMAP.md`.
