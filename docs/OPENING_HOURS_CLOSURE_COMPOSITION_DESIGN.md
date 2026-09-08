# Opening-Hours & Closure Composition Design Gate (Phase 3D-I)

**Status: design/audit only. No runtime code, UI, or dataset changed by this document.**

Phase 3D-B (`app/src/lib/temporal-availability.ts`) and Phase 3D-E (`app/src/lib/recorded-hours.ts`)
already turn `schedule.closures` and `schedule.hours` into two independent, conservative runtime
facts. Both modules' own documentation is explicit that they were built to stay apart:
`recorded-hours.ts` states it "never reads `bestTime`, `schedule.closures`, or `febMar2027`" and
that composing any of them "would exceed the evidence a single field can support," and
`docs/TEMPORAL_DATA_CONTRACT.md`'s own domain-model sketch says a combined `TemporalAvailability`
type "still has NOT been built... exactly as this sketch's own boundary rules require."

This document is the **gate** that decision has been waiting for — it decides *whether*, *for
which* tier combinations, and *under what exact rules* those two already-audited facts could ever
be shown together for a place assigned to a specific day, without ever asserting that the place is
open, closed, compatible, available, or that "this day works." It does this **without writing the
feature**, following this codebase's own established precedent (Phase 3B2E's "Access-Point
Override Design," and Phase 3D-G's own `RESERVATION_DEADLINE_DESIGN.md`, which this document
mirrors in structure and rigor).

The word "feasibility" is deliberately avoided in this document's title and throughout: this gate
does not decide, and no phase built on top of it may claim, whether a place can actually be
visited. It only decides how much of what is *already recorded and already classified* may be
shown side by side.

---

## 1. Executive decision

**Composition is safe, but only as a strictly confidence-preserving operation — never confidence-
increasing — and only down to a four-class, exhaustive vocabulary derived directly from the tiers
Phase 3D-B and Phase 3D-E already assign.** Given one place's `RecordedHoursFact` and one
`ClosureFact`, the two facts' tiers (`safe`/`partial`/`opaque`/`unknown`, identical vocabulary on
both sides) combine by taking the **weaker** of the two — nothing here ever produces a stronger
composed statement than either input alone would support.

Re-derived independently against the real 214-place dataset, using the actual TypeScript
classifiers (`interpretPlaceHours`/`interpretClosureText`), not a re-implementation or
approximation:

| Composition class | Rule | Places | Composable? |
|---|---|---:|---|
| **jointly-presentable** | both facts SAFE | **31** | **Yes** — show both facts plainly, side by side |
| **present-with-caveat** | worse tier is PARTIAL | **43** | **Yes, but** the PARTIAL side's caveat text must remain visible and undiminished |
| **keep-separate** | worse tier is OPAQUE | **56** | No single composed statement — render each fact in its own existing section, unchanged |
| **not-composable** | worse tier is UNKNOWN | **84** | No composition of any kind |

`31 + 43 + 56 + 84 = 214` ✓, re-derived, not assumed (§3).

This is a real, non-trivial population: **74/214 places (35%)** fall in `jointly-presentable` or
`present-with-caveat` — a genuine candidate for a future per-day composed signal, unlike, for
example, Phase 3D-G's Class D (1 real record) or the duration-fit check this document also
evaluates and refuses (§6). But composability is a **presentation** decision, never a promotion of
confidence: a future implementation must never let `jointly-presentable` or `present-with-caveat`
be read as "this place works on this day" — see §7's language contract for exactly what is and is
not permitted to be said about them.

---

## 2. Current architecture (what this gate builds on top of, not replaces)

### 2.1 `RecordedHoursFact` (Phase 3D-E, `app/src/lib/recorded-hours.ts`)

`interpretHoursText(raw)` / `interpretPlaceHours(place)` classify `schedule.hours` into a closed,
kind-tagged union: `recorded-24h` (tier `safe`), `recorded-interval` (tier `safe`, carries
`intervalRaw` — the only kind that does), `conditional` (tier `partial`, 7 categories folded
together), `external-dependency` (tier `opaque`, 2 categories), `unknown` (tier `unknown`, 3
categories). 14 `HoursCategory` values total, an exact port of `scripts/temporal_data_lib.py`'s
`classify_hours()` with identical priority order. This module never reads `schedule.closures`,
`bestTime`, or `febMar2027` (verified again directly against the current file, `recorded-hours.ts`
lines 41–47). Its only current runtime consumer is `hours-planning.ts`'s
`buildRecordedHoursSummary`, rendered by `HoursPlanningSection` in `OrderedSequenceBuilder.tsx`
**before any day split** (line 1017) — a route-wide summary with no date, no day, and no place
omitted regardless of tier.

