import { describe, expect, it, vi } from "vitest";
import type { LogisticsAccessPoint } from "./access-points";
import {
  resolveTransitEndpoint,
  validateTransitRouteRequest,
  type TransitProvider,
  type TransitRouteRequest,
} from "./transit";
import {
  buildSyntheticTransitProvider,
  buildTransitRouteHandler,
  REAL_TRANSIT_PROVIDER_ACTIVATION,
  type SyntheticTransitFixture,
} from "../server/transit";

const REQUEST: TransitRouteRequest = {
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

function successFixture(scheduleAware = true): SyntheticTransitFixture {
  return {
    from: REQUEST.from,
    to: REQUEST.to,
    when: REQUEST.when,
    serviceDate: REQUEST.serviceDate,
    outcome: {
      status: "ok",
      result: {
        scheduleAware,
        durationMinutes: { min: 18, max: 22 },
        departure: scheduleAware ? "2099-01-01T09:05:00+09:00" : null,
        arrival: scheduleAware ? "2099-01-01T09:25:00+09:00" : null,
        transferCount: 1,
        modeSummary: ["walk", "rail"],
        accessLegs: [{ kind: "walk", minutes: 4 }],
        warnings: [],
        timetableVersion: "SYNTHETIC-2099-A",
      },
    },
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
});

describe("validateTransitRouteRequest", () => {
  it("accepts the provider-neutral synthetic request contract", () => {
    expect(validateTransitRouteRequest(REQUEST)).toEqual({ ok: true, request: REQUEST });
  });

  it("rejects impossible service dates", () => {
    const result = validateTransitRouteRequest({ ...REQUEST, serviceDate: "2099-02-30" });
    expect(result).toEqual({ ok: false, category: "invalid-request", field: "serviceDate" });
  });

  it("requires an explicit offset on the requested instant", () => {
    const result = validateTransitRouteRequest({
      ...REQUEST,
      when: { kind: "depart-after", instant: "2099-01-01T09:00:00" },
    });
    expect(result).toEqual({ ok: false, category: "invalid-request", field: "when" });
  });

  it("rejects provider-specific or otherwise unknown top-level fields", () => {
    const result = validateTransitRouteRequest({ ...REQUEST, providerStationId: "SHOULD-NOT-CROSS" });
    expect(result).toEqual({ ok: false, category: "invalid-request", field: "request" });
  });
});

describe("synthetic transit boundary", () => {
  it("keeps real-provider activation off", () => {
    expect(REAL_TRANSIT_PROVIDER_ACTIVATION).toBe("off");
  });

  it("returns a schedule-aware ephemeral synthetic result and adds endpoint warnings", async () => {
    const provider = buildSyntheticTransitProvider([successFixture()], {
      now: () => "2098-12-31T23:59:00Z",
    });
    const response = await buildTransitRouteHandler(provider)(REQUEST);

    expect(response.status).toBe(200);
    if (response.status !== 200) throw new Error("expected synthetic success");
    expect(response.body.result.serviceDate).toBe("2099-01-01");
    expect(response.body.result.provenance).toEqual({
      kind: "transit-provider",
      provider: "synthetic",
      confidence: "schedule-aware-live",
      requestedAt: "2098-12-31T23:59:00Z",
      serviceDate: "2099-01-01",
      timetableVersion: "SYNTHETIC-2099-A",
      ephemeral: true,
    });
    expect(response.body.result.warnings).toContainEqual({
      kind: "no-catalogued-endpoint",
      endpoint: "from",
      placeId: "TEST-PLACE-A",
    });
    expect(response.body.result.warnings).toContainEqual({
      kind: "no-catalogued-endpoint",
      endpoint: "to",
      placeId: "TEST-PLACE-B",
    });
  });

  it("marks a non-schedule-aware fixture as static and warns that it is a typical duration", async () => {
    const provider = buildSyntheticTransitProvider([successFixture(false)], {
      now: () => "2098-12-31T23:59:00Z",
    });
    const response = await buildTransitRouteHandler(provider)(REQUEST);

    expect(response.status).toBe(200);
    if (response.status !== 200) throw new Error("expected synthetic success");
    expect(response.body.result.provenance.confidence).toBe("static-validated");
    expect(response.body.result.warnings).toContainEqual({ kind: "provider-typical-duration" });
  });

  it("is directed: the reverse request does not reuse the forward fixture", async () => {
    const provider = buildSyntheticTransitProvider([successFixture()]);
    const reverse = { ...REQUEST, from: REQUEST.to, to: REQUEST.from };
    const response = await buildTransitRouteHandler(provider)(reverse);
    expect(response.status).toBe(404);
    if (response.status === 200) throw new Error("reverse must not succeed");
    expect(response.body.error.category).toBe("no-route");
  });

  it("preserves unresolvable-endpoint as a distinct sanitized outcome", async () => {
    const fixture: SyntheticTransitFixture = {
      ...successFixture(),
      outcome: { status: "unresolvable-endpoint", endpoint: "to" },
    };
    const response = await buildTransitRouteHandler(buildSyntheticTransitProvider([fixture]))(REQUEST);
    expect(response.status).toBe(422);
    if (response.status === 200) throw new Error("expected failure");
    expect(response.body.error).toEqual({
      category: "unresolvable-endpoint",
      correlationId: REQUEST.correlationId,
      endpoint: "to",
    });
  });

  it("returns only provider error categories, never provider text", async () => {
    const fixture: SyntheticTransitFixture = {
      ...successFixture(),
      outcome: { status: "provider-error", category: "rate-limited" },
    };
    const response = await buildTransitRouteHandler(buildSyntheticTransitProvider([fixture]))(REQUEST);
    expect(response.status).toBe(429);
    expect(JSON.stringify(response)).not.toContain("providerMessage");
  });

  it("blocks a real-provider adapter before lookup while activation is off", async () => {
    const lookupRoute: TransitProvider["lookupRoute"] = vi.fn(async () => ({ status: "no-route" }));
    const realProvider: TransitProvider = { id: "ekispert", lookupRoute };
    const response = await buildTransitRouteHandler(realProvider)(REQUEST);

    expect(response.status).toBe(503);
    if (response.status === 200) throw new Error("real provider must remain disabled");
    expect(response.body.error.category).toBe("activation-disabled");
    expect(lookupRoute).not.toHaveBeenCalled();
  });
});
