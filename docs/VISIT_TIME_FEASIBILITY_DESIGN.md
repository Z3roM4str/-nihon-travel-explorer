# Visit-Time / Opening-Hours Feasibility Design Gate (Phase 3D-K)

**Design and audit only.** This phase adds no runtime `.ts`/`.tsx`/`.css`, no UI, no persistence,
no schema change, no dataset change, no dependency, and no visit times. It does not implement an
opening-hours solver, and it does not start the phase it recommends.

The phrase "opening-hours feasibility" appears in this document's title because that is the name
of the question the phase brief asked. Everything this gate actually approves is deliberately
narrower than that phrase, and §7 defines the vocabulary that keeps it narrow: the approved scope
is arithmetic **about a recorded interval**, never a claim about whether a place can be visited.

---

## 0. Executive decision (stated up front, restated in full in §21)

**APPROVE NARROW IMPLEMENTATION.**

There is sufficient evidence to build a strictly limited future phase that answers, for one place
on one assigned day:

> Given the recorded clock interval, a start time the user typed in by hand, and the recorded
> visit duration, does the visit fit inside **the recorded interval**?

The scope approved is exactly: `fixed-interval-clean` SAFE hours only (65 places), numerically
resolvable durations only (62 of those 65), a manually entered local `HH:mm` start time, a closed
eight-variant result union (§14), no timezone, no overnight support, no `recorded-24h`, no
transport, no scheduling, and no wording that describes the place rather than the record.

This is a different answer from Phase 3D-I's on a genuinely different question — see §20 for the
re-derivation and the exact reason the conclusions differ rather than conflict.

---

## 1. The question this gate resolves

**Asked:** does Nihon's current state permit safely building — and at what exact scope — a future
function that answers *"given a place, a civil date, a start time the user chose explicitly, and a
recorded duration, does the whole visit fit inside the recorded clock interval?"*

**Not asked, and not answered anywhere in this document:** whether a place is open, accessible,
admitting visitors, worth visiting at that hour, or reachable by then. This gate produces no
runtime answer to its own question; it decides what evidence a future implementation would need in
order to answer it without fabricating precision.

---

## 2. Method and reproducibility

Every figure in §4 was re-derived for this phase against the **live TypeScript modules**
(`recorded-hours.ts`, `duration.ts`, `temporal-availability.ts`, `hours-closure-composition.ts`)
and the live dataset — not copied from Phase 3D-I, not approximated in Python, not read off the
ROADMAP.

Procedure (temporary Vitest harnesses under `app/src/lib/`, each run with `npx vitest run <file>`
and **deleted immediately after**, so this phase's diff contains no `.ts` file — including a final
independent pass that recomputed §4.5, §4.4's separator scan, and §4.7 against stricter
definitions):

1. `app/src/data/places.json` and `data/places.json` were compared and are byte-identical
   (214 records each), matching `docs/DATA_MODEL.md`'s canonical-source rule.
2. Every place's `schedule.hours` was passed through `interpretHoursText()` — the real classifier,
   including its real priority order.
3. Every place's `duration` was passed through `resolveDuration()` — the real resolver, including
   its `duration.raw` fallback for decimal-hour ranges the exporter misses.
4. Interval tokens were parsed by the **candidate** narrow parser specified in §6 — written for
   the audit only, never added to the repository.
5. Composition classes came from the real `classifyHoursClosureComposition()`.

Where a figure coincides with one Phase 3D-I published, §20 says so explicitly. No figure in this
document was carried over without being recomputed.

---

## 3. Architecture audited (code read, not inferred from the ROADMAP)

### 3.1 `recorded-hours.ts` (Phase 3D-E)

`RecordedHoursFact` is a five-variant union. Only `"recorded-interval"` carries `intervalRaw`, and
only `fixed-interval-clean` produces that variant. `intervalRaw` is documented in the module itself
as *"the matched token only … never minutes-since-midnight, a `Date`, or any other
arithmetic-ready form."* That is a deliberate stop, not an omission — and the module's own header
names the exact questions it refuses to answer, including *"this closes before your visit ends."*

Two properties of the classifier are load-bearing for §6:

- `TIME_RANGE_RE` is `/\d{1,2}:\d{2}\s*[–—-]\s*\d{1,2}(:\d{2})?/`. The **end minutes are
  optional**, and hour/minute values are **not range-checked**. So `"09:00–17"` and `"25:00–26:00"`
  would both classify as `fixed-interval-clean`, tier SAFE, and both would produce an `intervalRaw`
  that is not a well-formed interval. Neither shape occurs in the current dataset (§4.4), but a
  future parser must reject them rather than repair them.
- `extractIntervalRaw()` returns the **first** `TIME_RANGE_RE` match in the trimmed original text.
  It does not verify that the match is the whole string, and 61 of 65 real records carry
  surrounding editorial text around the token (§4.5).

### 3.2 `duration.ts`

`resolveDuration()` returns `MinuteRange | null`. `null` means "no unambiguous numeric range was
recorded" — never zero, never a guess. `MULTI_DAY` text (`"Medio día"`, `"Día completo"`) is
refused up front and again inside `parseDurationRange()`. `docs/DATA_MODEL.md` reinforces the
policy this gate must inherit: *"No average, median or midpoint is ever taken."*

### 3.3 `civil-date.ts`

Pure civil-date helpers, `Date.UTC`/`getUTC*` only, `timeZone: "UTC"` passed to every
`Intl.DateTimeFormat`. There is **no time-of-day anywhere in this module** — no parser, no
formatter, no type. A future `HH:mm` value has no existing home here, which is why §7 specifies
one rather than assuming one exists.

### 3.4 `day-assignment.ts` and `hours-closure-composition.ts`

