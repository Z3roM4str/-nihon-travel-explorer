# Reservation Deadline Design Gate (Phase 3D-G)

**Status: design/audit only. No runtime code, UI, or dataset changed by this document.**

Phase 3D-D (`app/src/lib/reservation-lead-time.ts`) already turns the audited
`reservation.leadTime` free text into a conservative `ReservationLeadTimeFact`: a coarse
days/weeks/months magnitude when the text safely supports one, and an honest "specific mechanism,
needs review" flag when it does not. It deliberately stops there — no numeric `minDays`/`maxDays`,
no booking-by date, no comparison against `startDate` or today's date, no lottery/release
interpretation, no availability claim (see that module's own doc and `docs/ROADMAP.md`'s Phase
3D-D entry).

This document is the **gate** Phase 3D-D's own "Later (unscheduled)" item asks for before any of
that gets built: it decides *which* existing `reservation.leadTime` values could ever safely
support a deterministic date window, on what conditions, with what exact semantics — and it decides
this **without writing the feature**. Everything here is a contract for a future phase to build
against, not code landed ahead of a consumer, following this codebase's own established precedent
(Phase 3B2E's "Access-Point Override Design," and Phase 3D-A's "Proposed domain model — sketched,
not implemented" in `docs/TEMPORAL_DATA_CONTRACT.md`).

---

## 1. Executive decision

**A narrow, deterministic "recorded lead-time window" CAN be safely computed for exactly one
evidence class in the current dataset: an explicit numeric range paired with a single, non-mixed,
non-month unit (days or weeks) — 5 places today, all using "semanas."** Everything else must
remain a non-computable, manual-review signal:

| Evidence class | Distinct values | Places | Computable? |
|---|---:|---:|---|
| A — numeric range + single day/week unit | 3 | 5 | **Yes** — exact day-count bounds |
| B — unit only, no quantity | 2 | 5 | No — would require fabricating a number |
| C — mixed coarse units, no quantity | 1 | 10 | No — would require fabricating both a number and a unit choice |
| D — numeric range involving months | 1 | 1 | **No, for a first implementation** — see §7 |
| E — specific mechanism / OPAQUE | 58 | 65 | No — by design, permanently (§8) |
| not-applicable | 1 | 128 | N/A — no reservation lead time recorded at all |

Of 214 places, **at most 5 (2.3%)** could ever receive a computed date window under this design,
and only once BOTH an explicit day/date assignment and a valid `startDate` exist for that place
(§5). The other 209 places keep exactly what Phase 3D-D already gives them: a coarse magnitude or
an opaque "needs review" flag, with the recorded text always shown verbatim.

This is a small, honest surface — not a shortfall. The dataset's own bare-magnitude population
(§3–4) simply does not contain enough numeric precision to support more than that without
inventing numbers the editorial data never claimed. A future implementation must resist the
temptation to widen this scope by loosening Phase 3D-D's classifier or by guessing at unit-only/
mixed-unit records; §4 and §8 exist specifically to block that.

---

## 2. Current architecture (what this design must build on top of, not replace)

### 2.1 The audited lead-time classification (Phase 3D-D)

`app/src/lib/reservation-lead-time.ts`:

- `classifyLeadTimeCategory(raw)` — a direct port of `scripts/temporal_data_lib.py`'s
  `classify_lead_time()`: `not-applicable` (empty or `"—"`), `bare-magnitude` (the **whole**
  trimmed string matches `BARE_MAGNITUDE_RE`), or `opaque-entity-or-mechanism-specific` (anything
  else).
- `BARE_MAGNITUDE_RE = /^(?:\d+\s*[–—-]\s*\d+\s*)?(d[ií]as?(?:\/semanas?)?|semanas?(?:\/meses?)?|meses?)$/i`
  — anchored (`^...$`), so a magnitude-shaped substring inside a longer sentence never qualifies.
- **Load-bearing finding for this design:** capture group 1 in that regex captures ONLY the unit
  phrase (`"semanas"`, `"días/semanas"`, ...) — the optional numeric-range prefix
  (`(?:\d+\s*[–—-]\s*\d+\s*)?`) is a **non-capturing** group. `deriveMagnitude()` reads group 1
  only, so `"1–2 semanas"` and bare `"Semanas"` both resolve to the exact same
  `magnitude: "weeks"`. **The existing `ReservationLeadTimeFact.magnitude` field cannot
  distinguish a numeric-range record from a unit-only record.** Any future numeric-bounds
  extractor must re-match `raw` with its own pattern that DOES capture the digits — it cannot
  reverse-engineer them from `magnitude`. See §10.
- `ReservationLeadTimeFact` is a closed union (`not-applicable` / `coarse-magnitude` /
  `specific-mechanism`); `raw` is preserved verbatim on every variant.

### 2.2 The route-wide aggregation (Phase 3D-D)

`app/src/lib/reservation-planning.ts`'s `buildReservationPreparationSummary(places)` composes
`ReservationLeadTimeFact` with `reservation.ts`'s `ReservationFact` per place, over the current
canonical route, omitting `not-applicable` places, never resorting, and throwing on a duplicate
`place.id`. Rendered by `OrderedSequenceBuilder.tsx`'s `ReservationPreparationSection` (its
"Reservas por preparar" section, wired at line 906 via `buildReservationPreparationSummary(routePlaces)`
at lines 712–714) in the route builder view — **before** any day split exists.

