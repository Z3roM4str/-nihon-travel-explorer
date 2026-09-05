import {
  isCorrelationId,
  routingEndpointKey,
  validateTransitRouteRequest,
  type NormalizedTransitResult,
  type ProviderErrorCategory,
  type TransitLookupOutcome,
  type TransitProvider,
  type TransitRouteRequest,
} from "../src/lib/transit";

/**
 * Phase 3B3D server-side skeleton. This module is intentionally platform-neutral: no Vercel,
 * Netlify, Cloudflare, Express, secret, provider SDK, or real-provider adapter is introduced.
 *
 * It lives in `app/server/` rather than `app/src/server/` deliberately. `tsconfig.app.json`
 * compiles `src` with `lib: ["ES2023", "DOM"]`, so server-only code placed under `src` would be
 * type-checked as if browser globals existed — `localStorage`, `window` and friends would compile
 * cleanly inside the very module whose job is to never persist anything. Outside `src` it is
 * checked by `tsconfig.server.json` (no DOM), which turns that mistake into a type error, and it
 * is also structurally outside anything Vite can reach from `src/main.tsx`.
 */
export const REAL_TRANSIT_PROVIDER_ACTIVATION = "off" as const;

export type SyntheticTransitFixtureOutcome =
  | {
      status: "ok";
      result: Omit<NormalizedTransitResult, "serviceDate" | "provenance"> & {
        timetableVersion?: string | null;
      };
    }
  | { status: "no-route" }
  | { status: "unresolvable-endpoint"; endpoint: "from" | "to" }
  | { status: "provider-error"; category: ProviderErrorCategory };

export type SyntheticTransitFixture = {
  from: TransitRouteRequest["from"];
  to: TransitRouteRequest["to"];
  when: TransitRouteRequest["when"];
  serviceDate: string;
  outcome: SyntheticTransitFixtureOutcome;
};

function requestKey(request: Pick<TransitRouteRequest, "from" | "to" | "when" | "serviceDate">): string {
  return [
    routingEndpointKey(request.from),
    routingEndpointKey(request.to),
    request.when.kind,
    request.when.instant,
    request.serviceDate,
  ].join("\u0000");
}

export function buildSyntheticTransitProvider(
  fixtures: readonly SyntheticTransitFixture[],
  options: { now?: () => string } = {}
): TransitProvider {
  const now = options.now ?? (() => new Date().toISOString());
  const byKey = new Map(fixtures.map((fixture) => [requestKey(fixture), fixture.outcome]));

  return {
    id: "synthetic",
    async lookupRoute(request, signal): Promise<TransitLookupOutcome> {
      // Cancellation is the caller's own act, not an answer from a provider. Throwing the
      // standard abort error keeps it out of the provider-outcome union entirely (see
      // `handleTransitRoute`), so it can never be reported as a provider failure.
      signal?.throwIfAborted();

      const outcome = byKey.get(requestKey(request));
      if (!outcome) return { status: "no-route" };
      if (outcome.status !== "ok") return outcome;

      const { timetableVersion = null, ...result } = outcome.result;
      return {
        status: "ok",
        result: {
          ...result,
          serviceDate: request.serviceDate,
          provenance: {
            kind: "transit-provider",
            provider: "synthetic",
            // Always "synthetic-fixture", never a real confidence — a fixture must not be able
            // to present itself as a timetable lookup that never happened. `scheduleAware` still
            // varies so both result *shapes* stay exercised.
            confidence: "synthetic-fixture",
            requestedAt: now(),
            serviceDate: request.serviceDate,
            timetableVersion,
            ephemeral: true,
          },
        },
      };
    },
  };
}

export type TransitBoundaryErrorCategory =
  | "invalid-request"
  | "activation-disabled"
  | "cancelled"
  | "no-route"
  | "unresolvable-endpoint"
  | ProviderErrorCategory;

export type TransitRouteResponse =
  | { status: 200; body: { result: NormalizedTransitResult } }
  | {
      status: 400 | 404 | 422 | 429 | 499 | 500 | 502 | 503 | 504;
      body: {
        error: {
          category: TransitBoundaryErrorCategory;
          correlationId: string | null;
          field?: string;
          endpoint?: "from" | "to";
        };
      };
    };

