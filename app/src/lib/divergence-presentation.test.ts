import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  SHORTLIST_FILTERS,
  type DivergenceGroupKind,
} from "./interest-divergence";
import {
  divergenceHeading,
  divergenceLine,
  emptyFilterSentence,
  filterAccessibleName,
  filterLabel,
  filterStatusSentence,
  plannedNote,
} from "./divergence-presentation";
import type { Traveller } from "./travellers";

const PAIR: Traveller[] = [
  { id: "p1", label: "Ana" },
  { id: "p2", label: "Beto" },
];
const GROUPS: DivergenceGroupKind[] = [
  "agreed",
  "only-you",
  "only-them",
  "differing",
  "unclaimed",
];

function everySentence(): string[] {
  const out: string[] = [];
  for (const group of GROUPS) {
    out.push(divergenceLine(group, PAIR, "p1"));
    out.push(divergenceLine(group, PAIR, "p2"));
  }
  for (const filter of SHORTLIST_FILTERS) {
    out.push(filterLabel(filter));
    out.push(filterAccessibleName(filter, 0));
    out.push(filterAccessibleName(filter, 1));
    out.push(filterAccessibleName(filter, 4));
    out.push(filterStatusSentence(filter, 0));
    out.push(filterStatusSentence(filter, 3));
    out.push(emptyFilterSentence(filter));
  }
  out.push(divergenceHeading({ all: 0, agreed: 0, "only-one": 0, differing: 0, unclaimed: 0 }));
  out.push(divergenceHeading({ all: 3, agreed: 3, "only-one": 0, differing: 0, unclaimed: 0 }));
  out.push(divergenceHeading({ all: 3, agreed: 1, "only-one": 1, differing: 1, unclaimed: 0 }));
  out.push(plannedNote({ placeId: "x", group: "only-you", planned: true }) ?? "");
  return out;
}

describe("the copy states facts, and only facts", () => {
  it("names silence as silence and never as a disagreement", () => {
    expect(divergenceLine("only-you", PAIR, "p1")).toBe(
      "Sólo tú lo guardaste. Beto aún no ha opinado."
    );
    expect(divergenceLine("only-them", PAIR, "p1")).toBe(
      "Sólo Beto lo guardó. Tú aún no has opinado."
    );
    for (const group of ["only-you", "only-them"] as const) {
      expect(divergenceLine(group, PAIR, "p1")).not.toMatch(/distint|desacuerdo|no le interesa/i);
    }
  });

  it("uses 'opiniones distintas' for an explicit refusal, and says what it is", () => {
    const line = divergenceLine("differing", PAIR, "p1");
    expect(line).toContain("Opiniones distintas");
    expect(line).toContain("no le interesa");
  });

  it("reuses Block 5's vocabulary rather than inventing a second one", () => {
    expect(divergenceLine("agreed", PAIR, "p1")).toBe("Los dos quieren ir.");
    expect(filterLabel("agreed")).toBe("Los dos");
    expect(filterLabel("unclaimed")).toBe("Sin reclamar");
    expect(divergenceLine("unclaimed", PAIR, "p1")).toContain("antes de crear los perfiles");
  });

  it("emits no percentage, score, ranking or compatibility figure anywhere", () => {
    for (const sentence of everySentence()) {
      expect(sentence).not.toMatch(/%|\bscore\b|compatib|afinidad|ranking|puntuaci/i);
    }
  });

  it("passes no judgement and gives no instruction", () => {
    for (const sentence of everySentence()) {
      expect(sentence, sentence).not.toMatch(
        /conflicto|deberíais|deberías|mejor opción|mejor para|os conviene|gana\b|pierde\b|ceder|recomendad|elimina|quitad/i
      );
    }
  });

  it("never divides anything — no sentence carries a fraction or a ratio", () => {
    for (const sentence of everySentence()) {
      expect(sentence).not.toMatch(/\d\s*\/\s*\d|\bde cada\b|\bmedia\b/i);
    }
  });
});

