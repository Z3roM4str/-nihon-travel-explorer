# Phase 3F-H — Official Reservation Reference-Date Relation Runtime

Status: **runtime implemented and validated — eligible for Ready transition**

Base: `2a02bad414d1b8e01eb6bb88169506da30568677` (`main` after Phase 3F-G, merge of PR #76)

Branch: `feat/phase-3f-h-official-reservation-reference-date-relation-runtime`

Phase 3F-H implements only the civil-date relation approved by the Phase 3F-G design gate. It adds
calendar context to the existing Phase 3F official reservation surface. It does not add booking
state, availability, urgency, countdown, deadline, recommendation or action semantics.

---

## 1. Runtime architecture

Three layers, each with one job:

| Layer | Module | Responsibility |
| --- | --- | --- |
| Domain | `app/src/lib/reservation-mechanism-reference-date.ts` | Pure closed-union relation over one Phase 3F-D derivation plus one explicit civil reference date |
| Presentation | `app/src/lib/reservation-mechanism-reference-date-presentation.ts` | Strictly relational Spanish copy + fail-closed identity composition |
| Integration | `app/src/components/OrderedSequenceBuilder.tsx` | Passes the already-captured device civil date into the existing Phase 3F item |

### 1.1 Phase 3F owns its own evaluator

`evaluateOfficialReservationReferenceDate` is Phase-3F-specific. It does not call, wrap, extend or
import:

- `evaluateReservationWindowReference`;
- `ReservationWindowReferenceRelation`;
- `derivePlaceReservationDateWindow`;
- `reservation-deadline.ts`;
- any Phase 3D-H `reservation.leadTime` parsing.

The module's only imports are `./civil-date` (validation), `./reservation-mechanism-date-derivation`
(type) and `./reservation-mechanism-evidence` (type). That import set is pinned by a test.

### 1.2 Reference-date input

`OrderedSequenceBuilder` continues to capture exactly one device-local civil date at planner open:

```ts
const [reservationReferenceDate] = useState<string | null>(() => captureDeviceLocalCivilDate());
```

Phase 3F-H consumes that same concrete value. No second capture exists — a focused test asserts
`captureDeviceLocalCivilDate(` appears exactly once in the component, and that the Phase 3F notice
itself contains no `new Date(` / `Date.now(` / capture call. Sharing this environmental value does
not merge the Phase 3D and Phase 3F evidence domains: the evaluators, unions, copy and provenance
remain wholly separate.

### 1.3 Closed relation domain

```ts
type OfficialReservationReferenceRelation =
  | { kind: "not-assessed"; reason: "invalid-reference-date" | "derivation-not-date-relatable" }
  | { kind: "before-recorded-release-date" | "on-recorded-release-date" | "after-recorded-release-date";
      recordId; placeId; scope; referenceDate; releaseDate }
  | { kind: "before-recorded-application-date-span" | "within-recorded-application-date-span"
        | "after-recorded-application-date-span";
      recordId; placeId; scope; referenceDate; openDate; closeDate };
```

No boolean such as `isOpen`, `isLate` or `shouldBook` exists anywhere in the phase.

---

## 2. Domain contracts

### 2.1 Release date (`derivation.kind === "release-date"`)

| Condition | Result |
| --- | --- |
| `referenceDate < releaseDate` | `before-recorded-release-date` |
| `referenceDate === releaseDate` | `on-recorded-release-date` |
| `referenceDate > releaseDate` | `after-recorded-release-date` |

`on-recorded-release-date` means only that the two civil-date labels are equal. Ghibli's recorded
`10:00 Asia/Tokyo` is never consulted, so the result cannot mean "the sale opened", "the sale has
not opened yet", "it opens today" or "X hours remain".

### 2.2 Application window (`derivation.kind === "application-window"`)

| Condition | Result |
| --- | --- |
| `referenceDate < openDate` | `before-recorded-application-date-span` |
| `openDate <= referenceDate <= closeDate` | `within-recorded-application-date-span` |
| `referenceDate > closeDate` | `after-recorded-application-date-span` |

Both civil-date edges are inclusive. `openDate === closeDate` is a legitimate one-day span. Katsura's
recorded `05:00` open and `23:59` close times and its `null` source timezone mean an edge date can
only be described as inside the recorded **date span** — never as "applications are open", "last day"
or "closes today".

A span whose dates are each valid but **inverted** (`openDate > closeDate`) is refused before any
comparison runs, returning `{ kind: "not-assessed", reason: "derivation-not-date-relatable" }`. See
§10.1 for why this boundary cannot assume an ordered span.

### 2.3 Non-assessable statuses

`no-visit-date`, `inactive-evidence`, `not-applicable-to-visit-date` and `not-derivable` all return
`{ kind: "not-assessed", reason: "derivation-not-date-relatable" }`, as does a malformed calendar
fact — an unparseable date, or an inverted application span (§10.1). An invalid reference date
returns `{ kind: "not-assessed", reason: "invalid-reference-date" }`. The existing Phase 3F-F copy
for those states is unchanged and renders without any before/on/after line.

### 2.4 Identity, fail-closed

Every assessed relation carries `recordId`, `placeId` and `scope` copied from the derivation it was
evaluated from. `buildOfficialReservationReferenceRelationPresentation(presentation, relation)`
returns `null` unless all three match the Phase 3F-F item being annotated.

`OfficialReservationDatePresentation` gained one field, `scope`, so that composition can compare the
raw closed scope value rather than reverse-engineering it from display text.

There is no nearest match, no place-level "best relation", no cross-scope sharing and no automatic
repair. Multiple scopes stay independent and source-ordered; nothing is sorted or ranked.

### 2.5 Time and timezone exclusions

The evaluator source contains none of: `Date.now(`, `new Date(`, `Date.parse(`, `Date.UTC(`, `Intl`,
`getTimezoneOffset`, `toISOString`, `toLocaleDateString`, `Asia/Tokyo`, `releaseTimeLocal`,
`sourceTimeZone`, `openTimeLocal`, `closeTimeLocal`, `openSourceTimeZone`, `closeSourceTimeZone`.
That exclusion is asserted by test, and the behavioural property is asserted separately: mutating the
recorded times/timezones on a derivation, and changing `process.env.TZ`, never changes a result.

`Asia/Tokyo` remains visible Phase 3F-F evidence. `null` remains explicitly unknown. No JST/UTC+9,
country or operator inference is introduced anywhere.

---

## 3. Copy boundary

| Relation | Rendered sentence |
| --- | --- |
| release before | La fecha de referencia del dispositivo está antes de la fecha oficial registrada. |
| release same date | La fecha de referencia del dispositivo coincide con la fecha oficial registrada. |
| release after | La fecha de referencia del dispositivo está después de la fecha oficial registrada. |
| application before | La fecha de referencia del dispositivo está antes del tramo de fechas registrado para la solicitud. |
| application within | La fecha de referencia del dispositivo cae dentro del tramo de fechas registrado para la solicitud. |
| application after | La fecha de referencia del dispositivo está después del tramo de fechas registrado para la solicitud. |

Every assessed relation is followed by the concrete date:

> Fecha de referencia (tu dispositivo): dom, 10 ene 2027

The bare words `hoy`, `ahora` and `actualmente` are never used as the reference label. The copy never
contains open/closed, availability, inventory, sold-out, late, deadline, countdown, remaining-days,
urgency, purchase or recommendation vocabulary; unit and integration tests scan for each.

### 3.1 Placement inside the existing Phase 3F item

1. place name;
2. scope;
3. official date/window fact;
4. allocation, when recorded;
5. reference-date relation;
6. concrete reference date;
7. provenance text + official-source link.

No third reservation block was created. The Phase 3D-H/3D-O `ReservationDeadlineNotice` remains a
separate sibling section with its own evaluator, its own copy and its own CSS classes. No
intersection, union, precedence, "best booking window" or combined state exists.

### 3.2 Section disclaimer

The Phase 3F section disclaimer was updated, because the previous sentence ("No se comparan con la
fecha actual…") stopped being true once a relation exists. It now states that the comparison is
between calendar dates only, ignores the recorded time and source timezone, does not indicate current
sale state, comes from the device's local calendar, is not Japan's operating date, and does not
refresh itself while the view stays open.

---

## 4. Freshness and persistence boundaries

No timer, `setInterval`, `setTimeout`, midnight recapture, focus listener, visibility listener,
service worker, polling or scheduled refresh was added; a test scans the whole component for each.
The concrete reference date is always visible precisely because the value does not refresh.

Nothing is persisted. Unchanged: `ManualPlanningDraftV7`, `nihon.manualPlanningDraft`, every
localStorage key, evidence JSON, places data, the workbook, package manifests and dependencies. No
V8. No relation kind, reference date, derived status or timestamp is stored — every value is
recomputed from the current plan plus the captured reference date. The browser audit asserts the
persisted draft text contains none of `referenceDate`, `reservationReferenceDate`,
`recorded-release-date`, `application-date-span`, `releaseDate`, `openDate`, `closeDate`,
`not-assessed` or the scenario's reference date.

---

## 5. Deterministic browser-date mechanism

`app/scripts/phase3f-h-browser-audit.mjs` fixes the browser's local calendar date **before the
application boots** with a test-only Playwright `addInitScript` `Date` shim:

- the fixed instant is local noon on the requested civil date, computed from the original `Date`
  before shimming, so the civil date is unambiguous under any browser timezone or DST transition;
- a `Proxy` over the original `Date` intercepts only zero-argument construction, `Date.now` and
  direct `Date()` calls; explicit arguments, `Date.UTC`, `Date.parse` and the prototype are forwarded
  untouched, so `civil-date.ts`'s UTC arithmetic is unaffected;
- the shim is installed before any page script, therefore before React captures
  `reservationReferenceDate`;
- after boot each scenario asserts the browser's observed local civil date equals the requested one,
  so a scenario can never silently fall back to the machine's real date.

The shim lives only in the audit script. Production `captureDeviceLocalCivilDate` is unchanged in
semantics and still runs for real on the production call path. There is **no** production test-date
prop, URL/query override, localStorage test field, planning-draft test field, package dependency or
runtime seam of any kind.

`app/scripts/phase3f-f-browser-audit.mjs` required one narrow update: its Phase 3F-F assertion that
the official section shows no reference date became obsolete once Phase 3F-H renders one. That
assertion now asserts the disclosure is present, with a comment recording that before/on/after
behaviour is proved deterministically by the Phase 3F-H audit rather than against the host clock; one
neighbouring negative assertion was anchored on the fact line's separator for the same reason. No
other Phase 3F-F assertion changed.

---

## 6. Exact changed files

Added:

- `app/src/lib/reservation-mechanism-reference-date.ts` (includes the §10.1 inverted-span guard)
- `app/src/lib/reservation-mechanism-reference-date.test.ts`
- `app/src/lib/reservation-mechanism-reference-date-presentation.ts`
- `app/src/lib/reservation-mechanism-reference-date-presentation.test.ts`
- `app/src/components/OrderedSequenceBuilder.official-reservation-reference-date.test.ts`
- `app/scripts/phase3f-h-browser-audit.mjs`
- `docs/OFFICIAL_RESERVATION_REFERENCE_DATE_RELATION_RUNTIME.md`

Modified:

- `app/src/lib/reservation-mechanism-presentation.ts` — one added `scope` field on
  `OfficialReservationDatePresentation`, populated from the record. No copy, arithmetic or gating
  change.
- `app/src/components/OrderedSequenceBuilder.tsx` — one new prop on the existing Phase 3F notice, the
  relation evaluation/composition, two rendered lines, and the section disclaimer.
- `app/src/components/OrderedSequenceBuilder.test.ts` — three Phase 3F-F contracts updated to the new
  (still narrow) input set, JSX shape and disclaimer wording.
- `app/src/App.css` — one neutral rule pair for the two new lines. No state palette.
- `app/scripts/phase3f-f-browser-audit.mjs` — two assertions, as described in §5.
- `docs/ROADMAP.md` — Phase 3F-H section.

Not touched: reservation-mechanism evidence JSON, canonical places data, the workbook, Phase 3F-D
derivation arithmetic, Phase 3D-H derivation, the Phase 3D-O evaluator or its presentation, planning
draft schema/storage, and package manifests/dependencies.

---

## 7. Focused tests

| File | Tests |
| --- | --- |
| `app/src/lib/reservation-mechanism-reference-date.test.ts` | 38 |
| `app/src/lib/reservation-mechanism-reference-date-presentation.test.ts` | 15 |
| `app/src/components/OrderedSequenceBuilder.official-reservation-reference-date.test.ts` | 14 |
| `app/src/lib/reservation-mechanism-presentation.test.ts` | 14 |
| `app/src/lib/reservation-mechanism-evidence.test.ts` | 16 |
| `app/src/lib/reservation-mechanism-date-derivation.test.ts` | 29 |
| `app/src/components/OrderedSequenceBuilder.test.ts` | 91 |
| `app/src/components/OrderedSequenceBuilder.reservation-window-reference.test.ts` | 7 |
| `app/src/lib/reservation-window-reference.test.ts` | 16 |
| `app/src/lib/reservation-window-reference-presentation.test.ts` | 3 |

Focused run: **10 files, 243 passed, 0 failed.**

Domain coverage includes every case required by the gate: invalid reference date, no-visit,
inactive evidence, not-applicable, not-derivable, release one day before/exact/one day after, year
rollover, application one day before open, exact open, middle, exact close, one day after close,
record/place/scope identity preservation, clock-time invariance, timezone invariance, host-TZ
invariance, non-mutation, determinism, and the three identity-mismatch fail-closed cases. The
corrective in §10.1 adds an equal-edge one-day span case and four inverted-span cases.

Source-boundary coverage asserts the pure evaluator contains no `Date.now`, no ambient `new Date`,
no `Intl`/timezone conversion, no `evaluateReservationWindowReference`, no `reservation.leadTime`, no
network, no storage and no mutation, and that its import set is exactly the three modules listed in
§1.1.

---

## 8. Regression and static validation

Executed on the real checkout at final code HEAD
`63b5756570ad8cf8e8afaa4c5a504bb67d35967c`:

- full Vitest: **59 files, 2283/2283 tests passed, 0 failed**;
- `npm run lint` (oxlint): exit **0**;
- `npm run build` (`tsc -b && vite build`): exit **0**;
- `git diff --check 2a02bad414d1b8e01eb6bb88169506da30568677...HEAD`: exit **0**;
- working-tree `git diff --check`: exit **0**.

---

## 9. Browser audit results

`node app/scripts/phase3f-h-browser-audit.mjs`, scenario by scenario:

| Scenario | Fixed device date | Result |
| --- | --- | --- |
| A — Ghibli before | 2027-01-09 | before recorded release date |
| B — Ghibli same recorded date | 2027-01-10 | coincide; `10:00 (Asia/Tokyo)` still shown; no open-state copy |
| C — Ghibli after | 2027-01-11 | after recorded release date |
| D — Disneyland same date, null timezone | 2026-12-20 | coincide; `14:00`; timezone disclosed unknown; no `Asia/Tokyo`/`JST`/`UTC+9` |
| E — Katsura exact open edge | 2026-12-01 | within recorded date span; no open claim |
| F — Katsura exact close edge | 2027-03-12 | within recorded date span; no close/deadline claim |
| G — Sumo applicable | 2027-02-05 / 2027-02-06 | before / coincide against the recorded 6 feb 2027 sale date |
| H — Sumo not applicable | 2027-02-06 | neutral Phase 3F-F not-applicable copy; **no** relation or reference-date line in the item |
| I — Phase 3D coexistence | 2027-01-09 | both relation surfaces visible, separate DOM subtrees, distinct copy |
| J — reassignment recomputation | 2026-12-20 | moving Disneyland to Día 2 recomputes the official date to 21 dic 2026 and re-relates the same reference date (coincide → before) |
| K — clear start date + reload | 2026-12-20 | official section and relations disappear; nothing derived is persisted; reload shows none |

Console errors: **0**. Page errors: **0**. No assertion was relaxed and no console error was ignored.

The corrective in §10.1 changed code after the first recorded browser gate, so the browser gate was
**restarted from zero**. Both mandatory runs passed consecutively on the new final code HEAD
`63b5756570ad8cf8e8afaa4c5a504bb67d35967c`:

- browser audit #1: **PASS**, 0 console errors, 0 page errors
- browser audit #2: **PASS**, 0 console errors, 0 page errors

The Phase 3F-F audit was re-run as a regression on the same HEAD and also passed with 0 console and 0
page errors. Both audits use the same deterministic `Date` shim; no assertion was relaxed and no
scenario depends on the host wall clock.

The superseded gate on `6b27db014c680e3f56d25bb7146ad706747d0bad` (audit #1 PASS, audit #2 PASS,
Phase 3F-F PASS) is recorded here only as history; it is **not** the acceptance gate for this PR.

Environment note: the container's Playwright-managed Chromium build differed from the expected build
revision, so an external filesystem path bridge was created outside the repository. No repository
file, script or package dependency was changed for that environment-only adjustment.

---

## 10. Review findings and correctives

### 10.1 Independent review finding — inverted application date span

**Finding.** `evaluateOfficialReservationReferenceDate` validated `openDate` and `closeDate`
individually for an `application-window` derivation, but did not reject an inverted interval
(`openDate > closeDate`). Two dates can each be a real calendar date while their order is wrong.

**Why it is a real contract problem.** Phase 3F-D's evidence parser constrains
`relative-application-window` to a positive-integer `monthsBeforeVisitMonth` and a positive-integer
`daysBeforeVisit`, but nothing in that validation by itself guarantees that the *derived* open date
lands on or before the *derived* close date. Phase 3F-H therefore must not silently assume every
application window it receives is ordered. Under the previous code an inverted span would have been
classified as before/within/after, presenting an official date span the evidence never recorded.

**Corrective.** For `derivation.kind === "application-window"`, after both dates are confirmed valid
civil dates, an inverted span now returns:

```ts
{ kind: "not-assessed", reason: "derivation-not-date-relatable" }
```

Fail-closed, before any comparison runs. The dates are not swapped, repaired, re-ordered or
interpreted; intent is not inferred; the input is not mutated; and the refusal carries no identity and
no dates (exactly the two keys `kind` and `reason`). `openDate === closeDate` remains a legitimate
one-day span.

Corrective commit: `63b5756570ad8cf8e8afaa4c5a504bb67d35967c`, touching exactly two files —
`app/src/lib/reservation-mechanism-reference-date.ts` (one guard plus its comment) and
`app/src/lib/reservation-mechanism-reference-date.test.ts` (five added tests).

**Deliberately unchanged by this corrective:** `reservation-mechanism-date-derivation.ts`, the
evidence parser, the evidence JSON, the Katsura mechanism, canonical data, schema, storage, Phase 3D,
and all user-facing copy. No copy change was needed: an unassessable span renders no relation, the
same as every other non-date-relatable result, so the existing Phase 3F-F presentation already covers
it.

**Post-fix hostile check.** Confirmed point by point: (1) valid individual dates + inverted span →
not assessed, at five reference dates spanning both edges and the inverted range; (2) a valid ordered
span behaves exactly as before; (3) equal open/close is still a one-day span with correct
before/within/after; (4) Katsura's open edge `2026-12-01` is still within; (5) Katsura's close edge
`2027-03-12` is still within; (6) no new time or timezone arithmetic — the guard is a lexical
comparison of two validated fixed-width civil dates, and the source-boundary scans still pass;
(7) no Phase 3D evaluator reuse; (8) no sorting, swapping or repair of the interval; (9) no
persistence, schema or data change; (10) no copy change.

The design gate did not need amending: Phase 3F-G's fail-closed principle already covers this case.

### 10.2 Hostile self-review

Re-checked and found clean: accidental open/closed semantics; clock-time comparison; timezone
inference; Phase 3D evaluator reuse; identity mismatch; relation attached to the wrong record;
sorting/ranking; duplicated derivation arithmetic; stale persisted relation; a second clock capture;
a production test-date seam; browser tests depending on the machine date; currentness copy without a
concrete date; urgency or action language; Phase 3D/3F synthesis; missed recomputation after moving a
place; and not-applicable relation leakage.

One finding was raised and fixed during implementation rather than left standing: the Phase 3F-F
section disclaimer asserted that these dates are never compared with a current date, which Phase 3F-H
makes false. It was rewritten (§3.2) rather than left as inaccurate copy.

---

## 11. Validation commands

```bash
cd app
npx vitest run \
  src/lib/reservation-mechanism-reference-date.test.ts \
  src/lib/reservation-mechanism-reference-date-presentation.test.ts \
  src/components/OrderedSequenceBuilder.official-reservation-reference-date.test.ts \
  src/lib/reservation-mechanism-presentation.test.ts \
  src/lib/reservation-mechanism-evidence.test.ts \
  src/lib/reservation-mechanism-date-derivation.test.ts \
  src/components/OrderedSequenceBuilder.test.ts \
  src/components/OrderedSequenceBuilder.reservation-window-reference.test.ts \
  src/lib/reservation-window-reference.test.ts \
  src/lib/reservation-window-reference-presentation.test.ts
npm test
npm run lint
npm run build
cd ..
git diff --check 2a02bad414d1b8e01eb6bb88169506da30568677...HEAD
git diff --check
cd app
node scripts/phase3f-h-browser-audit.mjs
node scripts/phase3f-h-browser-audit.mjs
node scripts/phase3f-f-browser-audit.mjs
```

---

## 12. Commits

| SHA | Files |
| --- | --- |
| `008da04` | `reservation-mechanism-reference-date.ts`, `reservation-mechanism-reference-date.test.ts`, `reservation-mechanism-reference-date-presentation.ts`, `reservation-mechanism-reference-date-presentation.test.ts`, `reservation-mechanism-presentation.ts` |
| `b0f01d1` | `OrderedSequenceBuilder.tsx`, `OrderedSequenceBuilder.test.ts`, `OrderedSequenceBuilder.official-reservation-reference-date.test.ts`, `App.css` |
| `6b27db0` | `scripts/phase3f-h-browser-audit.mjs`, `scripts/phase3f-f-browser-audit.mjs` |
| `63b5756` | `reservation-mechanism-reference-date.ts`, `reservation-mechanism-reference-date.test.ts` — corrective for the independent-review finding in §10.1 |

`63b5756` is the **final code HEAD**. It changed code after the first browser gate, so every
validation gate was restarted from zero against it: focused tests, full Vitest, lint, build, both
`git diff --check` forms, Phase 3F-H browser audit #1, Phase 3F-H browser audit #2 and the Phase 3F-F
regression audit all passed on that HEAD.

Two further issues were found and fixed *during* initial implementation, before any validation gate
ran, so no gate needed restarting for them:

1. a test expectation in `reservation-mechanism-reference-date-presentation.test.ts` named the wrong
   weekday/day for the formatted reference date;
2. the Phase 3F-F section disclaimer and three Phase 3F-F integration assertions described a surface
   that no longer receives no reference date.

Documentation commits follow the final code HEAD. They change only `docs/`, so they do not
invalidate the browser-audit result recorded above.

---

## 13. Ready state

**VALIDATED — ELIGIBLE FOR READY TRANSITION.**

Focused tests, full regression, lint, build, whitespace checks and the two consecutive mandatory
browser audits passed on the final code state `63b5756570ad8cf8e8afaa4c5a504bb67d35967c`, after the
browser gate was restarted from zero for the §10.1 corrective. The pull request is deliberately left in **Draft** so
an independent focused review can be performed; this document does not perform that transition, and
Phase 3F-I is not started.
