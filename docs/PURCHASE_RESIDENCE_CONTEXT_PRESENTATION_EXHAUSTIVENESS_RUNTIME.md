# Phase 3F-Q — Purchase-Residence-Context Presentation Exhaustiveness Hardening

Status: **implemented, hostile-reviewed, independently reviewed and repository-native validated**

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

## 7. Repository-native validation

Exact validated HEAD:

`7575a2d9d857676a7df61af31c0e885cdb02d7c0`

Temporary workflow-bearing commit:

`92278a8d25f8f14e035e6ca7dcdd910caec34c7c`

GitHub Actions run:

`34910773136` — **SUCCESS**

The workflow explicitly checked out the exact validated HEAD above.

Passed:

- focused Phase 3F-Q presentation test;
- full Vitest;
- lint;
- build;
- whitespace gates;
- Chromium install;
- Phase 3F-F browser audit;
- Phase 3F-H browser audit;
- Phase 3F-J browser audit.

The temporary workflow was removed in:

`3e405ba2defaf2a4fb90f04efcbafa465435035d`

Comparison:

`7575a2d9d857676a7df61af31c0e885cdb02d7c0...3e405ba2defaf2a4fb90f04efcbafa465435035d`

reports:

- ahead by 2 commits;
- behind by 0;
- **zero changed files**.

The post-workflow tree is therefore byte-equivalent to the validated tree.

## 8. Hostile + independent focused review

The post-validation review re-read the implementation and its focused regression directly.

Confirmed:

1. the map is typed directly as
   `Record<ReservationPurchaseResidenceContext, string | null>`;
2. all three union members are explicit object-literal keys;
3. all three visible outputs are byte-equivalent to Phase 3F-P;
4. `not-recorded` remains `null`;
5. the helper performs only `PURCHASE_RESIDENCE_CONTEXT_LABEL[context]`;
6. the helper has no conditional fallback and no direct string fallback;
7. extending the union without adding a map key makes the typed object incomplete at compile time;
8. no evidence schema/data/parser/validator file changed;
9. no React/CSS/date/relation/calendar module changed;
10. active `placeId + scope` cardinality and the single JP-050 record remain untouched;
11. no domestic first-come or `last-day-of-shifted-month` work was started.

No executable corrective was required after validation.

## 9. Current gate

**IMPLEMENTED + HOSTILE REVIEW PASSED + INDEPENDENT FOCUSED REVIEW PASSED + REPOSITORY-NATIVE VALIDATION PASSED.**

Only documentation closure may change before Ready. Any runtime/test change invalidates the validation
seal and requires a new exact-head run.

Same-scope cardinality relaxation is not started.
