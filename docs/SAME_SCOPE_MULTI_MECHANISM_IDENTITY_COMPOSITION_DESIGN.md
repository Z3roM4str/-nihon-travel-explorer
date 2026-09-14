# Phase 3F-M — Same-Scope Multi-Mechanism Identity & Composition Design Gate

Status: **design gate only — no runtime/data implementation in this phase**

Base: `7bf0f385ccc6b5fdb635be4e6b3717c156aa2c6c` (`main` after Phase 3F-L / PR #82)

Official PokéPark KANTO source recheck: **2026-09-14**

---

## 1. Problem statement

Phase 3F-K deliberately kept PokéPark KANTO (`JP-050`) out of the official reservation-mechanism
catalog because the current catalog rejects more than one active record for the same
`placeId + scope`.

That restriction is now the blocking architectural fact.

The current official PokéPark KANTO domestic ticket page publishes **two different deterministic
calendar mechanisms for the same admission scope**:

1. a monthly drawing application window for admission three months ahead; and
2. a daily first-come sale release for admission two months ahead.

The source does not describe these as two different admission scopes. They are two ways of obtaining
admission tickets.

The current Phase 3F catalog therefore cannot represent the official evidence honestly without doing
one of three wrong things:

- dropping one deterministic mechanism;
- inventing a fake scope to distinguish acquisition paths; or
- adding a redundant `channel` identity field even though runtime identity already exists.

Phase 3F-M decides the identity/composition model before any JP-050 data is written.

---

## 2. Current official evidence recheck

### 2.1 Domestic official ticket page

Primary current source:

`https://www.pokepark-kanto.co.jp/ppark/ticketInfo/type/index`

The current official page states, for the Japan-resident official ticket site:

- users may apply for the drawing;
- some tickets are also sold first-come;
- drawing admission target: the calendar month three months ahead;
- drawing application period: the 1st through the 12th of each month;
- first-come target: admission on the same calendar date two months ahead;
- first-come release: 20:00 on the same calendar date two months before;
- if target dates exceed the length of the shifted month, the last day of that shifted month releases
  the remaining target-month dates through month-end;
- first-come sales end when sold out;
- methods and schedules may change.

The same page explicitly requires a Japan mobile number / SMS verification for the Japan-resident
site and directs residents outside Japan to a separate English official store.

That purchase-audience distinction is provenance/context. **Phase 3F-M does not infer that every
recorded mechanism is usable by every user.** The Phase 3F evidence layer records operator-published
mechanisms; it does not yet evaluate purchaser eligibility.

### 2.2 Start-time corroboration

Supporting source:

`https://www.pokepark-kanto.co.jp/ppark/announcement/40/detail/index`

The official June 16, 2026 notice states that, from July 2026 onward, both drawing and first-come
sales start at **20:00**, with examples for each mechanism.

The implementation successor must recheck both sources immediately before writing JP-050 records.

---

## 3. Existing runtime identity audit

The current one-active-`placeId + scope` rule is **not** the runtime identity model.

The real identity already carried through Phase 3F is `recordId`:

- every derivation variant carries `recordId`;
- Phase 3F-F pairs a derivation to its exact evidence record by `recordId`;
- Phase 3F-F presentation carries `recordId`;
- Phase 3F-H relation identity carries `recordId + placeId + scope`;
- Phase 3F-H presentation verifies matching `recordId + placeId + scope`;
- Phase 3F-J pairs back to the exact source record by `recordId`;
- Phase 3F-J output carries `recordId`;
- per-day React rendering uses `presentation.recordId` as the article key;
- route-wide deterministic tie-breaking already has the source-record index after date and plan
  ordinal.

Therefore `placeId + scope` is currently a **catalog cardinality restriction**, not an identity
requirement.

---

## 4. Identity decision

### 4.1 Record identity remains `recordId`

Phase 3F-M approves this model:

> `recordId` is the unique identity of one official reservation-mechanism evidence proposition.

`placeId` identifies the place.

`scope` identifies what is being reserved.

Neither field identifies the acquisition path.

### 4.2 `placeId + scope` becomes a grouping coordinate

The successor may contain multiple active records with the same `placeId + scope`.

This does **not** mean the records are interchangeable or duplicates.

Each record remains independently identified, derived, presented and related by `recordId`.

### 4.3 Global ID uniqueness remains mandatory

The successor removes only the active `placeId + scope` uniqueness rejection.

It must continue to reject duplicate global record IDs.

ID namespace matching remains unchanged:

`RM-<PLACE_ID>-<NNN>`

### 4.4 No `channel` field

Phase 3F-M explicitly rejects adding:

- `channel`;
- `acquisitionChannel`;
- `pathway`;
- `mechanismRole`;
- or any equivalent new identity field.

Reason:

The runtime already has a stable, globally unique record identity. A second identity axis would add
schema surface without solving a runtime ambiguity.

Mechanism kind, allocation, provenance and the exact record ID already describe the proposition.

If a later UX needs a user-facing taxonomy such as “sorteo” versus “venta directa”, that is a
separate presentation design question, not evidence identity.

---

## 5. Composition decision

### 5.1 Do not merge same-scope records

Two active records for one place/scope remain two records.

No layer may:

- coalesce them into one synthetic mechanism;
- choose a preferred record;
- treat one as fallback for the other;
- infer that one becomes relevant only if the other fails;
- deduplicate them merely because `placeId + scope` matches.

### 5.2 Existing per-day composition remains valid

The existing per-day composition already:

1. derives every record for the place;
2. pairs every derivation back to its exact record by `recordId`;
3. renders one article per presentation;
4. keys the article by `recordId`.

The successor should prove this with a same-place, same-scope test.

No production component change is authorized unless that test exposes a real defect.

### 5.3 Phase 3F-H remains record-local

Each relation is evaluated against one derivation.

Two same-scope records produce two independent relations because their `recordId` values differ.

No combined “best acquisition path” relation is authorized.

### 5.4 Phase 3F-J remains one row per eligible record

The route-wide calendar continues to emit one item per eligible record.

For two PokéPark admission records, the expected result is two rows when both derive applicable
calendar facts.

The existing chronological comparator remains:

1. anchor civil date;
2. plan ordinal;
3. source-record index.

Source-record index is a deterministic tie-breaker only. It is not priority, recommendation,
availability or operator preference.

---

## 6. New calendar-alignment requirement

PokéPark first-come sales expose a second independent gap in the current union.

Current `rolling-calendar-month-release` supports:

- `first-day-of-next-month`; and
- `not-recorded`

when the aligned day does not exist in the shifted month.

PokéPark requires different semantics.

Example:

- visit date: 2027-04-30;
- nominal two-month shift: 2027-02-30, which does not exist;
- official rule: February 28 releases April 28, 29 and 30.

Therefore using Disney's existing `first-day-of-next-month` rule would incorrectly derive
March 1.

### 6.1 Approved extension

Phase 3F-M approves one new closed value:

`last-day-of-shifted-month`

for `rolling-calendar-month-release.missingAlignedDayRule`.

Semantics:

1. shift the visit month by `-monthsBeforeVisit`;
2. try the same calendar day;
3. if that civil date does not exist and the rule is `last-day-of-shifted-month`, use the real last
   civil day of the shifted month;
4. preserve the recorded release time and source timezone;
5. never clamp a valid aligned day;
6. never use instant/timezone arithmetic.

Examples:

- 2027-04-30 → 2027-02-28;
- 2028-04-30 → 2028-02-29;
- 2027-05-31 → 2027-03-31;
- 2027-06-30 → 2027-04-30.

Disney's existing `first-day-of-next-month` behavior remains unchanged.

---

## 7. Approved successor data shape for JP-050

Subject to implementation-time source recheck, Phase 3F-N may add exactly two JP-050 records.

Both use:

- `placeId: "JP-050"`;
- `scope: "general-admission"`;
- `status: "active"`;
- official-explicit provenance;
- consultation date from the implementation day.

### 7.1 Record 1 — drawing application

Provisional identity:

`RM-JP-050-001`

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
allocation: drawing
```

The source states the application date range and the 20:00 start.

It does not establish a recurring closing clock time, so the close time remains null.

### 7.2 Record 2 — first-come release

Provisional identity:

`RM-JP-050-002`

Mechanism:

```text
kind: rolling-calendar-month-release
monthsBeforeVisit: 2
alignment: same-calendar-day
missingAlignedDayRule: last-day-of-shifted-month
releaseTimeLocal: 20:00
sourceTimeZone: Asia/Tokyo
allocation: first-come
```

“Sold out” is an inventory/current-state condition and is not represented.

### 7.3 Provenance context

The primary source should remain the official domestic PokéPark KANTO ticket page, with the 20:00
announcement retained as supporting evidence when needed.

The evidence text must explicitly retain the domestic-site context, including the Japanese mobile/SMS
requirement or equivalent source wording current at implementation time.

The structured records do **not** assert purchaser eligibility.

---

## 8. Audience / eligibility boundary

Phase 3F-M does not add:

- residency fields;
- user-country fields;
- eligibility predicates;
- account/SMS capability;
- “available to you” claims;
- personalized filtering.

A mechanism record means:

> the operator currently publishes this mechanism for the cited official purchase context.

It does not mean:

> the current user is eligible to use this mechanism.

The provenance/source context must remain inspectable and must not be rewritten into a global
eligibility claim.

If a future feature wants to filter mechanisms by user eligibility, that requires its own design gate.

---

## 9. Availability and sequencing boundary

The official source says first-come inventory may sell out and may become available again.

Phase 3F-M does not model any of that.

It also does not encode:

- whether a drawing has seats remaining;
- whether first-come inventory exists;
- whether the first-come sale will actually occur for a specific date;
- whether the user won or lost a drawing;
- whether one path should be attempted before another;
- whether a sale is currently open or closed;
- whether a date is urgent.

The two records are calendar-mechanism evidence only.

---

## 10. Successor implementation boundary

Phase 3F-N may change only what is necessary to support and prove the approved model:

1. TypeScript evidence-catalog cardinality validation;
2. Python offline catalog cardinality validation;
3. `rolling-calendar-month-release.missingAlignedDayRule` union;
4. 3F-D derivation for `last-day-of-shifted-month`;
5. exact JP-050 source/app evidence records;
6. focused tests proving same-scope multi-record composition through D/F/H/J and the existing
   per-day surface;
7. documentation/runtime record;
8. browser regressions.

Not authorized:

- new React UX taxonomy;
- new grouping UI;
- new record-channel field;
- new scope value;
- planning-draft migration;
- localStorage change;
- availability fetch;
- account integration;
- user-residency model;
- personalized eligibility;
- ranking or recommendation between mechanisms;
- notifications/reminders/calendar export.

---

## 11. Successor validation gate

Phase 3F-N must prove at minimum:

1. canonical/app evidence parity;
2. the catalog grows from 6 to exactly 8 active records;
3. global record IDs remain unique;
4. both JP-050 records have exact IDs and `general-admission` scope;
5. the parser accepts two active records with the same `placeId + scope`;
6. the parser still rejects duplicate global IDs;
7. the Python validator mirrors the same cardinality rule;
8. no `channel`/pathway identity field exists;
9. PokéPark drawing derives the month three months before the visit month, day 1 through day 12;
10. the drawing open edge preserves 20:00 Asia/Tokyo;
11. the drawing close edge invents no time or timezone;
12. PokéPark first-come derives the same date two calendar months before when that date exists;
13. 2027-04-30 derives first-come release 2027-02-28;
14. leap-year 2028-04-30 derives 2028-02-29;
15. Disney's existing missing-day behavior remains unchanged;
16. Phase 3F-F creates two separate presentations for one JP-050 visit when both records derive;
17. the two presentations preserve distinct record IDs;
18. allocation disclosure remains `drawing` versus `first-come`;
19. Phase 3F-H relates each record independently by record ID;
20. Phase 3F-J emits two separate rows rather than merging the same scope;
21. Phase 3F-J chronological order is determined by official anchor dates, not acquisition preference;
22. the per-day surface renders two record-keyed articles without a new grouping model;
23. no availability/inventory/current-sale-state field is introduced;
24. no purchaser-eligibility claim is introduced;
25. no user-residency field is introduced;
26. JP-002, JP-125, JP-126 and JP-211 remain absent;
27. existing six records preserve their meaning unless implementation-time source recheck requires a
    documented correction;
28. full Vitest passes;
29. lint passes;
30. build passes;
31. repository whitespace gates pass;
32. Phase 3F-F/H/J browser audits pass;
33. official PokéPark sources are rechecked on the implementation day before the data write.

A source change that makes either mechanism non-deterministic or materially changes its audience
context blocks that record rather than expanding scope silently.

---

## 12. Normative contracts

1. Phase 3F-M changes documentation only.
2. Phase 3F-M writes no JP-050 data.
3. `recordId` is the evidence-record identity.
4. `placeId` is place identity, not evidence-record identity.
5. `scope` describes what is reserved, not how it is acquired.
6. `placeId + scope` is not a unique record identity.
7. Multiple active records may share `placeId + scope`.
8. Global record ID uniqueness remains mandatory.
9. ID namespace matching remains mandatory.
10. Same-scope records are never silently merged.
11. Same-scope records are never silently deduplicated.
12. Same-scope records are never ranked.
13. Same-scope records are never treated as fallback chains.
14. Source order is deterministic order only, never preference.
15. No `channel` field is introduced.
16. No fake scope is introduced to encode acquisition method.
17. Allocation does not become identity.
18. Mechanism kind does not become identity.
19. Every derivation retains its source `recordId`.
20. Every presentation pairs to the exact record by `recordId`.
21. Every Phase 3F-H relation remains record-local.
22. Every Phase 3F-J row remains record-local.
23. Same-scope records may create multiple route-wide rows.
24. Multiple rows are not an availability claim.
25. `last-day-of-shifted-month` is a civil-calendar fallback.
26. It is used only when the same aligned day does not exist.
27. It uses the actual month end, including leap February.
28. It does not change Disney's existing fallback.
29. It performs no instant conversion.
30. It copies no timezone by implication.
31. PokéPark drawing open time is 20:00 only if revalidated.
32. PokéPark drawing close time remains unknown unless explicitly published.
33. PokéPark first-come release time is 20:00 only if revalidated.
34. Sold-out language is not encoded as mechanism closure.
35. Inventory is not encoded.
36. Availability is not encoded.
37. Current sale state is not encoded.
38. User lottery result is not encoded.
39. Urgency is not encoded.
40. Deadline is not encoded.
41. Recommendation between acquisition mechanisms is not encoded.
42. User residency is not encoded.
43. Purchaser eligibility is not inferred.
44. Domestic-source context remains provenance.
45. A mechanism record does not mean “available to this user”.
46. Runtime performs no network request.
47. No planning-draft version changes.
48. No localStorage changes.
49. No notification/reminder/calendar integration.
50. No source precedence with Phase 3D.
51. Existing evidence semantics remain unchanged unless revalidated source evidence requires a
    documented correction.
52. Implementation-time PokéPark source recheck is mandatory.
53. A changed source may remove one or both JP-050 candidates.
54. A changed source may not silently expand the mechanism union.
55. The successor may add exactly two JP-050 records under this approval.
56. The successor keeps SHIBUYA SKY absent.
57. The successor keeps USJ ordinary admission absent.
58. The successor keeps SUPER NINTENDO WORLD absent.
59. The successor keeps AnimeJapan 2027 absent.
60. Phase 3F-N must prove same-scope composition with real JP-050 records.
61. Phase 3F-N must prove duplicate global IDs still fail.
62. Phase 3F-N must prove Disney fallback semantics do not regress.
63. No parser-level semantic fingerprint is introduced in this gate.
64. Accidental duplicate propositions remain a catalog-review/test concern, while global ID
    uniqueness stays the hard structural identity invariant.

---

## 13. Rejected alternatives

### “Use a new scope for lottery versus first-come”

Rejected. Both mechanisms obtain the same admission product. Scope describes the reserved object,
not acquisition method.

### “Add a channel field”

Rejected for this successor. It duplicates identity already supplied by `recordId` and would expand
every downstream type without resolving a real ambiguity.

### “Keep placeId + scope unique and store only the lottery”

Rejected. The operator currently publishes another deterministic mechanism. Silently dropping it
would preserve a known false completeness boundary.

### “Merge both mechanisms into one record”

Rejected. One is an application span with drawing allocation; the other is a release date with
first-come allocation. A synthetic union would erase their independent calendar facts.

### “Use Disney's first-day-of-next-month missing-day rule”

Rejected. PokéPark explicitly releases remaining month-end dates on the last day of the shifted
month. Disney's rule would derive the wrong civil date.

### “Treat sold-out as the close edge of first-come sales”

Rejected. Sold-out is contingent inventory state, not a deterministic civil-date close rule.

### “Assume the current user can use the Japan-resident purchase path”

Rejected. Phase 3F records operator mechanism evidence, not personalized eligibility.

---

## 14. Recommended successor

**Phase 3F-N — Same-Scope Multi-Mechanism Foundation**

One bounded implementation:

- remove only the active `placeId + scope` uniqueness rejection;
- keep global `recordId` uniqueness;
- extend `rolling-calendar-month-release` with `last-day-of-shifted-month`;
- add exactly two current-source JP-050 records if implementation-time recheck still supports them;
- prove independent composition through Phase 3F-D/F/H/J and the existing per-day surface;
- preserve every existing no-state/no-network/no-persistence boundary;
- run the full regression gate.

Phase 3F-N is **NOT STARTED** by this design record.
