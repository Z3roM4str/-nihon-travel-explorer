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
the existing hours/closure composition — is strong enough to support any claim beyond the one
Phase 3D-L already makes: *the recorded duration fits inside the recorded interval*.

The three findings that close the question, each re-derived for this gate (§4):

1. **Zero places in the dataset carry SAFE evidence on all three temporal axes.** Of 214 places,
   31 have both SAFE hours and a SAFE closure fact; **0** of those 31 also have a SAFE
   `febMar2027` status, and **0** of the 65 SAFE recorded-interval places do. The strongest
   combination that actually exists in the data is *SAFE interval + SAFE closure + UNKNOWN
   trip-window confidence* (17 places), which is not a foundation for an openness claim.
2. **The dataset's own strongest closure phrase excludes the claim in its own words.** All 20
   SAFE-closure records inside the 65 read exactly `"Sin cierre ordinario"` — "no *ordinary*
   closure". A record that scopes itself to ordinary closures cannot be read as evidence that no
   extraordinary closure applies on a given date.
3. **The confounders that would decide an open/closed judgment are not merely weak in the dataset —
   they are structurally absent.** `place.schedule` has exactly two keys, `hours` and `closures`.
   There is no last-admission field (1 free-text mention in 214, on a place whose hours are
   UNKNOWN), no capacity field (0 mentions), no queue field (0 mentions), no holiday calendar
   (2 incidental mentions in 214, both OPAQUE), and no per-record verification provenance at all —
   all 214 records share a single `updatedAt` of `2026-09-01`, an export stamp rather than a
   verification date.

This is **not** a "collect more data and revisit" hold. The missing element between what Nihon has
and an opening-hours fact is *provenance and currency* — an authoritative, dated, source-attributed
statement about a named place — which is a live-verification class of input this product has
deliberately excluded since Phase 3D-A. §28.2 states the precise, narrow condition under which a
future phase could re-open the question, and it is a change of source, not a change of volume.

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

**Answered here:** no. §5 separates the three claim strengths and shows exactly where the evidence
stops; §6 tests the strongest combination that exists in the data and it still fails; §7–§13 work
each required sub-question; §14 tests whether a closed union could rescue the result and concludes
it cannot, because the problem is the evidence, not the type.

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

### 3.7 What no module in the repository does today, and what the schema cannot express

Read directly from the data, not from documentation: `place.schedule` has exactly **two** keys,
`hours` and `closures`. There is no `lastAdmission`, no `capacity`, no `holidays`, no
`temporaryClosures`, no `verifiedAt`, and no `source` on the schedule object. `place.updatedAt` is
identical for all 214 records (`2026-09-01`) — an export stamp, not a per-record verification date.
`place.officialUrl` is populated for all 214, which is exactly where a human can verify hours and
exactly what this application may not fetch (zero network requests, every phase since 3D-A).

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
PARTIAL tier is what keeps that honest, and it is a concrete reason a `candidate-weekday` fact can
be wrong in the closure-*exists* direction too — not only in the direction §8 addresses.

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

### 4.6 `febMar2027` and the triple-SAFE test — the decisive finding

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

There is no place in this dataset about which Nihon holds strong evidence on all three temporal
axes at once. Every candidate for a stronger claim is missing at least one.

### 4.7 The vocabulary the dataset does not contain

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

A + B + C + D + E = 65. Class A is the strongest group that exists, and §6 tests it directly.

---

## 5. Design question 1 — the three claim strengths, and where the evidence stops

