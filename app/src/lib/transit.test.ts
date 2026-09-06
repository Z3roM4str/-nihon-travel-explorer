import { describe, expect, it } from "vitest";
import { getAccessPointsForContext, type LogisticsAccessPoint } from "./access-points";
import {
  resolveTransitEndpoint,
  transitWarningsForResolution,
  validateTransitRouteRequest,
  type TransitRouteRequest,
} from "./transit";

export const TRANSIT_REQUEST: TransitRouteRequest = {
  from: { kind: "place-coordinate", placeId: "TEST-PLACE-A" },
  to: { kind: "place-coordinate", placeId: "TEST-PLACE-B" },
  when: { kind: "depart-after", instant: "2099-01-01T09:00:00+09:00" },
  serviceDate: "2099-01-01",
  timeZone: "Asia/Tokyo",
  correlationId: "test-correlation-001",
};

function accessPoint(id: string, isDefault = false): LogisticsAccessPoint {
  return {
    id,
    placeId: "TEST-PLACE-A",
    label: id,
    role: "transit-stop",
    coordinates: { lat: 35, lng: 139 },
    applicableContexts: ["external-local-transit"],
    provenance: {
      sourceUrl: "https://example.invalid/synthetic",
      sourceEntity: "TEST-STATION-A",
      consultedAt: "2099-01-01",
      evidence: "Synthetic fixture only",
      confidence: "official-explicit",
    },
    selection: isDefault ? { defaultForContexts: ["external-local-transit"] } : {},
    status: "active",
  };
}

describe("resolveTransitEndpoint", () => {
  it("falls back to the place coordinate when no external-local-transit point exists", () => {
    expect(resolveTransitEndpoint("TEST-PLACE-A", [])).toEqual({
      kind: "use-place-coordinate",
      endpoint: { kind: "place-coordinate", placeId: "TEST-PLACE-A" },
    });
  });

  it("resolves the only eligible access point", () => {
    expect(resolveTransitEndpoint("TEST-PLACE-A", [accessPoint("TEST-STATION-A")])).toEqual({
      kind: "resolved-access-point",
      accessPointId: "TEST-STATION-A",
      endpoint: {
        kind: "access-point",
        placeId: "TEST-PLACE-A",
        accessPointId: "TEST-STATION-A",
      },
    });
  });

  it("never silently picks among several eligible points without a default", () => {
    expect(
      resolveTransitEndpoint("TEST-PLACE-A", [accessPoint("TEST-STATION-A"), accessPoint("TEST-STATION-B")])
    ).toEqual({
      kind: "ambiguous",
      candidateAccessPointIds: ["TEST-STATION-A", "TEST-STATION-B"],
    });
  });

  it("uses the single explicit default when several points exist", () => {
    const result = resolveTransitEndpoint("TEST-PLACE-A", [
      accessPoint("TEST-STATION-A"),
      accessPoint("TEST-STATION-B", true),
    ]);
    expect(result.kind).toBe("resolved-access-point");
    if (result.kind === "resolved-access-point") expect(result.accessPointId).toBe("TEST-STATION-B");
  });

  it("fails closed when invalid fixture data claims multiple defaults", () => {
    expect(
      resolveTransitEndpoint("TEST-PLACE-A", [
        accessPoint("TEST-STATION-A", true),
        accessPoint("TEST-STATION-B", true),
      ])
    ).toEqual({ kind: "unavailable", reason: "multiple-defaults" });
  });

  it("never auto-selects a deprecated point, even if a caller passes one in", () => {
    const deprecated = accessPoint("TEST-STATION-A");
    deprecated.status = "deprecated";
    expect(resolveTransitEndpoint("TEST-PLACE-A", [deprecated])).toEqual({
      kind: "use-place-coordinate",
      endpoint: { kind: "place-coordinate", placeId: "TEST-PLACE-A" },
    });
  });

  it("ignores a point that does not apply to the external-local-transit context", () => {
    const walkOnly = accessPoint("TEST-STATION-A");
    walkOnly.applicableContexts = ["external-walk"];
    expect(resolveTransitEndpoint("TEST-PLACE-A", [walkOnly, accessPoint("TEST-STATION-B")])).toEqual({
      kind: "resolved-access-point",
      accessPointId: "TEST-STATION-B",
      endpoint: { kind: "access-point", placeId: "TEST-PLACE-A", accessPointId: "TEST-STATION-B" },
    });
  });

  it("does not treat a default declared for another context as a transit default", () => {
    const walkDefault = accessPoint("TEST-STATION-A");
    walkDefault.selection = { defaultForContexts: ["external-walk"] };
    const result = resolveTransitEndpoint("TEST-PLACE-A", [walkDefault, accessPoint("TEST-STATION-B")]);
    expect(result).toEqual({
      kind: "ambiguous",
      candidateAccessPointIds: ["TEST-STATION-A", "TEST-STATION-B"],
    });
  });
});

describe("transitWarningsForResolution", () => {
  it("reports no-catalogued-endpoint only when resolution actually found none", () => {
    const resolution = resolveTransitEndpoint("TEST-PLACE-A", []);
    expect(transitWarningsForResolution("from", resolution)).toEqual([
      { kind: "no-catalogued-endpoint", endpoint: "from", placeId: "TEST-PLACE-A" },
    ]);
  });

  it("emits nothing when an access point was resolved", () => {
    const resolution = resolveTransitEndpoint("TEST-PLACE-A", [accessPoint("TEST-STATION-A")]);
    expect(transitWarningsForResolution("to", resolution)).toEqual([]);
  });

  it("emits nothing for an ambiguous or failed resolution — neither means the catalog was empty", () => {
    const ambiguous = resolveTransitEndpoint("TEST-PLACE-A", [
      accessPoint("TEST-STATION-A"),
      accessPoint("TEST-STATION-B"),
    ]);
    const unavailable = resolveTransitEndpoint("TEST-PLACE-A", [
      accessPoint("TEST-STATION-A", true),
      accessPoint("TEST-STATION-B", true),
    ]);
    expect(transitWarningsForResolution("from", ambiguous)).toEqual([]);
    expect(transitWarningsForResolution("from", unavailable)).toEqual([]);
  });
});

