# Phase 3F-L — Official Reservation Evidence Coverage Expansion Foundation

Status: **implemented and repository-native validation passed**
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

### Phase 3F-H reference-date tests

- Nintendo's real derived December 2026 span is classified before / within / after using the existing
  civil-date relation vocabulary;
- no clock or timezone evidence leaks into the relation result.

### Phase 3F-J route-wide calendar tests

- Nintendo produces exactly one route-wide application-span item;
- anchor date is the open edge;
- allocation disclosure remains `drawing`;
- relation composition reuses the existing Phase 3F-H vocabulary;
- source link remains the canonical Nintendo ticketing URL.

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

## 8. Repository-native validation

A temporary GitHub Actions workflow was added only to execute the required gates and was removed
immediately afterward. The workflow checked out the exact code head
`b10e2bcf8abb9085d2e29576739b60cb40c9fb84` rather than the workflow-bearing commit.

GitHub Actions run: `34865708384` — **SUCCESS**.

Passed steps:

- exact-head checkout: **PASS**
- `python3 scripts/validate-reservation-mechanisms.py`: **PASS**
- `python3 scripts/test_reservation_mechanisms.py`: **PASS**
- dependency install: **PASS**
- focused Phase 3F Vitest set, including evidence, derivation, presentation, 3F-H and 3F-J: **PASS**
- full `npm test`: **PASS**
- `npm run lint`: **PASS**
- `npm run build`: **PASS**
- `git diff --check 7fa8e82053f241358f8d613b2d866b241dee36ac...HEAD`: **PASS**
- `git diff --check`: **PASS**
- Playwright Chromium install: **PASS**
- Phase 3F-F browser audit: **PASS**
- Phase 3F-H browser audit: **PASS**
- Phase 3F-J browser audit: **PASS**

The temporary workflow was then deleted. Comparing
`b10e2bcf8abb9085d2e29576739b60cb40c9fb84` with the post-deletion commit
`167abb77e64db5a68c6809d64d52ec49cd19c983` yields **zero changed files**, proving the executable
tree was restored exactly after validation.

The browser audits remain regression-only fixtures: Ghibli, Tokyo Disney, Katsura and Sumo were
exercised, while JP-097 is covered by focused pure-layer tests and no UI fixture required semantic
rewriting.

---

## 9. Hostile review corrective

A focused hostile pass after the Draft PR opened found two issues worth correcting before executable
validation:

1. **Compound provenance was under-recorded.** The generic Nintendo rule is derived from two official
   pages: the ticket-instructions page supplies the July 15 → April 1–30 example, while the official
   calendar supplies the once-per-month statement and the current December 2026 → September 30
   corroborating instance. The schema remains unchanged; the primary page stays in `sourceUrl` and
   the supporting calendar URL is now stored verbatim in `provenance.evidence` and pinned by a
   validator test.
2. **3F-H/J compatibility was implicit only.** Production code was already generic over
   `application-window`, but focused tests now pass the real Nintendo record through Phase 3F-H and
   Phase 3F-J so the new mechanism is covered end-to-end through those pure layers.

The browser audit sources were inspected and contain no JP-097 fixture, so they remain unchanged
regression gates rather than fixtures that need semantic updates.

## 10. Current gate result

**IMPLEMENTED + HOSTILE-REVIEW CORRECTED + REPOSITORY-NATIVE VALIDATION PASSED.**

The executable code tree passed the complete Phase 3F-L validation gate. Documentation-only closure
updates after validation do not alter the validated runtime/data/test tree.

Phase 3F-L is ready for the PR Ready transition. Phase 3F-M is not started.