The gate brief distinguishes three strengths. Restated precisely, with the verdict for each:

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
| An authoritative statement of opening hours for the whole site | **No** — 61 of 65 records are hedged (§4.5); none carries a source or a verification date (§3.7) |
| That statement being current for the visit date | **No** — one shared `updatedAt` for all 214 records; no per-record currency at all |
| Absence of a recurring closure on that weekday | **Partial at best** — 18 of 65 carry weekdays, all PARTIAL and all self-qualified in their own text |
| Absence of an extraordinary closure on that date | **No** — no field exists; 19 of 214 closure strings mention temporary works only in free text |
| Absence of a public holiday closure | **No** — no calendar; 2 incidental mentions in 214 |
| Last admission earlier than the closing bound | **No** — 1 mention in 214, on an UNKNOWN-hours place |
| Capacity / queue / admission refusal | **No** — 0 mentions in 214 |
| Reservation state, where required | **Partial** — `reservation.required` exists, but 0 of the 20 strongest places use it |
| Trip-window confidence for Feb–Mar 2027 | **No** — 0 of 214 are triple-SAFE (§4.6) |

Nine requirements; **one** is partially met, **seven** have no representation in the schema at all,
and the ninth is empty by measurement.

**Verdict: refused, decisively.** The gap is not marginal and not closable by better arithmetic.

---

## 6. Design question 2 — can the strongest existing combination justify a stronger result?

**Tested directly on class A (§4.9): the 20 places with a SAFE recorded interval, a numeric
duration, a SAFE `no-known-closure` fact, a valid civil visit date, and a manual `HH:mm` that lands
strictly inside the interval, producing `recorded-duration-fits-interval`.**

This is the best case that exists in the dataset. It still fails, on four independent grounds, any
one of which is sufficient:

1. **The SAFE closure record excludes the claim in its own words.** All 20 read exactly
   `"Sin cierre ordinario"` — *no ordinary closure*. The adjective is the record's own scoping, and
   the dataset proves the distinction is real: `JP-019` is the identical sentence with `"; clima"`
   appended, and that demotes it to PARTIAL. A record that scopes itself to ordinary closures
   cannot support "not closed on 19 February 2027".
2. **The hours record is hedged for 19 of the 20.** `JP-080` (`"09:00–17:00"`) is the only bare
   token in class A; the other 19 carry `"aprox."`. Arithmetic against an approximate bound produces
   an exact-looking result, and the exactness is manufactured by the computation, not read from the
   record.
3. **Not one of the 20 has SAFE trip-window confidence** — 17 UNKNOWN, 2 PARTIAL, 1 OPAQUE (§4.6).
   For 17 of them Nihon's own `febMar2027` axis says, in the dataset's words,
   `"CALENDARIO / CONDICIÓN PENDIENTE"`: the calendar is not published yet. Asserting openness on a
   date inside a window the product itself marks unverified is self-contradictory.
4. **Seven of the nine requirements in §5.3 are unrepresentable**, so no combination of the
   available fields — not this one, not any other — can supply them.

**Answer: no. A SAFE recorded interval plus a valid visit date, a manual start time, a duration fit
and closure evidence can never, with the present contract, justify a result stronger than the
interval arithmetic Phase 3D-L already produces.** The combination is genuinely the strongest
available, and it is still four independent steps short.

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

The asymmetry that makes "just gate on closure tier" wrong is worth stating once more in this gate's
own numbers, because it is the trap a future implementer will most plausibly fall into: showing the
fit line **only** where closure evidence is SAFE would show it for 20 of 65 places and hide it for
45 — and a user who sees the line on Ginkaku-ji and not on Kyoto Railway Museum learns something
about closure evidence that the interface never said, in the direction of "we only tell you this
where it is safe to go". That is a visitability claim produced by omission, and it is strictly worse
than saying nothing, because it is deniable.

---

## 8. Design question 4 — absence of a matching recurring closure is **not** evidence of openness

**Answer: NO, and the current data contract proves it rather than merely failing to disprove it.**
The gate brief instructs us to assume NO unless the contract proves otherwise; here three
independent lines of evidence make it a positive finding.

1. **`assessWeekdayClosure`'s own contract says so, in the source.** `"no-weekday-match"` **"does
   NOT mean open, feasible, compatible, or 'no closure'"**; `"no-known-closure"` is **"still not a
   claim that the place is open on this date"**. Reading either as openness would contradict the
   module that produces it.