### 2.2 `ClosureFact` (Phase 3D-B, `app/src/lib/temporal-availability.ts`)

`interpretClosureText(raw)` classifies `schedule.closures` into a closed union: `no-known-closure`
(tier `safe`), `candidate-weekday` (tier `partial`, one or more extracted weekdays), `not-evaluable`
(tier `partial`/`opaque`/`unknown` — **not a single tier**, see the load-bearing note below). 11
`ClosureCategory` values, exact port of `classify_closures()`. This module never reads
`schedule.hours`, `bestTime`, or `febMar2027` either (`temporal-availability.ts` lines 14–17).

**Load-bearing finding for this gate.** `not-evaluable`'s `tier` field is
`Exclude<TemporalTier, "safe">` — it can legitimately be `partial`, not only `opaque`/`unknown`.
The real dataset has exactly **one** such record: `JP-019`, `schedule.closures = "Sin cierre
ordinario; clima"`, category `no-ordinary-closure-with-caveat`, `kind: "not-evaluable"`, **tier
`partial`** — confirmed directly against the live classifier, not assumed from the type shape. A
naive future implementation that branches on `ClosureFact.kind` (`"no-known-closure"` = safe,
anything else = worse) rather than `ClosureFact.tier` would silently misclassify this one record as
`opaque`/`unknown`-equivalent when it is actually `partial`. **Any future implementation of this
gate's decision must dispatch on `.tier`, never on `.kind`.**

`buildDayWeekdaySignal` (`day-weekday-signal.ts`) is the one `Place[]`-aware consumer, composing
`ClosureFact` with a day bucket's derived civil date via `assessWeekdayClosure`, rendered by
`WeekdayClosureNotice` inside each day card (`OrderedSequenceBuilder.tsx` line 1214) — the existing
precedent for "a per-day, per-place temporal signal."

### 2.3 The day-view date contract — two existing precedents, not one

`OrderedSequenceBuilder.tsx` currently computes a day's derived date **two different ways**,
confirmed by re-reading the live file:

- **The looser contract** (line 1167): `const dayDate = startDate ? addCivilDays(startDate,
  dayIndex) : null;` — computed unconditionally, regardless of `dayAssignment.valid`. This is what
  feeds `buildDayWeekdaySignal`/`WeekdayClosureNotice` (Phase 3D-B).
