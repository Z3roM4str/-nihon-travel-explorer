# Phase 3F-J — Route-Wide Official Reservation Calendar Runtime

Status: **runtime implemented and validated — eligible for Ready transition**

Base: `671b5980b23f8f856dd7c55f156d3431b7bae72f` (`main` after Phase 3F-I, merge of PR #78)

Branch: `feat/phase-3f-j-route-wide-official-reservation-calendar-runtime`

Phase 3F-J implements exactly the design gate approved by Phase 3F-I: one route-wide, read-only,
**chronology-only** view of the Phase 3F official reservation facts already derived for the current
plan. It is a second view of existing facts. It derives nothing, claims nothing new and ranks
nothing.

---

## 1. Architecture

| Layer | Module | Responsibility |
| --- | --- | --- |
| Domain | `app/src/lib/reservation-mechanism-calendar.ts` | Pure aggregator: plan → chronologically ordered items |
| Presentation | `app/src/lib/reservation-mechanism-calendar-presentation.ts` | The one row element with no existing equivalent: an application window's two edges as one span, plus its anchor note |
| Integration | `app/src/components/OrderedSequenceBuilder.tsx` | One `OfficialReservationCalendarSection` in the dated `days` view |

### 1.1 What the aggregator reuses rather than reimplements

- Phase 3F-D `deriveReservationMechanismDatesForPlannedPlace` — the sole owner of visit-date and
  official-date derivation. Every date is consumed verbatim.
- Phase 3F-F `buildOfficialReservationDatePresentation` — all scope labels, headings, detail lines,
  allocation copy, provenance text, source URL, recorded clock times and the unknown-timezone
  disclosure.
- Phase 3F-H `evaluateOfficialReservationReferenceDate` and
  `buildOfficialReservationReferenceRelationPresentation` — the relation and its fail-closed
  identity composition, unchanged.

No calendar arithmetic, date formatting, relation vocabulary or presentation state is duplicated.

---

## 2. Result and item shape

```ts
type RouteWideOfficialReservationCalendar = {
  chronological: readonly RouteWideOfficialReservationCalendarItem[];
  referenceDate: string | null;
};
```

Exactly two fields. There is no `withoutApplicableDate`, no neutral-item type, no dateless list and
no field that could grow into one — a test pins the key set.

Each item carries `recordId`, `placeId`, `scope`, `placeName`, `dayNumber`, `dayId` (the stable
opaque draft day id when the caller has it, `null` otherwise, never invented), `visitDate`,
`anchorDate`, `fact`, the exact Phase 3F-F `presentation`, and the Phase 3F-H `relation` or `null`.

```ts
fact:
  | { kind: "release-date" }
  | { kind: "application-date-span"; openDate: string; closeDate: string; spanText: string };
```

`spanText` is the one addition to the design's illustrative shape: the two recorded edges rendered
together as one neutral span. It is produced by the presentation module, not by the aggregator's own
formatting, and exists so the row can honour Phase 3F-I §24.4.1 without the component doing string
surgery on `detailLines`.

No field named `priority`, `rank`, `score`, `urgency`, `status`, `state`, `isOpen`, `isLate`,
`daysUntil`, `deadline`, `dueDate` or `nextAction` exists anywhere in the phase; a source scan
asserts it.

---

## 3. Eligibility and omission

The whole surface renders nothing unless `dayAssignment.valid`, `startDate` is a valid civil date,
and `chronological.length > 0`. No empty heading, no "no hay fechas" message, no absence notice.

| Derivation | Route-wide | Where it still lives |
| --- | --- | --- |
| `release-date` with a valid `releaseDate` | ✅ one item at `releaseDate` | also in its day card |
| `application-window`, both edges valid, `openDate <= closeDate` | ✅ one item at `openDate` | also in its day card |
| `application-window` with an invalid edge | ❌ zero items | its day card, unchanged |
| `application-window` with `openDate > closeDate` | ❌ zero items | its day card, unchanged |
| `not-applicable-to-visit-date` | ❌ zero items | its day card, unchanged |
| `not-derivable` | ❌ zero items | its day card, unchanged |
| `no-visit-date` | ❌ zero items | nowhere — Phase 3F-F already omits it |
| `inactive-evidence` | ❌ zero items | nowhere — Phase 3F-F already omits it |

No omitted result receives a neutral row, placeholder, warning, count, sentinel or substitute date.
An inverted span is refused outright — never swapped, sorted, repaired or direction-inferred — and
the input object is proven unmutated by test. Phase 3F-D and Phase 3F-H are both untouched.

---

## 4. Chronology comparator

Primary key `anchorDate` ascending: `releaseDate` for a release item, `openDate` for a span item.
Every value is a validated fixed-width `YYYY-MM-DD`, so lexical comparison *is* calendar comparison;
no `Date` object, instant or timezone is constructed to order this list.

Ties break on the place's position in the flattened plan (day ordinal, then position within that
day), then on the index of the record in the bundled catalog — the stable source-record order.