`validateDayPartition()` guarantees that in a `valid` assignment every route id appears in
**exactly one** day bucket, exactly once. `deriveHoursClosureVisitDate()` (Phase 3D-J, adopting
Phase 3D-H's stricter contract) requires all of: `dayAssignment.valid === true`, a non-empty and
valid `startDate`, exactly one containing day bucket, and an `isValidCivilDate` re-check on the
derived date. There is no partial fallback.

### 3.5 `planning-draft.ts`

`ManualPlanningDraftV2` persists `routeIds`, `days`, and `startDate` — user *decisions*. Its
header states the rule this gate must respect: *"Everything derived from the plan … is recomputed
on read."* `migrateV1ToV2` is the one existing precedent for adding a field: the new field is set
to a neutral value, never invented, and `routeIds`/`days` pass through untouched.

### 3.6 `OrderedSequenceBuilder.tsx`

The day card at line 1239 already renders, in order: the reorderable list, `WeekdayClosureNotice`,
`HoursClosureCompositionNotice`, `ReservationDeadlineNotice`, and `TransferAndVisitTotals`. Both
Phase 3D-H's and Phase 3D-J's surfaces render nothing when they have nothing safe to say. A fifth
per-day, per-place notice fits this pattern exactly; a new top-level surface does not.

### 3.7 `transit.ts` (dormant)

`TransitRouteRequest` requires `serviceDate`, an IANA `timeZone: string`, and `TransitWhen`
instants. This is the module where absolute time already lives, and it is deliberately dormant
(activation gate `"off"`, per the ROADMAP). §8's timezone decision is drawn against this boundary,
not against a general claim that timezones are unnecessary.

### 3.8 The closest boundary in the whole codebase, addressed directly

`recorded-hours.ts`'s module header names, among the questions it refuses to answer, **"this closes
before your visit ends."** That is the nearest existing statement to what §14's
`recorded-duration-exceeds-interval` outcome would express, and a reviewer is right to stop on it.

Three reasons it is not a contradiction, and one obligation it creates:

1. **The sentence constrains that module, not the repository.** It is the same self-scoping
   discipline every Phase 3D classifier states about itself — `temporal-availability.ts` says it
   "never reads `place.schedule.hours`", and Phase 3D-J then composed the two facts in a
   *separate* module without modifying either classifier. The approved work follows that
   established pattern exactly: a new consumer, never a widened classifier.
2. **The refused question is about the place; the approved outcome is about the record.** "This
   closes before your visit ends" asserts a real closing event affecting a real visit.
   `recorded-duration-exceeds-interval` asserts that two recorded numbers and one number the user
   typed do not fit together. §16 exists to keep that difference audible in every rendered
   sentence, and it is why the permitted wording is «La duración registrada excede este intervalo
   horario registrado» and never «cierra antes de que termines».
3. **The refusal was made in the absence of a user-chosen start time.** Phase 3D-E had no start
   time to reason from, so the only available reading of that sentence would have been an inferred
   one — which §7 also refuses.

**Obligation on the implementing phase:** `recorded-hours.ts` must not be edited — not its
classifier, not its types, and not that module-header sentence, which stays true of that module.

### 3.9 Where documentation and code disagree

`docs/DATA_MODEL.md` does not mention Phase 3D-G, 3D-H, 3D-I, or 3D-J. Phase 3D-I recorded this
gap; it still exists and this phase does not fix it either — recorded again so it is not lost. No
contradiction was found between the documented contracts and the code in any area this gate
depends on; the disagreements found are the two *silent looseness* points in §3.1, which the
documentation never claimed otherwise about.

---

## 4. Real-data inventory (re-derived, 214 places)

### 4.1 Hours facts, by kind × category × tier — exhaustive

| Fact kind | Category | Tier | Count |
|---|---|---|---:|
| `recorded-24h` | `known-24h` | safe | 15 |
| `recorded-interval` | `fixed-interval-clean` | safe | **65** |
| `conditional` | `known-24h-with-caveat` | partial | 4 |
| `conditional` | `seasonal-variable` | partial | 15 |
| `conditional` | `solar-relative` | partial | 4 |
| `conditional` | `daytime-qualitative` | partial | 10 |
| `conditional` | `partial-single-bound` | partial | 2 |
| `conditional` | `ambiguous-alternative-interval` | partial | 3 |
| `conditional` | `fixed-interval-with-caveat` | partial | 12 |
| `external-dependency` | `weather-or-tide-dependent` | opaque | 6 |
| `external-dependency` | `third-party-operator-dependent` | opaque | 13 |
| `unknown` | `explicit-unknown-variable` | unknown | 49 |
| `unknown` | `qualitative-uncategorized` | unknown | 16 |
| | | **total** | **214** |

Tier totals: SAFE 80, PARTIAL 50, OPAQUE 19, UNKNOWN 65 — sums to 214, and matches
`docs/TEMPORAL_DATA_CONTRACT.md`'s independently-audited single-axis hours totals exactly.

### 4.2 Duration coverage across the two SAFE groups

| Group | n | numeric duration | non-numeric | exact (min = max) | range (min ≠ max) |
|---|---:|---:|---:|---:|---:|
| `recorded-interval` SAFE | 65 | **62** | **3** | **0** | **62** |
| `recorded-24h` SAFE | 15 | **15** | **0** | **0** | **15** |

The three non-numeric interval places: `JP-121` Expo '70 Park + Tower of the Sun
(`"Medio día"`), `JP-147` Enryaku-ji (`"Medio día–día completo"`), `JP-211` AnimeJapan 2027
(`"Día completo"`).

**Every single numerically resolvable duration in both groups is a range, not a point value
(0 of 77 are exact).** The range semantics decided in §9 are therefore not an edge case — they are
the only case.

Distinct ranges in the interval group (15 shapes, most common first): 60–90 (11), 120–180 (8),
90–150 (7), 180–300 (5), 120–240 (5), 90–120 (5), 60–120 (4), 45–75 (4), 90–180 (3), 30–60 (2),
45–90 (2), 150–240 (2), 180–240 (2), 20–45 (1), 180–360 (1). Total 62.

### 4.3 Interval spans and clock extremes (65 places)

- **Spans:** min 390 min (6 h 30), max 780 min (13 h), 10 distinct values
  (390, 420, 450, 480, 495, 510, 540, 600, 660, 780).
- **Opening times:** earliest **06:00** (2 places), latest **10:30** (1). Distribution: 06:00 ×2,
  06:30 ×1, 08:00 ×4, 08:30 ×7, 08:45 ×1, 09:00 ×25, 09:30 ×9, 10:00 ×15, 10:30 ×1.
- **Closing times:** earliest **14:00** (1 place, `JP-032` Tsukiji Outer Market), latest **22:30**
  (1, `JP-112` Umeda Sky Building). Distribution: 14:00 ×1, 16:00 ×1, 16:30 ×7, 17:00 ×30, 17:30 ×7, 18:00 ×9,
  19:00 ×3, 20:00 ×4, 21:00 ×1, 22:00 ×1, 22:30 ×1.
- **No opening earlier than 06:00 and no closing later than 22:30 exists.** No `00:00` and no
  `24:00` token appears in any `schedule.hours` string in the dataset, in any tier.

### 4.4 `intervalRaw` token formats

- **29 distinct tokens**, all of the exact shape `HH:MM–HH:MM`.
- **Separator:** U+2013 EN DASH in all 65. Scanning **all 214** places' `schedule.hours` for
  *every* clock-range-shaped substring (not just the first per record) finds 89 matches, spread
  over 89 places, and **all 89 use U+2013** — zero ASCII hyphen and zero em dash anywhere in the
  dataset's hours text, in any tier.
- **0 parse failures** under the §6 candidate parser: 0 tokens with an end lacking minutes,
  0 hour > 23, 0 minute > 59.
- **0 overnight tokens** (no token has `end < start`).
- **0 degenerate tokens** (no token has `end == start`).
- Most common tokens: `09:00–17:00` ×14, `10:00–17:00` ×5, `09:00–18:00` ×5, `09:30–17:00` ×4,
  `08:30–17:00` ×4.

### 4.5 The SAFE interval token is rarely the whole recorded string

Only **4 of 65** SAFE interval records are the bare token alone. The other **61** carry
surrounding editorial text:

- **58** carry an explicit approximation marker (`"aprox."`), e.g. `JP-062` `"09:00–17:00 aprox."`.
- **7** carry a **scope or source hedge** — the interval is attributed to part of the site or to an
  external announcement, not to the whole place:
  `JP-004` `"Tiendas aprox. 10:00–20:00"`, `JP-025` `"Tiendas aprox. 10:00–21:00"`,
  `JP-028` `"Tiendas aprox. 10:00–19:00"`, `JP-108` `"Tiendas aprox. 10:00–20:00"`,
  `JP-018` `"Mayoría 09:00–17:00"`, `JP-032` `"Muchos locales 06:00–14:00"`,
  `JP-211` `"09:00–17:00 según anuncio"`.

`JP-211` is worth naming twice: `"según anuncio"` is a real hedge that the third-party regex does
not match (it lists `comercio|tienda|local|templo|taller|productor|operador|usj|edificio|bar`, not
`anuncio`), so the record lands in SAFE. **The SAFE interval universe is not free of hedging
language.** This is the single strongest constraint on §16's language contract: a future UI may
never render the parsed token alone, and may never use the word "confirmado".

### 4.6 Span-only fit, with no start time (the Phase 3D-I check, re-derived)

Over the 62 numerically evaluable interval places, comparing `duration` against the interval
**span**:

| Outcome | Count |
|---|---:|
| max duration ≤ span | **62** |
| min ≤ span < max | **0** |
| span < min duration | **0** |
| max duration exactly = span | **0** |
| min duration exactly = span | **0** |
| not numerically evaluable | 3 (of 65) |

Margin (`span − maxMinutes`): minimum **120 min**, maximum 660 min. The single tightest record is
`JP-093` Kyoto Railway Museum — `"10:00–17:00 aprox."` (420 min) against `"3–5 h"` (300 min),
120 min of slack.

**This reproduces Phase 3D-I §6 exactly.** See §20.

### 4.7 The same population, once a start time exists (the evidence Phase 3D-I did not have)

Enumerating every minute-granularity start choice **strictly inside** the recorded interval
(`open ≤ t < close`, so no start that §14 would classify as
`start-time-outside-recorded-interval` is counted) for each of the 62 evaluable places, and
classifying it by §9's three-way rule:

| Property | Count |
|---|---:|
| Places with at least one start yielding *fits* | **62 / 62** |
| Places with at least one start yielding *only the minimum fits* | **62 / 62** |
| Places with at least one start yielding *exceeds the interval* | **62 / 62** |

Every one of the three informative outcomes is reachable, for **every** evaluable place, from a
start time strictly inside the recorded interval. The span-only check produced one constant answer
for the whole dataset; the start-time check produces all three for all 62. That difference is the entire reason this gate reaches a different conclusion from
Phase 3D-I's on the neighbouring question.

### 4.8 Evidence funnel

| Gate | Places |
|---|---:|
| All places | 214 |
| `recorded-interval` SAFE | 65 |
| …and `resolveDuration()` non-null | **62** |
| …and closure axis also SAFE (`jointly-presentable`) | 20 |

Composition class over the 65 SAFE-interval places: `jointly-presentable` 20 (SAFE
`no-known-closure`), `present-with-caveat` 18 (PARTIAL `candidate-weekday`), `keep-separate` 17
(OPAQUE), `not-composable` 10 (UNKNOWN) — sums to 65. Over all 214: 31 / 43 / 56 / 84 = 214,
identical to Phase 3D-I §3.1 (§20).

### 4.9 `recorded-24h` (15 places), read in full

```
JP-001 Espacio público 24 h          JP-104 Visible 24 h
JP-012 Espacio público 24 h          JP-130 Parque 24 h
JP-016 Recinto exterior 24 h; salón aprox. 06:00–17:00
JP-042 Espacio público 24 h          JP-144 Sendero 24 h; salón diurno
JP-063 Espacio público 24 h          JP-159 Espacio público 24 h
JP-066 Montaña 24 h; oficinas diurnas
JP-070 Espacio público 24 h          JP-164 Espacio público 24 h
JP-071 Espacio público 24 h          JP-182 Espacio público 24 h
JP-103 Espacio público 24 h
```

**3 of the 15 SAFE `known-24h` records narrow themselves in their own text** — `JP-016` Sensō-ji,
`JP-066` Fushimi Inari Taisha, `JP-144` Okunoin Cemetery each state that a *sub-facility* (the
hall, the offices, the hall) has different hours. `JP-016` goes further and names a full clock
interval (`06:00–17:00`) that the SAFE `known-24h` classification discards entirely, because the
`24 h` token is checked first and `"salón aprox."` matches none of the caveat regexes.

This is decisive for §11: a SAFE 24 h fact is a claim about *some part* of a site, and one fifth of
the real records say so themselves.

### 4.10 `bestTime` (all 214)

Mañana 131, Tarde 39, Noche 19, Atardecer 16, Apertura 3, Tarde y noche 2, Muy temprano 1,
Tarde/noche 1, Tarde/madrugada 1, Mañana o tarde 1 — ten distinct values summing to 214, matching
`docs/TEMPORAL_DATA_CONTRACT.md` §3's independently-audited distribution (its five named values
plus "five smaller combinations", which are the five listed last here).