- **The stricter contract** (`reservation-deadline.ts`'s `deriveVisitDateForPlace`, Phase 3D-H):
  requires `dayAssignment.valid === true` **and** a valid `startDate` **and** the place belonging to
  exactly one day bucket, before returning a visit date for that specific place — not just the day
  bucket as a whole. Phase 3D-H's own documentation is explicit about why: "a reservation-range
  derivation is a stronger claim than a weekday label, so it requires `valid === true` where the
  weekday signal does not."

**This gate adopts the stricter contract, for the same reason Phase 3D-H did.** A composed
hours+closures statement — even a conservative one — is a stronger combined claim than either
signal alone, exactly the same reasoning that justified Phase 3D-H's stricter guard over Phase
3D-B's looser one. §5 makes this precondition explicit.

### 2.4 What is deliberately absent today

No field on `Place`, `RecordedHoursFact`, or `ClosureFact` carries a combined signal. No code path
composes hours and closures today. `bestTime` and `febMar2027` are excluded from both modules by
their own documented design (`docs/TEMPORAL_DATA_CONTRACT.md` §3, §5) and this gate does not revisit
that exclusion (§8).

---

## 3. Real-data inventory (re-derived from the live TypeScript classifiers, not copied)

Re-run against the live 214-place dataset (`app/src/data/places.json`, byte-identical to
`data/places.json`), calling `interpretPlaceHours(place)` and
`interpretClosureText(place.schedule.closures)` directly — no Python approximation, no
re-implementation of the classifiers for this audit.

### 3.1 Full 4×4 cross-tab, hours-tier × closure-tier

| hours \ closures | safe | partial | opaque | unknown | row total |
|---|---:|---:|---:|---:|---:|
| **safe** | 31 | 18 | 19 | 12 | 80 |
| **partial** | 15 | 10 | 20 | 5 | 50 |
| **opaque** | 0 | 0 | 17 | 2 | 19 |
| **unknown** | 15 | 3 | 27 | 20 | 65 |
| **column total** | 61 | 31 | 83 | 39 | **214** |

Row/column totals match `docs/TEMPORAL_DATA_CONTRACT.md`'s independently-audited single-axis
coverage exactly (hours: SAFE 80/PARTIAL 50/OPAQUE 19/UNKNOWN 65; closures: SAFE 61/PARTIAL
31/OPAQUE 83/UNKNOWN 39) — a cross-check that this gate's re-derivation agrees with the existing
Phase 3D-A/3D-B/3D-E audits, not a new, disagreeing count.

**Notable structural finding:** `opaque × safe` and `opaque × partial` are both **0**. No place
whose hours are OPAQUE (weather/tide- or third-party-dependent) has SAFE or PARTIAL closures in the
current dataset — not assumed, confirmed by the classifier run. This is a real-data fact, not a
structural guarantee; a future dataset change could populate these cells, and any future
implementation must not assume they stay empty.

### 3.2 Real categories observed within each tier (both axes)

| Tier | `HoursCategory` values observed | `ClosureCategory` values observed |
|---|---|---|
| safe | `known-24h`, `fixed-interval-clean` | `no-known-closure` |
| partial | `known-24h-with-caveat`, `seasonal-variable`, `solar-relative`, `daytime-qualitative`, `partial-single-bound`, `ambiguous-alternative-interval`, `fixed-interval-with-caveat` | `recurring-weekday-named`, `no-ordinary-closure-with-caveat` |
| opaque | `weather-or-tide-dependent`, `third-party-operator-dependent` | `weather-or-tide-dependent`, `third-party-operator-dependent`, `temporary-specific-closure`, `irregular-weekday-pattern` |
| unknown | `explicit-unknown-variable`, `qualitative-uncategorized` | `explicit-unknown-variable`, `scheduled-but-unspecified`, `qualitative-uncategorized` |

This confirms (item 2/3 of the requested audit) that every category actually reachable at each tier
matches exactly what §2.1/§2.2's type definitions predict — no category appears at an unexpected
tier.

### 3.3 Promotion-safety check (item 1 of the requested audit)

Checked every one of the 214 places: **zero** instances where a category known to be
OPAQUE/UNKNOWN on either axis was tagged `safe` or `partial` by the live classifier.
`interpretPlaceHours`/`interpretClosureText` never promote a category to a stronger tier than
`HOURS_CATEGORY_TIER`/`CLOSURE_CATEGORY_TIER` assign it — confirmed by direct inspection of the
live output, not merely by reading the source.

### 3.4 Day-availability is not a dataset property

Item 4 of the requested audit asked what fraction of the population has a day date "potentially
available" under the current planning model. **This is not a per-place, dataset-derivable
statistic**, unlike every other number in this section — a visit date exists only once a specific
user has built a route, split it into valid day buckets, and chosen a `startDate` (Phase 3C-C/E).
All 214 places are equally *eligible* in principle; none is structurally excluded from ever getting
a visit date. What is fixed by the codebase, not by the dataset, is the **contract** for when a
place gets one at all — §2.3's stricter `deriveVisitDateForPlace` guard, adopted by this gate in
§5. This document does not fabricate a percentage where none exists.

### 3.5 A combination that looks jointly-presentable but requires care (item 5 of the requested audit)

Two real records make the risk concrete: `JP-030` (Tokyo Station Marunouchi Building,
`schedule.hours = "Estación 24 h; comercios variables"`, category `known-24h-with-caveat`, tier
`partial`) and `JP-041` (Unicorn Gundam at DiverCity, `schedule.hours = "Exterior 24 h; shows
variables"`, same category/tier) — both paired with a **SAFE** closures fact
(`"Sin cierre"`/`"Sin cierre ordinario"`, `no-known-closure`).

A naive composition might read "24h + no known closure" and render something like "generally
accessible any day" — **this would be wrong**. The `known-24h-with-caveat` category exists
precisely because the 24h baseline carries a real, attached variability caveat ("comercios
variables," "shows variables") that Phase 3D-E's own documentation calls out by name as the
worked example for why a caveat must never be dropped just because a safe-looking token appears
first in the string. Composing this with a SAFE closures fact must not dilute or hide that caveat —
the composed class here is correctly `present-with-caveat` (§1), not `jointly-presentable`, and any
future rendering must keep the PARTIAL side's raw text fully visible, exactly as prominently as it
is shown today in the un-composed `HoursPlanningSection`.

This is the general form of the risk this gate exists to name: **a SAFE fact on one axis must never
be used to visually or textually launder a PARTIAL/OPAQUE caveat on the other axis.** §6's
provenance rule is written specifically to block this.

---

## 4. Composition classes (closed vocabulary)

```
type CompositionClass =
  | "jointly-presentable"   // both facts SAFE
  | "present-with-caveat"   // the weaker of the two facts is PARTIAL
  | "keep-separate"         // the weaker of the two facts is OPAQUE
  | "not-composable";       // the weaker of the two facts is UNKNOWN
```

Derivation rule — a strict, total order over the four tiers, worst-tier-wins:

```
tierRank: safe = 0, partial = 1, opaque = 2, unknown = 3   (0 = strongest, 3 = weakest)
compositionClass(hoursTier, closureTier) = classFor(max(tierRank(hoursTier), tierRank(closureTier)))
```

**Why `opaque` outranks `unknown` in weakness, not the reverse.** This mirrors
`docs/TEMPORAL_DATA_CONTRACT.md`'s own ordering (`SAFE > PARTIAL > OPAQUE > UNKNOWN`, listed in that
exact order in its tier table) and rule 5's own language: "unknown must remain unknown... no
fallback branch that defaults to 'probably open' or 'probably fine.'" OPAQUE at least names a real,
identified external dependency (weather, an operator, a festival); UNKNOWN carries no extractable
information at all. Treating UNKNOWN as the weakest available signal, never eligible for any
composed presentation, is consistent with — not a new addition to — the existing tier philosophy.

Semantics of each class, restated precisely (never as a stand-in for "open"/"closed"):

- **`jointly-presentable`** — both the recorded interval/24h fact and the "no known closure" fact
  are safe to state without a caveat. A future UI may show both facts next to each other. It is
  still never permitted to combine them into a single stronger sentence than "here is what's
  recorded for hours, and here is what's recorded for closures" — see §7.
- **`present-with-caveat`** — at least one side carries a PARTIAL caveat and neither side is
  OPAQUE/UNKNOWN. Both facts may be shown together, but the PARTIAL side's caveat text is
  mandatory, not optional, and must read at least as prominently as the other side's fact (§3.5).
- **`keep-separate`** — at least one side is OPAQUE and neither is UNKNOWN. No single composed
  sentence is safe. A future implementation may still render both facts, but each in its own
  existing, unchanged section (`HoursPlanningSection`/`WeekdayClosureNotice`) — never merged.
- **`not-composable`** — at least one side is UNKNOWN. No composition of any kind. Each existing
  section renders exactly as it does today; this gate changes nothing about that rendering.

---

## 5. Provenance / confidence rule (load-bearing)

**Composition can never increase confidence beyond the weaker of its two inputs.** This is not a
style preference — it is the single rule that makes every other decision in this document
mechanical rather than a judgment call per place. Concretely:

- `safe + safe → jointly-presentable` is the **only** class that may ever omit a caveat.
- `safe + partial` and `partial + safe` both compose to `present-with-caveat` — a SAFE fact on one
  axis never absorbs or outranks a PARTIAL caveat on the other (§3.5's worked example is exactly
  this case, `partial + safe`).
- Any OPAQUE input forces at least `keep-separate`, regardless of how strong the other input is.
- Any UNKNOWN input forces `not-composable`, regardless of how strong the other input is — this is
  the same "unknown must remain unknown, no fallback to a stronger tier" rule Phase 3D-A's own
  contract established for each axis individually (§5 of `TEMPORAL_DATA_CONTRACT.md`), extended
  here to the composed case for the first time.
- `raw` text is never dropped on either side, on any class, including `jointly-presentable` — Phase
  3D-A's contract rule 1 ("raw editorial data is authoritative... preserved exactly as-is") applies
  to a composed presentation exactly as it does to each fact alone.

### 5.1 Date prerequisite

A composed signal for place P on a given day may only be computed when **all** of the following
hold — adopting Phase 3D-H's stricter contract over Phase 3D-B's looser one (§2.3), for the same
reason Phase 3D-H gave for adopting it over the weekday signal's own precedent:

1. `dayAssignment.valid === true` (the day partition is structurally unambiguous — an invalid
   assignment yields no composed signal for **any** place, not just the affected one, matching
   every prior Phase 3D-D→3D-H precedent for this exact guard).
2. `startDate !== null` and is a valid civil date.
3. P belongs to exactly one day bucket (guaranteed by condition 1).
4. `addCivilDays(startDate, dayIndex)` succeeds and the result passes `isValidCivilDate` — the same
   two-step output guard Phase 3D-H's corrective pass added to `deriveReservationDateWindow`, for
   the same reason (an extreme but already-validated numeric input can still overflow JS `Date`'s
   representable range and must never leak a malformed string).

**Explicitly rejected, matching `RESERVATION_DEADLINE_DESIGN.md` §12.2 verbatim in spirit:** there
is no trip end date anywhere in `ManualPlanningDraftV2` (`routeIds`, `days`, `startDate` only — no
upper bound), so "day N is out of trip bounds" is not a representable state and a future
implementation must not invent one or add a schema field to create it.

**Note that the closure half of this composition does not strictly need a date to say something —
`ClosureFact` alone is date-independent, and the hours half never needs a date at all.** The date
prerequisite above exists because the *weekday match* used inside `ClosureFact`'s composition
(`assessWeekdayClosure`) does need one, and a composed presentation should not show a weekday-match
outcome for one axis while the hours axis renders with no date context at all — the composed
signal is gated on the stricter, whole-signal contract for consistency, not because every part of
it individually requires it.

---

## 6. Duration-fit — explicitly evaluated and refused for now

The "Later (unscheduled)" list in `docs/ROADMAP.md` separately names "a visit-duration-fit
calculation against a recorded interval" as still not done. This gate evaluated it directly against
the real dataset, using the live classifiers (not an approximation):

- 65 places classify `recorded-interval` (SAFE, `fixed-interval-clean`).
- 62 of those have both `duration.minMinutes` and `duration.maxMinutes` populated.
- **0 of 214 places** show `duration.minMinutes` exceeding the recorded interval's span (parsed
  from `intervalRaw`, overnight-wrap handled).

