# Phase 3B3D — Synthetic Transit Skeleton

Implements the first code slice of the Phase 3B3C design
([LIVE_TRANSIT_INTEGRATION_DESIGN.md](LIVE_TRANSIT_INTEGRATION_DESIGN.md)) against a **synthetic
provider only**. Real-provider activation remains **OFF** and still
`REQUIRES VENDOR CONFIRMATION` (Phase 3B3B §7.2).

That design document remains the source of truth for *why* each boundary exists; this file records
*what was built* and the decisions taken while building it.

## Implemented

- **Provider-neutral contract** (`app/src/lib/transit.ts`): `RoutingEndpoint`, `TransitRouteRequest`
  with a tagged `depart-after | arrive-by` union, explicit `serviceDate` and IANA `timeZone`,
  `NormalizedTransitResult`, `TransitProvider`, a closed `TransitLookupOutcome` union, sanitized
  `ProviderErrorCategory`, and `TransitProviderProvenance` with mandatory `serviceDate` and a
  literal `ephemeral: true`.
- **Runtime request validation**: only Nihon ids and our own vocabulary cross the boundary.
  Unknown or provider-specific fields fail closed, instants require an explicit UTC offset,
  service dates must be real calendar days, time zones must resolve, and identifiers and the
  correlation id are length-bounded and character-restricted.
- **`external-local-transit` resolution**: place coordinate / resolved point / ambiguous /
  unavailable-on-multiple-defaults. Ambiguity is never silently collapsed, and deprecated or
  wrong-context points are filtered out regardless of what a caller passes in.
- **Directed synthetic provider** keyed on exact from/to/when/service-date. A reverse lookup is
  never inferred from a forward fixture.
- **Deployment-neutral route handler** (`app/server/transit.ts`) corresponding to the future
  `POST /api/transit/route`: normalized results or sanitized categories only, no provider payload
  or text crossing the boundary.
- **Activation gate**: `REAL_TRANSIT_PROVIDER_ACTIVATION = "off"` as a literal. An
  Ekispert/NAVITIME adapter is rejected *before* its lookup function can run — asserted by test.
- **Synthetic fixtures** use obviously fictional identifiers (`TEST-PLACE-A`, `TEST-STATION-A`)
  and the date `2099-01-01`. No captured provider payload exists anywhere in this branch.

## Review findings and decisions

This slice was reviewed against the real repository and corrected. The defects below were found
in the initial draft and fixed here.

### Fixed defects

