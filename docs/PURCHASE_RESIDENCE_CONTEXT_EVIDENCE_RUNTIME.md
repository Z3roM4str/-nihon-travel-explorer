# Phase 3F-P — Purchase-Residence-Context Evidence Foundation

Status: **implemented, hostile-reviewed, independently reviewed and repository-native validated**

Base: `aad244f3756b0641bd1c7831375ff56501f11dfd` (`main` after Phase 3F-O / PR #85)

Official PokéPark KANTO residence-routing source rechecked: **2026-09-14**

## 1. Implementation-day source gate

Official routing source:

`https://www.pokepark-kanto.co.jp/ppark/ticketInfo/type/index?languageKind=en_US`

The implementation-day recheck still states that:

- guests residing outside Japan are directed to the separate external English ticket website;
- residents of Japan use PokéPark KANTO's Japanese official website;
- the Japan-resident route requires membership registration and SMS verification through a mobile
  phone usable in Japan.

Therefore the Phase 3F-O design remains valid for this implementation day and
`RM-JP-050-001` may carry `purchaseResidenceContext: resides-outside-japan`.

## 2. Structural migration

Adds required evidence field:

`purchaseResidenceContext`

Closed vocabulary:

```text
not-recorded
resides-in-japan
resides-outside-japan
```

All seven current records are migrated atomically.

- `RM-JP-050-001` → `resides-outside-japan`
- the other six records → `not-recorded`

Catalog size remains **7 → 7**.

`not-recorded` means only that this structured record does not assert a residence-based purchase
context. It is not a claim of unrestricted access, worldwide availability or user eligibility.

## 3. JP-050 provenance

The canonical mechanism source remains:

`https://ticket-en.pokepark-kanto.co.jp/?viewLang=en`

The residence-routing source is retained verbatim inside `provenance.evidence`:

`https://www.pokepark-kanto.co.jp/ppark/ticketInfo/type/index?languageKind=en_US`

No provenance-array/schema expansion is introduced.

## 4. Presentation

Phase 3F-F now owns one additional presentation field:

`purchaseResidenceContextText: string | null`

Rendering:

- `not-recorded` → `null`
- `resides-in-japan` →
  `La fuente oficial citada presenta esta ruta de compra para residentes en Japón.`
- `resides-outside-japan` →
  `La fuente oficial citada dirige a quienes residen fuera de Japón a esta ruta de compra.`

The copy describes the cited official route, never the current user.

## 5. Visible order

Both existing official-reservation surfaces use exactly:

1. recorded fact/details;
2. allocation, when present;
3. purchase-residence context, when present;
4. Phase 3F-H temporal relation, when present;
5. provenance;
6. official source link.

No new panel, grouping surface, badge or action affordance is introduced.

## 6. Ownership boundaries

Phase 3F-D date derivation ignores `purchaseResidenceContext`.

Phase 3F-H temporal relation ignores `purchaseResidenceContext`.

Phase 3F-J carries the existing Phase 3F-F presentation object but does not:

- sort by context;
- group by context;
- filter by context;
- rank by context.

Focused source-boundary tests reject context reads in all three modules.

A behavioral comparator test mutates only purchase-residence context and requires identical route-wide
chronological identity/order.

## 7. Preserved boundaries

Phase 3F-P does not:

- relax active `placeId + scope` uniqueness;
- add a second active JP-050 record;
- add the domestic JP-050 first-come mechanism;
- add `last-day-of-shifted-month`;
- add user residence, country, nationality, citizenship, visa or eligibility fields;
- infer context from sourceEntity, locale, language or domain;
- persist context outside the evidence catalog;
- add network requests;
- model availability, inventory, current sale state or lottery result;
- rank/recommend purchase routes;
- add reminders, notifications or calendar actions.

## 8. Hostile-review corrective

The first complete repository-native validation passed on the pre-review executable tree.

Hostile review then found one fail-closed defect in the Python validator:

- a string outside the closed vocabulary was rejected correctly;
- but a non-scalar value such as an object/list could reach Python set membership and raise
  `TypeError` instead of returning a validation error.

The validator now requires `purchaseResidenceContext` to be a string before closed-vocabulary
membership is evaluated.

A regression test supplies a structured object and requires the validator to reject it cleanly.

No catalog semantics, UI copy, cardinality, date logic or route ordering changed.

Because this changed executable/test code, the first validation seal was discarded and the corrected
tree was revalidated from scratch.

## 9. Final repository-native validation

Final clean executable HEAD:

`f1f937c5f4c4b04b3296bd918e5cacb59e33a2cf`

Temporary workflow-bearing commit:

`2a2c8c25e79c760d7f7410242da19fec38fbed53`

The workflow explicitly checked out the clean executable HEAD above with full history.

GitHub Actions run:

`34905444797` — **SUCCESS**

Passed:

- exact-head checkout;
- Python reservation-mechanism validator;
- Python reservation-mechanism unit tests;
- dependency install;
- focused Phase 3F-P Vitest set;
- full Vitest;
- lint;
- build;
- repository whitespace gates;
- Chromium install;
- Phase 3F-F browser audit;
- Phase 3F-H browser audit;
- Phase 3F-J browser audit.

The temporary workflow was removed in:

`5eaf17e84f0d13049126a0a2602eb0864ebc0d76`

Compare:

`f1f937c5f4c4b04b3296bd918e5cacb59e33a2cf...5eaf17e84f0d13049126a0a2602eb0864ebc0d76`

reports:

- ahead by 2 commits;
- behind by 0;
- **zero changed files**.

Therefore the current executable/data/test tree after workflow removal is byte-equivalent to the exact
tree that passed repository-native validation.

## 10. Independent focused review

A post-validation focused review checked the final clean implementation shape against the Phase 3F-O
contract.

It confirmed:

1. the TypeScript schema requires one closed `purchaseResidenceContext` value;
2. the Python validator mirrors the vocabulary and rejects non-string/unsupported values fail-closed;
3. the catalog remains exactly seven records;
4. JP-050 is the only `resides-outside-japan` record;
5. the other six records remain `not-recorded`;
6. JP-050 retains the operator residence-routing URL in provenance evidence;
7. `not-recorded` produces no presentation line;
8. both visible surfaces render context between allocation and the Phase 3F-H temporal relation;
9. Phase 3F-D does not read purchase-residence context;
10. Phase 3F-H does not read purchase-residence context;
11. the route-wide calendar module does not read purchase-residence context;
12. the route comparator remains anchor date → plan ordinal → source-record index;
13. active `placeId + scope` uniqueness remains enforced;
14. no second JP-050 record, domestic first-come record or new missing-day runtime enum was added;
15. no user-residence, country, eligibility, persistence, availability or current-sale-state behavior
    was introduced.

No further executable corrective was required.

## 11. Second independent focused review (post-closure tree)

A second independent focused review was run directly against the final tree, reading the
implementation rather than relying on the existing test suite.

Re-inspected directly: the TypeScript evidence type/parser, the Python validator, both JSON
catalogs, the Phase 3F-F presentation helper, both React surfaces, the new CSS, the Phase 3F-D/H/J
modules, the focused tests, this runtime document and the roadmap entry.

Re-confirmed:

1. `hasExactKeys` still requires `purchaseResidenceContext`, so a missing or extra key is rejected
   and no default is synthesized;
2. the TypeScript membership check is fail-closed for non-scalar values — `Set.prototype.has`
   returns `false` rather than throwing, and the `as` cast is type-level only, matching the
   existing `scope`/`allocation`/`status` house pattern;
3. the Python validator retains the hostile-review corrective: `isinstance(..., str)` is evaluated
   before closed-vocabulary membership;
4. `data/reservation-mechanisms.json` and `app/src/data/reservation-mechanisms.json` are
   byte-identical (`md5 630ebf997838c9e2851a1fa5c49ec46a`);
5. the catalog holds exactly seven records with exactly one JP-050 record, which is active, and the
   context distribution is exactly six `not-recorded` plus one `resides-outside-japan`;
6. global record-ID uniqueness and active `placeId + scope` uniqueness both still hold;
7. JP-050 keeps `https://ticket-en.pokepark-kanto.co.jp/?viewLang=en` as canonical `sourceUrl` and
   retains the residence-routing URL verbatim inside `provenance.evidence`, which remains a single
   object — no provenance array or schema expansion;
8. presentation copy matches the approved strings exactly and contains none of the prohibited
   personal-applicability or eligibility wording;
9. `not-recorded` renders no line and no placeholder on either surface;
10. both surfaces render residence context strictly after allocation and strictly before the
    Phase 3F-H temporal relation, provenance and source link;
11. `reservation-mechanism-date-derivation.ts`, `reservation-mechanism-reference-date.ts` and
    `reservation-mechanism-calendar.ts` contain no reference to the field or its values, and all
    three files are byte-unchanged from base;
12. the route comparator is still anchor date → plan ordinal → source-record index, with no
    residence-context key;
13. no `last-day-of-shifted-month` value exists; `missingAlignedDayRule` still admits only
    `first-day-of-next-month` and `not-recorded`;
14. no `userResidence`, country, nationality, citizenship, visa or eligibility runtime field exists
    — every such token in the diff is a negative assertion, a test guard or a prohibition note;
15. no new network request, storage write or planning-draft schema change was introduced;
16. no temporary workflow remains in the tree, and the changed scope is exactly the expected
    fifteen files.

The Python validator and the Python unit suite were re-executed directly against this tree: the
validator reports catalog validity and source/app byte parity, and all thirty unit tests pass.

No executable corrective was required, so the validation seal described in section 9 remains intact.

### Non-blocking observation (deferred, not a defect in this tree)

`describeReservationPurchaseResidenceContextForUi` resolves `resides-outside-japan` through a final
unguarded `return` rather than through a `Record<Union, …>` map like `SCOPE_LABEL` and
`ALLOCATION_LABEL`. For the three values in the current closed vocabulary the function is exhaustive
and correct, and its parameter type admits nothing else, so there is no reachable defect.

It is recorded only because a future vocabulary extension would compile without error and fall
through to the outside-Japan sentence instead of failing closed. Converting the helper to the
house `Record` form is a robustness change to an executable file: it would discard the validation
seal and require a full exact-head revalidation, so it is deliberately deferred rather than made
inside the Phase 3F-P closure gate.

## 12. Current gate

**IMPLEMENTED + HOSTILE-REVIEW CORRECTED + INDEPENDENT FOCUSED REVIEW PASSED (TWICE) + REPOSITORY-NATIVE VALIDATION PASSED + READY FOR REVIEW.**

Only documentation closure may change after the validated tree before Ready transition. Any
subsequent runtime, data, schema, test, dependency, storage or UI change invalidates the validation
seal and requires a fresh exact-head run.

Phase 3F-Q is not started.
