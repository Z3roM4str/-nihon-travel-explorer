import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import type { Place } from "../types";
import { divergenceEntries } from "./interest-divergence";
import { quieroIrSections, travellerYetToMark, visibleShortlist } from "./quiero-ir";
import {
  findInterest,
  freshTravellersDocument,
  interestSnapshot,
  shortlistPlaceIds,
  stanceOf,
  summarizeInterest,
  withRestoredInterest,
  withStance,
  withToggledInterest,
  type TravellersDocumentV1,
} from "./travellers";

/**
 * B25 — B7 «Quiero ir». The organiser is a pure function of what Blocks 5 and 6 already derive;
 * these tests pin that it places every shortlisted place exactly where the existing groups say,
 * that the segmented lens filters without touching identity, and that «Deshacer» restores one
 * traveller's stance exactly.
 */

const P1 = "t-1";
const P2 = "t-2";

function ids(...values: string[]): () => string {
  let index = 0;
  return () => values[index++] ?? `overflow-${index}`;
}

function place(id: string, hub = "Tokio"): Place {
  return { id, name: id, hub, duration: { raw: "1–2 h" } } as unknown as Place;
}

function build(doc: TravellersDocumentV1, lens: string = "both", hubs: Record<string, string> = {}) {
  const savedPlaces = shortlistPlaceIds(doc).map((id) => place(id, hubs[id]));
  const declinedPlaces = doc.interests
    .filter((entry) => summarizeInterest(doc, entry.placeId).kind === "declined")
    .map((entry) => place(entry.placeId, hubs[entry.placeId]));
  return quieroIrSections({
    savedPlaces,
    declinedPlaces,
    divergence: divergenceEntries(doc),
    travellers: doc.travellers,
    interestSummary: (id) => summarizeInterest(doc, id),
    stanceFor: (id, traveller) => stanceOf(findInterest(doc, id), traveller),
    lens,
  });
}

/** A: both · B: only P1 · C: only P2 · D: P1 yes / P2 no · E: both no · F: only P1. */
function sample(): TravellersDocumentV1 {
  let doc = freshTravellersDocument(ids(P1, P2));
  doc = withToggledInterest(doc, "A", P1);
  doc = withToggledInterest(doc, "A", P2);
  doc = withToggledInterest(doc, "B", P1);
  doc = withToggledInterest(doc, "C", P2);
  doc = withToggledInterest(doc, "D", P1);
  doc = withStance(doc, "D", P2, "not-interested");
  doc = withStance(doc, "E", P1, "not-interested");
  doc = withStance(doc, "E", P2, "not-interested");
  doc = withToggledInterest(doc, "F", P1);
  return doc;
}

const names = (places: readonly Place[]) => places.map((entry) => entry.id);

describe("quieroIrSections — organisation only", () => {
  it("puts every shortlisted place in exactly the section its Block 5/6 group names", () => {
    const sections = build(sample());
    expect(names(sections.agreed)).toEqual(["A"]);
    expect(sections.onlyBy.map((section) => [section.traveller.id, names(section.places)])).toEqual([
      [P1, ["B", "F"]],
      [P2, ["C"]],
    ]);
    expect(names(sections.differing)).toEqual(["D"]);
    expect(names(sections.declined)).toEqual(["E"]);
    expect(names(visibleShortlist(sections)).sort()).toEqual(["A", "B", "C", "D", "F"]);
  });

  it("keeps the shortlist order inside every section", () => {
    const sections = build(sample());
    expect(names(sections.onlyBy[0].places)).toEqual(["B", "F"]);
  });

  it("is the same whoever is holding the device — sections name people, not «you»", () => {
    const asP1 = build({ ...sample(), activeTravellerId: P1 });
    const asP2 = build({ ...sample(), activeTravellerId: P2 });
    expect(asP2.onlyBy.map((s) => names(s.places))).toEqual(asP1.onlyBy.map((s) => names(s.places)));
  });

  it("a person lens shows only what that person wants (and what they declined)", () => {
    const p2 = build(sample(), P2);
    expect(names(p2.agreed)).toEqual(["A"]);
    expect(p2.onlyBy.map((s) => s.traveller.id)).toEqual([P2]);
    expect(names(p2.onlyBy[0].places)).toEqual(["C"]);
    expect(names(p2.differing)).toEqual([]);
    expect(names(p2.declined)).toEqual(["E"]);
    const p1 = build(sample(), P1);
    expect(names(p1.differing)).toEqual(["D"]);
  });

  it("the lens never touches the document or the active traveller", () => {
    const doc = sample();
    const before = JSON.stringify(doc);
    build(doc, P2);
    expect(JSON.stringify(doc)).toBe(before);
    expect(doc.activeTravellerId).toBe(P1);
  });
});