Within the 65 SAFE-interval group: Mañana 45, Tarde 15, Atardecer 4, Apertura 1.

---

## 5. Decision 1 — Hours eligibility (exhaustive, by kind × category × tier)

Audited, not inherited. The starting position in the phase brief was treated as a hypothesis; the
outcome differs from it on one point (`recorded-24h`, which the brief left open and this gate
refuses outright).

| Kind | Category | Tier | n | May enter interval arithmetic? | Reason |
|---|---|---|---:|---|---|
| `recorded-interval` | `fixed-interval-clean` | safe | 65 | **YES — the only eligible family** | Two recorded clock bounds, no caveat token, no season/weather/third-party dependency. Still requires §6 parsing to succeed and §16's wording discipline. |
| `recorded-24h` | `known-24h` | safe | 15 | **NO** | No recorded start or end exists to be an operand; treating it as 00:00–24:00 fabricates an interval the record never states. 3/15 records narrow themselves to a sub-facility in their own text (§4.9). See §11. |
| `conditional` | `known-24h-with-caveat` | partial | 4 | NO | The caveat is the point (`JP-189` `"Abierto 24 h; puede cerrar por viento"`). No bounds either. |
| `conditional` | `seasonal-variable` | partial | 15 | NO | Which interval applies depends on a season the record does not resolve (`JP-010` `"09:00–16:00/17:30 según temporada"`). Picking one bound would be a guess. |
| `conditional` | `solar-relative` | partial | 4 | NO | Bounds are astronomical, not clock (`"Amanecer–atardecer"`). Resolving them needs latitude, date, and an ephemeris — none of which exists here. |
| `conditional` | `daytime-qualitative` | partial | 10 | NO | `"Diurno"` has no bounds at all. |
| `conditional` | `partial-single-bound` | partial | 2 | NO | Exactly one bound is real (`JP-054` `"Abre desde 06:00; cierre variable"`). Half an interval cannot bound a visit's end. |
| `conditional` | `ambiguous-alternative-interval` | partial | 3 | NO | Two competing intervals, unresolved (`JP-067` `"09:00–16:00/16:30"`). Choosing either is a guess; choosing the wider one overclaims. |
| `conditional` | `fixed-interval-with-caveat` | partial | 12 | **NO** | The most tempting refusal: the token is parseable, but the caveat is precisely a statement that the interval may not hold (`JP-006` `"10:00–17:00 aprox.; verificar exposición"`). **A PARTIAL fact must never be promoted to a usable interval by a second parser** — that would be exactly the promotion Phase 3D-A's contract and `recorded-hours.ts`'s priority order exist to prevent. |
| `external-dependency` | `weather-or-tide-dependent` | opaque | 6 | NO | OPAQUE is documented as permanent, not "until parsed better". |
| `external-dependency` | `third-party-operator-dependent` | opaque | 13 | NO | Same. `JP-026` `"Según tienda, aprox. 11:00–20:00"` contains a clean-looking token and must still never be parsed. |
| `unknown` | `explicit-unknown-variable` | unknown | 49 | NO | Never coerced to any tier. |
| `unknown` | `qualitative-uncategorized` | unknown | 16 | NO | Same. |
| `unknown` | `missing` | unknown | 0 | NO | Does not occur in this dataset; the rule holds regardless. |

