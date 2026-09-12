# Phase 3F-B — Official Reservation Mechanism Evidence Foundation

Status: **data foundation**
Base: `68d2e8287f226ae160ada41f33dc1562853f4755`
Official sources consulted: **2026-09-12**

This phase implements the data-only successor approved by Phase 3F-A.

It adds no runtime consumer, no UI, no booking logic, no availability logic, no reminders and no planning-draft changes.

---

## 1. Artifacts

Canonical evidence:

`data/reservation-mechanisms.json`

Application parity copy:

`app/src/data/reservation-mechanisms.json`

Offline validator:

`scripts/validate-reservation-mechanisms.py`

Validator tests:

`scripts/test_reservation_mechanisms.py`

The canonical and app catalogs are intended to remain byte-identical.

---

## 2. Pilot population

The first pilot contains exactly five active official-evidence records.

### RM-JP-044-001 — Ghibli Museum

Place:

`JP-044`

Scope:

`general-admission`

Mechanism:

`monthly-fixed-release`

Recorded official rule:

- release day: 10th of each month;
- release time: 10:00;
- source timezone: Asia/Tokyo;
- target: subsequent calendar month.

Source:

`https://www.ghibli-museum.jp/en/tickets/`

The source states that overseas Lawson tickets become available at 10:00 JST on the 10th of each month for the subsequent month.

### RM-JP-203-001 — Tokyo Disneyland

Place:

`JP-203`

Scope:

`park-admission`

Mechanism:

`rolling-calendar-month-release`

Recorded official rule:

- two calendar months before admission;
- aligned to the same calendar date;
- sales from 14:00;
- if that same admission date does not exist, sales begin at 14:00 on the first day of the next month;
- daily sales may stop when the sales limit is reached.

Source:

`https://www.tokyodisneyresort.jp/en/ticket/index.html`

Allocation disclosure:

`capacity-limited`

### RM-JP-204-001 — Tokyo DisneySea

Same official park-ticket rule as JP-203, scoped independently to the DisneySea place record.

Source:

`https://www.tokyodisneyresort.jp/en/ticket/index.html`

Allocation disclosure:

`capacity-limited`

### RM-JP-077-001 — Katsura Imperial Villa

Place:

`JP-077`

Scope:

`guided-visit`

Mechanism:

`relative-application-window`

Online advance application evidence:

- opens at 05:00 on the first day of the month three months before the preferred visit date;
- closes at 23:59 three days before the preferred visit date;
- if applications exceed allocated capacity, a lottery is conducted.

Source:

`https://kyoto-gosho.kunaicho.go.jp/pdf/visit-1A3_en.pdf`

Allocation disclosure:

`lottery-if-oversubscribed`

The official English guideline states local clock times but does not explicitly label them JST in the quoted rule, so the record deliberately stores `sourceTimeZone: null` for these two rule edges.

### RM-JP-212-001 — Grand Sumo Tournament Osaka 2027

Place:

`JP-212`

Scope:

`event-admission`

Mechanism:

`fixed-sale-date`

Recorded official event evidence:

- advance ticket sale date: 2027-02-06;
- event period: 2027-03-14 through 2027-03-28;
- venue: EDION Arena Osaka.

Source:

`https://sumo.or.jp/EnTicket/year_schedule`

No sale clock time or allocation mechanism is invented.

---

## 3. Explicit exclusions

### JP-125 — Universal Studios Japan

Not populated.

Phase 3F-A's pre-3F-B verification found conflicting official pages:

- current main-site FAQ and purchase guide: two months;
- legacy `s.usj.co.jp` FAQ: three months;
- 2025 Expo notice: three months was temporary and the plan was to return afterward.

The current two-month statement wins as current evidence, but the current source does not define every missing-calendar-day alignment edge case required by the first-pass rolling-calendar schema.

Omission is therefore safer than guessing.

### JP-097 — Nintendo Museum

Not populated.

The current official page supports:

- advance reservation;
- random drawing;
- purchase after selection.

The consulted source does not expose enough stable recurring release-window structure to fit the first-pass mechanism union without adding an allocation-only record shape that Phase 3F-A did not approve.

### JP-211 — AnimeJapan 2027

Not populated.

The 2027 event dates are official, but the consulted 2027 public site does not yet publish a 2027 public ticket-sale schedule.