2. **`no-weekday-match` is the ordinary case, not a signal.** Over the 18 `candidate-weekday`
   interval places across a representative civil week (2027-02-15 … 2027-02-21), the 126 cells
   split **108 `no-weekday-match` / 18 `possible-weekday-closure-match`** — exactly the 6-in-7 a
   single named weekday must produce. `JP-020` (`"Lunes; verificar"`) matches on Monday and returns
   `no-weekday-match` on the other six days. A value that is true 85.7% of the time by construction
   carries no information about openness; it carries information about which weekday it is.
3. **The SAFE absence statement scopes itself.** `"Sin cierre ordinario"` (§4.2, §6.1) excludes
   ordinary closures only. And even the strongest reading of it says nothing about the 19 of 214
   places whose free text mentions temporary works, the 2 that mention holidays, or the Japanese
   holiday calendar that appears nowhere.

**Rule for any future phase:** absence of a matching closure is *absence of evidence*, and this
codebase has never been permitted to convert that into evidence of absence. No wording, variant
name, icon, colour, or layout may imply otherwise.

---

## 9. Design question 5 — `febMar2027` must remain orthogonal

**Answer: orthogonal, and it may compose only at presentation time, only as a weakening, and only
in the surface that already owns it.**

`docs/TEMPORAL_DATA_CONTRACT.md` §5 fixes the axis: `febMar2027` answers *how confident is Nihon
about this place's Feb–Mar 2027 situation*, and **never** *is this place closed on Tuesdays*. It is a
trip-window confidence axis, not a schedule.

Two consequences, and they point in opposite directions — which is exactly why it must stay
orthogonal rather than being folded in:

- **It can never strengthen a result.** A SAFE `febMar2027` is not evidence about hours; only 6
  places have one, and the only interval place among them (`JP-211`) has no numeric duration and a
  `"según anuncio"` hedge. Folding it in as a promoter would be a fourth kind of confidence
  laundering.
- **It cannot be silently ignored either.** The 152 UNKNOWN `pending-verification` records mean the
  trip-window calendar is not published. §6.3 shows this is what removes the last footing from a
  class-A openness claim. So the axis is *decisive against* a stronger claim while being
  *inadmissible in favour of* one — an asymmetry that only survives if the two axes stay separate.

**Presentation-time composition rule:** `PlaceDetail.tsx`'s existing Feb–Mar 2027 card (Phase 3D-F,
`feb-mar-status.ts`) continues to own this axis exclusively. No fit or feasibility surface may read
`febMar2027.status`, `warning` or `action`; no future notice may place a `febMar2027` tone beside a
fit result in a way that reads as a combined verdict; and `warning`/`action` remain 214/214 OPAQUE
prose that is never structurally parsed.

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

## 11. Design question 7 — `recorded-24h` cannot participate safely

**Answer: NO. It must stay excluded, exactly as Phase 3D-L excludes it, and this gate adds a fourth
reason to Phase 3D-K's three.**

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

**Rule:** eligibility is narrowed on `.kind === "recorded-interval"`. `tier === "safe"` must never
be the test, in this or any successor phase, and no `recorded-24h` record's `raw` text may be
re-scanned for a usable interval.

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

**Answer: YES — jointly and severally, they make an open/closed judgment impossible with the present
dataset.** §4.7 is the measurement; this is what it means.

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
- **Last admission.** One mention in 214 (`JP-038`), on a place whose hours classify UNKNOWN. This
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
last-admission and capacity axes are absent from the schema rather than merely weak in it. **No
place in this dataset has even that hypothetical starting point** (§4.6). The impossibility is
structural, not statistical.

---

## 14. Design question 10 — could an explicit closed union express the safe result without a misleading boolean?

**Answer: a closed union could express it — and it would be pointless, because the only safe result
it could carry is the one Phase 3D-L's union already carries.**