The comparator compares **every** key explicitly rather than relying on `Array.prototype.sort`
stability, and the input is built in plan order, so the output is reproducible for identical input on
any engine. The two sort keys are kept off the public item deliberately: exposing them would invite a
consumer to read them as a rank.

Forbidden ordering keys — allocation, requiredness, tourism grade, price, inventory, urgency,
`consultedAt`, `confidence`, `sourceEntity`, place name, visit date, relation kind — are all absent
from the module, asserted by source scan, and a behavioural test proves the order is identical across
wildly different reference dates.

**Ordering is not priority.** That is stated in the module doc, in the section disclaimer, and pinned
by tests that forbid first/next/upcoming labels, counts and progress indicators.

---

## 5. Phase 3F-H relation reuse

Not optional. Every eligible row is evaluated mechanically from the single `reservationReferenceDate`
the planner already captures at open — no second capture, no `Date.now()`, no ambient `new Date()`,
no timer, listener, worker or midnight refresh anywhere in the phase. A component test asserts
`captureDeviceLocalCivilDate(` still appears exactly once.

A `not-assessed` result yields `relation: null` and renders no line — never a placeholder, dash or
"unknown" chip. The relation never affects ordering, grouping, filtering, visibility or styling.

`referenceDate` on the result is non-null **only** when at least one row actually composed a relation
from it. That was a hostile-review finding: echoing the input unconditionally would let the UI
disclose a date that was never used (for example an unusable one, or a plan whose only record has no
applicable date). The section-level disclosure now gates on that precise field.

---

## 6. UI placement and row content

One `OfficialReservationCalendarSection`, rendered once, in the `days` view, immediately after
`<AccommodationManagerSection />` and immediately before `<div className="day-list">`. Never inside a
day card, never in the builder view, no new modal and no new view. The per-day
`OfficialReservationDateNotice` is unchanged.

Heading: **`Fechas oficiales de reserva del recorrido`** (the rejected `Calendario oficial de
reservas` appears nowhere).

Each row renders: anchor official date · place name · `Día N` · visit date · scope label · the
Phase 3F-F fact heading · the fact itself (a single detail line, or the span plus its anchor note) ·
allocation when recorded · the relation when assessable · provenance · the official-source link.

No checkbox, no completion state, no task affordance, no count, no badge, no control other than the
existing link. One neutral CSS family, with nothing coloured, emphasised or iconified by date,
position or relation kind — a row whose relation reads "después" is styled identically to one that
reads "antes".

The section's disclaimer carries all five mandated points, including the explicit
*"El orden cronológico solo ordena fechas de calendario: no indica prioridad, urgencia ni en qué
orden conviene reservar."*

### 6.1 One deliberate scoping decision in the copy test