**Eligible population: 65 places (30.4%). Eligible *and* numerically evaluable: 62 (29.0%).**

Structural requirement for the implementing phase: eligibility must be decided by **narrowing the
existing discriminated union** (`fact.kind === "recorded-interval"`), never by re-scanning
`fact.raw` and never by testing `fact.tier === "safe"` — `tier === "safe"` also admits
`recorded-24h`, and Phase 3D-I already recorded the mirror-image trap on the closure axis
(`kind: "not-evaluable"` with `tier: "partial"`). Dispatch on the axis that actually carries the
operands.

---

## 6. Decision 2 — Parsing the interval

**Decision: YES, a later phase may add a second, strictly narrower parser, and it must not touch
`recorded-hours.ts`'s classifier.**

Shape:

```ts
// Illustrative only — NOT implemented in this phase.
type ParsedRecordedInterval =
  | { kind: "parsed"; intervalStartMinutes: number; intervalEndMinutes: number; crossesMidnight: boolean }
  | { kind: "unparseable"; reason: "shape" | "end-without-minutes" | "clock-out-of-range" | "degenerate" };
```

**Naming, so two different quantities can never be confused.** The parsed bounds are
`intervalStartMinutes`/`intervalEndMinutes`; the time the user typed is `chosenStartMinutes`
(§7, §14). They are different numbers with different provenance — one is recorded, one is a user
decision — and §9's remaining-time formula subtracts one from the other. Reusing a bare
`startMinutes` for both would make that formula readable as the interval *span*, which is exactly
the quantity Phase 3D-I evaluated and refused (§20); the implementing phase must keep the two names
distinct for that reason, not for style.

Constraints, all load-bearing:

1. **Input is `RecordedHoursFact & { kind: "recorded-interval" }` only** — never a `string`, never
   `place.schedule.hours`. The type makes it structurally impossible to feed this parser a PARTIAL
   or OPAQUE record, which is a stronger guarantee than a documented convention.
2. **It is strictly narrower than `TIME_RANGE_RE`, never a re-implementation of it.** It anchors
   (`^…$` against the token), requires both ends to have minutes, and range-checks the components.
   Every input it refuses is a `fixed-interval-clean` SAFE fact that stays SAFE and simply gets no
   arithmetic — refusal narrows, it never reclassifies.
3. **It never runs on `fact.raw`.** Only on `fact.intervalRaw`.

Behaviour on each case named in the brief, with the dataset evidence:

| Case | Decision | Present today |
|---|---|---:|
| `09:00–17:00` (U+2013) | Parse. `intervalStartMinutes = 540`, `intervalEndMinutes = 1020`. | 65 / 65 |
| `09:00-17:00` (ASCII hyphen) | Accept the separator (the classifier already does); nothing else changes. | 0 |
| `09:00—17:00` (em dash) | Same. | 0 |
| `09:00–17` (end without minutes) | **Refuse** — `"end-without-minutes"`. Assuming `:00` invents a bound the record does not state. | 0 |
| `00:00` as start | Parse normally — `intervalStartMinutes = 0` is a legitimate midnight start, not a sentinel. | 0 |
| `09:00–00:00` (ends at midnight) | **Refuse via the overnight branch** — `intervalEndMinutes (0) < intervalStartMinutes (540)`, so `crossesMidnight` is true and §12 defers it. Mapping `00:00` to 1440 is a special case that would be the only place in this design where a recorded value is silently rewritten. | 0 |
| `18:00–02:00` (overnight) | Parse to `crossesMidnight: true`, then **defer** — §12. | 0 |
| `09:00–09:00` (degenerate) | **Refuse** — `"degenerate"`. A zero-minute recorded window admits no positive duration, and equality is far more plausibly a data defect than a real instantaneous interval. It must specifically **not** be read as "always open". | 0 |
| `25:00–26:00` (invalid hour) | **Refuse** — `"clock-out-of-range"`. Note this shape classifies SAFE today (§3.1). | 0 |
| `17:00–09:00` where overnight is *not* meant | **Indistinguishable from overnight by shape**, and both land in the same deferred branch, so no wrong answer is produced either way. Deferring overnight (§12) is what makes this safe; a future overnight implementation must confront it. | 0 |
| Bound equality in the *fit* comparison (`start + duration === end`) | **Counts as fitting** — see below. | see §9 |

**Equality semantics, stated once and precisely.** A visit that ends at exactly the recorded
closing minute is *inside the recorded interval*, because the interval as recorded is inclusive of
its stated end. This is a statement about arithmetic on two recorded numbers, and it is
deliberately **not** a claim about last admission, final entry, or whether a visitor may still be
inside at closing — none of which this dataset records for any place. §16's wording keeps that
distinction visible.

**Nothing is built for shapes the data does not have.** Every "0 present today" row above exists as
a *refusal*, which costs one branch, not as *support*, which would cost a model. The only cases
with real records are the plain U+2013 `HH:MM–HH:MM` form (65/65) and the fit comparison itself.

---

## 7. Decision 3 — The visit start time

**Decision: `visitStartTime` is an explicit manual decision by the user, and nothing else.**

It must never be inferred from `bestTime`, route order, the interval's opening time, transport or
transfer data, the recorded duration, or another place's time. There is **no default**: not
`09:00`, not the opening time, not "now". A place with no start time entered yields
`no-start-time-chosen` (§14) and nothing is displayed beyond what already renders today.

Auto-filling the opening time deserves its own refusal, because it is the most defensible-sounding
one: it would make the feature look useful immediately for all 62 places, and it would convert a
recorded fact into a user decision the user never made. The moment the field is prefilled, every
downstream result becomes a statement about Nihon's guess rather than about the user's plan.

