import { describe, expect, it } from "vitest";
import { describeTransferForUi, transferListFootnote, transferModeIcon } from "./transfer-display";
import type { TransferEdge } from "./transfer";

function edge(overrides: Partial<TransferEdge> = {}): TransferEdge {
  return {
    fromId: "TEST-A",
    toId: "TEST-B",
    minutes: { minMinutes: 12, maxMinutes: 12 },
    distanceKm: 0.84,
    mode: "walk",
    rawMode: "A pie",
    relation: "nearby",
    rawRelation: "Cercano",
    confidence: "estimated",
    source: {
      kind: "derived-geographic",
      dataset: "nearby",
      method: "haversine-speed-model",
    },
    verifiedAt: null,
    ...overrides,
  };
}

describe("describeTransferForUi", () => {
  it("keeps estimated transfers visibly approximate", () => {
    expect(describeTransferForUi(edge())).toEqual({
      distanceText: "0.84 km",
      timeText: "~12 min",
      qualityLabel: "Estimación geográfica",
    });
  });

  it("shows a validated walking route without the approximation marker", () => {
    expect(
      describeTransferForUi(
        edge({
          confidence: "validated-static",
          minutes: { minMinutes: 9, maxMinutes: 11 },
          distanceKm: 1.26,
        })
      )
    ).toEqual({
      distanceText: "1.26 km",
      timeText: "9–11 min",
      qualityLabel: "Ruta a pie validada",
    });
  });

  it("does not hardcode validated-static to walking", () => {
    expect(
      describeTransferForUi(edge({ confidence: "validated-static", mode: "local-transit", rawMode: "Transporte local" }))
        .qualityLabel
    ).toBe("Ruta validada");
  });

  it("keeps schedule-aware distinct from static validation", () => {
    expect(describeTransferForUi(edge({ confidence: "schedule-aware" })).qualityLabel).toBe("Horario en vivo");
  });
});

describe("transferListFootnote", () => {
  it("explains mixed validated and estimated results without calling either live", () => {
    const note = transferListFootnote([edge({ confidence: "validated-static" }), edge()]);
    expect(note).toContain("rutas a pie validadas");
    expect(note).toContain("estimaciones geográficas");
    expect(note).toContain("ninguno es un horario en vivo");
  });

  it("states that a validated-only list is static", () => {
    expect(transferListFootnote([edge({ confidence: "validated-static" })])).toContain(
      "Son datos estáticos, no horarios en vivo"
    );
  });

  it("preserves the old honesty when no validated result exists", () => {
    expect(transferListFootnote([edge(), null])).toBe(
      "Estos traslados siguen siendo estimaciones geográficas; no son tiempos de ruta validados ni horarios en vivo."
    );
  });
});

describe("transferModeIcon", () => {
  it("gives every real mode a distinct icon derived from the closed vocabulary", () => {
    expect(transferModeIcon("walk")).toBe("🚶");
    expect(transferModeIcon("local-transit")).toBe("🚇");
    expect(transferModeIcon("disney-resort-line")).toBe("🚝");
    const icons = new Set(["walk", "local-transit", "disney-resort-line"].map((m) =>
      transferModeIcon(m as Parameters<typeof transferModeIcon>[0])
    ));
    expect(icons.size).toBe(3);
  });
});