Phase 3F-I §22.3 forbids the words `prioridad` and `urgente`, while §22.2 *mandates* a disclaimer
that negates exactly those notions. The only coherent reading is that §22.3 forbids them as
*assertions*. The forbidden-vocabulary test therefore scans the section with the mandated disclaimer
paragraph excluded, and a separate test asserts the disclaimer's required negations are present
verbatim. This is recorded here rather than left as a silent exception.

---

## 7. Phase 3D separation

The aggregator reads no Phase 3D value at all — `reservation.leadTime`, `reservation.required`,
`ReservationFact`, `derivePlaceReservationDateWindow` and `evaluateReservationWindowReference` are
absent from the module and asserted absent by source scan.

Structurally, Phase 3D's route-wide `ReservationPreparationSection` renders in the **builder** view
and this calendar in the **days** view. Tests assert neither appears inside the other's view subtree,
and the browser audit checks both views directly. No shared heading, container, count or precedence
exists, and no source conflict is inferred or flagged.

---

## 8. Timezone, booking state, persistence

No timezone conversion, `Intl` use, `Date.parse` of source strings, instant generation, offset
arithmetic or DST logic is introduced. `Asia/Tokyo` stays recorded evidence; `null` stays explicitly
unknown; recorded times are displayed and compared with nothing.

No open/closed, availability, inventory, sold-out, late, deadline, countdown or remaining-time claim
appears anywhere. The Phase 3F-H civil-date relation remains the maximum current-date claim.

Nothing is persisted. Unchanged: `ManualPlanningDraftV7`, `nihon.manualPlanningDraft`, every storage
key, evidence JSON, places data, the workbook, package manifests and dependencies. No V8. The browser
audit asserts the persisted draft contains none of `anchorDate`, `chronological`,
`application-date-span`, `spanText`, `referenceDate`, `relation` or any derived date, and that a
reload brings nothing back.

---

## 9. Exact changed files

Added:

- `app/src/lib/reservation-mechanism-calendar.ts`
- `app/src/lib/reservation-mechanism-calendar.test.ts`
- `app/src/lib/reservation-mechanism-calendar-presentation.ts`
- `app/src/lib/reservation-mechanism-calendar-presentation.test.ts`
- `app/src/components/OrderedSequenceBuilder.official-reservation-calendar.test.ts`
- `app/scripts/phase3f-j-browser-audit.mjs`
- `docs/ROUTE_WIDE_OFFICIAL_RESERVATION_CALENDAR_RUNTIME.md`

Modified:

- `app/src/components/OrderedSequenceBuilder.tsx` — one imported aggregator, one memoised
  derivation, one new section component, one render site.
- `app/src/lib/reservation-mechanism-presentation.ts` — `formatRecordedDateTime` exported. Strictly
  additive: no behaviour, copy or signature change. Exporting it is what keeps the span rendering
  from becoming a second implementation of the timezone disclosure.
- `app/src/App.css` — one neutral `.official-reservation-calendar` family.
- `docs/ROADMAP.md` — Phase 3F-J section.

Not touched: reservation-mechanism evidence JSON and its parity copy, canonical places data, the
workbook, Phase 3F-D arithmetic, Phase 3F-H evaluator semantics, any Phase 3D module, the planning
draft schema/storage/hook, and `package.json`.

---

## 10. Tests

| File | Tests |
| --- | --- |
| `reservation-mechanism-calendar.test.ts` | 48 |
| `reservation-mechanism-calendar-presentation.test.ts` | 7 |
| `OrderedSequenceBuilder.official-reservation-calendar.test.ts` | 19 |
| `reservation-mechanism-date-derivation.test.ts` | 29 |
| `reservation-mechanism-evidence.test.ts` | 16 |
| `reservation-mechanism-presentation.test.ts` | 14 |
| `reservation-mechanism-reference-date.test.ts` | 38 |
| `reservation-mechanism-reference-date-presentation.test.ts` | 15 |
| `OrderedSequenceBuilder.official-reservation-reference-date.test.ts` | 14 |
| `reservation-planning.test.ts` | 18 |
| `reservation-window-reference.test.ts` | 16 |
| `reservation-window-reference-presentation.test.ts` | 3 |
| `OrderedSequenceBuilder.reservation-window-reference.test.ts` | 7 |
| `OrderedSequenceBuilder.test.ts` | 91 |