The union discipline itself is not in question and is not the constraint that fails. This codebase
has repeatedly shown that a closed union with no boolean, no `null`, no catch-all and named refusals
prevents an entire class of overclaiming, and Phase 3D-L's eight variants — every one named after
*the recorded interval* rather than the place — are the standing proof. Any successor would inherit
that discipline unchanged: no `open`, `available`, `feasible`, `visitable`, `works`, `compatible`,
`valid` or `ok` as a variant, a field, a property, or a boolean.

But a type only constrains what a value may *say*; it cannot manufacture the evidence a value would
*need*. Enumerate the candidate variants a feasibility union would want beyond Phase 3D-L's eight,
and every one is unreachable:

| Candidate variant | Evidence it would require | Status |
|---|---|---|
| `recorded-hours-permit-this-visit` | an unhedged, sourced, current hours record | unreachable — 61 of 65 hedged, 0 sourced (§4.5, §3.7) |
| `no-recorded-closure-on-this-date` | complete closure coverage incl. holidays and one-offs | unreachable — no holiday calendar, no temporary-closure dates (§13) |
| `visit-window-confirmed-for-trip` | SAFE `febMar2027` alongside the rest | unreachable — triple-SAFE intersection empty (§4.6) |
| `all-recorded-evidence-consistent` | a defined meaning for "consistent" across three axes | undefinable — no contract composes the axes, and §7 shows the composition is a display decision |

Each collapses into a refusal state, and a union whose only reachable informative variants are
Phase 3D-L's eight **is** Phase 3D-L's union.

**Therefore: the closed union is not a rescue.** It correctly prevents a misleading boolean, and
correctly prevents nothing else — the deficiency is in the evidence, not the type. Building a second
union to express the same eight outcomes would add a module, a surface, and a name containing the
word "feasibility" to a codebase that has spent seven phases keeping that word out of its runtime,
in exchange for zero new information.

---

## 15. Design question 11 — the constraints any future implementation would inherit

Recorded so the boundary survives this decision. **These are conditions on a phase that is not
approved, not a specification for one.** Should the question ever be re-opened under §28.2, all six
hold, and none is negotiable within the current product:

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
6. **No new evidence class.** No network request, no `Date.now()`, no "now", no timezone, no
   absolute instant, no holiday table, and no external verification — the constraints every Phase 3D
   document has carried, and the ones §28.2 would have to revisit explicitly rather than by
   implication.

---

## 16. Design question 12 — the exact boundaries between the four levels

The distinction this whole gate turns on, stated as four levels with a rule for each crossing.

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

**Level 3 — A genuine opening-hours fact.** An assertion that a named place admits visitors between
two clock times on a named civil date. It requires what levels 1 and 2 do not contain: an
authoritative source, a verification date, a scope statement (whole site or sub-facility), and
currency for the date in question. Nihon holds none of these for any record — no source field, no
per-record verification (one shared `updatedAt` for all 214), and explicit sub-facility hedging in 7
records with no way to rule it out for the other 58.

**Level 4 — A visitability claim.** An assertion that a specific user can complete a specific visit.
It requires level 3 **plus** closure completeness, a holiday calendar, last admission, capacity,
queue, reservation state, and reachability by the chosen time.

**The crossing rules, which are the operative output of this section:**

- **1 → 2 is permitted, under a gate.** Phase 3D-K gated it and Phase 3D-L built it. The crossing is
  legitimate only because the *subject stays the record*.
- **2 → 3 can never be reached by computation.** This is the boundary this gate exists to fix. What
  separates them is provenance, not arithmetic; no amount of comparison, composition, or type
  discipline over level-1 facts produces a level-3 statement. **Every proposal in §26 fails here,
  and it is the same failure each time.**
- **3 → 4 is out of scope for a static dataset**, and would remain so even if level 3 were somehow
  achieved.
- **Wording follows the level, not the confidence.** A level-2 result must be phrased about the
  record («el intervalo registrado») and never about the place («el lugar»). This is why §21's
  constraints are stated as grammar rather than as tone.

---

## 17. Eligibility rules