### 2.3 The manual plan: route, optional day assignment, calendar anchor

`app/src/lib/planning-draft.ts`'s `ManualPlanningDraftV2`:

```ts
export type ManualPlanningDraftV2 = {
  version: 2;
  routeIds: string[];             // Phase 3C-A: the ordered route
  days: string[][] | null;        // Phase 3C-C: optional day split, null = not split yet
  startDate: string | null;       // Phase 3C-E: civil date (YYYY-MM-DD) anchoring "Día 1"
};
```

- `days === null` means the route has never been split into days. When non-null, each inner array
  is one ordinal day bucket's explicit place-id list (`app/src/lib/planning-draft.ts:43–48`).
- `startDate` is independent of `routeIds`/`days` — a route or day-bucket edit never touches it
  (`planning-draft.ts:56–61`).
- `app/src/lib/day-assignment.ts`'s `validateDayPartition(routeIds, days)` / `buildDayAssignment`
  produce `DayAssignment.valid: boolean` — `true` **exactly when every route id appears in
  exactly one day, in exactly one position, with no extras** (`day-assignment.ts:51–57,66–98`).
  `OrderedSequenceBuilder.tsx` already surfaces `!dayAssignment.valid` as a user-facing warning
  ("El reparto actual no coincide exactamente con el recorrido") rather than trusting a broken
  partition silently.
- `app/src/lib/civil-date.ts`'s `addCivilDays(iso, offsetDays)` shifts a `YYYY-MM-DD` string by a
  whole number of calendar days (positive or negative), correctly rolling over month/year/leap-day
  boundaries, entirely in UTC component arithmetic (`Date.UTC`/`getUTC*`) so it is
  **timezone-invariant** — the hazard the module's own doc calls out by name
  (`civil-date.ts:10–17`). It returns `null` for an invalid input date rather than guessing
  (`civil-date.test.ts:58–61` pins this down, including negative offsets:
  `civil-date.test.ts:39–43`).
- **The existing precedent for "day index → derived civil date → per-place fact":**
  `OrderedSequenceBuilder.tsx` line 1058: `const dayDate = startDate ? addCivilDays(startDate, dayIndex) : null;`
  followed by line 1059: `const weekdaySignal = buildDayWeekdaySignal(places, dayDate);` — this is
  exactly the pattern (`day-weekday-signal.ts`) a future visit-date-derived lead-time window would
  reuse. Phase 3D-B already proved this composition works and is well-tested; §5 below builds the
  same contract for reservation deadlines.

### 2.4 What is deliberately absent today

No field on `Place`, `ManualPlanningDraftV2`, or any Phase 3D-D/3D-E/3D-F fact carries a numeric
day count, a calendar date derived from lead time, or an "is late"/"book now" signal. `Date.now()`
does not appear in any of `reservation-lead-time.ts`, `reservation-planning.ts`, `civil-date.ts`,
or `day-weekday-signal.ts` (verified by grep across all four files). This design gate does not
change that.

---

## 3. Full real-data inventory (re-derived from `data/places.json`, not copied from docs)

Re-run with a temporary, uncommitted script against the live 214-place dataset
(`python3` against `data/places.json`, mirroring `_BARE_MAGNITUDE_RE`/`classify_lead_time()`
exactly):

**214 places, 66 distinct raw `reservation.leadTime` values.**

| Category | Places | Distinct raw values |
|---|---:|---:|
| `not-applicable` | 128 | 1 (`"—"`) |
| `bare-magnitude` | 21 | 7 |
| `opaque-entity-or-mechanism-specific` | 65 | 58 |

These three totals (128 / 21 / 65) match `docs/TEMPORAL_DATA_CONTRACT.md`'s existing record
exactly — re-derived independently here, not assumed.

### 3.1 Every `bare-magnitude` raw value (all 7, exhaustive)

