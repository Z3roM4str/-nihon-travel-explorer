# Phase 3F-R — Same-Scope Purchase-Context Composition Design Gate

Status: **design gate only — no runtime/data/schema implementation in this phase**

Base: `ec22ed065435621428ace08f3e954d73d529f8cb` (`main` after Phase 3F-Q / PR #87)

Official PokéPark KANTO source recheck: **2026-09-14**

---

## 1. Problem statement

Phase 3F-M proved that `recordId`, not `placeId + scope`, is the actual reservation-evidence
record identity carried through Phase 3F-D/F/H/J.

Phase 3F-O/P then added the missing structural applicability evidence:

`purchaseResidenceContext`

with the closed values:

- `not-recorded`;
- `resides-in-japan`;
- `resides-outside-japan`.

Phase 3F-Q hardened its presentation exhaustiveness.

The remaining temporary safety invariant is therefore the active catalog restriction that rejects
more than one record with the same `placeId + scope`.

That restriction now blocks evidence that the official operator genuinely publishes as separate
purchase routes for the same admission scope.

PokéPark KANTO is the concrete motivating case:

- the outside-Japan official store publishes one three-month-ahead application / drawing route;
- the Japan-resident official route publishes a three-month-ahead drawing route;
- the Japan-resident route also publishes a two-month-ahead first-come route.

The next architectural question is no longer whether those propositions have distinct runtime
identity. They do.

The question is how to relax catalog cardinality without allowing ambiguous same-scope records whose
purchase-residence applicability is unknown.

---

## 2. Current official evidence recheck

### 2.1 Residence routing remains explicit

Official routing source:

`https://www.pokepark-kanto.co.jp/ppark/ticketInfo/type/index?languageKind=en_US`

Rechecked on 2026-09-14.

The operator still:

- directs guests residing outside Japan to the separate English Official Web Ticket Store;
- directs residents of Japan to the Japanese official route;
- requires membership registration and SMS verification through a mobile phone usable in Japan for
  the Japan-resident route.

Therefore the Phase 3F-P structured values remain evidence-faithful:

- international store record → `resides-outside-japan`;
- future domestic route records → `resides-in-japan`.

This design does not infer the current user's residence and does not evaluate transaction
eligibility.

### 2.2 Domestic drawing remains current

Official domestic ticket-information source:

`https://www.pokepark-kanto.co.jp/ppark/ticketInfo/type/index`

The current official material still publishes a drawing schedule for admission three calendar
months ahead, with applications from the 1st through the 12th of each month.

The official June 16, 2026 timing notice remains current supporting evidence:

`https://www.pokepark-kanto.co.jp/ppark/announcement/40/detail/index`

It states that from July 2026 the ticket drawing and first-come sale start time is 20:00, including a
drawing example beginning at 20:00 on the first of the month.

This is sufficient to design a future domestic drawing record using the existing
`monthly-application-window` mechanism family.

### 2.3 Domestic first-come remains real but intentionally deferred

The current domestic ticket material also publishes first-come sales for admission two months ahead
and a month-end rule for target dates that do not exist in the shifted month.

The same June 16 notice confirms the 20:00 start time from July 2026.

However the first-come route still needs the separately documented calendar rule:

`last-day-of-shifted-month`

for `rolling-calendar-month-release.missingAlignedDayRule`.

Phase 3F-R does not implement or authorize that runtime extension.

The first-come record remains deferred until a later design/runtime gate can add and prove that
calendar rule without coupling it to the cardinality change.

---

## 3. Existing runtime identity and composition audit

The current runtime already preserves exact evidence identity by `recordId`.

### 3.1 Phase 3F-D

Every derivation carries:

- `recordId`;
- `placeId`;
- `scope`.

The derivation layer iterates all records for a place and derives each independently.

### 3.2 Phase 3F-F

Presentation pairs a derivation back to its exact evidence record using:

- `recordId`;
- `placeId`;
- `scope`.

It now also presents `purchaseResidenceContext` through neutral route-anchored copy.

### 3.3 Phase 3F-H

Reference-date relation remains record-local.

No relation combines, prioritizes or replaces one same-scope mechanism with another.

### 3.4 Phase 3F-J

The route-wide calendar emits one item per eligible evidence record.

Its deterministic comparator remains:

1. anchor civil date;
2. plan ordinal;
3. source-record index.

Source-record index is only a deterministic tie-breaker. It is not operator preference, purchase
priority, recommendation or user applicability.

### 3.5 React surfaces

The per-day and route-wide surfaces render one presentation per record and already display
purchase-residence context before temporal relation/provenance.

Therefore two same-scope records with different or identical explicit purchase-residence contexts
remain visibly distinguishable without a new UI taxonomy.

---

## 4. Identity decision

### 4.1 `recordId` remains the only evidence-record identity

Phase 3F-R retains the Phase 3F-M conclusion:

> One official reservation-mechanism evidence proposition is identified by its globally unique
> `recordId`.

The following are not evidence-record identity:

- `placeId`;
- `scope`;
- `purchaseResidenceContext`;
- mechanism kind;
- allocation;
- source URL.

### 4.2 `purchaseResidenceContext` is applicability evidence, not identity

Two different evidence records may legitimately share the same purchase-residence context.

PokéPark's future domestic drawing and domestic first-come propositions are the concrete example:
both are `resides-in-japan`, but they are separate mechanisms with separate calendar facts.

Therefore the successor must **not** replace the current uniqueness key with:

`placeId + scope + purchaseResidenceContext`

because that would still incorrectly reject two valid domestic mechanisms.

### 4.3 No new channel/pathway identity field

Phase 3F-R again rejects adding:

- `channel`;
- `pathway`;
- `acquisitionChannel`;
- `mechanismRole`;
- fake scope values;
- allocation-as-identity;
- mechanism-kind-as-identity.

They are unnecessary for runtime identity and would duplicate information already represented by the
record itself.

---

## 5. Cardinality decision

### 5.1 Remove active `placeId + scope` uniqueness

The Phase 3F-S successor is authorized to remove the rule that globally rejects every second active
record with the same `placeId + scope`.

That invariant has served its temporary safety purpose and now conflicts with verified official
evidence.

### 5.2 Replace it with an explicit-context collision guard

A same-scope active collision group is defined as:

> two or more active records with the same `placeId + scope`.

For every such group, **every active member must have an explicit purchase-residence context**:

- `resides-in-japan`; or
- `resides-outside-japan`.

A record with:

`purchaseResidenceContext: not-recorded`

may remain active while it is the only active record for its `placeId + scope`.

But `not-recorded` may **not** participate in an active same-scope collision group.

This is the replacement fail-closed catalog invariant.

### 5.3 Why this guard is the minimum safe rule

`not-recorded` deliberately means only that structured evidence does not record residence context.

It does not mean:

- worldwide;
- unrestricted;
- usable by everyone;
- compatible with another route;
- eligible for the current user.

Allowing a same-scope collision that contains `not-recorded` would reintroduce the exact ambiguity
Phase 3F-O/P were created to prevent.

By contrast, two explicit `resides-in-japan` records are allowed because purchase-residence context
is not a mechanism identity axis.

### 5.4 Superseded records do not participate

The replacement guard applies only to active records.

A superseded record may share `placeId + scope` without forcing a current applicability claim.

Global ID uniqueness and ID namespace validation continue to apply to every record regardless of
status.

---

## 6. No semantic deduplication rule

Phase 3F-R does not introduce a generic semantic uniqueness key such as:

- `placeId + scope + context + mechanism.kind`;
- serialized mechanism equality;
- source URL equality;
- allocation equality.

Reason:

Official mechanisms can legitimately share some or all of those attributes while remaining distinct
evidence propositions because their source context, status history or operator-published purchase
route differs.

Exact accidental duplication is a data-quality defect to be caught by focused fixture review and
tests for concrete additions, not by inventing a second generic identity model.

Global `recordId` uniqueness remains the structural identity invariant.

---

## 7. Composition decision after relaxation

### 7.1 No merging

Same-scope records remain separate throughout D/F/H/J.

No layer may:

- merge them into one synthetic reservation fact;
- choose one as preferred;
- treat one as fallback;
- hide one because another shares its scope;
- deduplicate by matching dates;
- infer that one is more applicable to the current user.

### 7.2 No automatic filtering by residence context

The evidence field remains descriptive.

The application does not know the current user's residence and must not:

- ask for it in this phase;
- infer it from locale/IP/device;
- filter records automatically;
- rank one route above another;
- label one route "for you".

### 7.3 Identical calendar dates are valid

The future domestic drawing and current outside-Japan drawing may derive identical application
windows.

That is not duplication.

They are separate operator-published purchase routes with different explicit
`purchaseResidenceContext` values.

The route-wide calendar may therefore contain two rows with the same anchor date, plan ordinal and
scope.

The existing source-record-index tie-breaker may order them deterministically without implying
priority.

---

## 8. Phase 3F-S successor fixture

Phase 3F-S should prove the relaxed cardinality with exactly one new real record:

`RM-JP-050-002`

Required evidence shape, subject to implementation-day official-source recheck:

```text
placeId: JP-050
scope: general-admission
purchaseResidenceContext: resides-in-japan
status: active
mechanism:
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

Canonical source:

`https://www.pokepark-kanto.co.jp/ppark/ticketInfo/type/index`

Supporting timing source:

`https://www.pokepark-kanto.co.jp/ppark/announcement/40/detail/index`

The provenance evidence must also retain the residence-routing proposition that this is the
Japan-resident official route.

### 8.1 Catalog result

Expected active catalog size:

**7 → 8**

JP-050 active `general-admission` records become exactly:

1. `RM-JP-050-001` — `resides-outside-japan` — existing international application/drawing;
2. `RM-JP-050-002` — `resides-in-japan` — domestic application/drawing.

No first-come JP-050 record is authorized by Phase 3F-S.

### 8.2 Why the first successor adds drawing only

The domestic drawing uses the already proven `monthly-application-window` runtime family.

This isolates the cardinality/applicability change from the separate missing-day calendar extension
needed by domestic first-come sales.

The first real same-scope pair can therefore be proved without introducing another date mechanism
change in the same executable gate.

---

## 9. Deferred domestic first-come work

Phase 3F-R records but does not implement the later domestic first-come proposition.

A later gate must independently design/implement:

`rolling-calendar-month-release.missingAlignedDayRule = last-day-of-shifted-month`

with civil-date semantics such as:

- 2027-04-30 visit → 2027-02-28 release;
- 2028-04-30 visit → 2028-02-29 release.

Only after that runtime rule is proven may another active JP-050
`general-admission + resides-in-japan` record be added for the first-come route.

The collision guard designed here already permits that future third record because all colliding
active records would have explicit context.

---

## 10. Phase 3F-S implementation boundary

Phase 3F-S may change only what is necessary to:

1. replace active `placeId + scope` uniqueness with the explicit-context collision guard in the
   TypeScript catalog parser;
2. mirror the same rule in the Python validator;
3. add exactly one domestic drawing JP-050 record to both parity JSON catalogs;
4. add focused parser/validator tests for allowed and rejected collision groups;
5. add focused D/F/H/J tests proving exact record-local composition;
6. update documentation;
7. run the full repository-native validation and existing Phase 3F browser audits.

Not authorized:

- domestic first-come evidence;
- `last-day-of-shifted-month`;
- new mechanism kind;
- new scope;
- `channel` / pathway field;
- new residence-context vocabulary value;
- user residence/profile/settings;
- automatic filtering;
- ranking/recommendation;
- availability/inventory/current-sale-state logic;
- persistence/localStorage change;
- network requests;
- notifications/reminders/calendar export;
- new grouping UI;
- hiding duplicate-date rows.

---

## 11. Phase 3F-S validation gate

Phase 3F-S must prove at minimum:

1. canonical/app evidence catalogs remain byte-identical;
2. catalog size becomes exactly 8;
3. global record IDs remain unique;
4. ID namespace matching remains enforced;
5. exactly two active JP-050 `general-admission` records exist;
6. those two record IDs are exactly `RM-JP-050-001` and `RM-JP-050-002`;
7. RM-JP-050-001 remains `resides-outside-japan`;
8. RM-JP-050-002 is `resides-in-japan`;
9. both JP-050 records are active;
10. a same-scope active group with all members carrying specific context parses successfully;
11. two active same-scope records both carrying `resides-in-japan` are structurally permitted;
12. a same-scope active group containing one `not-recorded` record is rejected;
13. a same-scope active group containing only `not-recorded` members is rejected;
14. a single active `not-recorded` record for one `placeId + scope` remains valid;
15. superseded same-scope records do not trigger the active collision guard;
16. parser and Python validator enforce the same rule;
17. no `placeId + scope + purchaseResidenceContext` uniqueness rule is introduced;
18. no channel/pathway identity field exists;
19. RM-JP-050-002 uses the existing `monthly-application-window`;
20. RM-JP-050-002 derives the month three months before the visit month;
21. its open edge is day 1 at exactly 20:00 Asia/Tokyo;
22. its close edge is day 12 with no invented recurring close time/timezone;
23. allocation is `drawing`;
24. presentation renders `resides-in-japan` through the existing neutral route-anchored copy;
25. presentation still makes no user-residence/eligibility claim;
26. Phase 3F-D returns separate derivations identified by separate `recordId` values;
27. Phase 3F-H evaluates each record independently;
28. Phase 3F-J emits one row per eligible JP-050 record;
29. identical anchor dates are not deduplicated;
30. route ordering remains deterministic and unchanged in comparator semantics;
31. no context-based sorting/ranking is introduced;
32. domestic first-come evidence remains absent;
33. `last-day-of-shifted-month` remains absent from runtime;
34. existing Disney missing-day behavior remains unchanged;
35. no user-residence field is introduced;
36. no personalized filtering is introduced;
37. no availability/current-sale-state field is introduced;
38. official domestic and residence-routing sources are rechecked immediately before the data write;
39. if the residence split or domestic drawing proposition changes materially, implementation stops
    and returns to design;
40. full Vitest passes;
41. Python validator/tests pass;
42. lint passes;
43. build passes;
44. repository whitespace gates pass;
45. Phase 3F-F/H/J browser audits pass.

---

## 12. Normative contracts

1. Phase 3F-R changes documentation only.
2. Phase 3F-R does not change catalog data.
3. Phase 3F-R does not change runtime code.
4. `recordId` remains the evidence-record identity.
5. `purchaseResidenceContext` is applicability evidence, not identity.
6. Same context may contain multiple distinct mechanisms.
7. Phase 3F-S may remove active `placeId + scope` uniqueness.
8. The replacement guard applies only to active collision groups.
9. Every member of an active same-scope collision group must have a specific residence context.
10. `not-recorded` may not participate in an active same-scope collision group.
11. A solitary active `not-recorded` record remains valid.
12. Superseded records do not trigger the active collision guard.
13. Global record-ID uniqueness remains mandatory.
14. ID namespace matching remains mandatory.
15. No `placeId + scope + purchaseResidenceContext` uniqueness rule is introduced.
16. No generic semantic-dedup identity key is introduced.
17. No `channel`, `pathway` or equivalent field is introduced.
18. No fake scope is introduced.
19. Allocation is not identity.
20. Mechanism kind is not identity.
21. Same-scope records are never merged.
22. Same-scope records are never automatically deduplicated by date.
23. Same-scope records are never automatically ranked.
24. Purchase-residence context does not become user profile data.
25. No current-user residence is inferred.
26. No automatic applicability decision is made.
27. Phase 3F-D remains record-local.
28. Phase 3F-F remains record-local and owns residence-context display.
29. Phase 3F-H remains record-local.
30. Phase 3F-J emits one row per eligible record.
31. Source-record index remains a deterministic tie-breaker only.
32. Identical dates across different evidence records are valid.
33. Phase 3F-S may add exactly one new JP-050 record.
34. That record is `RM-JP-050-002`.
35. It is `general-admission`.
36. It is `resides-in-japan`.
37. It uses existing `monthly-application-window`.
38. It records days 1–12 three months before the visit month.
39. It records 20:00 Asia/Tokyo on the open edge.
40. It invents no close-edge time/timezone.
41. It records allocation `drawing`.
42. Existing RM-JP-050-001 remains the outside-Japan record.
43. Catalog size under Phase 3F-S becomes 8.
44. Domestic first-come remains absent in Phase 3F-S.
45. `last-day-of-shifted-month` remains absent in Phase 3F-S.
46. No user-residence/profile field is authorized.
47. No personalized filtering is authorized.
48. No availability/inventory/current-sale-state model is authorized.
49. No persistence/network/account integration is authorized.
50. Full repository-native validation is required before Ready transition.
51. Implementation-day official-source recheck is mandatory before RM-JP-050-002 is written.
52. Material source drift blocks implementation rather than being normalized into the designed model.

---

## 13. Successor

If the implementation-day source gate still passes, the authorized successor is:

**Phase 3F-S — Same-Scope Purchase-Context Composition Foundation**

Its scope is exactly the cardinality-guard replacement plus the one domestic drawing record described
above.

Domestic first-come remains a later independent gate.