**No new eligibility rule is defined by this phase, because no new computation is authorised.** What
follows is the eligibility contract that stands after this gate, recorded so a future reader does
not have to reconstruct it, and so any successor inherits it verbatim rather than re-deriving it.

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
5. **Closure evidence is never an eligibility input** (§7, §19). Not as a gate, not as a filter, not
   as a sort key, and not as a reason to hide a control.
6. **Overnight and degenerate tokens are named refusals, not exclusions** (§12).

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

**Rule 1 — The arithmetic composes with nothing.** It reads no `ClosureFact`, no
`WeekdayClosureAssessment`, no `CompositionClass`, no `febMar2027`, no `bestTime`, no reservation
field and no transfer edge. This is Phase 3D-K §10's decision, enforced structurally by Phase 3D-L,
re-tested tier by tier in §7, and unchanged here.

**Rule 2 — Co-presentation is allowed; combination is not.** Phase 3D-J's
`HoursClosureCompositionNotice` and Phase 3D-B's `WeekdayClosureNotice` render alongside the fit
line, never merged with it, never suppressed by it, never reordered because of it. The reader may
of course read both — that is what the day card is for. What the interface may never do is *perform
the composition on the reader's behalf* and present the product as a single verdict.

**Rule 3 — Omission is a claim, so hiding is regulated as tightly as showing.** The asymmetry that
makes closure-gating wrong (§7): showing the fit line only where closure evidence is SAFE would
show it for 20 of 65 and hide it for 45, and the pattern is legible. Any future rule that varies
*whether* a result appears, according to evidence the result does not use, is forbidden on the same
ground as a false positive claim — and it is worse, because it is deniable.

**Rule 4 — `febMar2027` composes only at presentation time, only in the surface that owns it**
(§9). It may weaken a reader's confidence by sitting on the same page; it may never enter a
computation, and it may never be rendered as part of a fit or feasibility line.

**Rule 5 — The direction of a composition does not make it safe.** A *weakening* cross-reference —
"the recorded weekday closure matches this date, so this comparison may not apply" — was evaluated
and refused in §26.2. Its absence would carry exactly the inverse implication, which is a
visitability claim by omission (rule 3).

---

## 20. Proposed closed domain model — evaluated, and **not** justified

The gate brief asks for a proposed domain model *if justified*. **It is not justified**, and §14
gives the reason: every informative variant such a model could reach is already reachable in
`RecordedIntervalDurationFit`, and every variant beyond it is unreachable for want of evidence.

Recording the shape that was evaluated and refused, so a future reader can see it was considered
rather than overlooked. **This is not an authorised design, and no implementation of it is
approved:**

```
REFUSED — not approved, not scheduled, and not to be implemented.

  OpeningHoursFeasibility =
    | { kind: "not-evaluable"; reason: <the six Phase 3D-L refusals> }   // duplicates 3D-L
    | { kind: "recorded-interval-fit"; fit: RecordedIntervalDurationFit } // wraps 3D-L
    | { kind: "recorded-evidence-consistent"; ... }                       // UNREACHABLE (§14)
    | { kind: "recorded-evidence-incomplete"; missing: EvidenceGap[] }    // REFUSED (§18)
```

Three defects, each fatal on its own:

1. **Variants one and two are `RecordedIntervalDurationFit` with a wrapper.** A second type that
   restates the first adds a name, a module, and a surface, and no information.
2. **Variant three is unreachable.** "Consistent" is undefined across the three axes, no contract
   composes them (§7, §9), and the triple-SAFE population is empty (§4.6) — so a variant that would
   require it can never be constructed from real data.
3. **Variant four is the refused "insufficient evidence" state of §18**, whose absence on some
   places would imply sufficiency elsewhere.

**What stands instead:** `RecordedIntervalDurationFit` in `app/src/lib/recorded-interval-fit.ts`, as
shipped, unchanged, and not wrapped. No new type is proposed by this phase.

---

## 21. UI wording constraints

