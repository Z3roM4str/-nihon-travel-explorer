# Phase 3F-N — PokéPark Overseas Application Evidence Foundation

Status: **implemented, hostile-reviewed and repository-native validation passed**

Base: `1937df90ffe6be6eb207519366df2b3e4928b407` (`main` after Phase 3F-M / PR #83)

Official source rechecked: **2026-09-14**

## 1. Scope

Phase 3F-N implements the corrected Phase 3F-M successor only:

- add one active official reservation-mechanism record for PokéPark KANTO `JP-050`;
- use the operator-designated outside-Japan Official Web Ticket Store;
- reuse the existing `monthly-application-window` family;
- preserve current global record-ID uniqueness;
- preserve current active `placeId + scope` uniqueness;
- add no new runtime mechanism kind;
- add no new purchase-context schema field;
- add no domestic first-come evidence.

No production TypeScript runtime module is changed by this phase.

## 2. Implementation-day official-source recheck

The current official English PokéPark KANTO ticket information continues to direct guests residing
outside Japan to the separate Official Web Ticket Store.

The current Official Web Ticket Store states:

- admission tickets use an Application system;
- applications are for admission three months in advance, one admission month at a time;
- the Application period is the 1st through the 12th of each month;
- ticket sales and Application periods start at 8:00 PM JST;
- selected applicants are notified around month-end;
- unsuccessful applicants may participate in a redraw when the documented conditions are met;
- payment follows selection;
- methods and schedules may change without prior notice.

The international source does not establish a recurring close clock time for the 12th.

## 3. Added evidence record

`RM-JP-050-001`

- place: `JP-050` — PokéPark KANTO
- scope: `general-admission`
- status: `active`
- allocation: `drawing`
- confidence: `official-explicit`
- canonical source:
  `https://ticket-en.pokepark-kanto.co.jp/?viewLang=en`
- source context:
  `PokéPark KANTO Official Web Ticket Store — outside-Japan purchase`
- consulted: `2026-09-14`

Mechanism:

```text
kind: monthly-application-window
monthsBeforeVisitMonth: 3
openDay:
  kind: fixed-day-of-month
  day: 1
closeDay:
  kind: fixed-day-of-month
  day: 12
openTimeLocal: 20:00
openSourceTimeZone: Asia/Tokyo
closeTimeLocal: null
closeSourceTimeZone: null
```

This creates catalog size **6 → 7**.

## 4. Explicit non-changes

Phase 3F-N does not:

- remove active `placeId + scope` uniqueness;
- add a second JP-050 active record;
- encode the domestic Japan-resident first-come path;
- add `last-day-of-shifted-month`;
- infer a close time or close timezone;
- add residency or purchaser-eligibility fields;
- model availability, inventory, sold-out state, lottery result, urgency or current sale state;
- change React UI;
- change planning-draft schema;
- change localStorage;
- add network requests;
- add reminders, notifications or calendar export.

## 5. Focused coverage

The implementation adds real JP-050 coverage for:

- evidence catalog parsing and exact provenance;
- Python canonical/app parity validation;
- Phase 3F-D civil-date derivation;
- Phase 3F-F presentation of the 20:00 Asia/Tokyo open edge and untimed close edge;
- Phase 3F-H civil-date-only relation, proving the clock/timezone does not leak into relation logic;
- Phase 3F-J route-wide composition and provenance.

Existing parser/cardinality tests remain unchanged in meaning and continue to reject duplicate active
`placeId + scope` identities.

## 6. Hostile review corrective

The implementation hostile review found one weak defensive assertion in the Python real-catalog
test. The first version checked `"first-come" not in pokepark["mechanism"]`, which only tested
dictionary keys and therefore could pass without scanning nested serialized mechanism content.

That assertion was hardened to scan the serialized mechanism object. No production data, runtime,
schema or UI semantics changed.

The hardened executable tree was then revalidated from scratch rather than inheriting the prior
validation result.

## 7. Repository-native validation

Final clean executable HEAD:

`e1c1e6098719d14ccb0053ad5c63d6c99ec71c2c`

A temporary GitHub Actions workflow was added only to trigger repository-native execution. Its final
workflow-bearing commit was `4f0596f14db553a30eabaa974cb74ea1bff6d94b`, but the workflow explicitly
checked out the clean executable HEAD above with `fetch-depth: 0`.

GitHub Actions run: `34874539102` — **SUCCESS**.

Passed steps:

- exact-head checkout: **PASS**
- `python3 scripts/validate-reservation-mechanisms.py`: **PASS**
- `python3 scripts/test_reservation_mechanisms.py`: **PASS**
- dependency install: **PASS**
- focused Phase 3F Vitest set: **PASS**
- full `npm test`: **PASS**
- `npm run lint`: **PASS**
- `npm run build`: **PASS**
- `git diff --check 1937df90ffe6be6eb207519366df2b3e4928b407...HEAD`: **PASS**
- `git diff --check`: **PASS**
- Playwright Chromium install: **PASS**
- Phase 3F-F browser audit: **PASS**
- Phase 3F-H browser audit: **PASS**
- Phase 3F-J browser audit: **PASS**

The temporary workflow was then removed in commit
`363636ecf92651b8649a610a16408eea76b25c6d`.

Comparing the clean validated HEAD
`e1c1e6098719d14ccb0053ad5c63d6c99ec71c2c` with that post-deletion commit reports:

- ahead by 2 commits;
- behind by 0;
- **zero changed files**.

Therefore the executable/data/test tree after workflow removal is byte-equivalent to the exact tree
that passed repository-native validation.

## 8. Current gate result

**IMPLEMENTED + HOSTILE-REVIEW CORRECTED + REPOSITORY-NATIVE VALIDATION PASSED.**

Only documentation closure may change after the validated tree before Ready transition. Any
subsequent runtime, data, schema, test, storage, dependency or UI change invalidates this validation
seal and requires a fresh exact-head run.

Phase 3F-O is not started.
