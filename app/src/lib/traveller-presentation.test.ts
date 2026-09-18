import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { interestMarker, stanceLines, tallySentence } from "./traveller-presentation";
import type { PlaceInterestSummary, Traveller } from "./travellers";

const P1 = "t-1";
const P2 = "t-2";
const TRAVELLERS: Traveller[] = [
  { id: P1, label: "Ana" },
  { id: P2, label: "Beto" },
];

describe("the marker stays silent when it has nothing to add", () => {
  it("says nothing about a place nobody has an opinion on", () => {
    expect(interestMarker({ kind: "none" }, TRAVELLERS, P1)).toBeNull();
  });

  it("says nothing on a place YOU saved that the other person has not seen", () => {
    const summary: PlaceInterestSummary = { kind: "only", interestedId: P1, silentIds: [P2] };
    expect(interestMarker(summary, TRAVELLERS, P1)).toBeNull();
  });

  it("but does speak when it is the OTHER person who wants it", () => {
    const summary: PlaceInterestSummary = { kind: "only", interestedId: P2, silentIds: [P1] };
    expect(interestMarker(summary, TRAVELLERS, P1)).toMatchObject({
      label: "Sólo Beto",
      tone: "other",
    });
  });
});

describe("the marker is written from the reader's point of view", () => {
  it("reports agreement as a coincidence, not a rating", () => {
    const marker = interestMarker({ kind: "both" }, TRAVELLERS, P1);
    expect(marker).toMatchObject({ label: "Los dos", tone: "agreement" });
    expect(marker?.description).toBe("Las dos personas han dicho que quieren ir.");
  });

  it("names the other person when they have refused something you want", () => {
    const summary: PlaceInterestSummary = {
      kind: "split",
      interestedIds: [P1],
      notInterestedIds: [P2],
    };
    expect(interestMarker(summary, TRAVELLERS, P1)).toMatchObject({
      label: "Beto: no",
      tone: "declined",
    });
  });

  it("flips that round for the other reader, from the same stored state", () => {
    const summary: PlaceInterestSummary = {
      kind: "split",
      interestedIds: [P1],
      notInterestedIds: [P2],
    };
    expect(interestMarker(summary, TRAVELLERS, P2)).toMatchObject({
      label: "Ana sí",
      tone: "other",
    });
  });

  it("tells you when it is you who said no", () => {
    const summary: PlaceInterestSummary = { kind: "declined", notInterestedIds: [P1] };
    expect(interestMarker(summary, TRAVELLERS, P1)).toMatchObject({
      label: "No te interesa",
      tone: "declined",
    });
  });

  it("tells you when it is the other person who said no and you have not spoken", () => {
    const summary: PlaceInterestSummary = { kind: "declined", notInterestedIds: [P2] };
    expect(interestMarker(summary, TRAVELLERS, P1)).toMatchObject({
      label: "Beto: no",
      tone: "declined",
    });
  });

  it("reports a place both refused without blaming either", () => {
    const summary: PlaceInterestSummary = { kind: "declined", notInterestedIds: [P1, P2] };
    expect(interestMarker(summary, TRAVELLERS, P1)).toMatchObject({ label: "Ninguno" });
  });

  it("marks a place carried over from before the profiles existed", () => {
    expect(interestMarker({ kind: "unclaimed" }, TRAVELLERS, P1)).toMatchObject({
      label: "Sin reclamar",
      tone: "unclaimed",
    });
  });

  it("degrades to a neutral name when a traveller cannot be resolved", () => {
    const summary: PlaceInterestSummary = { kind: "only", interestedId: "ghost", silentIds: [] };
    expect(interestMarker(summary, TRAVELLERS, P1)?.label).toBe("Sólo La otra persona");
  });
});

describe("every marker carries text, never colour alone", () => {
  const summaries: PlaceInterestSummary[] = [
    { kind: "unclaimed" },
    { kind: "both" },
    { kind: "only", interestedId: P2, silentIds: [P1] },
    { kind: "split", interestedIds: [P1], notInterestedIds: [P2] },
    { kind: "declined", notInterestedIds: [P2] },
  ];

  it.each(summaries.map((summary) => [summary.kind, summary] as const))(
    "%s has a non-empty label and a spelled-out description",
    (_kind, summary) => {
      const marker = interestMarker(summary, TRAVELLERS, P1);
      expect(marker).not.toBeNull();
      expect(marker!.label.trim().length).toBeGreaterThan(0);
      expect(marker!.description.trim().length).toBeGreaterThan(0);
      expect(marker!.description).not.toBe(marker!.label);
    }
  );
});

describe("the full picture, for the one surface with room for it", () => {
  it("gives one line per traveller, including silence as a real answer", () => {
    const summary: PlaceInterestSummary = { kind: "only", interestedId: P1, silentIds: [P2] };
    expect(stanceLines(summary, TRAVELLERS)).toEqual([
      { travellerId: P1, label: "Ana", text: "quiere ir", stance: "interested" },
      { travellerId: P2, label: "Beto", text: "no ha dicho nada", stance: "silent" },
    ]);
  });

  it("distinguishes a refusal from silence", () => {
    const summary: PlaceInterestSummary = {
      kind: "split",
      interestedIds: [P1],
      notInterestedIds: [P2],
    };
    expect(stanceLines(summary, TRAVELLERS).map((line) => line.stance)).toEqual([
      "interested",
      "not-interested",
    ]);
  });

  it("treats an unclaimed place as nobody having spoken", () => {
    expect(stanceLines({ kind: "unclaimed" }, TRAVELLERS).map((line) => line.stance)).toEqual([
      "silent",
      "silent",
    ]);
  });

  it("marks both as interested when both are", () => {
    expect(stanceLines({ kind: "both" }, TRAVELLERS).map((line) => line.stance)).toEqual([
      "interested",
      "interested",
    ]);
  });
});

describe("the list header counts, and never scores", () => {
  it("is honest about an empty list", () => {
    expect(tallySentence({ total: 0, both: 0, onlyOne: 0, split: 0, unclaimed: 0 })).toBe(
      "Todavía no habéis guardado nada."
    );
  });

  it("reports plain counts of what was said", () => {
    expect(tallySentence({ total: 4, both: 2, onlyOne: 1, split: 1, unclaimed: 0 })).toBe(
      "4 lugares: 2 que queréis los dos · 1 que quiere sólo uno · 1 con desacuerdo."
    );
  });

  it("names carried-over places separately", () => {
    expect(tallySentence({ total: 1, both: 0, onlyOne: 0, split: 0, unclaimed: 1 })).toBe(
      "1 lugar: 1 sin reclamar."
    );
  });

  it("never emits a percentage, a score or a verdict", async () => {
    const code = (await readFile(new URL("./traveller-presentation.ts", import.meta.url), "utf8"))
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(code).not.toMatch(/%|\bscore\b|\bcompatib|\bafinidad\b|\bmejor\b|\brecomend/i);
    // No arithmetic on preferences anywhere in the module.
    expect(code).not.toMatch(/[*/]\s*\d|\btoFixed\b|Math\./);
  });
});
