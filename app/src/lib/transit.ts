import type { LogisticsAccessPoint } from "./access-points";

/**
 * Shared, provider-neutral contract for Phase 3B3D live-transit work.
 *
 * `TransitProviderProvenance` below is deliberately NOT added to `transfer.ts`'s
 * `TransferProvenance` union yet. That union describes the provenance *of a `TransferEdge`*, and
 * a `NormalizedTransitResult` is not a `TransferEdge`: nothing converts one into the other, and
 * `toTransferEdge`/`getBestTransfer` can never produce a transit-sourced edge. Widening the
 * canonical union now would force every `TransferEdge` consumer to handle a variant that cannot
 * occur there — a false widening. The two merge when, and only when, a transit result actually
 * becomes a `TransferEdge`.
 */
export type RoutingEndpoint =
  | { kind: "place-coordinate"; placeId: string }
  | { kind: "access-point"; placeId: string; accessPointId: string };

export type TransitWhen =
  | { kind: "depart-after"; instant: string }
  | { kind: "arrive-by"; instant: string };

export type TransitRouteRequest = {
  from: RoutingEndpoint;
  to: RoutingEndpoint;
  when: TransitWhen;
  serviceDate: string;
  timeZone: string;
  correlationId: string;
};

export type TransitProviderId = "ekispert" | "navitime" | "synthetic";

/**
 * What kind of answer a transit result actually is.
 *
 * `"validated-static"` deliberately matches `TransferConfidence`'s spelling in `transfer.ts`
 * rather than inventing a second spelling of the same concept.
 *
 * `"synthetic-fixture"` exists so a fixture can never masquerade as a real provider answer.
 * The synthetic provider may simulate both a schedule-aware and a typical-duration *result
 * shape* for testing, but its provenance always reports `"synthetic-fixture"` — a consumer
 * switching on `confidence` therefore cannot mistake invented data for a real timetable
 * lookup, and does not have to cross-check `provider` to stay honest.
 */
export type TransitProviderConfidence = "schedule-aware-live" | "validated-static" | "synthetic-fixture";

export type TransitProviderProvenance = {
  kind: "transit-provider";
  provider: TransitProviderId;
  confidence: TransitProviderConfidence;
  requestedAt: string;
  serviceDate: string;
  timetableVersion: string | null;
  ephemeral: true;
};

/**
 * `"no-catalogued-endpoint"` is only ever derivable from an access-point *resolution* (see
 * `transitWarningsForResolution`), never from the shape of a `RoutingEndpoint` alone: a
 * `place-coordinate` endpoint can also mean a caller deliberately chose the place coordinate
 * while access points existed. Inferring the warning from the endpoint kind at a boundary that
 * never ran resolution would assert a fact that boundary cannot know.
 */
export type TransitWarning =
  | { kind: "no-catalogued-endpoint"; endpoint: "from" | "to"; placeId: string }
  | { kind: "provider-typical-duration" };

export type TransitModeSummary = "walk" | "rail" | "bus" | "ferry" | "other";

export type NormalizedTransitResult = {
  scheduleAware: boolean;
  durationMinutes: { min: number; max: number };
  departure: string | null;
  arrival: string | null;
  transferCount: number;
  modeSummary: TransitModeSummary[];
  accessLegs: { kind: "walk"; minutes: number }[] | null;
  serviceDate: string;
  provenance: TransitProviderProvenance;
  warnings: TransitWarning[];
};

export type ProviderErrorCategory =
  | "timeout"
  | "rate-limited"
  | "unauthorized"
  | "malformed-response"
  | "network"
  | "unknown";

export type TransitLookupOutcome =
  | { status: "ok"; result: NormalizedTransitResult }
  | { status: "no-route" }
  | { status: "unresolvable-endpoint"; endpoint: "from" | "to" }
  | { status: "provider-error"; category: ProviderErrorCategory };

export type TransitProvider = {
  id: TransitProviderId;
  lookupRoute: (request: TransitRouteRequest, signal?: AbortSignal) => Promise<TransitLookupOutcome>;
};

export type TransitAccessResolution =
  | { kind: "resolved-access-point"; accessPointId: string; endpoint: RoutingEndpoint }
  | { kind: "use-place-coordinate"; endpoint: RoutingEndpoint }
  | { kind: "ambiguous"; candidateAccessPointIds: string[] }
  | { kind: "unavailable"; reason: "multiple-defaults" };

/**
 * Resolve one place for the external-local-transit context without inventing a default.
 * Callers obtain `candidates` from getAccessPointsForContext(placeId, "external-local-transit").
 */
export function resolveTransitEndpoint(
  placeId: string,
  rawCandidates: readonly LogisticsAccessPoint[]
): TransitAccessResolution {
  // getAccessPointsForContext already filters to active points, but this function is exported
  // and independently callable, and ACCESS_POINT_DESIGN.md §16 is absolute: a deprecated point
  // is never selected automatically. Re-filtering here means the invariant holds for every
  // caller rather than only for the well-behaved one.
  const candidates = rawCandidates.filter(
    (point) =>
      point.status === "active" && point.applicableContexts.includes("external-local-transit")
  );

  if (candidates.length === 0) {
    return { kind: "use-place-coordinate", endpoint: { kind: "place-coordinate", placeId } };
  }

  const defaults = candidates.filter((point) =>
    point.selection.defaultForContexts?.includes("external-local-transit")
  );

  if (defaults.length > 1) {
    return { kind: "unavailable", reason: "multiple-defaults" };
  }

  const selected = defaults[0] ?? (candidates.length === 1 ? candidates[0] : null);
  if (selected) {
    return {
      kind: "resolved-access-point",
      accessPointId: selected.id,
      endpoint: { kind: "access-point", placeId, accessPointId: selected.id },
    };
  }

  return { kind: "ambiguous", candidateAccessPointIds: candidates.map((point) => point.id) };
}