**REFUSE FOR NOW.** No real population in the current dataset would ever produce a signal from this
check — building and testing interval-span-vs-duration arithmetic to serve zero real records is
exactly the disproportionate-engineering pattern Phase 3D-G's own Class D decision (§7 of
`RESERVATION_DEADLINE_DESIGN.md`, 1 real record) already established a precedent for refusing. This
is a **data-triggered** revisit condition, not a scheduled one: if a future dataset edit introduces
a place whose recorded duration genuinely exceeds its recorded interval, this check should be
re-evaluated then, with real evidence, not built speculatively now. This finding is out of scope
for the composition this gate does approve (§1) — duration-fit is a third axis (place vs. its own
recorded interval), not a composition of hours and closures.

---

## 7. Language contract (load-bearing)

**Never say, in any composed presentation, regardless of composition class:** *abierto*, *cerrado*,
*puedes ir*, *este día funciona*, *compatible*, *disponible*, *garantizado*, *horario confirmado
para tu visita*, or any translation implying a verified, live, or contractual state. None of these
terms is supportable by two independently-audited, static, editorially-recorded text fields, no
matter how strong the composition class.

**Permitted vocabulary**, matching the register already established by Phase 3D-B/3D-D/3D-H's own
notices:

- *horario registrado* / *ventana registrada* — for the hours side.
- *posible coincidencia de cierre semanal* — for a `candidate-weekday` match, exactly Phase 3D-B's
  own existing wording; never strengthened to "closed."
