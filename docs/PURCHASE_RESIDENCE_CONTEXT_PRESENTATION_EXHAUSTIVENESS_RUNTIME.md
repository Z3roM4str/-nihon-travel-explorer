# Phase 3F-Q — Purchase-Residence-Context Presentation Exhaustiveness Hardening

Status: **implementation candidate — repository-native validation pending**

Base: `4a9156c4236453c7389e6841fe5d7f25ffc08ecf` (`main` after Phase 3F-P / PR #86)

## 1. Problem

Phase 3F-P's second independent focused review identified one non-blocking robustness issue in
`describeReservationPurchaseResidenceContextForUi`.

The helper was semantically correct for the current closed union, but its final unguarded `return`
implicitly represented `resides-outside-japan`.

That shape creates a future-extension hazard: if the TypeScript union later gains a fourth value and
the helper is not updated at the same time, the new value could fall through to the outside-Japan
sentence rather than forcing an explicit presentation decision.

This is not a defect for the current three-value runtime. Phase 3F-Q removes the extension hazard
without changing current behavior.

## 2. Hardening

The helper now reads from:

`Record<ReservationPurchaseResidenceContext, string | null>`

with one explicit key for every current closed value:

- `not-recorded` → `null`
- `resides-in-japan` → existing Japan-resident sentence
- `resides-outside-japan` → existing outside-Japan sentence

`describeReservationPurchaseResidenceContextForUi` performs only:

`return PURCHASE_RESIDENCE_CONTEXT_LABEL[context];`

There is no fallback branch or fallback string.

A future union extension therefore makes the `Record` incomplete at compile time until the new
value receives an explicit presentation decision.

## 3. No semantic change

Phase 3F-Q changes no visible copy.

It changes no:

- evidence schema;
- evidence JSON;
- validator;
- parser;
- residence semantics;
- source/provenance;
- date derivation;
- temporal relation;
- calendar aggregation/order;
- React rendering order;
- CSS;
- cardinality;
- persistence;
- network behavior.

The seven-record catalog remains untouched.

## 4. Deferred work remains deferred

Phase 3F-Q does **not**:

- relax active `placeId + scope` uniqueness;
- add a second JP-050 record;
- add domestic JP-050 first-come;
- add `last-day-of-shifted-month`;
- introduce any new purchase-residence-context value;
- introduce another applicability axis.

Same-scope multi-mechanism cardinality still requires its own later design gate.

## 5. Focused proof

The focused presentation test now proves:

1. the map is typed as `Record<ReservationPurchaseResidenceContext, string | null>`;
2. the helper returns the map lookup;
3. the helper contains no context-specific `if` fallback;
4. the helper contains no direct string-return fallback;
5. all three existing outputs remain exactly unchanged.

## 6. Validation gate

Before Ready transition:

1. focused reservation-mechanism presentation tests;
2. full Vitest;
3. lint;
4. build;
5. whitespace gates;
6. Phase 3F-F browser audit;
7. Phase 3F-H browser audit;
8. Phase 3F-J browser audit.

Because schema/data/Python validation are unchanged, the Phase 3F-Q focused executable gate is
TypeScript/UI-only. Full Vitest still protects cross-phase regressions.

Any executable/test correction after hostile review requires a fresh exact-head validation.

## 7. Current gate

**IMPLEMENTED — REPOSITORY-NATIVE VALIDATION PENDING.**

Same-scope cardinality relaxation is not started.