No UI is authorised by this phase. These constraints bind the existing Phase 3D-L surface — which
must not drift — and would bind any successor.

**Forbidden in any construction, in any language, on any feasibility, fit, or hours surface:**
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

---

## 22. Styling constraints

1. **One neutral treatment for all outcomes.** No per-outcome class name, no green check, no red
   cross, no warning triangle, no success/error/danger badge, no colour that encodes approval or
   rejection. Phase 3D-L verified in-browser that every result line computes to the same colour on
   the same background; that property must be preserved.
2. **Never Phase 3D-J's composed-notice styling.** Borrowing it would make an arithmetic result look
   like it carries closure evidence — the visual form of the §19 rule 1 violation.
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
required. **No implementation is approved, so none of this is scheduled.** Anything built under
§28.2 would need, at minimum:

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

---

## 25. Explicit non-goals

Nothing below is started, designed, scheduled, or implied by this document:

- Any opening-hours solver, feasibility engine, or open/closed judgment about any place.
- Any composition of an hours fact with a closure fact, a `febMar2027` status, a `bestTime`, or a
  reservation field into a stronger claim than either supports alone.
- `Date.now()`, "now", the current clock, urgency, countdowns, or deadline framing.
- Timezones, IANA zones, absolute instants, DST handling, or epoch values.
- Holiday calendars, special calendars, observance rules, or "closed the day after a holiday" logic.
- Live or temporary verification against any source — zero network requests, and no use of
  `place.officialUrl` beyond the existing link.
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

Three proposals that are strictly weaker than a solver — each of which looks safe — were worked
individually. All three fail at the same boundary (§16, 2 → 3), and recording them is most of this
gate's practical value.

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

It fails on §19 rule 3. If the annotation appears on match and is absent otherwise, its absence
carries the inverse implication — and §8 measures how often that would happen: **108 of 126** cells
over a representative week return `no-weekday-match`. An annotation present in 18 cells and absent
in 108 trains the reader to treat its absence as clearance, which is precisely the "absence of
evidence is not evidence of absence" error, delivered by interface rather than by wording. Phase
3D-J's notice already renders the match on its own, immediately beside the fit line, where a reader
can see both without Nihon composing them.

### 26.3 Restricting the existing fit line to `jointly-presentable` places

*Only show Phase 3D-L's result where both axes are SAFE, i.e. the 20 class-A places.* **Refused**,
and it would be a regression of shipped behaviour rather than an addition. Phase 3D-K §10 already
refused it as a design; the measurement holds — it would hide the line for 45 of 65 places, and the
pattern would read as "we only tell you this where it is safe to go". It also misreads the
composition class, which is a *display* decision computed from tiers alone (§3.4), as an *evidence*
decision.

---

## 27. Unresolved risks

Recorded rather than resolved, because a future reader needs them and this phase changes no code:

1. **`JP-211` `"09:00–17:00 según anuncio"` still classifies SAFE.** `"anuncio"` is absent from the
   third-party regex word list. Phase 3D-K recorded it; it remains. The SAFE interval universe is
   therefore not free of source hedging, and any successor inherits that. **Not fixed here — this
   phase is not authorised to edit data or the classifier.**
2. **`JP-016`'s recorded `06:00–17:00` hall interval is discarded** by the `known-24h` priority
   branch. Recorded by Phase 3D-K; unchanged. §11 shows why it matters more once tiers are used as
   evidence.
3. **`JP-038`'s last-admission rule is invisible to arithmetic** because its hours classify UNKNOWN
   (§4.7). The one record that states the confounder is the one record that cannot reach the
   computation. This is luck, not design: **a future dataset edit that made a last-admission place
   classify `fixed-interval-clean` would silently create a wrong-looking fit result**, and no test
   in the repository would catch it. This is the highest-value follow-up finding in this document.
4. **`"aprox."` has no defined magnitude.** 58 of 65 records are approximate, and nothing states
   whether that means five minutes or an hour. Phase 3D-L's arithmetic is exact over an inexact
   bound, and §21 rule 3 (always show the raw text) is the only mitigation available.