/**
 * The only sound source of `"no-catalogued-endpoint"`: a resolution that actually looked at the
 * catalog and found no eligible `external-local-transit` point. Callers attach these to a
 * result's `warnings`; the server boundary never fabricates them from an endpoint's shape.
 */
export function transitWarningsForResolution(
  endpoint: "from" | "to",
  resolution: TransitAccessResolution
): TransitWarning[] {
  if (resolution.kind !== "use-place-coordinate") return [];
  return [{ kind: "no-catalogued-endpoint", endpoint, placeId: resolution.endpoint.placeId }];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Identifiers crossing the boundary are bounded so a hostile or buggy caller cannot push an
 * unbounded string through validation. 128 is generous next to the dataset's real ids
 * (`JP-029`, `AP-JP-029-001`) without being arbitrary-looking at the small end.
 */
const MAX_IDENTIFIER_LENGTH = 128;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isBoundedIdentifier(value: unknown): value is string {
  return isNonEmptyString(value) && value.length <= MAX_IDENTIFIER_LENGTH;
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  const allowedSet = new Set(allowed);
  return Object.keys(value).every((key) => allowedSet.has(key));
}

function isRoutingEndpoint(value: unknown): value is RoutingEndpoint {
  if (!isRecord(value) || !isBoundedIdentifier(value.placeId)) return false;
  if (value.kind === "place-coordinate") {
    return hasOnlyKeys(value, ["kind", "placeId"]);
  }
  return (
    value.kind === "access-point" &&
    isBoundedIdentifier(value.accessPointId) &&
    hasOnlyKeys(value, ["kind", "placeId", "accessPointId"])
  );
}

function isInstantWithOffset(value: unknown): value is string {
  if (!isNonEmptyString(value)) return false;
  if (!/(?:Z|[+-]\d{2}:\d{2})$/u.test(value)) return false;
  return Number.isFinite(Date.parse(value));
}

function isServiceDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function isTimeZone(value: unknown): value is string {
  if (!isNonEmptyString(value)) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format(0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Exported so the server boundary can echo a correlation id back on a *rejected* request
 * without re-implementing the rule. Two copies of this predicate would be free to drift, and
 * the boundary needs it before validation succeeds.
 */
export function isCorrelationId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 1 &&
    value.length <= MAX_IDENTIFIER_LENGTH &&
    /^[A-Za-z0-9._:-]+$/u.test(value)
  );
}

export type TransitRequestValidation =
  | { ok: true; request: TransitRouteRequest }
  | {
      ok: false;
      category: "invalid-request";
      field: "request" | "from" | "to" | "when" | "serviceDate" | "timeZone" | "correlationId";
    };

/** Runtime validation for the server boundary. It never accepts provider-specific fields. */
export function validateTransitRouteRequest(value: unknown): TransitRequestValidation {
  if (!isRecord(value)) return { ok: false, category: "invalid-request", field: "request" };
  if (!hasOnlyKeys(value, ["from", "to", "when", "serviceDate", "timeZone", "correlationId"])) {
    return { ok: false, category: "invalid-request", field: "request" };
  }
  if (!isRoutingEndpoint(value.from)) return { ok: false, category: "invalid-request", field: "from" };
  if (!isRoutingEndpoint(value.to)) return { ok: false, category: "invalid-request", field: "to" };

  const when = value.when;
  if (
    !isRecord(when) ||
    !hasOnlyKeys(when, ["kind", "instant"]) ||
    (when.kind !== "depart-after" && when.kind !== "arrive-by") ||
    !isInstantWithOffset(when.instant)
  ) {
    return { ok: false, category: "invalid-request", field: "when" };
  }

  if (!isServiceDate(value.serviceDate)) {
    return { ok: false, category: "invalid-request", field: "serviceDate" };
  }
  if (!isTimeZone(value.timeZone)) {
    return { ok: false, category: "invalid-request", field: "timeZone" };
  }
  if (!isCorrelationId(value.correlationId)) {
    return { ok: false, category: "invalid-request", field: "correlationId" };
  }

  const normalizedWhen: TransitWhen =
    when.kind === "depart-after"
      ? { kind: "depart-after", instant: when.instant }
      : { kind: "arrive-by", instant: when.instant };

  return {
    ok: true,
    request: {
      from: value.from,
      to: value.to,
      when: normalizedWhen,
      serviceDate: value.serviceDate,
      timeZone: value.timeZone,
      correlationId: value.correlationId,
    },
  };
}

export function routingEndpointKey(endpoint: RoutingEndpoint): string {
  return endpoint.kind === "place-coordinate"
    ? `place:${endpoint.placeId}`
    : `access:${endpoint.placeId}:${endpoint.accessPointId}`;
}