**Type: a local civil clock time, `HH:mm`, 24-hour, zero-padded** (`"09:00"`, `"14:30"`), validated
by shape *and* range (`00:00`–`23:59`), refused rather than coerced on anything else — the same
discipline `withStartDate`/`isValidCivilDate` already apply to the calendar anchor. **It is not
converted to a UTC instant, a `Date`, or an epoch value at any point.**

**Granularity: one time per (place, day-assigned occurrence).** Because a valid `DayAssignment`
places every route id in exactly one bucket exactly once (§3.4), a `placeId` key is sufficient and
unambiguous; a composite `(dayIndex, placeId)` key would add a second source of truth for a fact
the partition invariant already guarantees.

**No end time is ever entered or stored.** The visit's end is derived from the recorded duration,
which is exactly what the feature is testing. Letting the user enter both would make the recorded
duration decorative.

---

## 8. Decision 4 — Timezone

**Decision: the first implementation must NOT introduce an IANA timezone, and must not be allowed
to acquire one implicitly.**

The two cases are genuinely different, and only one of them is in scope:

**Case A — civil clock arithmetic, one place, one day (in scope).**
`intervalStartMinutes`, `intervalEndMinutes` and the entered `HH:mm` are all *minutes since local
midnight* in the
same, single, unnamed local frame. `start + duration ≤ end` is exact integer arithmetic on three
values that are already in the same frame. No instant is constructed, so there is no instant to
place on a timeline, and no offset to apply. A timezone would be inert data.

**Case B — absolute instants (out of scope).**
Departure/arrival timestamps, DST transitions, travel between zones, comparison against a real
clock, or anything ordered against another place's time. All of these require a real IANA zone —
and `transit.ts` already models exactly this, with a required `timeZone: string` on every
`TransitRouteRequest` (§3.7). That module is where absolute time belongs, and it is dormant.

**The contract, stated so it cannot be misread as an assumption about Japan:**

- The absence of a timezone here is a **scope boundary**, not a claim that Asia/Tokyo is implied,
  and not a shortcut taken because Japan currently observes no DST. If the dataset were extended to
  a second country tomorrow, **the arithmetic in Case A would still be correct**, because it never
  leaves the local frame. That is the actual justification, and it does not depend on the dataset.
- `Asia/Tokyo` must not be hardcoded anywhere, not even as a comment-level assumption or a
  formatting default.
- No function in the approved scope may return, accept, or construct a `Date`, an epoch number, or
  an ISO instant. Names must not suggest one: `visitStartLocalTime` / `chosenStartMinutes`, never
  `visitStartAt`, `visitTimestamp`, or `startInstant`.
- If any future phase needs Case B, it must introduce the zone **explicitly and visibly at that
  point**, as a new decision — never by widening a Case A type.

---

## 9. Decision 5 — Duration semantics

`resolveDuration()` returns a range, and **all 77 numerically resolvable durations in both SAFE
groups are ranges; none is a point value** (§4.2). A range therefore cannot be treated as an edge
case.

Let `R` = the recorded minutes remaining from the chosen start to the recorded end —
`intervalEndMinutes − chosenStartMinutes`, with `chosenStartMinutes` already known to lie inside
the interval (§14).

`R` is **not** the interval's span. The span (`intervalEndMinutes − intervalStartMinutes`) is the
quantity Phase 3D-I evaluated and refused, and it is not part of the approved scope (§20); `R`
depends on the user's chosen start and is what makes the three-way rule below produce more than one
answer. Substituting the span here would silently rebuild the refused check.

| Condition | Outcome | What it is allowed to mean |
|---|---|---|
| `maxMinutes ≤ R` | **fits** | Even the longest recorded duration ends at or before the recorded closing minute. |
| `minMinutes ≤ R < maxMinutes` | **only the minimum fits** | The shortest recorded duration ends in time; the longest does not. Which one applies is not recorded, so no stronger statement is available. |
| `R < minMinutes` | **exceeds** | Even the shortest recorded duration runs past the recorded closing minute. |
| `resolveDuration() === null` | **duration not evaluable** | No numeric range was recorded (3 places, §4.2). |

Forbidden, explicitly:

- **No midpoint.** `docs/DATA_MODEL.md` already forbids averages and medians for duration
  aggregation; a midpoint here would be the same fabrication in a new place.
- **No min-only.** `min ≤ R` alone would report "fits" for a case where the recorded maximum
  plainly does not, and would delete the middle outcome entirely.
- **No max-only.** `max ≤ R` alone is a *sound* sufficient condition and can be used **inside** the
  three-way rule — but used as the whole rule it collapses the middle outcome into "exceeds",
  reporting a definite negative where the evidence supports only "the shorter reading fits".
  Neither error is acceptable, which is why the middle outcome exists.

The middle outcome is not theoretical: it is reachable for **62 of 62** evaluable places at some
start time the user could plausibly choose (§4.7).

---

## 10. Decision 6 — Relationship to closure composition

**Decision: A — keep them structurally separate. The audit confirms the initial bias, and adds a
second, independent argument the bias did not rest on.**

The approved computation takes exactly three inputs — the parsed recorded interval, the entered
start time, and the recorded duration — and **no `ClosureFact`, no `WeekdayClosureAssessment`, and
no `CompositionClass`**. It is a statement about a recorded interval; the closure axis is a
statement about recorded closures; composing them would produce a third, stronger claim that
neither supports.

Two reasons, and the second one is what the data added:

1. **Confidence laundering runs in both directions.** Phase 3D-I forbids a SAFE fact diluting a
   PARTIAL caveat. The mirror-image error is equally available here: gating the arithmetic on a
   closure evidence class would make the arithmetic *appear* to carry closure evidence, when it
   carries none.
2. **Gating would silently delete 42 of 62 places, and the deletion would itself read as a
   claim.** Only 20 of the 65 SAFE-interval places are `jointly-presentable` (§4.8). A UI that
   showed a duration-fit line for exactly those 20 would communicate "we only tell you this where
   it is safe to go" — a visitability signal, produced by omission, which is precisely the claim
   this gate refuses to make.

The corollaries the phase brief asked to be preserved all hold, untouched, because this feature
never reads the closure axis at all:

- An UNKNOWN closure does not disappear because hours are SAFE — `HoursClosureCompositionNotice`
  continues to render exactly as Phase 3D-J shipped it.
- An OPAQUE closure never becomes "abierto" — nothing here writes that word (§16).
- A `candidate-weekday` PARTIAL closure keeps its caveat — `WeekdayClosureNotice` is not modified.
- `no-known-closure` does **not** mean "guaranteed open", and this feature must never be rendered
  in a way that could combine with it to suggest so.

**The presentation constraint that follows** (binding on the implementing phase, and the reason
"structurally separate" is not the whole answer): the new notice must render *alongside* the
existing closure notices, never in place of them, never above them, and never in a way that lets a
reader compose the two into a visitability statement. Concretely — the new line names the recorded
interval in its own wording (§16), does not use the day-card's composed-notice styling, and does
not suppress or reorder anything Phase 3D-B or 3D-J renders.

**`duration fits recorded interval` ≠ `place is visitable`** is the formal, load-bearing
distinction of this document. Every naming, wording, and structural decision above exists to keep
those two statements from being confused.

