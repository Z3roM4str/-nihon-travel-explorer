import { describe, expect, it, vi } from "vitest";
import type { TransitProvider, TransitRouteRequest } from "../src/lib/transit";
import {
  buildSyntheticTransitProvider,
  buildTransitRouteHandler,
  REAL_TRANSIT_PROVIDER_ACTIVATION,
  type SyntheticTransitFixture,
} from "./transit";

const REQUEST: TransitRouteRequest = {
  from: { kind: "place-coordinate", placeId: "TEST-PLACE-A" },
  to: { kind: "place-coordinate", placeId: "TEST-PLACE-B" },
  when: { kind: "depart-after", instant: "2099-01-01T09:00:00+09:00" },
  serviceDate: "2099-01-01",
  timeZone: "Asia/Tokyo",
  correlationId: "test-correlation-001",
};

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

describe("synthetic transit boundary", () => {
  it("keeps real-provider activation off", () => {
    expect(REAL_TRANSIT_PROVIDER_ACTIVATION).toBe("off");
  });

  it("blocks a real-provider adapter before lookup while activation is off", async () => {
    const lookupRoute = vi.fn<TransitProvider["lookupRoute"]>(async () => ({ status: "no-route" }));
    const realProvider: TransitProvider = { id: "ekispert", lookupRoute };
    const response = await buildTransitRouteHandler(realProvider)(REQUEST);

    expect(response.status).toBe(503);
    if (response.status === 200) throw new Error("real provider must remain disabled");
    expect(response.body.error.category).toBe("activation-disabled");
    expect(lookupRoute).not.toHaveBeenCalled();
  });

  it("returns an ephemeral synthetic result whose provenance never claims a real lookup", async () => {
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
      confidence: "synthetic-fixture",
      requestedAt: "2098-12-31T23:59:00Z",
      serviceDate: "2099-01-01",
      timetableVersion: "SYNTHETIC-2099-A",
      ephemeral: true,
    });
  });

  it("never reports a real confidence for a fixture, even one shaped as schedule-aware", async () => {
    for (const scheduleAware of [true, false]) {
      const provider = buildSyntheticTransitProvider([successFixture(scheduleAware)]);
      const response = await buildTransitRouteHandler(provider)(REQUEST);
      if (response.status !== 200) throw new Error("expected synthetic success");
      expect(response.body.result.scheduleAware).toBe(scheduleAware);
      expect(response.body.result.provenance.confidence).toBe("synthetic-fixture");
      expect(response.body.result.provenance.confidence).not.toBe("schedule-aware-live");
      expect(response.body.result.provenance.confidence).not.toBe("validated-static");
    }
  });

  it("warns that a non-schedule-aware answer is a typical duration", async () => {
    const provider = buildSyntheticTransitProvider([successFixture(false)]);
    const response = await buildTransitRouteHandler(provider)(REQUEST);
    if (response.status !== 200) throw new Error("expected synthetic success");
    expect(response.body.result.warnings).toContainEqual({ kind: "provider-typical-duration" });
  });

  it("does not invent no-catalogued-endpoint from a place-coordinate endpoint alone", async () => {
    // The boundary never ran access-point resolution, so it cannot know whether the caller had
    // no catalogued endpoint or simply chose the place coordinate. It must not guess.
    const provider = buildSyntheticTransitProvider([successFixture()]);
    const response = await buildTransitRouteHandler(provider)(REQUEST);
    if (response.status !== 200) throw new Error("expected synthetic success");
    expect(response.body.result.warnings.some((w) => w.kind === "no-catalogued-endpoint")).toBe(false);
  });

  it("is directed: the reverse request does not reuse the forward fixture", async () => {
    const provider = buildSyntheticTransitProvider([successFixture()]);
    const reverse = { ...REQUEST, from: REQUEST.to, to: REQUEST.from };
    const response = await buildTransitRouteHandler(provider)(reverse);
    expect(response.status).toBe(404);
    if (response.status === 200) throw new Error("reverse must not succeed");
    expect(response.body.error.category).toBe("no-route");
  });

  it("rejects an invalid body before reaching the provider, echoing a safe correlation id", async () => {
    const lookupRoute = vi.fn<TransitProvider["lookupRoute"]>(async () => ({ status: "no-route" }));
    const response = await buildTransitRouteHandler({ id: "synthetic", lookupRoute })({
      ...REQUEST,
      serviceDate: "not-a-date",
    });
    expect(response.status).toBe(400);
    if (response.status === 200) throw new Error("expected rejection");
    expect(response.body.error.category).toBe("invalid-request");
    expect(response.body.error.correlationId).toBe(REQUEST.correlationId);
    expect(lookupRoute).not.toHaveBeenCalled();
  });

  it("returns a null correlation id rather than echoing an unsafe one", async () => {
    const response = await buildTransitRouteHandler(buildSyntheticTransitProvider([]))({
      ...REQUEST,
      correlationId: "bad id\nInjected: 1",
    });
    expect(response.status).toBe(400);
    if (response.status === 200) throw new Error("expected rejection");
    expect(response.body.error.correlationId).toBeNull();
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

  it("maps every provider error category to a sanitized status without provider text", async () => {
    const expected = {
      timeout: 504,
      "rate-limited": 429,
      unauthorized: 502,
      "malformed-response": 502,
      network: 503,
      unknown: 500,
    } as const;

    for (const [category, status] of Object.entries(expected)) {
      const fixture: SyntheticTransitFixture = {
        ...successFixture(),
        outcome: { status: "provider-error", category: category as keyof typeof expected },
      };
      const response = await buildTransitRouteHandler(buildSyntheticTransitProvider([fixture]))(REQUEST);
      expect(response.status).toBe(status);
      if (response.status === 200) throw new Error("expected failure");
      expect(response.body.error.category).toBe(category);
      expect(JSON.stringify(response)).not.toContain("providerMessage");
    }
  });

  it("does not answer a provider credential failure with 401", async () => {
    // 401 would tell the browser to authenticate and would leak the state of our provider
    // relationship. An upstream rejecting our key is a 502.
    const fixture: SyntheticTransitFixture = {
      ...successFixture(),
      outcome: { status: "provider-error", category: "unauthorized" },
    };
    const response = await buildTransitRouteHandler(buildSyntheticTransitProvider([fixture]))(REQUEST);
    expect(response.status).not.toBe(401);
    expect(response.status).toBe(502);
  });

  it("treats an already-aborted signal as cancellation, not a provider failure", async () => {
    const lookupRoute = vi.fn<TransitProvider["lookupRoute"]>(async () => ({ status: "no-route" }));
    const controller = new AbortController();
    controller.abort();

    const response = await buildTransitRouteHandler({ id: "synthetic", lookupRoute })(
      REQUEST,
      controller.signal
    );

    expect(response.status).toBe(499);
    if (response.status === 200) throw new Error("expected cancellation");
    expect(response.body.error.category).toBe("cancelled");
    expect(lookupRoute).not.toHaveBeenCalled();
  });

  it("reports cancellation raised inside the adapter as cancelled, never as a network error", async () => {
    const controller = new AbortController();
    const provider = buildSyntheticTransitProvider([successFixture()]);
    const aborting: TransitProvider = {
      id: "synthetic",
      lookupRoute: async (request, signal) => {
        controller.abort();
        return provider.lookupRoute(request, signal);
      },
    };

    const response = await buildTransitRouteHandler(aborting)(REQUEST, controller.signal);
    expect(response.status).toBe(499);
    if (response.status === 200) throw new Error("expected cancellation");
    expect(response.body.error.category).toBe("cancelled");
  });

  it("lets a genuine adapter defect surface instead of disguising it as a provider category", async () => {
    const broken: TransitProvider = {
      id: "synthetic",
      lookupRoute: async () => {
        throw new TypeError("adapter bug");
      },
    };
    await expect(buildTransitRouteHandler(broken)(REQUEST)).rejects.toThrow(TypeError);
  });

  /**
   * Comments are stripped first so the check is about what the module *references*, not what its
   * documentation is allowed to name — the module's own comments discuss these APIs precisely
   * because it must never call them.
   */
  async function serverModuleCode(): Promise<string> {
    const { readFile } = await import("node:fs/promises");
    const source = await readFile(new URL("./transit.ts", import.meta.url), "utf8");
    return source.replace(/\/\*[\s\S]*?\*\//gu, "").replace(/\/\/.*$/gmu, "");
  }

  it("keeps transit results ephemeral: the server module references no persistence API", async () => {
    // This is the enforcement for `localStorage` specifically: tsconfig.server.json excludes DOM
    // (so window/document/indexedDB are already compile errors) but cannot stop @types/node's
    // web-globals shim, which vitest pulls in transitively, from declaring it.
    const code = await serverModuleCode();
    for (const forbidden of [
      "localStorage",
      "sessionStorage",
      "indexedDB",
      "writeFile",
      "appendFile",
      "createWriteStream",
    ]) {
      expect(code).not.toContain(forbidden);
    }
  });

  it("logs no route payload: the module never reaches for a console or logger sink", async () => {
    const code = await serverModuleCode();
    for (const forbidden of ["console.", "process.stdout", "process.stderr"]) {
      expect(code).not.toContain(forbidden);
    }
  });
});
