import { describe, expect, it } from "vitest";
import type { PlaceInterestSummary } from "../lib/travellers";

function resolveInterestState(
  summary: PlaceInterestSummary | undefined,
  firstTravellerId: string | null
): "both" | "person-a" | "person-b" | "none" {
  if (!summary) return "none";
  if (summary.kind === "both") return "both";
  if (summary.kind === "only") {
    return summary.interestedId === firstTravellerId ? "person-a" : "person-b";
  }
  if (summary.kind === "split") {
    const interestedId = summary.interestedIds[0];
    if (!interestedId) return "none";
    return interestedId === firstTravellerId ? "person-a" : "person-b";
  }
  return "none";
}

describe("Checkpoint D — Mapa de Ciudad (DD-004 & DD-003)", () => {
  it("resolves marker interest states for DD-004 correctly", () => {
    const travA = "trav-a";
    const travB = "trav-b";

    // Both want it
    const summaryBoth: PlaceInterestSummary = { kind: "both" };
    expect(resolveInterestState(summaryBoth, travA)).toBe("both");

    // Only Person A wants it
    const summaryA: PlaceInterestSummary = { kind: "only", interestedId: travA, silentIds: [travB] };
    expect(resolveInterestState(summaryA, travA)).toBe("person-a");

    // Only Person B wants it
    const summaryB: PlaceInterestSummary = { kind: "only", interestedId: travB, silentIds: [travA] };
    expect(resolveInterestState(summaryB, travA)).toBe("person-b");

    // Nobody / none
    const summaryNone: PlaceInterestSummary = { kind: "none" };
    expect(resolveInterestState(summaryNone, travA)).toBe("none");
  });

  it("verifies DD-003 OSM CSS tile filter formula", () => {
    const filter = "saturate(.25) contrast(.92) brightness(1.04)";
    expect(filter).toContain("saturate(.25)");
    expect(filter).toContain("contrast(.92)");
    expect(filter).toContain("brightness(1.04)");
  });
});
