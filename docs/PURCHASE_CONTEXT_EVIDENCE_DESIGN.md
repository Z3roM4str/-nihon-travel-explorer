# Phase 3F-O — Purchase-Context Evidence Design Gate

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

> **For which operator-published purchase context was this mechanism recorded?**

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
proves that the operator itself distinguishes purchase contexts.

---

## 3. Design principle

The new field records **source-defined purchase context**, not the user's personal eligibility.

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

`purchaseContext`

Closed vocabulary:

```text
not-recorded
resides-in-japan
resides-outside-japan
```

Type:

```text
ReservationPurchaseContext =
  | "not-recorded"
  | "resides-in-japan"
  | "resides-outside-japan"
```

Every reservation-mechanism evidence record must carry exactly one value.

---

## 5. Semantics

### 5.1 `not-recorded`

Means only:

> The current structured evidence record does not assert a residence-based purchase context.

It does **not** mean:

- universally available;
- available worldwide;
- no residency restriction;
- no account requirement;
- usable by the current user.

Absence of structured purchase-context evidence must remain absence.

### 5.2 `resides-in-japan`

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

### 5.3 `resides-outside-japan`

Means:

> The cited official purchase route is explicitly presented by the operator for people residing
> outside Japan.

It does not mean:

- every country is supported;
- every payment method is supported;
- every user outside Japan can successfully transact;
- the mechanism is currently available.

---

## 6. Why the field belongs at record level

`purchaseContext` belongs beside `scope`, `mechanism`, `allocation` and `status`, not inside
provenance.

Reason:

- provenance answers **where the evidence came from**;
- purchase context answers **which operator-defined purchase audience the proposition describes**.

The same official operator may publish distinct mechanisms for different purchase contexts.

Keeping the field structural makes that distinction machine-readable without turning provenance free
text into business logic.

---

## 7. Why not overload `sourceEntity`

Phase 3F-N used:

`PokéPark KANTO Official Web Ticket Store — outside-Japan purchase`

That wording remains useful provenance, but it must not be the only structured location of the
context.

Overloading `sourceEntity` is rejected because:

- it is free text;
- parser logic cannot safely infer semantics from it;
- Phase 3F-J explicitly forbids `sourceEntity` as an ordering/quality signal;
- different wording could describe the same purchase context;
- future same-scope records need an explicit non-textual distinction.

---

## 8. Why not create a user-residency model

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

## 9. Presentation contract

Phase 3F-P should add one presentation field:

`purchaseContextText: string | null`

Closed rendering:

### `not-recorded`

`null`

No UI line is rendered.

### `resides-in-japan`

`Ruta de compra oficial citada: para residentes en Japón.`

### `resides-outside-japan`

`Ruta de compra oficial citada: para residentes fuera de Japón.`

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

## 10. Presentation placement

When non-null, `purchaseContextText` should render:

1. after allocation disclosure;
2. before provenance text/source link.

Reason:

The field describes the mechanism itself, not source metadata and not a Phase 3F-H temporal relation.

The same placement should be used in:

- the per-day official reservation notice;
- the route-wide official reservation calendar.

No new panel, grouping surface or badge taxonomy is required.

---

## 11. Provenance traceability for specific purchase contexts

A non-`not-recorded` `purchaseContext` is a structured factual claim and must be traceable to an
official source that explicitly supports that residence context.

For JP-050, the canonical mechanism `sourceUrl` remains:

`https://ticket-en.pokepark-kanto.co.jp/?viewLang=en`

because that store is the source for the Application/lottery mechanism itself.

However, the explicit outside-Japan routing statement is published on:

`https://www.pokepark-kanto.co.jp/ppark/ticketInfo/type/index?languageKind=en_US`

Therefore Phase 3F-P must retain that official routing URL verbatim inside
`provenance.evidence` as a supporting source for `purchaseContext: resides-outside-japan`.

This follows the existing Phase 3F compound-provenance pattern used for Nintendo Museum: one
canonical `sourceUrl`, with an additional official supporting URL retained verbatim in evidence
when a structured claim depends on it.

No provenance-array/schema expansion is authorized by this gate.

If a future non-`not-recorded` context cannot be traced to explicit official evidence, that record
must remain `not-recorded` rather than deriving context from naming, locale, language, domain or
operator assumptions.

---

## 12. Existing-record migration

Phase 3F-P should migrate all seven active records so the field is explicit and parser shape remains
closed.

Required migration:

| Record | purchaseContext |
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

## 13. Parser and validator contract

Phase 3F-P must:

1. make `purchaseContext` required on every evidence record;
2. reject missing `purchaseContext`;
3. reject unsupported values;
4. reject extra purchase-context subfields because this is a scalar closed vocabulary;
5. preserve global record-ID uniqueness;
6. preserve active `placeId + scope` uniqueness in Phase 3F-P;
7. preserve canonical/app JSON byte parity.

No optional fallback/default is allowed in the parser.

Old records without the field must fail parsing after the migration lands; the bundled catalog is
migrated atomically in the same successor.

---

## 14. Runtime ownership boundaries

### Phase 3F-D derivation

Must ignore `purchaseContext`.

Date derivation remains a pure function of:

- one evidence record's date mechanism;
- visit civil date;
- evidence status/applicability.

No date changes based on purchase context are authorized.

### Phase 3F-F presentation

Owns human-readable purchase-context disclosure.

It may read the field only to generate `purchaseContextText`.

### Phase 3F-H reference-date relation

Must ignore `purchaseContext`.

A temporal relation is about civil dates, not audience applicability.

