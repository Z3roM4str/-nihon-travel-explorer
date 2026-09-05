import type { LogisticsAccessPoint } from "./access-points";

/** Shared, provider-neutral contract for Phase 3B3D live-transit work. */
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
export type TransitProviderConfidence = "schedule-aware-live" | "static-validated";

export type TransitProviderProvenance = {
  kind: "transit-provider";
  provider: TransitProviderId;
  confidence: TransitProviderConfidence;
  requestedAt: string;
  serviceDate: string;
  timetableVersion: string | null;
  ephemeral: true;
};

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
  candidates: readonly LogisticsAccessPoint[]
): TransitAccessResolution {
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  const allowedSet = new Set(allowed);
  return Object.keys(value).every((key) => allowedSet.has(key));
}

function isRoutingEndpoint(value: unknown): value is RoutingEndpoint {
  if (!isRecord(value) || !isNonEmptyString(value.placeId)) return false;
  if (value.kind === "place-coordinate") {
    return hasOnlyKeys(value, ["kind", "placeId"]);
  }
  return (
    value.kind === "access-point" &&
    isNonEmptyString(value.accessPointId) &&
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

function isCorrelationId(value: unknown): value is string {
  return typeof value === "string" && value.length >= 1 && value.length <= 128 && /^[A-Za-z0-9._:-]+$/u.test(value);
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