5. **The composition class is a display decision that reads like an evidence decision.** Its name
   (`jointly-presentable`) is honest, but a future reader may reach for it as a gate. §7, §19 and
   §26.3 exist to make that harder.
6. **`docs/DATA_MODEL.md` still does not mention Phase 3D-G, 3D-H, 3D-I, 3D-J, 3D-K or 3D-L.**
   Recorded by Phase 3D-I and again by Phase 3D-K; recorded again here so it is not lost, and again
   not fixed — it is unrelated to the question this gate decides.

---

## 28. Executive conclusion and recommendation

### 28.1 Recommendation: **DO NOT IMPLEMENT**

There is no subset of the evidence Nihon can derive conservatively today that supports any claim
stronger than *"the recorded duration fits inside the recorded interval"* — which Phase 3D-L already
delivers, at the exact scope Phase 3D-K approved.

The four findings that close it:

1. **The triple-SAFE intersection is empty** (§4.6). 31 places hold SAFE hours and a SAFE closure
   fact; **0** also hold a SAFE trip-window status, and **0** of the 65 SAFE recorded-interval
   places do. There is no place about which Nihon holds strong evidence on all three axes.
2. **The strongest existing combination still fails on four independent grounds** (§6). Class A's 20
   places — SAFE interval, numeric duration, SAFE closure, valid date, manual time, duration fits —
   are defeated by the closure record's own adjective («ordinario»), by hedging in 19 of the 20
   hours records, by an unverified trip window in all 20, and by seven unrepresentable requirements.
3. **The decisive confounders are absent from the schema, not merely weak in the data** (§13).
   `place.schedule` has two keys. No holiday calendar, no last admission, no capacity, no queue, no
   per-record verification date.
4. **A closed union cannot rescue it** (§14). It correctly prevents a misleading boolean and
   nothing else; every variant beyond Phase 3D-L's eight is unreachable, so the union would restate
   what already exists.

**This phase therefore recommends no successor.** That is a deliberate break with the Phase 3D-G →
3D-H, 3D-I → 3D-J and 3D-K → 3D-L pattern: each of those gates found a narrow safe slice and named
it. This one looked for the slice, measured where it would have to come from, and found it empty.
The correct output of a design gate that finds no safe slice is to say so and stop.

### 28.2 The narrow condition under which the question could be re-opened

Not a plan, not scheduled, and not a recommendation — recorded so that a future revisit is a
decision rather than a drift, and so nobody re-opens it on weaker grounds than these. **All** of the
following would have to be true, and each would need its own gate:

1. A per-record **source and verification date** for `schedule.hours`, so a record can be known to
   be current for a given civil date (level 3 of §16; today all 214 share one export stamp).
2. **Structured extraordinary-closure coverage** — holidays, temporary closures with date ranges,
   and the day-after-holiday convention — as fields rather than free text.
3. A **last-admission field**, given that its single free-text occurrence today is invisible to the
   arithmetic (§27.3) and that it can invert an otherwise correct fit result.
4. **Scope resolution** for the 7 sub-facility records and a stated meaning for `"aprox."`, so
   arithmetic is not exact over an inexact bound.
5. An explicit product decision to admit **live or externally verified data**, which every phase
   since 3D-A has excluded and which §15 rule 6 forbids by default.

Items 1–4 are dataset and schema work; item 5 is a product decision that changes what kind of
application Nihon is. **None is a matter of collecting more of the same data**, which is why this
gate returns DO NOT IMPLEMENT rather than NEEDS MORE DATA.

### 28.3 What stands after this gate

- Phase 3D-B's weekday closure notice: unchanged.
- Phase 3D-E's recorded-hours summary: unchanged.
- Phase 3D-J's hours/closure composition notice: unchanged.
- Phase 3D-L's manual visit-start-time fit: unchanged, and it remains the **ceiling** of what Nihon
  says about visit timing.
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