### Phase 3F-J route-wide calendar

May carry `purchaseContextText` only through the already-composed presentation.

It must not:

- sort by purchase context;
- group by purchase context;
- filter by purchase context;
- rank by purchase context.

---

## 15. Identity and cardinality boundary

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

## 16. Domestic PokéPark boundary

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

## 17. No hidden applicability logic

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

## 18. Successor implementation boundary

**Phase 3F-P — Purchase-Context Evidence Foundation** may change only:

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

## 19. Phase 3F-P validation gate

Phase 3F-P must prove at minimum:

1. canonical/app evidence parity;
2. catalog size remains exactly 7;
3. every record has exactly one `purchaseContext`;
4. six pre-PokéPark-context records use `not-recorded`;
5. RM-JP-050-001 uses `resides-outside-japan`;
6. parser rejects missing `purchaseContext`;
7. parser rejects an unsupported value;
8. Python validator mirrors the same closed vocabulary;
9. duplicate global IDs still fail;
10. duplicate active `placeId + scope` still fails;
11. no defaulting of missing context occurs;
12. no user-residence field exists;
13. no country field exists in the evidence schema;
14. no eligibility boolean exists;
15. Phase 3F-D derives identical dates before and after the migration;
16. Phase 3F-D source code does not read `purchaseContext`;
17. Phase 3F-F returns null context text for `not-recorded`;
18. Phase 3F-F renders the exact route-anchored outside-Japan text for JP-050;
19. Phase 3F-F wording contains no personalized applicability claim;
20. Phase 3F-H relation output remains byte/shape-equivalent for matching date inputs;
21. Phase 3F-H source code does not read `purchaseContext`;
22. Phase 3F-J ordering remains unchanged when only purchase context changes;
23. Phase 3F-J source comparator does not read `purchaseContext`;
24. per-day surface renders non-null context after allocation and before provenance;
25. route-wide surface renders non-null context after allocation and before provenance;
26. not-recorded records render no empty placeholder;
27. JP-050 provenance evidence retains the official routing URL that explicitly supports the
    outside-Japan context;
28. no specific purchase context is inferred from sourceEntity, locale, language or domain;
29. JP-050 remains exactly one active record;
30. domestic JP-050 first-come remains absent;
31. `last-day-of-shifted-month` remains absent from runtime;
32. full Vitest passes;
33. lint passes;
34. build passes;
35. repository whitespace gates pass;
36. Phase 3F-F/H/J browser audits pass.

---

## 20. Normative contracts

1. Phase 3F-O changes documentation only.
2. `purchaseContext` is source evidence, not user profile data.
3. `purchaseContext` is required on every record after Phase 3F-P.
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
32. Missing `purchaseContext` fails parsing.
33. Unsupported `purchaseContext` fails parsing.
34. No parser default is allowed.
35. Phase 3F-D ignores purchase context.
36. Phase 3F-H ignores purchase context.
37. Phase 3F-J does not order by purchase context.
38. Phase 3F-J does not group by purchase context.
39. Phase 3F-J does not filter by purchase context.
40. Phase 3F-F owns purchase-context display text.
41. `not-recorded` produces no UI line.
42. `resides-in-japan` uses route-anchored neutral descriptive text.
43. `resides-outside-japan` uses route-anchored neutral descriptive text.
44. Context text names the cited official purchase route, not the current user's residence.
45. Context text renders before provenance.
46. Context text renders after allocation when allocation exists.
47. Context text must not say “applies to you”.
48. Context text must not say “does not apply to you”.
49. Context text must not say “you can buy”.
50. Context text must not say “you cannot buy”.
51. Context text must not say or imply “you are a resident”.
52. Context text must not say or imply “you are eligible”.
53. A specific context requires explicit official supporting evidence.
54. JP-050's outside-Japan context keeps the official routing URL in provenance evidence.
55. Specific context may not be inferred from sourceEntity, locale, language or domain.
56. Active `placeId + scope` uniqueness remains in Phase 3F-P.
57. Global record-ID uniqueness remains.
58. No second JP-050 active record is authorized.
59. Domestic JP-050 first-come remains deferred.
60. `last-day-of-shifted-month` remains deferred.
61. No planning-draft schema change is authorized.
62. No localStorage change is authorized.
63. No network request is authorized.
64. No reminder/notification/calendar action is authorized.
65. Full repository-native validation is required before Ready transition.
66. A later gate is required before same-scope cardinality relaxation.

---

## 21. Rejected alternatives

### “Keep encoding purchase context only in sourceEntity”

Rejected. Free-text provenance is visible but not structurally reliable.

### “Add country or nationality”

Rejected. The official distinction is residence inside/outside Japan, not citizenship or nationality.

### “Store the user's residence and filter automatically”

Rejected. It is unnecessary personal applicability logic for this evidence feature.

### “Use unrestricted instead of not-recorded”

Rejected. It would turn missing evidence into a universal-access claim.

### “Make purchaseContext optional”

Rejected. Optional absence creates two different meanings for missing data. Explicit
`not-recorded` is safer.

### “Relax same-scope cardinality in the same successor”

Rejected. Purchase-context foundation should be validated independently before it becomes part of a
multi-record composition change.

### “Add the domestic first-come record in Phase 3F-P”

Rejected. That record has additional calendar-rule and evidence-granularity requirements unrelated
to the purchase-context field itself.

---

## 22. Recommended successor

**Phase 3F-P — Purchase-Context Evidence Foundation**

One bounded implementation:

- add required `purchaseContext` to the evidence schema;
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