/**
 * The boundary may only add what it can actually observe. `scheduleAware` is a property of the
 * answer the provider returned, so deriving "this is a typical duration, not a timetable answer"
 * from it is sound. `no-catalogued-endpoint` is deliberately NOT derived here: a
 * `place-coordinate` endpoint does not imply the catalog was empty — the caller may have chosen
 * it while access points existed — and this boundary never runs resolution, so it cannot tell
 * the two apart. That warning comes from `transitWarningsForResolution` instead.
 */
function addBoundaryWarnings(result: NormalizedTransitResult): NormalizedTransitResult {
  if (result.scheduleAware) return result;
  if (result.warnings.some((warning) => warning.kind === "provider-typical-duration")) return result;
  return { ...result, warnings: [...result.warnings, { kind: "provider-typical-duration" }] };
}

function errorStatus(category: ProviderErrorCategory): 429 | 500 | 502 | 503 | 504 {
  switch (category) {
    // Deliberately 502, not 401: a provider rejecting *our* credential is an upstream failure,
    // not a request for the browser to authenticate. A 401 here would both misdirect the client
    // and leak the state of our provider relationship.
    case "unauthorized":
      return 502;
    case "rate-limited":
      return 429;
    case "timeout":
      return 504;
    case "network":
      return 503;
    case "malformed-response":
      return 502;
    case "unknown":
      return 500;
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

/**
 * Deployment-neutral equivalent of POST /api/transit/route. A future host adapter only has to
 * translate HTTP request/response objects to this function; provider payloads never cross it.
 */
export function buildTransitRouteHandler(provider: TransitProvider) {
  return async function handleTransitRoute(
    body: unknown,
    signal?: AbortSignal
  ): Promise<TransitRouteResponse> {
    const validation = validateTransitRouteRequest(body);
    const rawCorrelationId =
      typeof body === "object" && body !== null && "correlationId" in body
        ? (body as { correlationId?: unknown }).correlationId
        : null;
    const correlationId = isCorrelationId(rawCorrelationId) ? rawCorrelationId : null;

    if (!validation.ok) {
      return {
        status: 400,
        body: {
          error: {
            category: "invalid-request",
            correlationId,
            field: validation.field,
          },
        },
      };
    }

    if (provider.id !== "synthetic" && REAL_TRANSIT_PROVIDER_ACTIVATION === "off") {
      return {
        status: 503,
        body: { error: { category: "activation-disabled", correlationId: validation.request.correlationId } },
      };
    }

    // Checked before any work is dispatched, and again via the thrown abort error below, so a
    // caller that has already given up never costs a provider call.
    const cancelled: TransitRouteResponse = {
      status: 499,
      body: { error: { category: "cancelled", correlationId: validation.request.correlationId } },
    };
    if (signal?.aborted) return cancelled;

    let outcome: TransitLookupOutcome;
    try {
      outcome = await provider.lookupRoute(validation.request, signal);
    } catch (error) {
      // Only cancellation is translated. Anything else is a genuine defect in the adapter and
      // must not be silently reshaped into a sanitized provider category.
      if (isAbortError(error)) return cancelled;
      throw error;
    }
    if (signal?.aborted) return cancelled;

    switch (outcome.status) {
      case "ok":
        return { status: 200, body: { result: addBoundaryWarnings(outcome.result) } };
      case "no-route":
        return {
          status: 404,
          body: { error: { category: "no-route", correlationId: validation.request.correlationId } },
        };
      case "unresolvable-endpoint":
        return {
          status: 422,
          body: {
            error: {
              category: "unresolvable-endpoint",
              correlationId: validation.request.correlationId,
              endpoint: outcome.endpoint,
            },
          },
        };
      case "provider-error":
        return {
          status: errorStatus(outcome.category),
          body: {
            error: {
              category: outcome.category,
              correlationId: validation.request.correlationId,
            },
          },
        };
    }
  };
}
