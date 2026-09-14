# Phase 3F-N — PokéPark Overseas Application Evidence Foundation

Status: **implementation candidate — validation pending**

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

## 6. Validation gate

Before Ready transition Phase 3F-N must pass:

1. Python catalog validator;
2. Python catalog unit tests;
3. focused Phase 3F evidence/derivation/presentation/reference/calendar Vitest;
4. full `npm test`;
5. `npm run lint`;
6. `npm run build`;
7. repository whitespace gates;
8. Phase 3F-F browser audit;
9. Phase 3F-H browser audit;
10. Phase 3F-J browser audit.

The exact executable HEAD used for validation must be recorded here before Ready transition.

## 7. Current gate result

**IMPLEMENTED — EXECUTABLE VALIDATION PENDING.**

Phase 3F-O is not started.
