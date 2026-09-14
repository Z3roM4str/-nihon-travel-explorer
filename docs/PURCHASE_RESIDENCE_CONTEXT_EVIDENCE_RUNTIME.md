# Phase 3F-P — Purchase-Residence-Context Evidence Foundation

Status: **implementation candidate — repository-native validation pending**

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

## 8. Validation gate

Before Ready transition the exact executable tree must pass:

1. Python reservation-mechanism validator;
2. Python reservation-mechanism unit tests;
3. focused Phase 3F evidence/presentation/calendar/component tests;
4. full Vitest;
5. lint;
6. build;
7. repository whitespace gates;
8. Phase 3F-F browser audit;
9. Phase 3F-H browser audit;
10. Phase 3F-J browser audit.

A hostile review must follow the first complete validation pass. Any executable/data/test correction
after that review requires a fresh exact-head validation.

## 9. Current gate

**IMPLEMENTED — REPOSITORY-NATIVE VALIDATION PENDING.**

Phase 3F-Q is not started.
