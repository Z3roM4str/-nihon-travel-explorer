# Phase 3F-L — Official Reservation Evidence Coverage Expansion Foundation

Status: **implementation candidate — validation pending**  
Base: `7fa8e82053f241358f8d613b2d866b241dee36ac` (`main` after Phase 3F-K / PR #81)  
Official Nintendo source rechecked: **2026-09-13**  
Design authority: [OFFICIAL_RESERVATION_EVIDENCE_COVERAGE_EXPANSION_DESIGN.md](OFFICIAL_RESERVATION_EVIDENCE_COVERAGE_EXPANSION_DESIGN.md)

---

## 1. Scope implemented

Phase 3F-L implements only the bounded successor authorized by Phase 3F-K:

1. harden application-window ordering fail-closed behavior;
2. add one new mechanism family, `monthly-application-window`;
3. add exactly one new active official-evidence record, Nintendo Museum `JP-097`;
4. preserve active `placeId + scope` uniqueness;
5. preserve every existing Phase 3F booking-state, network, persistence, timezone-conversion and
   automation boundary.

Not implemented:

- SHIBUYA SKY;
- PokéPark KANTO;
- Universal Studios Japan;
- SUPER NINTENDO WORLD;
- AnimeJapan 2027;
- mechanism-channel identity;
- booking-open/closed state;
- availability or inventory;
- reminders, notifications or calendar export;
- runtime network calls;
- planning-draft or localStorage changes.

---

## 2. Implementation-time source recheck

Official Nintendo Museum ticketing sources re-opened on 2026-09-13:

- primary ticket instructions: `https://museum-tickets.nintendo.com/en`
- supporting official calendar: `https://museum-tickets.nintendo.com/en/calendar?lang=en`

The evidence proposition is compound: the ticket instructions provide the July 15 → April 1–30
drawing example, while the separate calendar states that drawings occur once per month and supplies
the current December 2026 → September 30 corroborating instance. The schema still has one canonical
`sourceUrl`, so the primary ticket instructions remain that field and the supporting calendar URL is
stored verbatim inside `provenance.evidence`. This preserves the second official source without
expanding the Phase 3F provenance schema in this bounded successor.

The current official ticket page states that tickets are first sold to drawing entrants and gives the
worked example:

- visit date: July 15;
- drawing entry: April 1 through April 30.

The current calendar independently states:

- drawings occur once per month;
- December 2026 drawing entries are open through September 30.

The implementation therefore records the deterministic civil-date proposition:

> drawing application spans the full calendar month three months before the visit month.

No recurring opening or closing clock time is inferred. The current calendar's one concrete
September 30 23:59 close is not generalized into every month.

Because the three-month full-month relation is normalized from the operator's worked example plus its
current monthly calendar rather than quoted as one generic formula, the record uses
`confidence: "official-derived"`.

---

## 3. New evidence record

`RM-JP-097-001`

- place: `JP-097` — Nintendo Museum
- scope: `general-admission`
- mechanism: `monthly-application-window`
- month offset: 3 months before the visit month
- open edge: fixed day 1
- close edge: actual last day of that shifted month
- open time: null
- close time: null
- open timezone evidence: null
- close timezone evidence: null
- allocation: `drawing`
- status: `active`
- consultedAt: `2026-09-13`
- confidence: `official-derived`
- primary `sourceUrl`: `https://museum-tickets.nintendo.com/en`
- supporting source retained verbatim in `provenance.evidence`:
  `https://museum-tickets.nintendo.com/en/calendar?lang=en`

Canonical and app-facing JSON were written with identical serialized bytes.

Catalog size changes from **5 to 6 active records**.

---

## 4. New mechanism family

`monthly-application-window` contains:

```text
monthsBeforeVisitMonth
openDay: fixed-day-of-month
closeDay: fixed-day-of-month | last-day-of-month
openTimeLocal
openSourceTimeZone
closeTimeLocal
closeSourceTimeZone
```

Both edge timezone fields remain independent.

Static fixed-day rules with `openDay > closeDay` are rejected by both the TypeScript parser and
offline Python validator.

A fixed day that is syntactically valid (1..31) but impossible in the real shifted month fails closed
at derivation time. Nothing clamps it to a nearby date.

`last-day-of-month` is computed from real civil-calendar validity, never hard-coded as day 31.

---

## 5. Lower-layer inverted-span hardening

### Phase 3F-D

Existing `relative-application-window` now refuses a result when the derived
`openDate > closeDate`.

The new monthly family applies the same invariant.

Both return:

`not-derivable / invalid-calendar-alignment`

No swap, sort, clamp or repair occurs.

### Phase 3F-F

Before formatting an `application-window`, presentation now independently verifies:

- open edge is a valid civil date;
- close edge is a valid civil date;
- `openDate <= closeDate`.

Failure returns `null` before either edge is formatted.

No new neutral/error presentation kind was introduced.

Phase 3F-H and Phase 3F-J already fail closed on inverted spans and are unchanged.

---

## 6. Tests added or updated

### TypeScript evidence tests

- six real records parse;
- exact real source order includes Nintendo;
- Phase 3F-K exclusions remain absent;
- `monthly-application-window` parses;
- statically inverted fixed-day monthly windows fail.

### TypeScript derivation tests

- Nintendo March 2027 visit -> December 1–31, 2026;
- February 2027 -> February 1–28;
- leap February 2028 -> February 1–29;
- impossible fixed day 31 in February -> not derivable;
- synthetic Katsura-style inverted relative span -> not derivable;
- Nintendo remains within claim/side-effect boundary checks;
- SHIBUYA/PokéPark/USJ/SNW/AnimeJapan still derive no Phase 3F result.

### TypeScript presentation tests

- Nintendo renders one neutral application window with drawing allocation;
- no timezone-warning text is emitted when no clock time exists;
- a synthetic inverted application derivation returns `null` before formatting.

### Python validator tests

- valid monthly application window;
- fixed-day open-after-close rejection;
- exact six-record real catalog;
- exact Nintendo identity, mechanism, allocation, provenance date and confidence;
- original five retain their 2026-09-12 / official-explicit provenance;
- Phase 3F-K exclusions remain absent.

---

## 7. Static artifact gate executed in this environment

A connector-grounded static audit over the branch confirmed:

- canonical/app evidence byte parity: **PASS**
- catalog record count = 6: **PASS**
- globally unique record IDs: **PASS**
- active `placeId + scope` uniqueness: **PASS**
- every evidence place ID exists in canonical places: **PASS**
- Nintendo identity/scope/family/month offset/edge rules/allocation exact: **PASS**
- Nintendo primary + supporting official provenance URLs retained: **PASS**
- Nintendo `consultedAt = 2026-09-13`: **PASS**
- Nintendo `confidence = official-derived`: **PASS**
- Nintendo recurring times = null/null: **PASS**
- Nintendo recurring timezones = null/null: **PASS**
- JP-002, JP-050, JP-125, JP-126, JP-211 absent: **PASS**
- no availability/inventory/urgency/deadline/reminder/notification action fields: **PASS**
- no `fetch`, XHR, localStorage, Date.now, device-clock capture or Phase 3D editorial reservation
  dependency introduced into the three Phase 3F runtime modules: **PASS**
- Phase 3F-D inverted-span guard present: **PASS**
- Phase 3F-F inverted-span guard present: **PASS**

An independent civil-date arithmetic check also confirmed:

- 2027-03 visit -> 2026-12-01..31;
- 2027-05 visit -> 2027-02-01..28;
- 2028-05 visit -> 2028-02-01..29;
- February fixed open day 31 -> invalid;
- fixed open day 20 / close day 12 -> invalid;
- legacy relative example M=1 / D=60 / visit 2027-03-31 produces an inverted span and is therefore
  correctly a fail-closed case.

---

## 8. Validation still required before Ready transition

The current ChatGPT execution environment has no repository checkout, no GitHub network access from
its shell, and the repository has no GitHub Actions workflow registered for these gates. Therefore
the following commands have **not** been executed against this branch and must not be reported as
passing yet:

```bash
python3 scripts/validate-reservation-mechanisms.py
python3 scripts/test_reservation_mechanisms.py

cd app
npx vitest run   src/lib/reservation-mechanism-evidence.test.ts   src/lib/reservation-mechanism-date-derivation.test.ts   src/lib/reservation-mechanism-presentation.test.ts   src/lib/reservation-mechanism-reference-date.test.ts   src/lib/reservation-mechanism-reference-date-presentation.test.ts   src/lib/reservation-mechanism-calendar.test.ts   src/lib/reservation-mechanism-calendar-presentation.test.ts   src/components/OrderedSequenceBuilder.official-reservation-reference-date.test.ts   src/components/OrderedSequenceBuilder.official-reservation-calendar.test.ts

npm test
npm run lint
npm run build
cd ..
git diff --check 7fa8e82053f241358f8d613b2d866b241dee36ac...HEAD
git diff --check

cd app
node scripts/phase3f-f-browser-audit.mjs
node scripts/phase3f-h-browser-audit.mjs
node scripts/phase3f-j-browser-audit.mjs
```

The browser audits are regressions: none of their existing fixtures use JP-097, and no UI code was
changed. They still need execution before Ready transition.

---

## 9. Current gate result

**IMPLEMENTED — NOT YET VALIDATED FOR READY TRANSITION.**

The branch is intentionally suitable only for a **Draft PR** until the repository-native test, lint,
build, whitespace and browser gates above are executed on its final code HEAD.

Phase 3F-M is not started.
