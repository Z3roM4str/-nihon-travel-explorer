# Phase 3F-D — Trip-Specific Reservation Date Derivation Runtime Foundation

Status: **runtime foundation — domain only**
Base: `3814e51cb9e13282e1de332833d9e6e56f28c980`

This phase implements the domain-only successor authorized by Phase 3F-C.

It adds no React/UI, no persistence, no current-date relation, no availability, no reminders and no booking actions.

---

## 1. Runtime modules

### `app/src/lib/reservation-mechanism-evidence.ts`

Owns:

- the closed Phase 3F evidence unions;
- defensive parsing of the application-facing JSON;
- strict mechanism/provenance shape validation;
- duplicate global-ID rejection;
- duplicate active `placeId + scope` rejection;
- stable per-place source-order filtering;
- the parsed bundled five-record pilot.

It does not:

- parse `Place.reservation.leadTime`;
- read `Place.reservation.required`;
- perform date arithmetic;
- read a device clock;
- use network/storage.

### `app/src/lib/reservation-mechanism-date-derivation.ts`

Owns:

- pure visit-date-to-reservation-date derivation;
- exact calendar-month alignment;
- operator-specific missing-date fallback;
- rolling-day subtraction;
- application-window open/close edges;
- fixed-sale-date event applicability;
- active/superseded status handling;
- stable multi-scope derivation;
- one plan-level adapter that reuses the existing `deriveVisitDateForPlace` owner.

It does not:

- compare against today;
- infer timezone;
- produce an instant;
- persist derived values;
- mutate evidence;
- rank scopes;
- merge Phase 3D editorial guidance with Phase 3F official evidence.

---

## 2. Real-data fixtures

The implementation pins the approved Phase 3F-C fixtures:

- Ghibli, visit `2027-02-20` → `2027-01-10 10:00 Asia/Tokyo`
- Ghibli, visit `2027-01-05` → `2026-12-10`
- Disneyland, visit `2027-02-20` → `2026-12-20 14:00`, timezone remains null
- DisneySea, visit `2027-04-30` → invalid nominal `2027-02-30` → recorded fallback `2027-03-01`
- Katsura, visit `2027-03-15` → open `2026-12-01 05:00`, close `2027-03-12 23:59`
- Osaka Sumo, visit `2027-03-14`, `2027-03-20` or `2027-03-28` → `2027-02-06`
- Osaka Sumo, visit `2027-03-29` → `not-applicable-to-visit-date`

USJ, Nintendo Museum and AnimeJapan 2027 remain absent because Phase 3F-B intentionally has no structured record for them.

---

## 3. Calendar semantics

Month arithmetic is calendar-based.

The runtime never converts:

- one month to 30 days;
- two months to 60 days;
- three months to 90 days.

An invalid aligned day does not silently clamp or roll.

Disney's `first-day-of-next-month` behavior is applied only because that fallback is encoded on the Disney mechanism records.

A future monthly-fixed release on an impossible day with no fallback returns:

`not-derivable / invalid-calendar-alignment`

---

## 4. Evidence-status semantics

Only `active` evidence may produce a normal derived date.

A validated `superseded` record yields:

`inactive-evidence`

The runtime never sorts by `consultedAt` to invent a winner.

The parser rejects duplicate active `placeId + scope` identities, aligning runtime shape enforcement with the Phase 3F-B data validator.

---

## 5. Phase 3D separation

The implementation reuses only the existing visit-date owner:

`deriveVisitDateForPlace`

It does not parse or inspect:

- `reservation.leadTime`;
- Phase 3D-H editorial windows;
- Phase 3D-O current/reference-date relations;
- `Place.reservation.required`.

Official mechanism derivation remains a separate source domain.

---

## 6. Tests

New test files:

- `reservation-mechanism-evidence.test.ts`
- `reservation-mechanism-date-derivation.test.ts`

They contain **42 test blocks** total.

Coverage includes:

- five bundled records;
- defensive parser failures;
- duplicate ID and duplicate active-scope rejection;
- synthetic rolling-day evidence;
- superseded evidence;
- Ghibli year rollover;
- Disney normal alignment;
- Disney missing-day fallback;
- no-fallback refusal;
- leap February;
- exact rolling-day subtraction;
- Katsura open/close edges;
- Sumo inclusive applicability bounds;
- Sumo outside-period behavior;
- missing applicability refusal;
- missing/invalid visit date;
- reuse of existing plan visit-date ownership;
- invalid plan assignment;
- stable multiple-scope order;
- deterministic repeated output;
- forbidden availability/urgency fields;
- source scans for clock/network/storage/editorial-lead-time dependencies;
- intentional absence of USJ/Nintendo/AnimeJapan results.

---

## 7. Validation executed in this environment

Because the repository cannot be cloned from the execution sandbox and Vitest is not installed there, the complete repository test command has **not** been claimed.

What was executed:

1. Exact current Phase 3F-D source modules were materialized from the branch.
2. The real Phase 3F-B reservation JSON was materialized.
3. Unchanged dependencies were represented only by narrow signature-compatible stubs:
   - `addCivilDays`
   - `isValidCivilDate`
   - `deriveVisitDateForPlace`
4. TypeScript compiled the new domain modules successfully.
5. A direct runtime harness executed the core real-data fixtures successfully.
6. After the hostile parser corrective, TypeScript compilation and fixtures passed again.
7. Source scan found no `Date.now`, `localStorage`, `fetch`, `reservation.leadTime`, timezone conversion or instant serialization in the new derivation domain.

Observed success:

```text
OK: corrective parser + TypeScript compile + core fixtures passed
```

This is a meaningful domain validation, but it is not a substitute for the repository's own Vitest/lint/build gate.

---

## 8. Required gate before Ready

Before Phase 3F-D may become Ready for review, execute in a real checkout of the branch:

```bash
cd app
npm test -- --run src/lib/reservation-mechanism-evidence.test.ts src/lib/reservation-mechanism-date-derivation.test.ts
npm test
npm run lint
npm run build
git diff --check
```

No browser audit is required because Phase 3F-D has no UI.

---

## 9. Scope boundary

Expected changed runtime/test files:

- `app/src/lib/reservation-mechanism-evidence.ts`
- `app/src/lib/reservation-mechanism-evidence.test.ts`
- `app/src/lib/reservation-mechanism-date-derivation.ts`
- `app/src/lib/reservation-mechanism-date-derivation.test.ts`

Documentation:

- this execution record
- `docs/ROADMAP.md`

No expected changes to:

- React components;
- CSS;
- hooks;
- planning-draft schema;
- localStorage;
- package manifests;
- data JSON;
- workbook;
- existing Phase 3D modules.

---

## 10. Conclusion

Phase 3F-D now has a pure domain implementation for trip-specific official reservation dates.

The code can derive calendar facts such as:

- a Ghibli release date;
- a Disney release date with its operator-defined fallback;
- a Katsura application window;
- the Osaka 2027 Sumo sale date when the planned visit falls inside the recorded event period.

It still cannot claim:

- booking is open now;
- booking is closed;
- inventory exists;
- the user is late;
- the user should buy;
- a reservation will succeed.

Those remain outside this runtime foundation.
