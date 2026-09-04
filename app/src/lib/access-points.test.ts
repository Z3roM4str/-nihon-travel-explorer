import { describe, expect, it } from "vitest";
import {
  buildAccessPointReader,
  getAccessPointById,
  getAccessPointsForPlace,
  getAllAccessPoints,
  type LogisticsAccessPoint,
} from "./access-points";

const point = (id: string, role: LogisticsAccessPoint["role"]): LogisticsAccessPoint => ({
  id,
  placeId: "JP-TEST",
  label: id,
  role,
  coordinates: { lat: 1, lng: 2 },
  applicableContexts: ["external-walk"],
  provenance: {
    sourceUrl: "https://example.test/access",
    sourceEntity: "Synthetic authority",
    consultedAt: "2026-01-01",
    evidence: "Synthetic fixture only",
    confidence: "official-explicit",
  },
  selection: {},
  status: "active",
});

describe("access-point reads", () => {
  it("reads the real empty artifact", () => {
    expect(getAllAccessPoints()).toEqual([]);
    expect(getAccessPointById("AP-JP-TEST-001")).toBeUndefined();
    expect(getAccessPointsForPlace("JP-TEST")).toEqual([]);
  });

  it("does not expose an array that can mutate its index", () => {
    const source = [point("AP-JP-TEST-001", "gate")];
    const reader = buildAccessPointReader(source);
    reader.getAllAccessPoints().pop();
    source.pop();
    expect(reader.getAllAccessPoints()).toHaveLength(1);
    expect(reader.getAccessPointById("AP-JP-TEST-001")).toBeDefined();
  });

  it("preserves multiple candidates without inferring priority", () => {
    const candidates = [
      point("AP-JP-TEST-009", "gate"),
      point("AP-JP-TEST-001", "visitor-entrance"),
    ];
    const reader = buildAccessPointReader(candidates);
    expect(reader.getAccessPointsForPlace("JP-TEST")).toEqual(candidates);
    expect(reader.getAccessPointsForContext("JP-TEST", "external-walk")).toEqual(candidates);
  });
});
