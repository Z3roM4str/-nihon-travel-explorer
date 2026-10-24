import { describe, expect, it } from "vitest";
import {
  buildAccessPointReader,
  getAccessPointById,
  getAccessPointsForContext,
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
  it("reads the real evidenced artifact", () => {
    const all = getAllAccessPoints();
    expect(all.map((candidate) => candidate.id)).toEqual([
      "AP-JP-029-001",
      "AP-JP-029-002",
      "AP-JP-029-003",
      "AP-JP-181-001",
    ]);
    expect(getAccessPointById("AP-JP-029-002")).toMatchObject({
      placeId: "JP-029",
      role: "visitor-entrance",
      status: "active",
    });
    expect(getAccessPointById("AP-JP-TEST-001")).toBeUndefined();
    expect(getAccessPointsForPlace("JP-TEST")).toEqual([]);
  });

  it("returns every real place with no access points as an empty list", () => {
    for (const placeId of ["JP-064", "JP-069", "JP-090", "JP-185"]) {
      expect(getAccessPointsForPlace(placeId)).toEqual([]);
      expect(getAccessPointsForContext(placeId, "external-walk")).toEqual([]);
    }
  });

  it("hands back all three real gates for JP-029 without choosing one", () => {
    const candidates = getAccessPointsForContext("JP-029", "external-walk");
    expect(candidates).toHaveLength(3);
    for (const candidate of candidates) {
      expect(candidate.selection.defaultForContexts ?? []).toEqual([]);
    }
  });

  it("offers the same three JP-029 gates for local transit, still without choosing one", () => {
    // The Imperial Household Agency documents each gate as the arrival point of a named
    // subway approach, so all three carry external-local-transit as well as external-walk
    // (see docs/TRANSIT_ACCESS_POINT_EVIDENCE.md). No gate is a default in either context:
    // Phase 3B2H showed the best gate flips with the counterpart, so the ambiguity is real.
    const candidates = getAccessPointsForContext("JP-029", "external-local-transit");
    expect(candidates.map((candidate) => candidate.id)).toEqual([
      "AP-JP-029-001",
      "AP-JP-029-002",
      "AP-JP-029-003",
    ]);
    for (const candidate of candidates) {
      expect(candidate.selection.defaultForContexts ?? []).toEqual([]);
    }
  });

  it("keeps the real ASMUI reception out of internal-stage contexts and out of local transit", () => {
    expect(
      getAccessPointsForContext("JP-181", "external-walk").map((candidate) => candidate.id),
    ).toEqual(["AP-JP-181-001"]);
    expect(getAccessPointsForContext("JP-181", "internal-hike")).toEqual([]);
    expect(getAccessPointsForContext("JP-181", "internal-shuttle")).toEqual([]);
    // Arrival there is documented as car access and no official source puts a transit
    // endpoint at the facility, so the context is deliberately not claimed.
    expect(getAccessPointsForContext("JP-181", "external-local-transit")).toEqual([]);
  });

  it("does not expose an array that can mutate its index", () => {
    const source = [point("AP-JP-TEST-001", "gate")];
    const reader = buildAccessPointReader(source);
    reader.getAllAccessPoints().pop();
    source.pop();
    expect(reader.getAllAccessPoints()).toHaveLength(1);
    expect(reader.getAccessPointById("AP-JP-TEST-001")).toBeDefined();
  });

  it("isolates its snapshot and returned nested values from mutations", () => {
    const original = point("AP-JP-TEST-001", "gate");
    original.selection.defaultForContexts = ["external-walk"];
    const reader = buildAccessPointReader([original]);

    original.coordinates.lat = 90;
    original.applicableContexts.push("internal-hike");
    original.provenance.evidence = "mutated source";
    original.selection.defaultForContexts.push("internal-hike");

    const returned = [
      reader.getAllAccessPoints()[0],
      reader.getAccessPointById(original.id),
      reader.getAccessPointsForPlace(original.placeId)[0],
      reader.getAccessPointsForContext(original.placeId, "external-walk")[0],
    ];
    for (const candidate of returned) {
      expect(candidate).toBeDefined();
      candidate!.coordinates.lng = 180;
      candidate!.applicableContexts.length = 0;
      candidate!.provenance.sourceEntity = "mutated return";
      candidate!.selection.defaultForContexts!.length = 0;
    }

    expect(reader.getAccessPointById(original.id)).toMatchObject({
      coordinates: { lat: 1, lng: 2 },
      applicableContexts: ["external-walk"],
      provenance: { evidence: "Synthetic fixture only", sourceEntity: "Synthetic authority" },
      selection: { defaultForContexts: ["external-walk"] },
    });
  });

  it("excludes deprecated points from context candidates but resolves them by ID", () => {
    const deprecated = point("AP-JP-TEST-002", "gate");
    deprecated.status = "deprecated";
    const reader = buildAccessPointReader([point("AP-JP-TEST-001", "gate"), deprecated]);

    expect(reader.getAccessPointsForContext("JP-TEST", "external-walk")).toHaveLength(1);
    expect(reader.getAccessPointById(deprecated.id)).toEqual(deprecated);
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