describe("the empty state is a statement, not a blank", () => {
  it("says outright that no explicit disagreement exists", () => {
    const sentence = emptyFilterSentence("differing");
    expect(sentence).toContain("No hay opiniones distintas");
    // And it explains WHY that is different from nobody having spoken.
    expect(sentence).toContain("nadie ha dicho que no");
  });

  it("has an empty sentence for every filter", () => {
    for (const filter of SHORTLIST_FILTERS) {
      expect(emptyFilterSentence(filter).length, filter).toBeGreaterThan(0);
    }
  });

  it("routes a zero-result filter status to the empty sentence", () => {
    for (const filter of SHORTLIST_FILTERS) {
      if (filter === "all") continue;
      expect(filterStatusSentence(filter, 0)).toBe(emptyFilterSentence(filter));
    }
  });

  it("says nothing at all in the default view", () => {
    expect(filterStatusSentence("all", 5)).toBe("");
  });

  it("reports full agreement without calling it a result", () => {
    const heading = divergenceHeading({
      all: 4,
      agreed: 4,
      "only-one": 0,
      differing: 0,
      unclaimed: 0,
    });
    expect(heading).toContain("coincidís en todo lo guardado");
    expect(heading).not.toMatch(/perfect|ideal|enhorabuena|%/i);
  });
});

describe("the planner note informs and nothing else", () => {
  it("states where the place already is, and that this screen does not move it", () => {
    const note = plannedNote({ placeId: "x", group: "differing", planned: true });
    expect(note).toBe("Ya está en un día del recorrido. Esto no lo cambia.");
  });

  it("is silent for a place nobody has scheduled", () => {
    expect(plannedNote({ placeId: "x", group: "differing", planned: false })).toBeNull();
  });

  it("is silent for an agreed place, where it would add nothing", () => {
    expect(plannedNote({ placeId: "x", group: "agreed", planned: true })).toBeNull();
  });

  it("never proposes removing, moving or replacing it", () => {
    const note = plannedNote({ placeId: "x", group: "only-you", planned: true }) ?? "";
    expect(note).not.toMatch(/quita|mueve|cambia de día|sustitu|reemplaz|otro día/i);
  });
});

describe("accessible names carry their own subject", () => {
  it("names what a chip selects and how many, in every filter", () => {
    for (const filter of SHORTLIST_FILTERS) {
      const name = filterAccessibleName(filter, 3);
      expect(name, filter).toMatch(/^Ver los 3 lugares/);
    }
  });

  it("agrees in number with the count it carries", () => {
    expect(filterAccessibleName("differing", 1)).toContain("1 lugar con");
    expect(filterAccessibleName("differing", 2)).toContain("2 lugares con");
  });

  it("gives every filter a visible label and an accessible name that differ", () => {
    for (const filter of SHORTLIST_FILTERS) {
      const label = filterLabel(filter);
      expect(label.length, filter).toBeGreaterThan(0);
      expect(filterAccessibleName(filter, 1)).not.toBe(label);
    }
  });
});

describe("a lone traveller is still described honestly", () => {
  it("does not refer to a second person who is not there", () => {
    const solo: Traveller[] = [{ id: "p1", label: "Ana" }];
    expect(divergenceLine("only-you", solo, "p1")).toBe("Sólo tú lo guardaste.");
    expect(divergenceLine("only-you", solo, "p1")).not.toContain("La otra persona");
  });

  it("falls back to a neutral noun when the other traveller cannot be named", () => {
    expect(divergenceLine("only-them", [], null)).toContain("La otra persona");
  });
});

describe("the module is copy only", () => {
  it("does no arithmetic beyond agreeing a plural", async () => {
    const source = await readFile(new URL("./divergence-presentation.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/[^/*\s]\s[*/+-]\s\w+\s*\)/);
    expect(source).not.toMatch(/Math\./);
    expect(source).not.toMatch(/\.sort\(|localeCompare/);
  });
});
