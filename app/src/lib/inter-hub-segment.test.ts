import { describe, expect, it } from "vitest";
import {
  INTER_HUB_MODES,
  assessInterHubSegment,
  createInterHubSegmentId,
  createManualInterHubSegment,
  deriveEligibleInterHubPairs,
  parseManualInterHubSegment,
  parseManualInterHubSegments,
  type InterHubAssessmentContext,
  type ManualInterHubSegment,
} from "./inter-hub-segment";

function segment(overrides: Partial<ManualInterHubSegment> = {}): ManualInterHubSegment {
  return {
    id: "seg-1",
    fromPlaceId: "tokyo-a",
    toPlaceId: "kyoto-b",
    fromHub: "Tokio",
    toHub: "Kioto",
    mode: "shinkansen",
    minutes: 140,
    source: { kind: "user-entered" },
    ...overrides,
  };
}

function context(
  routeIds: readonly string[] = ["tokyo-a", "kyoto-b"],
  days: readonly (readonly string[])[] | null = null,
  hubs: Record<string, string> = { "tokyo-a": "Tokio", "kyoto-b": "Kioto" }
): InterHubAssessmentContext {
  return { routeIds, days, resolvePlace: (id) => (id in hubs ? { hub: hubs[id] } : null) };
}

describe("manual inter-hub segment shape", () => {
  it("parses a valid segment verbatim", () => {
    expect(parseManualInterHubSegment(segment())).toEqual(segment());
  });

  it("keeps a closed vocabulary separate from TransferMode", () => {
    expect(INTER_HUB_MODES).toEqual([
      "shinkansen",
      "limited-express",
      "domestic-flight",
      "ferry",
      "highway-bus",
      "other",
    ]);
    expect(parseManualInterHubSegment(segment({ mode: "walk" as never }))).toBeNull();
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid minutes %s",
    (minutes) => expect(parseManualInterHubSegment(segment({ minutes }))).toBeNull()
  );

  it.each([
    { id: "" },
    { id: "   " },
    { fromPlaceId: "" },
    { toPlaceId: "" },
    { fromHub: "" },
    { toHub: "   " },
  ])("rejects empty ids and hubs: %o", (override) => {
    expect(parseManualInterHubSegment(segment(override))).toBeNull();
  });

  it("rejects equal anchors and equal stored hubs", () => {
    expect(parseManualInterHubSegment(segment({ toPlaceId: "tokyo-a" }))).toBeNull();
    expect(parseManualInterHubSegment(segment({ toHub: "Tokio" }))).toBeNull();
  });

  it("requires exactly user-entered provenance and the exact top-level shape", () => {
    expect(parseManualInterHubSegment({ ...segment(), source: { kind: "official" } })).toBeNull();
    expect(parseManualInterHubSegment({ ...segment(), source: { kind: "user-entered", extra: true } })).toBeNull();
    expect(parseManualInterHubSegment({ ...segment(), distanceKm: 450 })).toBeNull();
  });

  it("rejects duplicate segment ids", () => {
    expect(parseManualInterHubSegments([segment(), segment({ toPlaceId: "osaka-c", toHub: "Osaka" })])).toBeNull();
  });

  it("rejects duplicate directional anchor pairs", () => {
    expect(parseManualInterHubSegments([segment(), segment({ id: "seg-2", minutes: 150 })])).toBeNull();
  });

  it("accepts reverse directional pairs as distinct", () => {
    const reverse = segment({
      id: "seg-2",
      fromPlaceId: "kyoto-b",
      toPlaceId: "tokyo-a",
      fromHub: "Kioto",
      toHub: "Tokio",
    });
    expect(parseManualInterHubSegments([segment(), reverse])).toHaveLength(2);
  });

  it("mints opaque collision-safe ids and never derives one from input", () => {
    const values = ["seg-1", "", "opaque-random"];
    expect(createInterHubSegmentId(["seg-1"], () => values.shift() ?? "", 3)).toBe("opaque-random");
    const created = createManualInterHubSegment(
      [],
      {
        fromPlaceId: "tokyo-a",
        toPlaceId: "kyoto-b",
        fromHub: "Tokio",
        toHub: "Kioto",
        mode: "ferry",
        minutes: 90,
      },
      () => "opaque-random"
    );
    expect(created).toEqual(segment({ id: "opaque-random", mode: "ferry", minutes: 90 }));
  });
});

describe("route-only applicability", () => {
  it("activates only the adjacent forward pair", () => {
    expect(assessInterHubSegment(segment(), context())).toEqual({
      kind: "active",
      placement: "route-only",
      fromDayOrdinal: null,
      toDayOrdinal: null,
    });
    expect(
      assessInterHubSegment(segment(), context(["kyoto-b", "tokyo-a"]))
    ).toEqual({ kind: "inactive", reason: "not-consecutive-in-route" });
  });

  it("reports each missing anchor", () => {
    expect(assessInterHubSegment(segment(), context(["kyoto-b"]))).toEqual({
      kind: "inactive",
      reason: "missing-from-place",
    });
    expect(assessInterHubSegment(segment(), context(["tokyo-a"]))).toEqual({
      kind: "inactive",
      reason: "missing-to-place",
    });
  });

  it("does not activate a non-adjacent pair", () => {
    expect(assessInterHubSegment(segment(), context(["tokyo-a", "middle", "kyoto-b"]))).toEqual({
      kind: "inactive",
      reason: "not-consecutive-in-route",
    });
  });

  it("detects stored hub mismatch without rewriting snapshots", () => {
    const original = segment();
    expect(
      assessInterHubSegment(original, context(undefined, null, { "tokyo-a": "Osaka", "kyoto-b": "Kioto" }))
    ).toEqual({ kind: "inactive", reason: "from-hub-mismatch" });
    expect(original).toEqual(segment());
  });

  it("detects a same-current-hub classification", () => {
    expect(
      assessInterHubSegment(segment(), context(undefined, null, { "tokyo-a": "Tokio", "kyoto-b": "Tokio" }))
    ).toEqual({ kind: "inactive", reason: "same-current-hub" });
  });

  it("accepts a stored non-adjacent segment but assesses it inactive", () => {
    const stored = parseManualInterHubSegment(segment());
    expect(stored).not.toBeNull();
    expect(assessInterHubSegment(stored!, context(["tokyo-a", "middle", "kyoto-b"]))).toEqual({
      kind: "inactive",
      reason: "not-consecutive-in-route",
    });
  });
});

describe("day-assignment applicability", () => {
  it("supports adjacent different hubs inside the same day", () => {
    expect(assessInterHubSegment(segment(), context(undefined, [["tokyo-a", "kyoto-b"]]))).toEqual({
      kind: "active",
      placement: "same-day",
      fromDayOrdinal: 0,
      toDayOrdinal: 0,
    });
  });

  it("rejects non-adjacent anchors inside one day", () => {
    expect(
      assessInterHubSegment(segment(), context(["tokyo-a", "middle", "kyoto-b"], [["tokyo-a", "middle", "kyoto-b"]]))
    ).toEqual({ kind: "inactive", reason: "not-consecutive-in-day" });
  });

  it("supports last-of-day to first-of-next-day", () => {
    expect(
      assessInterHubSegment(segment(), context(["tokyo-a", "kyoto-b"], [["tokyo-a"], ["kyoto-b"]]))
    ).toEqual({
      kind: "active",
      placement: "between-consecutive-days",
      fromDayOrdinal: 0,
      toDayOrdinal: 1,
    });
  });

  it("does not flatten across an empty intervening day", () => {
    expect(
      assessInterHubSegment(segment(), context(["tokyo-a", "kyoto-b"], [["tokyo-a"], [], ["kyoto-b"]]))
    ).toEqual({ kind: "inactive", reason: "not-boundary-of-consecutive-days" });
  });

  it("rejects a cross-day pair that is not last-to-first", () => {
    expect(
      assessInterHubSegment(
        segment(),
        context(["tokyo-a", "middle", "kyoto-b"], [["tokyo-a", "middle"], ["kyoto-b"]])
      )
    ).toEqual({ kind: "inactive", reason: "not-boundary-of-consecutive-days" });
  });

  it("returns invalid-day-partition and never falls back to route order", () => {
    expect(assessInterHubSegment(segment(), context(undefined, [["tokyo-a"]]))).toEqual({
      kind: "inactive",
      reason: "invalid-day-partition",
    });
  });

  it("represents the same-day Tokio to Kioto fixture without terminals or distance", () => {
    const result = assessInterHubSegment(segment(), context(undefined, [["tokyo-a", "kyoto-b"]]));
    expect(result.kind).toBe("active");
    expect(segment()).not.toHaveProperty("distanceKm");
    expect(segment()).not.toHaveProperty("terminal");
  });

  it("is pure", () => {
    const stored = segment();
    const days = [["tokyo-a"], ["kyoto-b"]];
    const before = JSON.stringify({ stored, days });
    assessInterHubSegment(stored, context(undefined, days));
    expect(JSON.stringify({ stored, days })).toBe(before);
  });
});

describe("eligible pair derivation for the create UI", () => {
  it("derives route-only, same-day and cross-day positions without mode or minutes", () => {
    expect(deriveEligibleInterHubPairs(context())).toEqual([
      {
        fromPlaceId: "tokyo-a",
        toPlaceId: "kyoto-b",
        fromHub: "Tokio",
        toHub: "Kioto",
        placement: "route-only",
        fromDayOrdinal: null,
        toDayOrdinal: null,
      },
    ]);
    const sameDay = deriveEligibleInterHubPairs(context(undefined, [["tokyo-a", "kyoto-b"]]));
    expect(sameDay[0].placement).toBe("same-day");
    const crossDay = deriveEligibleInterHubPairs(context(undefined, [["tokyo-a"], ["kyoto-b"]]));
    expect(crossDay[0].placement).toBe("between-consecutive-days");
    for (const pair of [...sameDay, ...crossDay]) {
      expect(pair).not.toHaveProperty("mode");
      expect(pair).not.toHaveProperty("minutes");
    }
  });

  it("derives no pair across an empty day or invalid partition", () => {
    expect(deriveEligibleInterHubPairs(context(undefined, [["tokyo-a"], [], ["kyoto-b"]]))).toEqual([]);
    expect(deriveEligibleInterHubPairs(context(undefined, [["tokyo-a"]]))).toEqual([]);
  });
});