- *información no evaluable* — for anything landing in `keep-separate`/`not-composable`.
- *necesidad de revisión* / *conviene revisar* — for any PARTIAL caveat carried into
  `present-with-caveat`.

A `jointly-presentable` place gets the least hedged language this gate ever permits, and even then
only "esto es lo que está registrado" — never "esto es lo que hay," "esto es correcto hoy," or any
phrasing that reads as live-verified. Nothing in this document authorizes claiming inventory,
capacity, or real-time state, which no field audited here (or anywhere in the current dataset)
supports.

---

## 8. Explicit non-goals

- No opening-hours solver, feasibility check, or "this day works" judgment of any kind — restated
  because it is this document's entire reason for existing, not a sign of scope creep it must guard
  against.
- No `Date.now()`, no current-time/wall-clock axis, no "ahora," no timezone-of-now.
- No holiday or special-calendar closure handling — no field in the dataset supports one.
- No temporary or live closure verification against any official source — zero network requests
  informed this document, matching every prior Phase 3D-A→3D-H document.
- No availability/capacity/inventory claim of any kind.
- No reservation availability composition — `reservation-deadline.ts` (Phase 3D-G/H) stays a fully
  separate axis; this gate does not touch it or revisit its own already-decided orthogonality rule.
- No automatic day recommendation, redistribution, or route optimization.
- No composition with `bestTime` — remains excluded per `TEMPORAL_DATA_CONTRACT.md` §3's own
  boundary, unrevisited here.
