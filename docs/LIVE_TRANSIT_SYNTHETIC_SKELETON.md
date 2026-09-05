# Phase 3B3D — Synthetic Transit Skeleton (working branch)

This branch implements the first code slice of the Phase 3B3C live-transit design against a
**synthetic provider only**. Real-provider activation remains **OFF**.

## Implemented in this slice

- Provider-neutral `RoutingEndpoint`, request, normalized result, provider outcome, warning, and
  provenance types.
- Runtime validation for the future `POST /api/transit/route` boundary. Requests use only Nihon
  ids and our vocabulary; unknown/provider-specific fields fail closed.
- `external-local-transit` access-point resolution with the existing four-outcome discipline:
  place coordinate, resolved access point, ambiguous candidates, or unavailable on invalid
  multiple-default data. Ambiguity is never silently collapsed.
- A directed synthetic provider keyed by exact from/to/when/service-date inputs. Reverse lookup is
  not inferred.
- A deployment-neutral route handler that keeps provider payloads behind the server boundary and
  returns only normalized results or sanitized error categories.
- `REAL_TRANSIT_PROVIDER_ACTIVATION = "off"` as a literal gate. An Ekispert/NAVITIME adapter is
  rejected before its lookup function can run.
- Synthetic provenance carries mandatory `serviceDate` and literal `ephemeral: true`.
- Synthetic fixtures use obviously fictional identifiers and the date `2099-01-01`.
- Unit tests cover access-point ambiguity/defaults, request validation, directed behavior,
  schedule-aware/static synthetic results, no-route, unresolvable endpoints, sanitized provider
  errors, and the real-provider activation gate.

## Deliberately not implemented

- No Ekispert or NAVITIME account, SDK, API key, request, or payload.
- No ORS request.
- No hosting choice or platform adapter (Vercel/Netlify/Cloudflare/etc.).
- No UI wiring and no automatic runtime request from the SPA.
- No dataset or access-point catalog changes.
- No itinerary ordering, path search, aggregation, or Phase 3C work.
- No claim that Phase 3B3D is complete until the full repository test/lint/build suite is run in a
  real checkout and the implementation is reviewed against `LIVE_TRANSIT_INTEGRATION_DESIGN.md`.

## Validation performed before push

The authoring environment cannot clone GitHub or install the repository workspace, so full repo
validation is intentionally deferred. The new modules were nevertheless checked locally with:

- isolated TypeScript typecheck (`tsc`, strict/no-unused/erasable-syntax settings): **PASS**;
- CommonJS emit of the new pure modules for execution: **PASS**;
- behavioral smoke tests for validation, synthetic success, ephemeral provenance, endpoint
  warnings, directed no-route, and activation-disabled-before-provider-call: **PASS**.

The PR should remain draft until a repository-capable agent runs the project's actual commands
(`npm test`, `npm run lint`, `npm run build`, plus standing dataset/geography/logistics validators),
reviews the diff against Phase 3B3C §§3–9, and makes any necessary corrections.