describe("resolveTransitEndpoint against the real catalog", () => {
  // Every test above injects fixtures. These two pin the outcome for the actual shipped
  // catalog, because the Transit Access-Point Evidence Audit changed it: JP-029 used to
  // resolve to use-place-coordinate (querying a point 198.63 m off-network, inside the
  // palace grounds) and now surfaces the three official gates as an explicit ambiguity.
  it("surfaces JP-029's three gates as ambiguous rather than collapsing to a coordinate", () => {
    const resolution = resolveTransitEndpoint(
      "JP-029",
      getAccessPointsForContext("JP-029", "external-local-transit")
    );
    expect(resolution).toEqual({
      kind: "ambiguous",
      candidateAccessPointIds: ["AP-JP-029-001", "AP-JP-029-002", "AP-JP-029-003"],
    });
    // An ambiguous resolution is not an empty catalog, so it must not claim one.
    expect(transitWarningsForResolution("to", resolution)).toEqual([]);
  });

  it("still falls back honestly for a place the audit left uncatalogued", () => {
    const resolution = resolveTransitEndpoint(
      "JP-185",
      getAccessPointsForContext("JP-185", "external-local-transit")
    );
    expect(resolution).toEqual({
      kind: "use-place-coordinate",
      endpoint: { kind: "place-coordinate", placeId: "JP-185" },
    });
    expect(transitWarningsForResolution("from", resolution)).toEqual([
      { kind: "no-catalogued-endpoint", endpoint: "from", placeId: "JP-185" },
    ]);
  });
});

describe("validateTransitRouteRequest", () => {
  it("accepts the provider-neutral synthetic request contract", () => {
    expect(validateTransitRouteRequest(TRANSIT_REQUEST)).toEqual({ ok: true, request: TRANSIT_REQUEST });
  });

  it("rejects impossible service dates", () => {
    const result = validateTransitRouteRequest({ ...TRANSIT_REQUEST, serviceDate: "2099-02-30" });
    expect(result).toEqual({ ok: false, category: "invalid-request", field: "serviceDate" });
  });

  it("requires an explicit offset on the requested instant", () => {
    const result = validateTransitRouteRequest({
      ...TRANSIT_REQUEST,
      when: { kind: "depart-after", instant: "2099-01-01T09:00:00" },
    });
    expect(result).toEqual({ ok: false, category: "invalid-request", field: "when" });
  });

  it("rejects provider-specific or otherwise unknown top-level fields", () => {
    const result = validateTransitRouteRequest({ ...TRANSIT_REQUEST, providerStationId: "SHOULD-NOT-CROSS" });
    expect(result).toEqual({ ok: false, category: "invalid-request", field: "request" });
  });

  it("rejects a non-object body", () => {
    for (const body of [null, undefined, "request", 42, []]) {
      expect(validateTransitRouteRequest(body)).toEqual({
        ok: false,
        category: "invalid-request",
        field: "request",
      });
    }
  });

  it("rejects a when clause carrying both intents or an unknown kind", () => {
    expect(
      validateTransitRouteRequest({
        ...TRANSIT_REQUEST,
        when: { kind: "depart-after", instant: TRANSIT_REQUEST.when.instant, arriveBy: "2099-01-01T10:00:00Z" },
      })
    ).toEqual({ ok: false, category: "invalid-request", field: "when" });

    expect(
      validateTransitRouteRequest({ ...TRANSIT_REQUEST, when: { kind: "whenever", instant: "2099-01-01T09:00:00Z" } })
    ).toEqual({ ok: false, category: "invalid-request", field: "when" });
  });

  it("rejects an unknown time zone", () => {
    expect(validateTransitRouteRequest({ ...TRANSIT_REQUEST, timeZone: "Mars/Olympus" })).toEqual({
      ok: false,
      category: "invalid-request",
      field: "timeZone",
    });
  });

  it("rejects endpoints carrying extra provider fields", () => {
    expect(
      validateTransitRouteRequest({
        ...TRANSIT_REQUEST,
        from: { kind: "place-coordinate", placeId: "TEST-PLACE-A", providerNodeId: "X" },
      })
    ).toEqual({ ok: false, category: "invalid-request", field: "from" });
  });

  it("rejects an access-point endpoint missing its accessPointId", () => {
    expect(
      validateTransitRouteRequest({ ...TRANSIT_REQUEST, to: { kind: "access-point", placeId: "TEST-PLACE-B" } })
    ).toEqual({ ok: false, category: "invalid-request", field: "to" });
  });

  it("bounds identifier and correlation-id length instead of accepting unbounded strings", () => {
    const huge = "A".repeat(129);
    expect(
      validateTransitRouteRequest({ ...TRANSIT_REQUEST, from: { kind: "place-coordinate", placeId: huge } })
    ).toEqual({ ok: false, category: "invalid-request", field: "from" });
    expect(validateTransitRouteRequest({ ...TRANSIT_REQUEST, correlationId: huge })).toEqual({
      ok: false,
      category: "invalid-request",
      field: "correlationId",
    });
  });

  it("rejects a correlation id with characters unsafe to echo into logs", () => {
    expect(validateTransitRouteRequest({ ...TRANSIT_REQUEST, correlationId: "bad id\nInjected: 1" })).toEqual({
      ok: false,
      category: "invalid-request",
      field: "correlationId",
    });
  });
});