Focused run: **14 files, 335 passed, 0 failed.**

The aggregator suite covers every case the mission required, including the synthetic invalid-edge and
inverted-span cases no bundled record produces, each tie-break tier proved by inverting its input,
identity and provenance preservation, multiple scopes staying separate, determinism, non-mutation,
host-timezone invariance, and the full source-boundary scan (no clock, instant, `Intl`, network,
storage, React, Phase 3D domain, provenance-freshness input, ranking vocabulary or re-derived
arithmetic).

---

## 11. Validation

Executed on the real checkout at final code HEAD `55d0f19208e0a02d27920daa92ee852e5cbbffad`:

- focused: **14 files, 335/335 passed, 0 failed**
- full Vitest: **62 files, 2357/2357 passed, 0 failed**
- `npm run lint` (oxlint): exit **0**
- `npm run build` (`tsc -b && vite build`): exit **0**
- `git diff --check 671b5980b23f8f856dd7c55f156d3431b7bae72f...HEAD`: exit **0**
- working-tree `git diff --check`: exit **0**

### 11.1 Browser audit

`node app/scripts/phase3f-j-browser-audit.mjs`:

| Scenario | Result |
| --- | --- |
| A — chronological multi-place order | pass: plan order 1,2,3,4 renders as day order 2,4,1,3 |
| B — same-date tie | pass: two rows sharing 20 dic 2026, ordered by position within the day |
| C — Ghibli | pass: 10 ene 2027 · `10:00 (Asia/Tokyo)`, provenance and source link |
| D — Disneyland unknown timezone | pass: `14:00` + unknown-timezone disclosure, no `Asia/Tokyo`/JST/UTC+9 |
| E — Katsura | pass: exactly one range row, both edges + times, anchor note, no standalone close row |
| F — Sumo applicable | pass: 6 feb 2027, no invented clock time |
| G — Sumo outside period | pass: no route-wide section at all; the per-day neutral item is intact |
| H — Phase 3D separation | pass: `reservation-prep` only in the builder view, calendar only in days, never nested |
| I — move place between days | pass: `Día`, visit date and anchor date all recompute together |
| J — start-date change | pass: every anchor recomputes |
| K — intra-day reorder | pass: only the tie order changes |
| L — clear start date | pass: the entire section disappears |
| M — reload | pass: nothing derived is persisted and nothing stale returns |
| N — reference-date disclosure | pass: shown once at section level, not collapsible, Phase 3F-H vocabulary unchanged |

Console errors **0**, page errors **0** in every run. No assertion was relaxed; every reference-date
scenario fixes the browser's civil date before boot with the Phase 3F-H deterministic `Date` shim and
asserts it took effect.

- Phase 3F-J browser audit #1: **PASS**
- Phase 3F-J browser audit #2: **PASS**, same final code HEAD
- Phase 3F-H regression audit: **PASS**, 0/0
- Phase 3F-F regression audit: **PASS**, 0/0

Environment note: the container's Playwright-managed Chromium build revision differs from the
expected one, so a filesystem path bridge exists **outside** the repository. No repository file or
dependency was changed for it.

---

## 12. Hostile review

All twenty required checks were run against the implementation. Two findings were fixed **during**
implementation, before any validation gate ran, so no gate needed restarting:

1. **`referenceDate` could name a date no relation ever used.** The aggregator echoed its input
   unconditionally, so an unusable reference date — or a plan whose only record had no applicable
   date — still reported one. It is now non-null only when a relation actually composed, and the
   section-level disclosure gates on that field. Covered by a new test.