- No composition with `febMar2027` — remains its own trip-window-confidence axis per
  `TEMPORAL_DATA_CONTRACT.md` §5 and `RESERVATION_DEADLINE_DESIGN.md` §6.2's orthogonality rule;
  this gate does not create a second, competing composition path for it.
- No external API or provider queries of any kind.
- Duration-fit is evaluated and refused for now (§6) — not part of this gate's approved scope.
- No runtime code, UI, dataset, or schema/persistence change of any kind in this phase.
- No Phase 3D-J (or any later phase) work started by this document.

---

## 9. Proposed domain model — sketched, not implemented

```ts
// Illustrative — a possible app/src/lib/hours-closure-composition.ts (NOT implemented this phase)

export type CompositionClass =
  | "jointly-presentable"
  | "present-with-caveat"
  | "keep-separate"
  | "not-composable";

export type HoursClosureComposition =
  | { kind: "no-visit-date" }                     // §5.1's date prerequisite not met
  | {
      kind: "composed";
      compositionClass: CompositionClass;
      hours: RecordedHoursFact;                   // raw always carried, never dropped
      closure: ClosureFact;                        // raw always carried, never dropped
      weekdayAssessment: WeekdayClosureAssessment;  // reuses Phase 3D-B's existing assessment
    };

/**
 * Pure. Never reads Date.now(), bestTime, or febMar2027. Never produces open/closed/feasible/
 * available booleans anywhere in this type. compositionClass is derived purely from
 * hours.tier/closure.tier via the worst-tier-wins rule (§4/§5) — never from .kind, and never
 * re-interprets either fact's own classification.
 */
declare function composeHoursAndClosure(
  hours: RecordedHoursFact,
  closure: ClosureFact,
  weekdayAssessment: WeekdayClosureAssessment
): HoursClosureComposition;
```

This sketch deliberately has **no** `open`, `closed`, or `feasible` boolean anywhere, matching the
existing precedent `TEMPORAL_DATA_CONTRACT.md`'s own sketch established for `HoursFact`/`ClosureFact`
individually. Naming and exact shape are illustrative, not a locked contract, exactly as
`RESERVATION_DEADLINE_DESIGN.md` §10's own sketch describes itself.

---

## 10. Future UI surface (NOT implemented)

Evaluated against the real architecture, not assumed: the natural home is inside each day card of
`OrderedSequenceBuilder.tsx`, next to `WeekdayClosureNotice` and `ReservationDeadlineNotice` (both
already render there, lines 1214–1215) — the same "extend the existing day card, don't fragment
into a new surface" pattern every prior Phase 3D UI addition has followed. `HoursPlanningSection`
(route-wide, line 1017) would stay exactly as-is; a future composed notice would be an *additional*
per-day signal, never a replacement for it, matching how `ReservationDeadlineNotice` did not replace
`ReservationPreparationSection`.

This is a recommendation for a future phase to verify against the UI current at that time, not a
final decision made here — `RESERVATION_DEADLINE_DESIGN.md` §11 makes the identical caveat about its
own UI recommendation.

---

## 11. Future test strategy (for the phase that implements this)

Modeled on the existing Phase 3D-B/3D-E/3D-H test suites, precedent-for-precedent:

1. **Full tier-combination matrix** — all 16 `(hoursTier, closureTier)` pairs, asserting the exact
   `CompositionClass` the worst-tier-wins rule predicts, including both `partial+safe` and
   `safe+partial` (order must not matter — commutativity is a structural invariant to pin).
2. **Real-dataset regression** — re-derive §3.1's 4×4 cross-tab (31/18/19/12/15/10/20/5/0/0/17/2/
   15/3/27/20 = 214) as a pinned regression, the same technique `recorded-hours.test.ts` uses for
   its own tier totals.