| Raw value | Places |
|---|---:|
| `"1–2 semanas"` | 2 |
| `"2–4 semanas"` | 2 |
| `"2–6 semanas"` | 1 |
| `"1–3 meses"` | 1 |
| `"Días"` | 2 |
| `"Semanas"` | 3 |
| `"Días/semanas"` | 10 |

### 3.2 A representative sample of `opaque-entity-or-mechanism-specific` values (58 distinct, 65 places — full list available by re-running the audit script; not reproduced in full here to keep this document reviewable)

`"Lotería 3 meses antes; revisar liberaciones"`, `"App obligatoria para timed entry desde 2026;
Express opcional"`, `"Venta oficial desde 6 feb 2027"`, `"Para Seiden desde 23 nov 2026, revisar
reserva"`, `"Grupos: reservar; individuales según operador"`, `"Mismo día en locales pequeños"`,
`"1–2 meses; venta oficial"` (×2), `"Alojamiento 4–8 meses"`, `"Según exposición"` (×3),
`"Participación: proceso separado"`, `"Venta oficial pendiente"`, and 47 more distinct values of
the same shape: either a genuine external mechanism (lottery, timed-entry app, official on-sale
date), an already-fixed calendar date embedded in prose (not a lead-time duration at all — see
§8.3), or a magnitude-shaped substring embedded in a longer, operationally important sentence.

---

## 4. Computability partition (exact counts, evidence classes A–E)

Re-run against the 21 `bare-magnitude` records specifically, splitting by (a) whether an explicit
numeric range prefix is present and (b) the unit:

| Class | Definition | Distinct values | Places | Values |
|---|---|---:|---:|---|
| **A** | Explicit numeric range + single day/week unit | 3 | **5** | `"1–2 semanas"` (2), `"2–4 semanas"` (2), `"2–6 semanas"` (1) |
| **B** | Unit only, no numeric quantity | 2 | **5** | `"Días"` (2), `"Semanas"` (3) |
| **C** | Mixed coarse units, no numeric quantity | 1 | **10** | `"Días/semanas"` (10) |
| **D** | Explicit numeric range involving months | 1 | **1** | `"1–3 meses"` (1) |
| **E** | Specific mechanism / OPAQUE (not `bare-magnitude` at all) | 58 | **65** | — see §3.2 |

`5 + 5 + 10 + 1 = 21` ✓ matches the total `bare-magnitude` count exactly.

**Notable absences, confirmed empty, not assumed:**
- **No** `"X–Y días"` numeric range exists anywhere in the current dataset (class A is 100%
  `"semanas"` today, even though the underlying regex shape would accept a days-unit range too —
  a future implementation's day/week extraction rule should stay unit-agnostic in *design* even
  though it is currently exercised by weeks-only *data*).
- **No** bare `"Meses"` (unit-only, no number) value exists.
- **No** `"Semanas/meses"` mixed-unit value exists (only `"Días/semanas"` is populated), even
  though `LeadTimeMagnitude` already has a `"weeks-to-months"` bucket ready for it.
- Class D has exactly **one** real record. This is the reason §7 treats month semantics as a
  "decide the policy, but do not build unneeded machinery for n=1" problem.

### 4.1 Why B and C must stay non-computable

`"Semanas"` alone names a unit with no quantity. Any number a future implementation might pick
(1? 2? 4?) would be **invented**, not recorded — indistinguishable in the UI from an editorially
authored fact, which it would not be. `"Días/semanas"` (10 places — the single largest
bare-magnitude bucket) additionally requires guessing *which* unit applies before even reaching
the "how many" problem. Both must remain exactly what Phase 3D-D already calls them: a coarse
magnitude, nothing more precise.

---

## 5. Visit-date source contract

**Decision: a deadline/window calculation for place P requires ALL of the following to hold
simultaneously. If any fails, the result is `"no-visit-date"` — never a fallback to `startDate`
alone, never a guess.**

1. `days !== null` (`ManualPlanningDraftV2.days`) — the route has been split into day buckets at
   all.
2. `buildDayAssignment(routeIds, days).valid === true` — P's day membership is unambiguous:
   P appears in **exactly one** day bucket, at **exactly one** position
   (`day-assignment.ts:51-57`). An invalid partition (P missing, duplicated within a day, or
   duplicated across days) yields `"no-visit-date"` for **every** place, not just the affected
   one — mirroring the existing UI's own all-or-nothing validity warning, never a partial "trust
   the parts that look fine" reading of a structurally broken assignment.
3. `startDate !== null` and `isValidCivilDate(startDate)` — already enforced at the point
   `usePlanningDraft`/`withStartDate` accept a value, but a future consumer should not assume that
   without checking, since `startDate` is stored as a plain string.