| # | Defect | Fix |
|---|---|---|
| 1 | **`npm run build` failed** (`TS2322` in the test's `vi.fn` mock — `status` widened to `string`). The draft was authored in an environment that could not run the repo's suite. | Mock typed as `vi.fn<TransitProvider["lookupRoute"]>`. Build is green. |
| 2 | **Synthetic provenance claimed a real confidence.** A fixture reported `confidence: "schedule-aware-live"` — which per the design means a real timetable answer — so a consumer could believe a lookup happened that never did. | The synthetic provider now always reports `confidence: "synthetic-fixture"`, a new union member. `scheduleAware` still varies so both result *shapes* stay exercised, but provenance never lies. Asserted by test in both directions. |
| 3 | **Two spellings of one concept**: `"static-validated"` here vs. the canonical `"validated-static"` in `TransferConfidence`. | Renamed to `"validated-static"`. |
| 4 | **`no-catalogued-endpoint` was an unsound inference.** The boundary derived it from `request.from.kind === "place-coordinate"`, but a place-coordinate endpoint can equally mean a caller deliberately chose it while access points existed — and the boundary never runs resolution, so it cannot tell those apart. | The boundary no longer fabricates it. `transitWarningsForResolution()` derives it from an actual `TransitAccessResolution`, which is the only place the fact is known. |
| 5 | **Cancellation was reported as a provider failure** (`{ status: "provider-error", category: "network" }`), so a user aborting a request would surface as the transit service being down. | Cancellation is now its own boundary category (`"cancelled"`, status `499`), never part of the provider-outcome union. Checked before dispatch and after the call, and via `throwIfAborted()` inside the adapter. A genuine adapter defect still propagates instead of being disguised as a sanitized category. |
| 6 | **`unauthorized` returned HTTP 401 to the browser.** A provider rejecting *our* credential is not a request for the client to authenticate, and the status leaked the state of our provider relationship. | Mapped to `502`. Asserted by test that it is never `401`. |
| 7 | **Correlation-id validation was duplicated** in the server with its own inline regex, free to drift from the library rule. | `isCorrelationId` is exported and reused. |
| 8 | **Identifiers were unbounded strings.** | Bounded to 128 characters, matching the design's request-validation requirement. |
| 9 | **Server-only code sat in the browser type graph.** `app/src/server/` fell under `tsconfig.app.json`'s `include: ["src"]`, which compiles with `lib: ["ES2023", "DOM"]` — so browser globals type-checked cleanly inside the one module that must never persist anything. | Moved to `app/server/`, outside `src`, with its own `tsconfig.server.json` (no DOM). See the honest limits below. |

### Where server-only code lives, and what that actually guarantees

`app/server/transit.ts` is outside `app/src/`, so it is outside Vite's source root; the production
bundle was verified to contain none of it. `tsconfig.server.json` compiles it with
`lib: ["ES2023"]` and `types: []`.

Verified by mutation, not assumed: `window`, `document` and `indexedDB` are **compile errors** in
that project. **`localStorage` is not** — vitest's own type references transitively pull in
`@types/node`, whose web-globals shim declares it, and `types: []` cannot prevent a transitive
reference. That gap is closed by an explicit test in `app/server/transit.test.ts` that scans the
module's source (comments stripped) for persistence and logging APIs; the test was mutation-checked
and does fail when real usage is introduced.

### Decisions taken

- **`TransitProviderProvenance` stays out of `transfer.ts`'s `TransferProvenance` union.** That
  union describes the provenance *of a `TransferEdge`*, and a `NormalizedTransitResult` is not one:
  nothing converts between them, and `toTransferEdge`/`getBestTransfer` cannot produce a
  transit-sourced edge. Adding it now would force every `TransferEdge` consumer to handle a variant
  that cannot occur there. The two merge if and when a transit result actually becomes a
  `TransferEdge`.
- **The React hook / client transport is deliberately deferred.** Phase 3B3C §9.3 places the
  static-vs-live arbitration in a hook, but the preconditions do not exist: `transfer.ts` still has
  no UI consumer, `PlaceDetail.tsx` still renders raw `nearby.json`, and the design's own cost rule
  (§13.3) requires a live lookup to happen only on an **explicit user action** that no component
  offers yet. Building the hook now would create async UI state ahead of any consumer and would
  bake in a product decision — where the user triggers a lookup — that has not been made. The
  server-side slice is complete and testable without it.
- **`getBestTransfer()` is untouched**: still synchronous, static, directed and non-fabricating.
  `app/src/lib/transfer.ts` and its 61 tests are byte-identical to `main`.

## Deliberately not implemented

- No Ekispert or NAVITIME account, SDK, API key, request, or payload; no ORS request.
- No hosting choice or platform adapter (Vercel/Netlify/Cloudflare/etc.).
- No UI wiring, no React hook, and no automatic runtime request from the SPA.
- No dataset or access-point catalog change; `"external-local-transit"` still has zero members, so
  every place resolves to `use-place-coordinate` today.
- No persistence, cache, or artifact of any transit result.
- No itinerary ordering, path search, aggregation, or other Phase 3C work.

## Validation

Run in a real checkout of this branch:

| Command | Result |
|---|---|
| `npm test` (in `app/`) | **162 passed**, 6 files |
| `npm run lint` | clean (rc 0) |
| `npm run build` | clean (`tsc -b` + `vite build`) |
| `scripts/validate-dataset.py data` | OK (13 pre-existing secondary-metadata warnings) |
| `scripts/validate-geography.py` | OK |
| `scripts/validate-logistics.py data` | OK |
| `scripts/validate-access-points.py data` | OK |
| `scripts/validate-walking-access-point-results.py data` | OK |
| `scripts/test_access_points.py` / `test_walking_pilot.py` / `test_walking_scale.py` / `test_walking_access_points.py` | OK |
| `git diff --check` | clean |

Additionally verified: the production bundle contains no server module; the persistence guard test
fails when real `localStorage` usage is introduced; `transfer.ts`, `access-points.ts`, `store.ts`,
the components, `data/`, `scripts/`, `package.json` and the lockfile are unchanged from `main`.
