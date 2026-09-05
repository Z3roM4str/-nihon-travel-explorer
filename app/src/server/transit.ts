import {
  routingEndpointKey,
  validateTransitRouteRequest,
  type NormalizedTransitResult,
  type ProviderErrorCategory,
  type TransitLookupOutcome,
  type TransitProvider,
  type TransitRouteRequest,
} from "../lib/transit";

/**
 * Phase 3B3D server-side skeleton. This module is intentionally platform-neutral: no Vercel,
 * Netlify, Cloudflare, Express, secret, provider SDK, or real-provider adapter is introduced.
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
      if (signal?.aborted) return { status: "provider-error", category: "network" };
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
            confidence: result.scheduleAware ? "schedule-aware-live" : "static-validated",
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
  | "no-route"
  | "unresolvable-endpoint"
  | ProviderErrorCategory;

export type TransitRouteResponse =
  | { status: 200; body: { result: NormalizedTransitResult } }
  | {
      status: 400 | 401 | 404 | 422 | 429 | 500 | 502 | 503 | 504;
      body: {
        error: {
          category: TransitBoundaryErrorCategory;
          correlationId: string | null;
          field?: string;
          endpoint?: "from" | "to";
        };
      };
    };

function addBoundaryWarnings(
  request: TransitRouteRequest,
  result: NormalizedTransitResult
): NormalizedTransitResult {
  const warnings = [...result.warnings];

  if (request.from.kind === "place-coordinate") {
    warnings.push({ kind: "no-catalogued-endpoint", endpoint: "from", placeId: request.from.placeId });
  }
  if (request.to.kind === "place-coordinate") {
    warnings.push({ kind: "no-catalogued-endpoint", endpoint: "to", placeId: request.to.placeId });
  }
  if (!result.scheduleAware && !warnings.some((warning) => warning.kind === "provider-typical-duration")) {
    warnings.push({ kind: "provider-typical-duration" });
  }

  return { ...result, warnings };
}

function errorStatus(category: ProviderErrorCategory): 401 | 429 | 500 | 502 | 503 | 504 {
  switch (category) {
    case "unauthorized":
      return 401;
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
    const correlationId =
      typeof rawCorrelationId === "string" &&
      rawCorrelationId.length >= 1 &&
      rawCorrelationId.length <= 128 &&
      /^[A-Za-z0-9._:-]+$/u.test(rawCorrelationId)
        ? rawCorrelationId
        : null;

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

    const outcome = await provider.lookupRoute(validation.request, signal);
    switch (outcome.status) {
      case "ok":
        return { status: 200, body: { result: addBoundaryWarnings(validation.request, outcome.result) } };
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