4. `addCivilDays(startDate, dayIndex)` returns a non-`null` result, where `dayIndex` is the
   **zero-based** index of the day bucket containing P (`days[dayIndex].includes(P.id)`) — "Día 1"
   in the UI is `dayIndex === 0`.

When all four hold: **`visitDate = addCivilDays(startDate, dayIndex)`** — the same expression
`OrderedSequenceBuilder.tsx` already computes at line 1058 for the weekday-closure signal, reused
verbatim, not reimplemented.

**Explicitly rejected:** using `startDate` itself (i.e., "Día 1's date") as a stand-in visit date
for a place that has not been assigned to any day, or that is only present in `routeIds` before
any day split exists. A route-wide, pre-day-split context (§11) may still show the *coarse*
lead-time signal Phase 3D-D already provides — it must never additionally compute or imply a date
window from an assumption the user has not actually made.

---

## 6. Numeric range semantics (Class A)

For an explicit range `"N₁–N₂ semanas"`, the safe derived meaning is a whole-week-to-whole-day
conversion — a week is unambiguously 7 days, unlike a month (§7):

- `minLeadDays = N₁ × 7`
- `maxLeadDays = N₂ × 7`

Worked examples from the real data: `"1–2 semanas"` → 7–14 days; `"2–4 semanas"` → 14–28 days;
`"2–6 semanas"` → 14–42 days.

Given a known `visitDate` (§5), the derived window is:

- **`earliestDate = addCivilDays(visitDate, -maxLeadDays)`** (the earlier calendar date — the far
  edge of the recorded range)
- **`latestDate = addCivilDays(visitDate, -minLeadDays)`** (the later calendar date — the near
  edge of the recorded range, still before the visit)

### 6.1 Naming discipline (load-bearing)

**Never name either date, or the window as a whole, any of:** *guaranteed release date*,
*guaranteed booking deadline*, *availability date*, *last possible booking date*, or any
translation implying certainty the source text does not carry. The raw editorial text records
advance-notice *guidance* ("1–2 semanas" = "book roughly 1–2 weeks ahead"), not a contractual or
platform-enforced deadline — no reservation platform, cutoff time, or refusal-to-book date is
named anywhere in this dataset's `reservation.leadTime` field.

**Preferred terminology**, both for internal type/field naming and any eventual user-facing
Spanish copy:

- English/code: "recorded lead-time window," "recorded advance-notice window."
- Spanish (user-facing, future): **"ventana de anticipación registrada"**, with a standing
  disclaimer such as *"ventana orientativa derivada del dato registrado; no es una fecha límite
  garantizada ni confirma disponibilidad."*

This mirrors the discipline `reservation-lead-time.ts`'s own doc already established for
`coarse-magnitude` ("Anticipación registrada," never "deadline") and extends it, rather than
introducing a new, stronger register of language for the numeric case.

---

## 7. Month semantics decision (Class D)

**Audited finding: exactly one record, `"1–3 meses"` (1 place), contains an explicit numeric
month range.** No other bare-magnitude or opaque record contains a numeric month range this
narrow rule would need to generalize over (the opaque bucket contains several *mechanism-specific*
month mentions — e.g. `"Alojamiento 4–8 meses"`, `"1–2 meses; venta oficial"` — but those are
`opaque-entity-or-mechanism-specific`, not `bare-magnitude`, and stay out of scope entirely per
§8).

Three options were compared, per the phase brief's own framing:

- **(A) Fixed-day approximation (1 month = 30 days).** Rejected. This fabricates a precision the
  source data never claims — "meses" is a calendar concept, and treating it as a fixed 30-day
  span would silently misstate the window for any date near a 28/29/31-day month, for a single
  real record, with no data-driven need to solve the general case yet.
- **(B) Civil-calendar month subtraction with end-of-month clamping**, via a new
  `addCivilMonths`-style helper analogous to `civil-date.ts`'s existing `addCivilDays` (same
  UTC-component-only discipline, same `null`-on-invalid-input contract). Semantically the most
  defensible general answer (subtracting "N months" from March 31 clamped to the shorter month,
  e.g. February 28/29, is the standard civil-calendar interpretation), but it is meaningfully more
  code — a new date-arithmetic primitive, its own clamping-edge-case test suite — to build and
  maintain for **one row in the dataset**.
- **(C) Refuse numeric computation for month-unit ranges entirely; treat them as `bare-magnitude`
  with a coarse `"months"` magnitude only** — exactly what Phase 3D-D already does for it today,
  with no new deadline signal layered on top.