---

## 11. Decision 8 — What may be said about `recorded-24h`

**Decision: nothing beyond restating the recorded text. `recorded-24h` produces
`interval-not-evaluable` (§14) and no fit outcome, positive or negative.**

Three independent reasons, any one of which is sufficient:

1. **There is no operand.** `known-24h` records no start and no end. A 1440-minute span would be
   fabricated by this feature, not read from the record — the same fabrication §6 refuses for
   `09:00–17`.
2. **The records contradict the reading.** 3 of 15 narrow themselves to a sub-facility in their own
   SAFE text (§4.9), and `JP-016` names a `06:00–17:00` hall interval that the `known-24h`
   classification discards. A "fits" line on Sensō-ji would be arithmetically consistent with the
   fact and flatly at odds with the record it came from.
3. **A 24 h span is not evidence about a visit.** 90 minutes inside a 24 h record says nothing
   about real access, temporary closure, weather, maintenance, admission, or reservations — the
   exact list the phase brief names, and the exact list `docs/TEMPORAL_DATA_CONTRACT.md` says a
   static dataset cannot resolve.

Note the trap being refused: for all 15 places the arithmetic would trivially succeed, so this is a
refusal of a result that is *true and useless* — true as arithmetic, and read by any user as
"you can go". These 15 places continue to be described by the existing "Horarios registrados"
section exactly as they are today.

---

## 12. Decision 9 — Overnight intervals

**Decision: DEFER. The first implementation must detect overnight intervals and refuse them, not
model them.**

Evidence: **0 of 65** SAFE interval tokens cross midnight; every one has `end > start` (§4.4). The
whole dataset's opening range is 06:00–22:30 (§4.3). There is no record to serve.

Required behaviour: the §6 parser sets `crossesMidnight: true` when
`intervalEndMinutes < intervalStartMinutes`, and the
evaluator returns `interval-not-evaluable` with reason `overnight-interval-not-supported`. This is
a named refusal that appears in the closed union — not a silent skip, and not a wrong answer.

Recorded so that deferring is a decision rather than an oversight, a future overnight model would
have to settle all of the following, none of which the current architecture answers:

- **Rollover representation** — presumably `intervalEndMinutes + 1440` when the end precedes the
  start, making the interval `[intervalStartMinutes, intervalEndMinutes + 1440)` on a single
  expanded axis.
- **Which civil date owns the start** — the assigned day's date owns the start time; the end then
  falls on the *following* civil date. That second date is derivable (`addCivilDays(visitDate, 1)`)
  but it is a **new** date the current contract never produces.
- **What "ends the next day" means for every other axis** — `assessWeekdayClosure` would have a
  weekday for the start date and a different one for the end date, and Phase 3D-B's contract says
  nothing about which applies. This alone is a design gate's worth of work.
- **Disambiguation from a data defect** — `17:00–09:00` is shape-identical whether it means
  overnight or a transposed record (§6).

For the same reason `00:00` as an end bound is refused (§6): supporting it is indistinguishable
from supporting overnight, and the dataset has neither.

---

## 13. Decision 7 — The date contract

**Decision: reuse Phase 3D-H/3D-J's existing strict contract unchanged. No second date contract is
invented.**

The implementing phase uses `deriveHoursClosureVisitDate()` (or an identical guard, if a shared
helper is extracted without changing behaviour): `dayAssignment.valid === true`, a valid
`startDate`, the place in **exactly one** day bucket, and `isValidCivilDate` on the derived date.
Any failure yields `visit-date-not-evaluable` (§14) for that place, with no partial reading.

**One honest qualification, stated because overstating it would be a small lie that matters:** the
arithmetic in §9 does **not** consume the civil date. It is pure clock arithmetic. The date contract
governs *whether a start-time input exists for this place at all* and *where it is rendered* —
because a start time is a decision about a specific day, and a place with no valid assigned day has
no day for the user to be deciding about. Adopting the strict contract keeps the new input from
appearing on a day card whose own assignment is structurally invalid, next to notices that have
already suppressed themselves for exactly that reason.

`ManualPlanningDraftV2` still has no trip end date, and this phase does not add one.

---

## 14. Decision 10 — The closed result union

Illustrative shape only; **no `.ts` file is created by this phase.**

```ts
// Illustrative only — NOT implemented in this phase.
type RecordedIntervalDurationFit =
  // --- inputs missing or not evaluable ---
  | { kind: "visit-date-not-evaluable" }
  | { kind: "no-start-time-chosen" }
  | {
      kind: "interval-not-evaluable";
      reason:
        | "hours-not-a-recorded-interval"      // every family in §5 except fixed-interval-clean
        | "interval-token-unparseable"          // §6: shape / end-without-minutes / clock-out-of-range / degenerate
        | "overnight-interval-not-supported";   // §12
    }
  | { kind: "duration-not-evaluable" }
  | { kind: "start-time-outside-recorded-interval"; chosenStartMinutes: number }
  // --- evaluated ---
  | { kind: "recorded-duration-fits-interval";       remainingMinutes: number; duration: MinuteRange }
  | { kind: "only-minimum-duration-fits-interval";   remainingMinutes: number; duration: MinuteRange }
  | { kind: "recorded-duration-exceeds-interval";    remainingMinutes: number; duration: MinuteRange };
```

The phase brief required seven distinctions; this is eight. The addition is
`start-time-outside-recorded-interval`, and it is a real need rather than an invention: a user can
type `07:00` for a place recorded as `09:00–17:00`. That is neither "does not fit" (the duration
might fit perfectly well from opening) nor an unevaluable input (every operand is present and
valid) — it is a distinct, informative fact about the entered time. Folding it into "exceeds" would
report a false negative. It covers both `chosenStartMinutes < intervalStartMinutes` and
`chosenStartMinutes ≥ intervalEndMinutes`.

Naming rules, enforced by the union itself:

- **Every evaluated variant names the recorded interval**, not the place. No `open`, `available`,
  `feasible`, `visitable`, `valid`, `ok`, or `compatible` appears anywhere in the type — not as a
  variant, not as a field, not as a boolean.
- **No booleans at all.** A `boolean` field cannot carry the middle outcome, and any consumer that
  reduced this union to one would be discarding the distinction the union exists for.
- `remainingMinutes` and `duration` are carried on the evaluated variants so a consumer can render
  the arithmetic without recomputing it, and so a test can assert on the numbers rather than on a
  formatted string.
- Every refusal is **named**. There is no `null`, no `undefined`, and no catch-all.

---

## 15. `bestTime` stays completely separate

`bestTime` is OPAQUE, tier-wise, for all 214 places, and
`docs/TEMPORAL_DATA_CONTRACT.md` §3 already forbids treating it as an hours source without an
explicit new product decision. **This gate makes no such decision, and this section is that refusal
stated positively.**

Audited explicitly against the real records: `bestTime = "Mañana"` does **not** mean —