describe("travellerYetToMark — «sólo una persona ha marcado»", () => {
  it("names the person who has not marked anything yet", () => {
    let doc = freshTravellersDocument(ids(P1, P2));
    doc = withToggledInterest(doc, "A", P1);
    const saved = shortlistPlaceIds(doc).map((id) => place(id));
    const who = travellerYetToMark(saved, doc.travellers, (id, t) => stanceOf(findInterest(doc, id), t));
    expect(who?.id).toBe(P2);
  });

  it("is null once both have marked something", () => {
    const doc = sample();
    const saved = shortlistPlaceIds(doc).map((id) => place(id));
    expect(travellerYetToMark(saved, doc.travellers, (id, t) => stanceOf(findInterest(doc, id), t))).toBeNull();
  });
});

describe("withRestoredInterest — «Deshacer» after quitar", () => {
  it("puts a place only the remover wanted back at its original position", () => {
    const doc = sample();
    const snapshot = interestSnapshot(doc, "B", P1)!;
    const removed = withStance(doc, "B", P1, null);
    expect(shortlistPlaceIds(removed)).not.toContain("B");
    const restored = withRestoredInterest(removed, snapshot);
    expect(restored.interests).toEqual(doc.interests);
  });

  it("restores the remover's stance on a shared place without touching the other person", () => {
    const doc = sample();
    const snapshot = interestSnapshot(doc, "A", P1)!;
    const removed = withStance(doc, "A", P1, null);
    expect(summarizeInterest(removed, "A").kind).toBe("only");
    const restored = withRestoredInterest(removed, snapshot);
    expect(summarizeInterest(restored, "A").kind).toBe("both");
    expect(restored.interests).toEqual(doc.interests);
  });

  it("never overwrites what the other person said in the meantime", () => {
    const doc = sample();
    const snapshot = interestSnapshot(doc, "A", P1)!;
    let next = withStance(doc, "A", P1, null);
    next = withStance(next, "A", P2, "not-interested");
    const restored = withRestoredInterest(next, snapshot);
    expect(stanceOf(findInterest(restored, "A"), P2)).toBe("not-interested");
    expect(stanceOf(findInterest(restored, "A"), P1)).toBe("interested");
  });

  it("is a no-op for a snapshot with no stance of the remover", () => {
    const doc = sample();
    const snapshot = interestSnapshot(doc, "C", P1)!;
    expect(withRestoredInterest(doc, snapshot)).toBe(doc);
  });
});

describe("B25 copy contract", () => {
  it("no visible text in Quiero ir says «analizar» or «selección», and the heading is not a duration", async () => {
    const strip = (source: string) =>
      source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    for (const file of ["../components/SelectionPanel.tsx", "../components/SelectionAnalysis.tsx"]) {
      const code = strip(await readFile(new URL(file, import.meta.url), "utf8"));
      // JSX text and string literals only — identifiers such as `SelectionAnalysis` are code.
      const literals = [...code.matchAll(/>([^<>{}]+)</g), ...code.matchAll(/"([^"]*)"|`([^`]*)`/g)]
        .map((match) => match[1] ?? match[2] ?? "")
        .join("\n");
      // Guard against a vacuous pass: the extraction must really have found the screen's copy.
      expect(literals.length, file).toBeGreaterThan(0);
      expect(literals, file).not.toMatch(/analiz/i);
      expect(literals, file).not.toMatch(/selecci[oó]n/i);
    }
    const panelCode = strip(await readFile(new URL("../components/SelectionPanel.tsx", import.meta.url), "utf8"));
    expect(panelCode).toContain("Llevar al viaje");
    // B25 moved the screen's title to the shell header (`app__title`, with the place count). The
    // check reads THAT element and fails loudly if it cannot be found, instead of slicing nothing.
    const app = strip(await readFile(new URL("../App.tsx", import.meta.url), "utf8"));
    const start = app.indexOf('<h1 className="app__title">');
    expect(start).toBeGreaterThan(-1);
    const end = app.indexOf("</h1>", start);
    expect(end).toBeGreaterThan(start);
    const heading = app.slice(start, end);
    expect(heading).toContain("destinationLabel(destination)");
    expect(heading).toContain("wantToGoCount");
    // …and SelectionPanel itself renders no heading of its own that could carry a duration.
    expect(panelCode).not.toMatch(/<h1[\s>]/);
    expect(heading).not.toMatch(/formatRange|visitTime/);
  });
});