3. **No-promotion invariant** — assert no `HoursCategory`/`ClosureCategory` known to be
   OPAQUE/UNKNOWN ever yields a `jointly-presentable`/`present-with-caveat` class, across all 214
   real places and a table of synthetic adversarial strings.
4. **`.tier`-dispatch, not `.kind`-dispatch** — a dedicated test using the real
   `no-ordinary-closure-with-caveat` record (`JP-019`) proving the composition reads `closure.tier
   === "partial"`, not `closure.kind === "not-evaluable"` treated as automatically opaque/unknown.
5. **Malformed-input behavior** — empty/missing `schedule.hours`/`schedule.closures` strings behave
   identically to every existing Phase 3D-B/3D-E test for the same inputs (never a new failure
   mode introduced by composition).
6. **Invalid/missing date behavior** — no day split, invalid partition, missing `startDate`,
   invalid `startDate` string, and an `addCivilDays` overflow (mirroring Phase 3D-H's corrective
   `isValidCivilDate` guard) each yield `"no-visit-date"`, never a guessed or partial result.
7. **Source-scanning structural check** — no `open`/`closed`/`feasible`/`available` boolean
   anywhere in the new type, the same technique `feb-mar-status.test.ts` and
   `reservation-deadline.test.ts` already apply to their own types.
8. **Determinism** — calling the composition function twice with identical inputs yields
   byte-identical output (no hidden `Date.now()`/randomness), the same structural check
   `reservation-deadline.test.ts` uses for its own cross-axis orthogonality proof.
9. **Language/forbidden-phrase source-scan**, once a UI consumer exists — the established
   `OrderedSequenceBuilder.test.ts` technique, checked against §7's exact forbidden list.

---

## 12. Future browser QA (NOT executed this phase — no runtime shipped)

For the phase that implements this gate's decision, representative cases to verify manually:

1. A real `jointly-presentable` place (e.g. `JP-017`, Asakusa Culture Tourist Information Center) —
   both facts shown plainly, no caveat implied.
2. A real `present-with-caveat` place (e.g. `JP-030`, Tokyo Station Marunouchi Building) — the
   `known-24h-with-caveat` text remains fully visible and at least as prominent as the closures
   fact next to it.
3. A `present-with-caveat` place from the other direction (SAFE hours + PARTIAL closures,
   `recurring-weekday-named`) — the weekday caveat is not diluted by the safe hours fact.
4. A `keep-separate` place (OPAQUE on either axis) — both facts still render, in their existing,
   separate sections; no merged sentence appears.
5. A `not-composable` place (UNKNOWN on either axis) — rendering is unchanged from today.
6. No `startDate` set — no composed signal for any place, existing sections unaffected.
7. An invalid day-partition (`dayAssignment.valid === false`) — no composed signal for **any**
   place in the day, matching Phase 3D-B/3D-H's existing behavior for the same condition.
8. Moving a place between days — the composed signal (if any) follows the place to its new day's
   date, never the old one; no stale composed signal survives a route/day edit.
9. Mobile/narrow width — no clipping or overflow of the composed notice, checked at the same
   breakpoint every prior Phase 3D UI addition has used (390px).

This phase does not execute any of the above — there is no runtime surface to test yet.

---

## 13. Recommended next phase and exact scope

**Phase 3D-J (proposed name, pending confirmation at that time) — a narrow implementation of
exactly §1's `jointly-presentable`/`present-with-caveat` composition, gated on §5.1's date
prerequisite, using the domain model sketched in §9, per the test/QA strategy in §11/§12.**
`keep-separate` and `not-composable` places would continue rendering exactly as they do today —
this gate does not ask a future phase to change anything about them beyond leaving them alone.

**This phase (3D-I) recommends but does not schedule 3D-J** — per this codebase's own established
precedent (Phase 3D-G recommended but did not schedule 3D-H), no later phase is started here, and
3D-J is not approved, only proposed.

---

## Known pre-existing documentation gap (not addressed by this phase)

`docs/DATA_MODEL.md` does not currently mention Phase 3D-G or Phase 3D-H (`reservation-deadline.ts`,
`ReservationDeadlineSignal`, `ReservationDateWindow`) at all — confirmed by direct grep against the
live file. This predates this gate, is unrelated to the hours/closures composition question this
document decides, and this document does not attempt to fix it — recorded here only so the gap is
not lost, per the instruction that created this phase.