| Claim | Counterexample from the 65 SAFE-interval places |
|---|---|
| "opens in the morning" | `JP-004` Takeshita Street — `"Mañana"`, recorded `10:00–20:00`. |
| "must be visited in the morning" | `JP-024` Nezu Shrine — `"Mañana"`, recorded `06:00–17:00`; eleven recorded hours, no recorded preference among them. |
| "09:00" | `JP-004` again: the recorded interval does not begin until 10:00, so a `bestTime`-derived 09:00 start would fall **outside** the recorded interval entirely. |
| "before noon" | `JP-032` Tsukiji Outer Market — `"Mañana"`, recorded `06:00–14:00`: the record's own afternoon is two hours long. |

`"Apertura"` is the value that most looks like an hours signal, and it is not one either: of its 3
places, two (`JP-203` Tokyo Disneyland, `JP-204` Tokyo DisneySea) record
`schedule.hours = "Calendario variable"` — UNKNOWN, no clock time whatsoever.

`bestTime` may become an editorial recommendation surface in some future phase. It is **not**
evidence of availability, it is **never** a source for `visitStartTime` (§7), and the approved
scope must not read the field at all — structurally, the way `recorded-hours.ts` already does not.

---

## 16. Language contract (load-bearing)

Every permitted sentence describes **the record**. No permitted sentence describes the place.

**Permitted** (Spanish, matching the register Phase 3D-B/3D-E/3D-H/3D-J already established):

| Outcome | Permitted wording |
|---|---|
| fits | «La duración registrada cabe dentro del intervalo horario registrado.» |
| only the minimum fits | «Solo la duración mínima registrada cabe dentro del intervalo registrado.» |
| exceeds | «La duración registrada excede este intervalo horario registrado.» |
| start outside the interval | «La hora que has indicado queda fuera del intervalo horario registrado.» |
| interval not evaluable | «No hay información horaria estructurada suficiente para evaluar este intervalo.» |
| duration not evaluable | «No hay una duración numérica registrada para evaluar.» |
| no start time chosen | «Introduce una hora de inicio para comparar con el intervalo registrado.» |

**Forbidden, in any outcome, in any tone, in any tooltip:** «Está abierto», «Cerrado», «Puedes
ir», «Este horario funciona», «Este día funciona», «Disponible», «Visita válida», «Horario
garantizado», «Horario confirmado», «Compatible», «Te recomendamos ir a las…», «Mejor hora»,
«Hora óptima», and any imperative that tells the user when to go.

Four supporting rules, each forced by a specific audit finding:

1. **The word «registrado» is mandatory in every evaluated sentence** — it is what makes the
   sentence about the record rather than the place.
2. **The original raw text is always shown alongside**, exactly as `HoursPlanningSection` and
   `HoursClosureCompositionNotice` already do. §4.5 is why this is non-negotiable: 61 of 65 records
   carry surrounding text, 58 of them an explicit `"aprox."`, and 7 a scope or source hedge
   (`"Tiendas…"`, `"Mayoría…"`, `"según anuncio"`). Rendering the parsed token alone would present
   an approximate, sometimes sub-facility-scoped value as an exact one.
3. **Never «confirmado», in any construction** — `JP-211` `"09:00–17:00 según anuncio"` is a SAFE
   record whose own text defers to an announcement that has not been made.
4. **No colour, icon, or badge that reads as approval or rejection** — no green check, no red
   cross. The existing `⚠`-plus-«conviene revisar» treatment is the established register, and the
   three evaluated outcomes are not a good/bad axis.

---

## 17. Persistence

**Recommendation: `visitStartTime` belongs in the persisted planning draft, in the same phase that
implements the evaluation — not as ephemeral component state.**

It matches `planning-draft.ts`'s stated criterion exactly: the module persists *user decisions*
(`routeIds`, `days`, `startDate`) and never persists *derived results*. A start time the user typed
is a decision of precisely the same nature as the calendar anchor. The **result** of the comparison
is derived and must never be stored — recomputed on read, like every other Phase 3D fact.

The ephemeral alternative was considered and rejected: `startDate` survives a reload, `days`
survives a reload, and a hand-entered time silently vanishing on refresh would be an inconsistency
the user would experience as data loss.

**Required migration, if the implementing phase is approved** (specified here, applied nowhere):

- Add `PLANNING_DRAFT_VERSION = 3` and `ManualPlanningDraftV3` with
  `visitStartTimes: Record<string, string>` — `placeId → "HH:mm"`, `{}` when empty (never `null`;
  an empty map and "no times chosen" are the same state, and two spellings of one state is a bug
  waiting to happen).
- Add `migrateV2ToV3(draft)` setting `visitStartTimes: {}` — a pure addition that reinterprets no
  existing field, exactly as `migrateV1ToV2` does. `parseStoredDraft` then chains `V1 → V2 → V3`.
  V1 remains migratable; the existing rule that an unrecognised version is treated as a missing
  draft is unchanged.
- **Shape validation:** every key a string, every value matching `^([01]\d|2[0-3]):[0-5]\d$`. A
  malformed entry invalidates the **whole** stored draft (the existing all-or-nothing rule for a
  duplicate route id or an invalid `startDate`), rather than being quietly dropped.
- **Reconciliation:** prune entries whose `placeId` is no longer in the reconciled `routeIds` — the
  same staleness rule `reconcileDraft` already applies to day buckets. This is the one place the
  new field differs from `startDate`, and for a principled reason: `startDate` is about the *trip*,
  so a route change must not touch it, while a start time is about a *place*, so it dies with that
  place.
- **On `withRoute` with an unchanged id set** (a pure reorder): keep the times. The decision is
  attached to a place, not to a position.
- **On `withDays`** (re-splitting): keep the times. The partition invariant guarantees the place is
  still in exactly one bucket, and the user's decision about that place has not changed.
- **On `resetRoute`:** clear `visitStartTimes` for pruned places via the normal
  `freshDraft`/reconcile path; times for places still saved are retained, matching how `startDate`
  is deliberately carried through a route reset.

No schema change is made by this phase.

---

## 18. Future UI (design only — nothing built)

**Location: inside the existing day card in `OrderedSequenceBuilder.tsx`, per place, rendered
after `HoursClosureCompositionNotice` and before `ReservationDeadlineNotice`.** No new surface, no
new modal, no new route-wide section. A start time is a decision about a place *on a given day*, and
the day card is the only place in the app where that pair already exists.

Shape:

- One optional `<input type="time">`-equivalent per place whose hours fact is `recorded-interval`,
  with an accessible label naming the place and the day (the pattern `ReorderableList`'s
  `labelSuffix` and Phase 3D-J's per-day `aria-label` already established).
- **Empty by default.** No placeholder that looks like a value.
- **No control at all** for the 149 places whose hours are not `recorded-interval` — rendering a
  disabled input for them would invite the reading "this place has no hours", which is false for
  every PARTIAL and OPAQUE record. Those places continue to be described by the existing sections.
- The result line renders only once a time is entered, in §16's wording, with the raw text beside it.
- The section renders nothing when it has nothing to say — the established behaviour of
  `WeekdayClosureNotice`, `HoursClosureCompositionNotice`, and `ReservationDeadlineNotice`.

Explicitly excluded from the UI design: auto-scheduling, temporal drag-and-drop, timeline or
gantt views, "optimise my day", "suggest a better time", propagating a time to other places,
sorting or reordering places by time, and any warning that appears without the user having entered
a time.

---

## 19. Explicit non-goals

None of the following is approved, designed, or started by this gate, and none of it is implied by
the phase it recommends:

1. **Transport interaction — named separately because it is the most tempting.** The route already
   has an order and known transfer durations, so an arrival time at the next place is arithmetically
   derivable. **That is scheduling, and it is expressly out of scope.** The approved feature
   evaluates one place against one hand-entered time; it never derives a second place's time,
   never chains times along a day, and never reads a `TransferEdge`.
2. An opening-hours solver, or any open/closed judgment.
3. Any `Date.now()`, "now", urgency, or countdown axis — matching every prior Phase 3D module.
4. Holidays, Japanese public holidays, seasonal calendars, or special event calendars.
5. Live or temporary verification against any official source, provider, or API. **Zero network
   requests were made to produce this document.**
6. Composition with `bestTime` (§15), `febMar2027`, or `reservation` deadlines (Phase 3D-G/H stays
   fully separate).
7. Capacity, admission, last-entry, ticketing, or queue modelling.
8. Any change to `recorded-hours.ts`'s classifier, its categories, its tiers, or its priority order.
9. Any dataset edit — including "fixing" `JP-211`'s `"según anuncio"` or `JP-016`'s discarded hall
   interval. Both are recorded here as findings; neither is a defect this phase is authorised to
   touch.
10. Overnight support (§12) and `recorded-24h` evaluation (§11).

---

## 20. Re-derivation against Phase 3D-I — coincidence, and why the conclusions differ

Every Phase 3D-I figure this gate touches was recomputed from scratch (§2). **All of them
coincide exactly:**

| Figure | Phase 3D-I | Re-derived here | Match |
|---|---:|---:|:--:|
| Places | 214 | 214 | ✓ |
| SAFE `recorded-interval` | 65 | 65 | ✓ |
| …numerically evaluable | 62 | 62 | ✓ |
| …qualitative-duration exclusions | 3 (`JP-121`, `JP-147`, `JP-211`) | 3, same ids | ✓ |
| Duration exceeding the interval **span** | 0 | 0 | ✓ |
| Boundary equality against the span | 0 | 0 | ✓ |
| Composition classes, all places | 31 / 43 / 56 / 84 | 31 / 43 / 56 / 84 | ✓ |
| Hours tier totals | 80 / 50 / 19 / 65 | 80 / 50 / 19 / 65 | ✓ |
| `bestTime` distribution | 131 / 39 / 19 / 16 / 3 + 5 | identical | ✓ |

No figure differs, so there is nothing to stop and explain.

**The conclusions differ, and that is not a contradiction — the questions are different.**
Phase 3D-I §6 evaluated *duration vs. interval span*, a comparison with **no start time**, and
found it produces one constant answer for the entire dataset: 62 of 62 fit, with 120 minutes of
slack even in the tightest case (`JP-093`). Building arithmetic to return "fits" 62 times out of 62
serves nobody, and 3D-I's refusal was correct on its own terms and remains correct.

This gate evaluates *duration vs. the interval remaining after a start time the user chose*. §4.7
re-derives what that changes: all three informative outcomes become reachable for **all 62**
places. The variable Phase 3D-I did not have — and explicitly did not include — is the user's own
start time, and it is the entire difference.

Phase 3D-I's refusal is therefore **not overturned**. The span-only check it refused is still
refused here, and is not part of the approved scope; §9 evaluates the interval *remaining from a
chosen start*, which is a different quantity that the span-only check cannot produce.

---

## 21. Executive conclusion

**APPROVE NARROW IMPLEMENTATION.**

The evidence supports a strictly limited future phase, and every decision it needs is closed by
this document:

- A real, non-trivial evaluable population: **62 of 214 places (29%)**, reached through named
  gates, with the 152 excluded places accounted for by category (§5) rather than dropped.
- Every one of the three informative outcomes is reachable for **62 of 62** evaluable places
  (§4.7) — the feature produces real distinctions, unlike the span-only check Phase 3D-I refused.
- The parsing problem is closed and total: **65 of 65** real tokens parse under the §6 parser, and
  every malformed, degenerate, out-of-range, and overnight shape has a named refusal — including
  two shapes (`09:00–17`, `25:00–26:00`) that today's classifier would call SAFE.
- Every failure mode is named in a closed union with no boolean and no catch-all (§14).
- The wording contract (§16) is forced by real records, not by taste: 61 of 65 SAFE intervals carry
  editorial hedging, and 7 attribute the interval to a sub-facility or an announcement.
- The one dangerous shortcut — `recorded-24h`, where the arithmetic would trivially succeed for all
  15 places — is refused on evidence from the records themselves (§4.9, §11).

**Conditions, which are part of the approved scope rather than follow-ups:** the draft-schema V3
migration in §17 and the full eight-variant union in §14 must ship *with* the evaluation. A version
that persists nothing, or that collapses the middle outcome, is not the phase approved here.

### Recommended future phase (proposed, NOT started, NOT scheduled, NOT approved by this document)

**Phase 3D-L — Manual Visit-Start-Time vs. Recorded Interval Fit (`fixed-interval-clean` SAFE
only).**

Exact scope:

1. A narrow parser over `RecordedHoursFact & { kind: "recorded-interval" }` only, per §6 — the
   classifier untouched.
2. A pure evaluator producing the §14 union from (parsed interval, entered `HH:mm`, resolved
   duration), with the §9 three-way range semantics.
3. A manual `HH:mm` input per eligible place inside the existing day card, empty by default, per
   §7 and §18.
4. `ManualPlanningDraftV3` with `visitStartTimes`, `migrateV2ToV3`, shape validation, and staleness
   pruning, per §17.
5. Wording strictly per §16, with the raw text always shown alongside.
6. Date gating reusing the existing Phase 3D-H/3D-J contract unchanged, per §13.

Out of that phase's scope, restated: `recorded-24h`, overnight, timezones, transport chaining,
scheduling, suggestions, `bestTime`, dataset edits, and any change to an existing classifier.

**Phase 3D-L is proposed only.** It is not started, not scheduled, and not approved by this
document — following this codebase's own precedent, where Phase 3D-G recommended but did not
schedule Phase 3D-H, and Phase 3D-I recommended but did not schedule Phase 3D-J.

---

## 22. What this phase changed

`docs/VISIT_TIME_FEASIBILITY_DESIGN.md` (this file, new) and `docs/ROADMAP.md` (one new phase entry
plus a wording correction in "Later (unscheduled)").

No `.ts`, `.tsx`, or `.css` file; no `data/places.json` or `app/src/data/places.json`; no workbook;
no `seasonal-alerts.json`; no `package.json`; no lockfile; no new dependency; no schema or
persistence change; no visit times introduced anywhere. The four Vitest harnesses used for §4 were
temporary and deleted (§2). No Phase 3D-L work was started.