**Decision: (C) for a first implementation.** Building and testing calendar-month clamping
machinery to serve a single real record is disproportionate engineering for the evidence
available, and refusing is strictly safer than approximating. If the dataset later grows a
meaningful population of numeric month-range `bare-magnitude` records, revisit with option (B) —
never (A) — and add `addCivilMonths` to `civil-date.ts` following its existing
UTC-only/`null`-on-invalid pattern at that time, not before. This is a data-triggered revisit, not
a scheduled one.

**Consequence:** the first implementation's `ReservationDeadlineSignal` (§10) only ever produces
`explicit-lead-window` for Class A (day/week unit) records. A Class D record still classifies as
`coarse-magnitude` / `magnitude: "months"` under Phase 3D-D (unchanged) and, under this design's
new layer, as `not-computable` with a reason naming exactly why (§10, §12) — never silently
dropped, never silently approximated.

---

## 8. OPAQUE mechanism boundary (Class E)

**Rule, restated and extended from Phase 3D-D's own doc:** a numeric-looking substring inside an
`opaque-entity-or-mechanism-specific` record never becomes a computable deadline, regardless of
how simple the arithmetic would look. `"Lotería 3 meses antes; revisar liberaciones"` must never
be reduced to "book 90 days before" — the lottery/release mechanism is exactly the operationally
important part of that sentence, and a coarse day-count would silently discard it while implying a
false precision.

### 8.1 Why this boundary is structural, not just a style preference