No historical 2026 ticket timing is projected forward.

---

## 4. Schema exercised by real data

The pilot exercises four mechanism families:

1. `monthly-fixed-release`
2. `rolling-calendar-month-release`
3. `relative-application-window`
4. `fixed-sale-date`

`rolling-day-release` remains valid in the validator contract but has no pilot record because no mandatory pilot source requires it.

Allocation evidence exercised:

- `capacity-limited`
- `lottery-if-oversubscribed`
- `not-stated`

No `first-come` or `drawing` value is fabricated merely because a purchase flow or drawing concept exists elsewhere.

---

## 5. Validator contract

`scripts/validate-reservation-mechanisms.py` validates:

- top-level array shape;
- globally unique record IDs;
- `RM-<PLACE_ID>-<NNN>` namespace;
- referenced place existence;
- closed scope vocabulary;
- closed mechanism vocabulary;
- mechanism-specific exact field sets;
- positive safe integers;
- valid civil dates;
- valid `HH:mm` local times;
- first-pass timezone boundary;
- closed allocation vocabulary;
- active/superseded status;
- mandatory official provenance shape;
- valid HTTPS source URL;
- valid consultation date;
- supported provenance confidence;
- no duplicate active `placeId + scope` identity;
- no secret-like values;
- byte-for-byte source/app parity.

The validator intentionally does not make network requests and does not inspect live availability.

---

## 6. Test contract

`scripts/test_reservation_mechanisms.py` includes synthetic positive and negative cases for:

- each approved mechanism family;
- malformed/foreign IDs;
- unknown places;
- duplicate IDs;
- duplicate active place+scope;
- distinct scopes for one place;
- closed vocabularies;
- invalid day-of-month;
- invalid local time;
- invalid month alignment;
- malformed application-window rules;
- invalid/inverted fixed-date scope;
- unsupported timezone;
- malformed provenance;
- unsupported extra fields such as `urgency` or `availability`;
- secret-like fields;
- app/source parity drift.

Real-catalog tests pin:

- exactly five pilot records;
- exact pilot place set;
- official-explicit provenance on all records;
- consultation date 2026-09-12;
- intentional absence of USJ, Nintendo Museum and AnimeJapan 2027;
- absence of runtime-action fields.

---

## 7. Runtime isolation

No application module imports the new JSON in Phase 3F-B.

No changes to:

- `Place`;
- `reservation.ts`;
- `reservation-lead-time.ts`;
- `reservation-deadline.ts`;
- `reservation-window-reference.ts`;
- planning-draft schema;
- localStorage;
- React components;
- CSS;
- package manifests.

The app-facing copy exists only so a future runtime design can consume a versioned parity artifact without changing the evidence source.

---

## 8. Claim boundary

These records mean only:

> this official source, consulted on this date, states this reservation-mechanism proposition.

They do not mean:

- tickets are currently available;
- inventory exists;
- booking is open at the current instant;
- the user is late;
- the user should purchase now;
- a reservation is guaranteed;
- a booking succeeds;
- the rule will remain unchanged.

No current-date comparison is performed.

---

## 9. Validation commands

From repository root:

```bash
python3 scripts/validate-reservation-mechanisms.py
python3 scripts/test_reservation_mechanisms.py
```

Expected validator success:

```text
OK: reservation-mechanism catalog is valid; source/app byte parity confirmed
```

No runtime test suite is required merely to consume this data because Phase 3F-B adds no runtime consumer.

---

## 10. Successor boundary

Phase 3F-B does not authorize a runtime consumer.

A later Phase 3F-C design gate must decide whether and how official mechanism evidence can derive trip-specific reservation dates, including:

- exact calendar arithmetic;
- timezone semantics;
- staleness/currentness;
- multiple scopes;
- source supersession;
- interaction with existing editorial lead-time facts;
- route-wide presentation;
- reminders or automation.

No such successor is started here.

---

## 11. Conclusion

Phase 3F-B establishes a small official-evidence foundation without promoting source text into stronger booking claims.

The five-record pilot deliberately favors correctness over coverage.

The data is now structurally capable of representing materially different official mechanisms while preserving:

- source provenance;
- consultation date;
- scope;
- timing semantics;
- allocation semantics;
- explicit uncertainty through omission.

**Recommended next step after validation and focused review: a separate Phase 3F-C runtime-derivation design gate.**
