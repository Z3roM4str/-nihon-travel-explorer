# Phase 3F-O — Purchase-Residence-Context Evidence Design Gate

Status: **design gate only — no runtime/data implementation in this phase**

Base: `f1eb7214a62c14f50200d7f2a19bf2f5f7362cfe` (`main` after Phase 3F-N / PR #84)

Official PokéPark KANTO source recheck: **2026-09-14**

---

## 1. Problem statement

Phase 3F-M proved that `recordId` is already sufficient as evidence-record identity, but hostile
review correctly blocked same-scope multi-mechanism implementation because identity and purchaser
applicability are different questions.

PokéPark KANTO is the canonical real case:

- the operator tells guests residing outside Japan to use a separate English Official Web Ticket
  Store;
- residents of Japan use the Japanese official route and must complete SMS verification using a
  mobile phone usable in Japan;
- the two routes do not currently expose the same set of purchase mechanisms.

Phase 3F-N intentionally added only the outside-Japan application/lottery record and encoded the
audience context indirectly in `sourceEntity` and provenance evidence.

That was safe for one record, but it is not a scalable structural model.

The current evidence schema cannot answer this factual question directly:

> **For which operator-published purchase-residence context was this mechanism recorded?**

Phase 3F-O designs the smallest evidence field needed to answer that question without creating a
user profile, personalized eligibility engine or purchase recommendation system.

---

## 2. Current official evidence recheck

### 2.1 Operator separation of purchase routes

Current official English ticket information:

`https://www.pokepark-kanto.co.jp/ppark/ticketInfo/type/index?languageKind=en_US`

The operator currently states that:

- guests residing outside Japan should use a separate external English website;
- residents of Japan may purchase through the Japanese official website;
- the Japan-resident route requires membership registration and SMS verification through a mobile
  phone usable in Japan.

### 2.2 Outside-Japan Official Web Ticket Store

Current official international store:

`https://ticket-en.pokepark-kanto.co.jp/?viewLang=en`

The outside-Japan store continues to publish the Application/lottery mechanism implemented in
Phase 3F-N.

This phase does not re-open that date-mechanism decision. The source is relevant here only because it
proves that the operator itself distinguishes purchase routes by residence context.

---

## 3. Design principle

The new field records **source-defined purchase residence context**, not the user's personal eligibility and not a generic acquisition-channel taxonomy.

The system may say:

> “The official source records this mechanism for residents outside Japan.”

It must not infer:

> “You are eligible for this mechanism.”

It must not ask, store or derive the user's residence.

It must not automatically hide or prefer mechanisms based on assumed residence.

This is evidence presentation, not personalization.

---

## 4. New closed field

Phase 3F-O approves one required top-level evidence field:

`purchaseResidenceContext`

Closed vocabulary:

```text
not-recorded
resides-in-japan
resides-outside-japan
```

Type:

```text
ReservationPurchaseResidenceContext =
  | "not-recorded"
  | "resides-in-japan"
  | "resides-outside-japan"
```

Every reservation-mechanism evidence record must carry exactly one value.

---

## 5. Naming boundary

The field name is deliberately `purchaseResidenceContext`, not the broader `purchaseContext`.

Reason:

- the approved vocabulary encodes one axis only: residence in Japan versus residence outside Japan;
- it does not encode language, sales channel, membership, phone/SMS requirements, payment method,
  nationality, citizenship or account type;
- a generic `purchaseContext` name would invite future unrelated concepts to be overloaded into one
  scalar field.

If a future official source requires a different structured applicability axis, that axis requires
its own design gate and must not be smuggled into `purchaseResidenceContext`.

---

## 6. Semantics

### 6.1 `not-recorded`

Means only:

> The current structured evidence record does not assert a residence-based purchase context.

It does **not** mean:

- universally available;
- available worldwide;
- no residency restriction;
- no account requirement;
- usable by the current user.

Absence of structured purchase-residence-context evidence must remain absence.

### 6.2 `resides-in-japan`

Means:

> The cited official purchase route is explicitly presented by the operator for people residing in
> Japan.

It does not itself encode:

- Japanese citizenship;
- nationality;
- visa status;
- postal address;
- phone ownership;
- successful SMS verification;
- actual purchase eligibility.

Any additional official requirement, such as SMS through a Japan-usable mobile number, remains in
provenance evidence unless a future design gate gives that concept its own structured field.

### 6.3 `resides-outside-japan`

Means:

> The cited official purchase route is explicitly presented by the operator for people residing
> outside Japan.

It does not mean:

- every country is supported;
- every payment method is supported;
- every user outside Japan can successfully transact;
- the mechanism is currently available.

---

## 7. Why the field belongs at record level

`purchaseResidenceContext` belongs beside `scope`, `mechanism`, `allocation` and `status`, not inside
provenance.

Reason:

- provenance answers **where the evidence came from**;
- purchase-residence context answers **which operator-defined residence audience the proposition describes**.

The same official operator may publish distinct mechanisms for different purchase-residence contexts.

Keeping the field structural makes that distinction machine-readable without turning provenance free
text into business logic.

---

## 8. Why not overload `sourceEntity`

Phase 3F-N used:

`PokéPark KANTO Official Web Ticket Store — outside-Japan purchase`

That wording remains useful provenance, but it must not be the only structured location of the
context.

Overloading `sourceEntity` is rejected because:

- it is free text;
- parser logic cannot safely infer semantics from it;
- Phase 3F-J explicitly forbids `sourceEntity` as an ordering/quality signal;
- different wording could describe the same purchase-residence context;
- future same-scope records need an explicit non-textual distinction.

---

## 9. Why not create a user-residency model

Phase 3F-O explicitly rejects:

- `userResidence`;
- country-of-residence settings;
- inferred residence from location/IP/device;
- passport/nationality fields;
- automatic mechanism filtering based on user data.

Those concepts would turn a source-evidence feature into personal eligibility logic.

They are unnecessary for the current goal.

The application can display the operator-published context and leave the applicability decision to
the user.

---

## 10. Presentation contract

Phase 3F-P should add one presentation field:

`purchaseResidenceContextText: string | null`

Closed rendering:

### `not-recorded`

`null`

No UI line is rendered.

### `resides-in-japan`

`La fuente oficial citada presenta esta ruta de compra para residentes en Japón.`

### `resides-outside-japan`

`La fuente oficial citada dirige a quienes residen fuera de Japón a esta ruta de compra.`

This text is descriptive only and is deliberately anchored to the **cited official purchase
route**, not to the current user.

It must not say:

- “aplica para ti”;
- “no aplica para ti”;
- “elige esta opción”;
- “debes usar”;
- “puedes comprar”;
- “no puedes comprar”;
- “eres residente”;
- “no eres residente”;
- “eres elegible”;
- “no eres elegible”.

---

## 11. Presentation placement

When non-null, `purchaseResidenceContextText` has one exact ordering contract on both existing surfaces:

1. detail lines / recorded fact;
2. allocation disclosure, when non-null;
3. **purchase-residence-context disclosure**;
4. Phase 3F-H reference-date relation, when present;
5. provenance text;
6. official source link.

If allocation is null, purchase-residence context still renders immediately after the recorded fact/details.

Reason:

The purchase-residence context is a property of the recorded mechanism/source route, so it stays adjacent to
allocation and before the independent temporal-relation layer. Provenance remains after both
mechanism disclosure and temporal relation.

This exact order applies to:

- the per-day official reservation notice;
- the route-wide official reservation calendar.

No new panel, grouping surface or badge taxonomy is required.

---

## 12. Provenance traceability for specific purchase-residence contexts

A non-`not-recorded` `purchaseResidenceContext` is a structured factual claim and must be traceable to an
official source that explicitly supports that residence context.

For JP-050, the canonical mechanism `sourceUrl` remains:

`https://ticket-en.pokepark-kanto.co.jp/?viewLang=en`

because that store is the source for the Application/lottery mechanism itself.

However, the explicit outside-Japan routing statement is published on:

`https://www.pokepark-kanto.co.jp/ppark/ticketInfo/type/index?languageKind=en_US`

Therefore Phase 3F-P must retain that official routing URL verbatim inside
`provenance.evidence` as a supporting source for `purchaseResidenceContext: resides-outside-japan`.

This follows the existing Phase 3F compound-provenance pattern used for Nintendo Museum: one
canonical `sourceUrl`, with an additional official supporting URL retained verbatim in evidence
when a structured claim depends on it.

No provenance-array/schema expansion is authorized by this gate.

If a future non-`not-recorded` context cannot be traced to explicit official evidence, that record
must remain `not-recorded` rather than deriving context from naming, locale, language, domain or
operator assumptions.

---

## 13. Existing-record migration

Phase 3F-P should migrate all seven active records so the field is explicit and parser shape remains
closed.

Required migration:

| Record | purchaseResidenceContext |
|---|---|
| RM-JP-044-001 | `not-recorded` |
| RM-JP-203-001 | `not-recorded` |
| RM-JP-204-001 | `not-recorded` |
| RM-JP-077-001 | `not-recorded` |
| RM-JP-212-001 | `not-recorded` |
| RM-JP-097-001 | `not-recorded` |
| RM-JP-050-001 | `resides-outside-japan` |

This migration does **not** claim that the six `not-recorded` records have no restrictions.

It only preserves what Phase 3F currently knows structurally.

A future source audit may replace `not-recorded` with a more specific value if official evidence
supports it.

---

## 14. Parser and validator contract

Phase 3F-P must:

1. make `purchaseResidenceContext` required on every evidence record;
2. reject missing `purchaseResidenceContext`;
3. reject unsupported values;
4. reject extra purchase-residence-context subfields because this is a scalar closed vocabulary;
5. preserve global record-ID uniqueness;
6. preserve active `placeId + scope` uniqueness in Phase 3F-P;
7. preserve canonical/app JSON byte parity.

No optional fallback/default is allowed in the parser.

Old records without the field must fail parsing after the migration lands; the bundled catalog is
migrated atomically in the same successor.

---

## 15. Runtime ownership boundaries

### Phase 3F-D derivation

Must ignore `purchaseResidenceContext`.

Date derivation remains a pure function of:

- one evidence record's date mechanism;
- visit civil date;
- evidence status/applicability.

No date changes based on purchase-residence context are authorized.

### Phase 3F-F presentation

Owns human-readable purchase-residence-context disclosure.

It may read the field only to generate `purchaseResidenceContextText`.

### Phase 3F-H reference-date relation

Must ignore `purchaseResidenceContext`.

A temporal relation is about civil dates, not audience applicability.

### Phase 3F-J route-wide calendar

May carry `purchaseResidenceContextText` only through the already-composed presentation.

It must not:

- sort by purchase-residence context;
- group by purchase-residence context;
- filter by purchase-residence context;
- rank by purchase-residence context.

---

## 16. Identity and cardinality boundary

Phase 3F-O retains the Phase 3F-M identity conclusion:

> `recordId` is the evidence-record identity.

However Phase 3F-P must **not** yet remove active `placeId + scope` uniqueness.

Reason:

Adding a structural context field and proving its neutral presentation should be one bounded
foundation phase.

A later gate may then evaluate same-scope cardinality relaxation using actual context-bearing
records, without combining two schema changes into one validation surface.

Therefore Phase 3F-O does not authorize a second JP-050 active record.

---

## 17. Domestic PokéPark boundary

The Japan-resident route is useful as the real proof that `resides-in-japan` is needed in the
vocabulary.

Phase 3F-P does not add it to the catalog.

The domestic first-come mechanism remains deferred because it separately requires:

- implementation-time source recheck;
- the previously documented `last-day-of-shifted-month` missing-date rule;
- cardinality relaxation;
- exact determination of what ticket inventory the current “some tickets” wording covers;
- preservation of first-come contingency language.

Purchase-context support is necessary but not sufficient to add that record.

---

## 18. No hidden applicability logic

The new field may not be used as a proxy for:

- availability;
- current sale state;
- eligibility;
- recommendation;
- priority;
- convenience;
- price;
- language preference;
- payment support;
- nationality;
- citizenship;
- visa status;
- current location.

No code may derive “usable by user” from this field.

---

## 19. Successor implementation boundary

Before any Phase 3F-P data write, the implementation must re-open the current official PokéPark
routing source and verify that the operator still explicitly distinguishes residents of Japan from
guests residing outside Japan.

The implementation-day source is:

`https://www.pokepark-kanto.co.jp/ppark/ticketInfo/type/index?languageKind=en_US`

If that proposition has changed, disappeared, broadened or become materially ambiguous, Phase 3F-P
must stop and return to a design gate. It may not preserve `resides-outside-japan` from stale
evidence, infer the context from language/domain, or silently substitute a different applicability
axis.

**Phase 3F-P — Purchase-Residence-Context Evidence Foundation** may change only:

1. TypeScript evidence type/parser;
2. Python validator;
3. both parity JSON catalogs;
4. Phase 3F-F presentation type/helper;
5. the two existing React display surfaces only to render non-null context text;
6. focused D/F/H/J/source-boundary tests;
7. Python tests;
8. documentation;
9. browser regression fixtures/audits only where necessary to prove presentation.

Not authorized:

- new date mechanism kind;
- same-scope cardinality relaxation;
- second JP-050 record;
- domestic first-come record;
- `last-day-of-shifted-month`;
- user profile/settings;
- persistence;
- network requests;
- account integration;
- automatic filtering;
- ranking;
- recommendation;
- notifications/reminders/calendar export.

---

## 20. Phase 3F-P validation gate

Phase 3F-P must prove at minimum:

1. canonical/app evidence parity;
2. catalog size remains exactly 7;
3. every record has exactly one `purchaseResidenceContext`;
4. six pre-PokéPark-context records use `not-recorded`;
5. RM-JP-050-001 uses `resides-outside-japan`;
6. parser rejects missing `purchaseResidenceContext`;
7. parser rejects an unsupported value;
8. Python validator mirrors the same closed vocabulary;
9. duplicate global IDs still fail;
10. duplicate active `placeId + scope` still fails;
11. no defaulting of missing context occurs;
12. no user-residence field exists;
13. no country field exists in the evidence schema;
14. no eligibility boolean exists;
15. Phase 3F-D derives identical dates before and after the migration;
16. Phase 3F-D source code does not read `purchaseResidenceContext`;
17. Phase 3F-F returns null context text for `not-recorded`;
18. Phase 3F-F renders the exact route-anchored outside-Japan text for JP-050;
19. Phase 3F-F wording contains no personalized applicability claim;
20. Phase 3F-H relation output remains byte/shape-equivalent for matching date inputs;
21. Phase 3F-H source code does not read `purchaseResidenceContext`;
22. Phase 3F-J ordering remains unchanged when only purchase-residence context changes;
23. Phase 3F-J source comparator does not read `purchaseResidenceContext`;
24. per-day surface renders non-null context after allocation and **before the Phase 3F-H relation**;
25. route-wide surface renders non-null context after allocation and **before the Phase 3F-H relation**;
26. on either surface, if allocation is null, context renders after the recorded fact/details;
27. provenance remains after the temporal relation;
28. not-recorded records render no empty placeholder;
29. JP-050 provenance evidence retains the official routing URL that explicitly supports the
    outside-Japan context;
30. no specific purchase-residence context is inferred from sourceEntity, locale, language or domain;
31. JP-050 remains exactly one active record;
32. domestic JP-050 first-come remains absent;
33. `last-day-of-shifted-month` remains absent from runtime;
34. full Vitest passes;
35. lint passes;
36. build passes;
37. repository whitespace gates pass;
38. Phase 3F-F/H/J browser audits pass;
39. the official PokéPark residence-routing source is rechecked on implementation day before the
    catalog migration;
40. the implementation-day source still explicitly supports `resides-outside-japan` for the
    international route; otherwise implementation stops rather than forcing the designed value.

---

## 21. Normative contracts

1. Phase 3F-O changes documentation only.
2. `purchaseResidenceContext` is source evidence, not user profile data.
3. `purchaseResidenceContext` is required on every record after Phase 3F-P.
4. The vocabulary is closed to three values.
5. `not-recorded` never means unrestricted.
6. `not-recorded` never means globally available.
7. `not-recorded` never means eligible for the current user.
8. `resides-in-japan` describes the official purchase route's published audience.
9. `resides-outside-japan` describes the official purchase route's published audience.
10. Neither specific value proves successful transaction eligibility.
11. No nationality field is introduced.
12. No citizenship field is introduced.
13. No visa field is introduced.
14. No country field is introduced.
15. No user-residence field is introduced.
16. No current-location inference is introduced.
17. No IP/device inference is introduced.
18. No personalized filtering is introduced.
19. No automatic route selection is introduced.
20. No availability inference is introduced.
21. No inventory inference is introduced.
22. No ranking is introduced.
23. No recommendation is introduced.
24. The field belongs at evidence-record level.
25. The field is not parsed out of `sourceEntity`.
26. The field is not parsed out of free-text `evidence`.
27. `sourceEntity` remains provenance free text.
28. Existing seven records are migrated atomically.
29. RM-JP-050-001 becomes `resides-outside-japan`.
30. The six other current records become `not-recorded`.
31. Existing six `not-recorded` values make no claim about restrictions.
32. Missing `purchaseResidenceContext` fails parsing.
33. Unsupported `purchaseResidenceContext` fails parsing.
34. No parser default is allowed.
35. Phase 3F-D ignores purchase-residence context.
36. Phase 3F-H ignores purchase-residence context.
37. Phase 3F-J does not order by purchase-residence context.
38. Phase 3F-J does not group by purchase-residence context.
39. Phase 3F-J does not filter by purchase-residence context.
40. Phase 3F-F owns purchase-residence-context display text.
41. `not-recorded` produces no UI line.
42. `resides-in-japan` uses route-anchored neutral descriptive text.
43. `resides-outside-japan` uses route-anchored neutral descriptive text.
44. Context text names the cited official purchase route, not the current user's residence.
45. Context text renders immediately after allocation when allocation exists.
46. If allocation is null, context text renders immediately after the recorded fact/details.
47. Context text renders before any Phase 3F-H reference-date relation.
48. Provenance remains after the reference-date relation.
49. Context text must not say “applies to you”.
50. Context text must not say “does not apply to you”.
51. Context text must not say “you can buy”.
52. Context text must not say “you cannot buy”.
53. Context text must not say or imply “you are a resident”.
54. Context text must not say or imply “you are eligible”.
55. A specific context requires explicit official supporting evidence.
56. JP-050's outside-Japan context keeps the official routing URL in provenance evidence.
57. Specific context may not be inferred from sourceEntity, locale, language or domain.
58. Active `placeId + scope` uniqueness remains in Phase 3F-P.
59. Global record-ID uniqueness remains.
60. No second JP-050 active record is authorized.
61. Domestic JP-050 first-come remains deferred.
62. `last-day-of-shifted-month` remains deferred.
63. No planning-draft schema change is authorized.
64. No localStorage change is authorized.
65. No network request is authorized.
66. No reminder/notification/calendar action is authorized.
67. Full repository-native validation is required before Ready transition.
68. A later gate is required before same-scope cardinality relaxation.
69. Phase 3F-P must recheck the official residence-routing source immediately before data write.
70. A changed or ambiguous source may not be forced into the prior `resides-outside-japan` value.
71. A changed source that no longer supports the designed residence axis requires a new design gate.

---

### 21.1 Independent focused review corrective

The independent focused review checked the corrected design against:

- the current official PokéPark residence-routing evidence;
- both current React reservation surfaces;
- the shipped Phase 3F-H composition order;
- the proposed closed evidence vocabulary.

It found two material design issues.

#### A. Presentation-order ambiguity

The earlier draft required purchase-residence context to render “after allocation and before
provenance”, but both existing surfaces currently place the Phase 3F-H reference-date relation inside
that same interval. The wording therefore allowed two incompatible implementations:

- allocation → context → relation → provenance; or
- allocation → relation → context → provenance.

The review fixes one exact order:

> recorded fact/details → allocation (if any) → purchase-residence context → temporal relation (if any) →
> provenance → source link.

This keeps mechanism/source-route properties together and leaves the temporal relation as a separate
dimension after them.

#### B. Field name was broader than the evidence axis

The earlier field name `purchaseContext` was too broad for a vocabulary whose only structured axis
is residence in Japan versus residence outside Japan.

The review narrows the structural field to:

`purchaseResidenceContext`

and the presentation field to:

`purchaseResidenceContextText`

This prevents future language, channel, membership, payment or phone/SMS concepts from being
silently overloaded into the same scalar.

The review reconfirmed:

1. `purchaseResidenceContext` is a fact about the cited official route, not the user;
2. the three-value closed vocabulary is sufficient for the currently evidenced PokéPark residence
   distinction;
3. migrating the other six records to `not-recorded` adds no new restriction or universal-access
   claim;
4. specific context requires explicit official supporting evidence and may not be inferred from
   `sourceEntity`, locale, language or domain;
5. no additional runtime owner beyond Phase 3F-F presentation is needed;
6. Phase 3F-J can continue carrying the existing presentation object without a new calendar-level
   purchase-residence-context field.

No runtime, data, schema or UI implementation is performed by this review.

---

## 22. Rejected alternatives

### “Keep encoding purchase-residence context only in sourceEntity”

Rejected. Free-text provenance is visible but not structurally reliable.

### “Add country or nationality”

Rejected. The official distinction is residence inside/outside Japan, not citizenship or nationality.

### “Store the user's residence and filter automatically”

Rejected. It is unnecessary personal applicability logic for this evidence feature.

### “Use unrestricted instead of not-recorded”

Rejected. It would turn missing evidence into a universal-access claim.

### “Make purchaseResidenceContext optional”

Rejected. Optional absence creates two different meanings for missing data. Explicit
`not-recorded` is safer.

### “Relax same-scope cardinality in the same successor”

Rejected. Purchase-context foundation should be validated independently before it becomes part of a
multi-record composition change.

### “Add the domestic first-come record in Phase 3F-P”

Rejected. That record has additional calendar-rule and evidence-granularity requirements unrelated
to the purchase-residence-context field itself.

---

## 23. Recommended successor

**Phase 3F-P — Purchase-Residence-Context Evidence Foundation**

One bounded implementation:

- recheck the official PokéPark residence-routing source on implementation day;
- add required `purchaseResidenceContext` to the evidence schema;
- migrate all seven records atomically;
- set JP-050 to `resides-outside-japan`;
- set the other six records to `not-recorded`;
- add route-anchored neutral presentation text for non-`not-recorded` contexts;
- retain the official PokéPark routing URL in JP-050 provenance evidence as supporting context proof;
- render context on both existing official-reservation surfaces;
- keep date derivation, temporal relation and route ordering context-blind;
- preserve active `placeId + scope` uniqueness;
- add no new mechanisms or records;
- run the full repository-native regression gate.

Phase 3F-P is **NOT STARTED** by this design record.