2. **Provenance freshness was not explicitly fenced.** The source-boundary scan did not forbid
   `consultedAt`, `confidence` or `sourceEntity` as aggregator inputs, even though Phase 3F-I §8.4
   and §15 forbid them as ordering or freshness signals. Added to the scan.

One further issue surfaced from the existing suite rather than the review: the component name
`RouteWideOfficialReservationCalendarSection` produced a JSX tag beginning `<Route`, which the
existing Phase 3D-W guard in `OrderedSequenceBuilder.trip-bounds.test.ts` forbids as a router route.
The component was renamed to `OfficialReservationCalendarSection` rather than weakening that guard;
the module and type names remain as the design gate specifies.

The remaining checks — chronology implying priority, relation affecting order or style, Phase 3D
leakage, a window becoming two rows, a repaired inverted span, a fallback row, a sentinel date,
identity mismatch, lost source order, alphabetical sorting, booking-state vocabulary, timezone
inference, a second clock capture, a persisted aggregate, schema/storage growth, implicit conflict
resolution, wrong view, duplicate section, and day-card regression — were all verified clean, each by
a test, a source scan or a browser scenario.

---

## 13. Commits

| SHA | Files |
| --- | --- |
| `8ae1779` | `reservation-mechanism-calendar.ts`, `reservation-mechanism-calendar.test.ts`, `reservation-mechanism-calendar-presentation.ts`, `reservation-mechanism-calendar-presentation.test.ts`, `reservation-mechanism-presentation.ts` |
| `e905e17` | `OrderedSequenceBuilder.tsx`, `OrderedSequenceBuilder.official-reservation-calendar.test.ts`, `App.css` |
| `55d0f19` | `scripts/phase3f-j-browser-audit.mjs` |

`55d0f19208e0a02d27920daa92ee852e5cbbffad` is the **final code HEAD**. Every gate above ran against
it. Documentation commits follow it and change only `docs/`, so they do not invalidate the browser
result.

---

## 14. Validation commands

```bash
cd app
npx vitest run \
  src/lib/reservation-mechanism-calendar.test.ts \
  src/lib/reservation-mechanism-calendar-presentation.test.ts \
  src/components/OrderedSequenceBuilder.official-reservation-calendar.test.ts \
  src/lib/reservation-mechanism-date-derivation.test.ts \
  src/lib/reservation-mechanism-evidence.test.ts \
  src/lib/reservation-mechanism-presentation.test.ts \
  src/lib/reservation-mechanism-reference-date.test.ts \
  src/lib/reservation-mechanism-reference-date-presentation.test.ts \
  src/components/OrderedSequenceBuilder.official-reservation-reference-date.test.ts \
  src/lib/reservation-planning.test.ts \
  src/lib/reservation-window-reference.test.ts \
  src/lib/reservation-window-reference-presentation.test.ts \
  src/components/OrderedSequenceBuilder.reservation-window-reference.test.ts \
  src/components/OrderedSequenceBuilder.test.ts
npm test
npm run lint
npm run build
cd ..
git diff --check 671b5980b23f8f856dd7c55f156d3431b7bae72f...HEAD
git diff --check
cd app
node scripts/phase3f-j-browser-audit.mjs
node scripts/phase3f-j-browser-audit.mjs
node scripts/phase3f-h-browser-audit.mjs
node scripts/phase3f-f-browser-audit.mjs
```

---

## 15. Ready state

**VALIDATED — ELIGIBLE FOR READY TRANSITION.**

Focused tests, full regression, lint, build, both whitespace checks, two consecutive Phase 3F-J
browser audits and both Phase 3F-F/3F-H regression audits passed on the final code state. At the time
this execution record was written, the pull request was deliberately left in **Draft** for independent
focused review. PR #79 subsequently passed that review, transitioned out of Draft, and was merged into
`main`. Phase 3F-K was not started by this runtime phase.