Phase 3D-D's classifier is already the sole gate: `classifyLeadTimeCategory()` only ever returns
`bare-magnitude` when the **entire, trimmed** string matches `BARE_MAGNITUDE_RE`. Any record
containing prose around a number — `"Lotería 3 meses antes; revisar liberaciones"`,
`"Venta oficial desde 6 feb 2027"`, `"Para Seiden desde 23 nov 2026, revisar reserva"` — already
fails that whole-string match and classifies `opaque-entity-or-mechanism-specific` today. A future
deadline layer must gate on `ReservationLeadTimeFact.kind === "coarse-magnitude"` (i.e., trust
Phase 3D-D's own classification) and must **never** independently re-scan `raw` for a
numeric-looking token when `kind === "specific-mechanism"`. Doing so would build a second,
competing classifier of the same field, exactly the anti-pattern Phase 3D-F's own audit called out
and eliminated for `febMar2027.status` (`alertSeverity()`'s removal, `docs/ROADMAP.md`'s Phase
3D-F entry).

### 8.2 Representative opaque records that must stay untouched

- `"Lotería 3 meses antes; revisar liberaciones"` — a lottery mechanism; the "3 meses" is
  informational context for the human reader, not a computable lead time.
- `"App obligatoria para timed entry desde 2026; Express opcional"` — a booking mechanism
  (a specific app), not a duration.
- `"Grupos: reservar; individuales según operador"` — depends on group size and an unnamed
  operator's own rule; no single number applies.
- `"Mismo día en locales pequeños"` — "same day," an entirely different shape of information (an
  upper bound near zero) that this design does not attempt to formalize, since it is not
  `bare-magnitude` and thus out of scope by the same gate.

### 8.3 A related, distinct finding: some opaque records already name a fixed calendar date

`"Venta oficial desde 6 feb 2027"` and `"Para Seiden desde 23 nov 2026, revisar reserva"` are not
"lead time before a visit" at all — they name a specific on-sale calendar date, a fundamentally
different kind of fact than a duration relative to a visit date. A future phase must not conflate
"parse the date out of this OPAQUE string" with "compute a lead-time window" — they are different
features with different risk profiles (the former would require knowing today's date to say
anything useful, which §9 explicitly defers). This design does not propose solving either for
OPAQUE records; both stay `specific-mechanism` / manual review.

---

## 9. Current-date / urgency boundary

**Decision: a first implementation must NOT know "today."** `ReservationDeadlineSignal` and
`ReservationDateWindow` (§10) are both computed relative to a **visit date** only (§5) — never
relative to `Date.now()`, the browser's clock, or any other notion of "now."

Explicitly out of scope for the first implementation, because each introduces a **second temporal
axis** (current date/time) this design does not touch:

- "You are late" / "ya deberías haber reservado."
- "Book now" / "reserva ahora."
- "Deadline passed" / "ventana vencida."
- "X days remaining" / "quedan N días."
- Any "urgent"/priority styling driven by proximity to today.

**Rationale, audited against the existing codebase's own precedent:** every prior Phase 3D runtime
module (`temporal-availability.ts`, `reservation.ts`, `reservation-lead-time.ts`,
`recorded-hours.ts`, `feb-mar-status.ts`) is deliberately date-relative-to-a-recorded-fact only,
never wall-clock-relative — none of them call `Date.now()` (verified by grep across all five
files). Introducing "today" here would be the first such axis in this codebase's temporal-data
layer, a materially different and riskier feature (it would need to handle "the user opens the app
weeks later," time zone of "now" vs. the trip's own civil dates, and importantly *when* to treat a
window as "passed" without falsely alarming a user who has, in fact, already booked — a fact this
dataset has no way to know). **This is recorded here as separately scoped future work — current-date
urgency/reminders — not started, not designed, and not part of this gate's recommended next phase
(§15).**

---

## 10. Proposed future domain model / API (illustrative — NOT implemented)

Two small, separately testable layers, mirroring this codebase's existing precedent of keeping
text-extraction and fact-application as distinct steps (e.g. `temporal-availability.ts`'s
`interpretClosureText` vs. `assessWeekdayClosure`, or `day-weekday-signal.ts`'s composition of the
two): **extracting a numeric window from the recorded text** is independent of **applying that
window to a visit date**. Neither module described below exists yet; naming and exact shapes are
illustrative starting points for the phase that actually builds this, not a locked contract.

### 10.1 Extraction: `ReservationDeadlineSignal` (pure text → structured evidence, no date)

```ts
// Illustrative — a possible app/src/lib/reservation-deadline.ts (NOT implemented in this phase)

export type ReservationDeadlineSignal =
  | {
      kind: "not-applicable";           // mirrors ReservationLeadTimeFact.kind === "not-applicable"
      raw: string;
    }
  | {
      kind: "not-computable";
      /** Named, not inferred — every reason below traces to a specific evidence class in §4/§7/§8. */
      reason:
        | "specific-mechanism"          // Class E — opaque, never re-scanned for numbers (§8)
        | "unit-without-quantity"       // Class B — "Semanas"/"Días" alone (§4.1)
        | "mixed-unit-without-quantity" // Class C — "Días/semanas" (§4.1)
        | "month-range-not-supported";  // Class D — refused for now, see §7
      raw: string;
    }
  | {
      kind: "explicit-lead-window";     // Class A ONLY
      minLeadDays: number;
      maxLeadDays: number;
      raw: string;
    };

/** Re-derives ReservationLeadTimeFact first (Phase 3D-D remains the sole classifier/tier
 * authority) and only THEN independently re-matches `raw` for an explicit numeric day/week range
 * — never reads `.magnitude` to recover digits (§2.1 explains why that is structurally
 * impossible). Never called for `kind === "specific-mechanism"` facts (§8.1). */
declare function interpretReservationDeadlineText(raw: string | null | undefined): ReservationDeadlineSignal;
```

### 10.2 Application: `ReservationDateWindow` (evidence + a visit date → a window)

```ts
// Illustrative — NOT implemented in this phase.

export type ReservationDateWindow =
  | { kind: "no-visit-date" }                     // §5's contract not satisfied
  | { kind: "no-window"; signal: ReservationDeadlineSignal } // has a visit date, but signal isn't explicit-lead-window
  | {
      kind: "derived-window";
      visitDate: string;      // YYYY-MM-DD, from addCivilDays(startDate, dayIndex) — §5
      earliestDate: string;   // YYYY-MM-DD — §6
      latestDate: string;     // YYYY-MM-DD — §6
      signal: Extract<ReservationDeadlineSignal, { kind: "explicit-lead-window" }>;
    };

/** Pure. Never reads Date.now(), never mutates the planning draft, never re-derives startDate or
 * dayIndex itself — both are passed in by the caller, which already owns that state. */
declare function deriveReservationDateWindow(
  signal: ReservationDeadlineSignal,
  visitDate: string | null   // null whenever §5's contract isn't met — computed by the caller
): ReservationDateWindow;
```

### 10.3 Critical requirements (all satisfied by the shapes above; restated explicitly per the phase brief)

- **No availability boolean** — no field named `available`, `bookable`, `open`, or equivalent,
  anywhere in either type.
- **No "bookable" boolean.**
- **No current-date urgency** — no field derived from `Date.now()`, no `daysRemaining`, no
  `isLate`/`isUrgent`.
- **No reminder state** — no scheduling, no notification flag, no "dismissed" state.
- **No silent defaults** — `"not-computable"` always names a `reason`; `"no-visit-date"` is a
  distinct, explicit kind, never a `null`/`undefined` window pretending to be a valid one.
- **No parsing of OPAQUE mechanisms** — `interpretReservationDeadlineText` must gate on Phase
  3D-D's own `kind` before touching `raw` for digits (§8.1).
- **No mutation of the planning draft** — both functions are pure; `visitDate` is computed by the
  caller from the existing `ManualPlanningDraftV2` (§5), never written back into it.

---

## 11. Proposed future UI integration (NOT implemented)

Evaluated against the real architecture, not assumed:

1. **Route-wide "Reservas por preparar" (`ReservationPreparationSection`, existing).** Already
   the home of Phase 3D-D's coarse lead-time signal, rendered before any day split
   (§2.2). **Recommended: extend this surface, do not add a new card**, per the phase brief's own
   stated preference and this codebase's established pattern of composing independent axes into
   one existing summary rather than fragmenting related information (`reservation-planning.ts`'s
   own doc: "composing two independent axes ... without merging or overriding either").
2. **Per-day planning view, once a place has an assigned visit date.** This is where §5's
   contract is actually satisfiable — `OrderedSequenceBuilder.tsx`'s "days" view already has
   `dayDate` computed per bucket (line 1058) and already composes a second per-place signal there
   (`buildDayWeekdaySignal`, line 1059). A derived lead-time window is the same shape of addition:
   computed per place, per day, from that day's own already-derived date.
3. **`PlaceDetail.tsx`.** Currently shows `reservation.leadTime` as raw text only (Phase 3D-C).
   Not recommended as the primary surface for a *derived* window: `PlaceDetail` has no notion of
   "which day is this place assigned to" — it renders one place in isolation, outside route/day
   context, so it cannot satisfy §5's visit-date contract at all without importing route state it
   does not otherwise need. Leave it exactly as: raw text only.
4. **A new surface.** Not justified — nothing here requires a shape distinct enough from
   "Reservas por preparar"/the day view to warrant fragmenting related reservation
   information into a third place.

**Recommended design (to be verified against the real UI when actually implemented, not assumed
final here):**

- **Before day/date assignment** (`days === null`, or `startDate === null`): render exactly what
  `ReservationPreparationSection` already renders today — the coarse magnitude or "needs review"
  flag. No window, no "not-computable" reason surfaced yet — there is no visit date to be
  not-computable *for*.
- **After day/date assignment** (§5 satisfied) **and** the place's `ReservationDeadlineSignal` is
  `explicit-lead-window`: additionally show the derived "ventana de anticipación registrada" (§6),
  in the day view, next to that day's already-rendered weekday-closure signal — never replacing
  the raw lead-time text, which stays visible per the Phase 3D-A contract's rule 1.
- **Never automatically reorder places by deadline or urgency** — the route/day order stays
  exactly the user's own, matching every prior Phase 3D-D/3D-E aggregation's own "never resorted"
  guarantee.

---

## 12. Failure / unknown behavior

| Situation | Required behavior |
|---|---|
| `reservation.leadTime` is `"—"`/empty | `ReservationDeadlineSignal.kind = "not-applicable"` — no window attempted at all |
| `bare-magnitude`, unit-only (Class B) | `"not-computable"`, `reason: "unit-without-quantity"` |
| `bare-magnitude`, mixed unit (Class C) | `"not-computable"`, `reason: "mixed-unit-without-quantity"` |
| `bare-magnitude`, month range (Class D) | `"not-computable"`, `reason: "month-range-not-supported"` |
| `specific-mechanism` (Class E) | `"not-computable"`, `reason: "specific-mechanism"` — `raw` never re-scanned |
| Place not assigned to any day (`days === null`, or place absent from every bucket) | `ReservationDateWindow.kind = "no-visit-date"` |
| Day assignment structurally invalid (`DayAssignment.valid === false`) | `"no-visit-date"` for every place, not only the affected one (§5.2) |
| `startDate === null` or invalid | `"no-visit-date"` |
| `addCivilDays` returns `null` for any reason | `"no-visit-date"` — never fall back to an unvalidated date |
| A valid visit date exists, but the signal isn't `explicit-lead-window` | `ReservationDateWindow.kind = "no-window"`, carrying the `ReservationDeadlineSignal` so a caller can still show *why* (the `not-computable` reason, or `not-applicable`) |

No branch above ever produces a guessed number, a guessed date, or a silently empty/zeroed result
presented as if it were a real answer — every "we don't know" state is a distinct, named `kind`.

---

## 13. Explicit non-goals (this phase, and the recommended next phase)

Restated from the phase brief, all confirmed against the actual architecture above, not merely
asserted:

- Deriving `minDays`/`maxDays` for anything other than Class A (explicit day/week numeric ranges).
- Any month-range arithmetic (fixed-day or calendar-based) in a first implementation (§7).
- Knowing today's date, `Date.now()`, or any current-date/urgency claim (§9).
- Interpreting a lottery/release/timed-entry mechanism beyond flagging it for manual review (§8).
- Claiming availability, "bookable," or any boolean equivalent (§10.3).
- Any reminder, notification, or scheduled follow-up.
- Automatically booking anything, opening an external booking site, or linking to one with
  automation semantics.
- Moving places between days, changing trip dates, or reordering the route by urgency/deadline.
- Dropping a place from the route or the summary based on its deadline status.
- Using `startDate` as a proxy visit date for an unassigned place (§5).
- Modifying `data/places.json`, the workbook, or `ManualPlanningDraftV2`'s persisted schema.
- Adding a new `localStorage` key — a derived window is recomputed on read, exactly like every
  other Phase 3D fact, never persisted.

---

## 14. Test strategy for the future implementation

Modeled directly on the existing Phase 3D-D/3D-E/3D-F test suites (`reservation-lead-time.test.ts`,
`recorded-hours.test.ts`, `feb-mar-status.test.ts`), which a future implementation should follow
precedent-for-precedent rather than inventing new conventions:

1. **Extraction unit tests** (`reservation-deadline.test.ts`, pure, no `Place`): one case per
   evidence class (A–E) using the *real* raw strings from §3.1/§3.2, asserting the exact `kind`/
   `reason`/`minLeadDays`/`maxLeadDays`. Include the exact adversarial case named in the brief:
   `"Lotería 3 meses antes; revisar liberaciones"` must produce `not-computable` /
   `specific-mechanism`, never `explicit-lead-window`.
2. **Real-dataset invariant tests**: re-run the extraction across all 214 places, asserting it
   never throws, and re-deriving the exact partition counts from §4 (5 / 5 / 10 / 1 / 65 / 128) as
   a pinned regression, the same way `recorded-hours.test.ts` pins the 80/50/19/65 tier totals.
3. **Visit-date contract tests** (pure, using synthetic `ManualPlanningDraftV2`-shaped fixtures,
   the same technique `day-weekday-signal.test.ts`'s `place()` helper and
   `planning-draft.test.ts` already use): every branch of §5's contract — no day split, invalid
   partition, no `startDate`, invalid `startDate`, valid on day 0, valid on day N — each asserted
   to produce exactly the right `visitDate` or `"no-visit-date"`.
4. **Window-derivation tests**: for each Class A raw value, assert the exact `earliestDate`/
   `latestDate` against a fixed, valid `visitDate` fixture — including a case that crosses a month
   boundary and a case that crosses a year boundary, exactly mirroring `civil-date.test.ts`'s own
   boundary-crossing tests for `addCivilDays`.
5. **Never-promoted-to-availability tests**: assert no boolean field exists anywhere on
   `ReservationDeadlineSignal` or `ReservationDateWindow`, the same structural check
   `feb-mar-status.test.ts` already applies to `FebMarStatusFact`.
6. **Source-scanning integration tests** for whatever UI actually wires this in (§11) — the
   established no-jsdom technique every prior Phase 3D UI change has used
   (`OrderedSequenceBuilder.test.ts`'s `extract*SectionSource` pattern): prove the wiring, prove
   no `Date.now()`/urgency vocabulary appears, prove the raw lead-time text still renders
   alongside the derived window.
7. **Manual QA** in a real browser against at least one real Class A place (a day-assigned trip
   with a valid `startDate`), confirming the rendered window text uses the §6 terminology
   discipline and never implies a guarantee.

---

## 15. Recommended next implementation phase and exact scope

**Phase 3D-H (proposed name, pending confirmation at that time) — Explicit Lead-Time Window
(Class A only).**

Exact scope, informed entirely by this document:

- Implement `app/src/lib/reservation-deadline.ts` per §10.1 (`ReservationDeadlineSignal`) and
  §10.2 (`ReservationDateWindow`) — both pure, both tested per §14.
- Support **Class A only** (explicit day/week numeric ranges) as `explicit-lead-window`; every
  other bare-magnitude/opaque case is `not-computable` with a named reason (§12).
- No month-range support (§7) — revisit only if the dataset's Class D population grows.
- No current-date/urgency logic of any kind (§9) — a strictly separate, unscheduled future phase.
- Extend `ReservationPreparationSection` and/or the day view per §11, reusing
  `addCivilDays`/`buildDayWeekdaySignal`'s existing composition pattern rather than inventing a
  new one.
- No dataset change, no new `localStorage` key, no planning-draft schema change.

This phase (3D-G) recommends but does not schedule 3D-H — per the phase brief, no later phase is
started here.
