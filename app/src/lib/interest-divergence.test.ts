import { describe, expect, it } from "vitest";
import {
  SHORTLIST_FILTERS,
  divergenceEntries,
  hasDifferingOpinions,
  matchesShortlistFilter,
  plannedOneSidedCount,
  shortlistFilterCounts,
  shouldOfferFilters,
  type DivergenceEntry,
} from "./interest-divergence";
import {
  freshTravellersDocument,
  migrateLegacySavedIds,
  withActiveTraveller,
  withStance,
  withTravellerReset,
  withoutTraveller,
  type TravellersDocumentV1,
} from "./travellers";

/** Deterministic ids, so every assertion names the traveller it means. */
function ids(...values: string[]): () => string {
  let index = 0;
  return () => values[index++] ?? `overflow-${index}`;
}

function twoTravellers(): TravellersDocumentV1 {
  return freshTravellersDocument(ids("p1", "p2"));
}

function groupOf(entries: readonly DivergenceEntry[], placeId: string): string | null {
  return entries.find((entry) => entry.placeId === placeId)?.group ?? null;
}

describe("the seven states the view must tell apart", () => {
  it("A — both interested is `agreed`", () => {
    let doc = twoTravellers();
    doc = withStance(doc, "fushimi", "p1", "interested");
    doc = withStance(doc, "fushimi", "p2", "interested");
    expect(groupOf(divergenceEntries(doc), "fushimi")).toBe("agreed");
  });

  it("B — P1 interested and P2 silent is `only-you` when P1 is reading", () => {
    let doc = twoTravellers();
    doc = withStance(doc, "fushimi", "p1", "interested");
    expect(doc.activeTravellerId).toBe("p1");
    expect(groupOf(divergenceEntries(doc), "fushimi")).toBe("only-you");
  });

  it("C — the same state is `only-them` when P2 is reading", () => {
    let doc = twoTravellers();
    doc = withStance(doc, "fushimi", "p1", "interested");
    doc = withActiveTraveller(doc, "p2");
    expect(groupOf(divergenceEntries(doc), "fushimi")).toBe("only-them");
  });

  it("D — P1 interested and P2 explicitly refusing is `differing`, from either chair", () => {
    let doc = twoTravellers();
    doc = withStance(doc, "fushimi", "p1", "interested");
    doc = withStance(doc, "fushimi", "p2", "not-interested");
    expect(groupOf(divergenceEntries(doc), "fushimi")).toBe("differing");
    expect(groupOf(divergenceEntries(withActiveTraveller(doc, "p2")), "fushimi")).toBe("differing");
  });

  it("E — P2 interested and P1 explicitly refusing is `differing` too", () => {
    let doc = twoTravellers();
    doc = withStance(doc, "fushimi", "p2", "interested");
    doc = withStance(doc, "fushimi", "p1", "not-interested");
    expect(groupOf(divergenceEntries(doc), "fushimi")).toBe("differing");
  });

  it("F — a legacy place nobody has claimed is `unclaimed`, not anybody's preference", () => {
    const doc = migrateLegacySavedIds(["kiyomizu"], ids("p1", "p2"));
    const entries = divergenceEntries(doc);
    expect(groupOf(entries, "kiyomizu")).toBe("unclaimed");
    expect(shortlistFilterCounts(entries)["only-one"]).toBe(0);
    expect(shortlistFilterCounts(entries).differing).toBe(0);
  });

  it("G — a one-sided place the planner already holds is flagged, and stays in its own group", () => {
    let doc = twoTravellers();
    doc = withStance(doc, "fushimi", "p1", "interested");
    const entries = divergenceEntries(doc, ["fushimi"]);
    expect(groupOf(entries, "fushimi")).toBe("only-you");
    expect(entries[0].planned).toBe(true);
    expect(plannedOneSidedCount(entries)).toBe(1);
  });

  it("H — with nobody refusing anything there are no differing opinions at all", () => {
    let doc = twoTravellers();
    doc = withStance(doc, "fushimi", "p1", "interested");
    doc = withStance(doc, "nara", "p2", "interested");
    doc = withStance(doc, "kinkakuji", "p1", "interested");
    doc = withStance(doc, "kinkakuji", "p2", "interested");
    const entries = divergenceEntries(doc);
    expect(hasDifferingOpinions(entries)).toBe(false);
    expect(shortlistFilterCounts(entries).differing).toBe(0);
    // ...and the places one of them has not looked at are NOT counted as disagreements.
    expect(shortlistFilterCounts(entries)["only-one"]).toBe(2);
  });
});

describe("silence is never reported as a disagreement", () => {
  it("separates 'you have not said anything' from 'you said no'", () => {
    let silent = twoTravellers();
    silent = withStance(silent, "fushimi", "p1", "interested");

    let refused = twoTravellers();
    refused = withStance(refused, "fushimi", "p1", "interested");
    refused = withStance(refused, "fushimi", "p2", "not-interested");

    expect(groupOf(divergenceEntries(silent), "fushimi")).toBe("only-you");
    expect(groupOf(divergenceEntries(refused), "fushimi")).toBe("differing");
    expect(hasDifferingOpinions(divergenceEntries(silent))).toBe(false);
    expect(hasDifferingOpinions(divergenceEntries(refused))).toBe(true);
  });

  it("counts a list of purely one-sided places as zero disagreements", () => {
    let doc = twoTravellers();
    for (const id of ["a", "b", "c", "d"]) doc = withStance(doc, id, "p1", "interested");
    const entries = divergenceEntries(doc);
    expect(entries).toHaveLength(4);
    expect(hasDifferingOpinions(entries)).toBe(false);
  });

  it("clearing a stance returns a place to silence rather than to refusal", () => {
    let doc = twoTravellers();
    doc = withStance(doc, "fushimi", "p1", "interested");
    doc = withStance(doc, "fushimi", "p2", "not-interested");
    expect(groupOf(divergenceEntries(doc), "fushimi")).toBe("differing");
    doc = withStance(doc, "fushimi", "p2", null);
    expect(groupOf(divergenceEntries(doc), "fushimi")).toBe("only-you");
  });
});

describe("what the view contains", () => {
  it("holds only shortlisted places — a place both have refused is not in it", () => {
    let doc = twoTravellers();
    doc = withStance(doc, "fushimi", "p1", "not-interested");
    doc = withStance(doc, "fushimi", "p2", "not-interested");
    expect(divergenceEntries(doc)).toHaveLength(0);
  });

  it("keeps the shortlist's own order and introduces no ordering of its own", () => {
    let doc = twoTravellers();
    doc = withStance(doc, "c", "p1", "interested");
    doc = withStance(doc, "a", "p2", "interested");
    doc = withStance(doc, "b", "p1", "interested");
    doc = withStance(doc, "b", "p2", "interested");
    expect(divergenceEntries(doc).map((entry) => entry.placeId)).toEqual(["c", "a", "b"]);
  });

  it("flags nothing when the planner has assigned no days", () => {
    let doc = twoTravellers();
    doc = withStance(doc, "fushimi", "p1", "interested");
    expect(divergenceEntries(doc, []).every((entry) => entry.planned === false)).toBe(true);
    expect(plannedOneSidedCount(divergenceEntries(doc, []))).toBe(0);
  });

  it("does not count an agreed place as a planned one-sided one", () => {
    let doc = twoTravellers();
    doc = withStance(doc, "fushimi", "p1", "interested");
    doc = withStance(doc, "fushimi", "p2", "interested");
    const entries = divergenceEntries(doc, ["fushimi"]);
    expect(entries[0].planned).toBe(true);
    expect(plannedOneSidedCount(entries)).toBe(0);
  });

  it("ignores planned ids for places that are not in the shortlist", () => {
    const doc = twoTravellers();
    expect(divergenceEntries(doc, ["ghost"])).toHaveLength(0);
  });
});

describe("counts are tallies, never a figure about the two people", () => {
  it("adds every bucket up to the total, with no place in two buckets", () => {
    let doc = twoTravellers();
    doc = withStance(doc, "agreed", "p1", "interested");
    doc = withStance(doc, "agreed", "p2", "interested");
    doc = withStance(doc, "mine", "p1", "interested");
    doc = withStance(doc, "theirs", "p2", "interested");
    doc = withStance(doc, "split", "p1", "interested");
    doc = withStance(doc, "split", "p2", "not-interested");
    const entries = divergenceEntries(doc);
    const counts = shortlistFilterCounts(entries);
    expect(counts).toEqual({ all: 4, agreed: 1, "only-one": 2, differing: 1, unclaimed: 0 });
    expect(counts.agreed + counts["only-one"] + counts.differing + counts.unclaimed).toBe(counts.all);
  });

  it("counts an empty shortlist as zero everywhere", () => {
    expect(shortlistFilterCounts(divergenceEntries(twoTravellers()))).toEqual({
      all: 0,
      agreed: 0,
      "only-one": 0,
      differing: 0,
      unclaimed: 0,
    });
  });

  it("returns whole numbers only — nothing here is a ratio", () => {
    let doc = twoTravellers();
    doc = withStance(doc, "a", "p1", "interested");
    doc = withStance(doc, "b", "p1", "interested");
    doc = withStance(doc, "c", "p1", "interested");
    const counts = shortlistFilterCounts(divergenceEntries(doc));
    for (const value of Object.values(counts)) expect(Number.isInteger(value)).toBe(true);
  });
});

describe("filters select, and select exactly once", () => {
  it("puts every entry in `all` and in exactly one narrower filter", () => {
    let doc = twoTravellers();
    doc = withStance(doc, "agreed", "p1", "interested");
    doc = withStance(doc, "agreed", "p2", "interested");
    doc = withStance(doc, "mine", "p1", "interested");
    doc = withStance(doc, "split", "p1", "interested");
    doc = withStance(doc, "split", "p2", "not-interested");
    const legacy = migrateLegacySavedIds(["old"], ids("q1", "q2"));
    const entries = [...divergenceEntries(doc), ...divergenceEntries(legacy)];
    for (const entry of entries) {
      expect(matchesShortlistFilter(entry, "all")).toBe(true);
      const narrow = SHORTLIST_FILTERS.filter(
        (filter) => filter !== "all" && matchesShortlistFilter(entry, filter)
      );
      expect(narrow, entry.placeId).toHaveLength(1);
    }
  });

  it("`only-one` covers both sides of a one-sided place", () => {
    let doc = twoTravellers();
    doc = withStance(doc, "mine", "p1", "interested");
    doc = withStance(doc, "theirs", "p2", "interested");
    const entries = divergenceEntries(doc);
    expect(entries.map((entry) => entry.group)).toEqual(["only-you", "only-them"]);
    expect(entries.every((entry) => matchesShortlistFilter(entry, "only-one"))).toBe(true);
  });
});

describe("the view follows the state, immediately", () => {
  it("I — a change of stance moves a place between groups with no other input", () => {
    let doc = twoTravellers();
    doc = withStance(doc, "fushimi", "p1", "interested");
    expect(groupOf(divergenceEntries(doc), "fushimi")).toBe("only-you");
    doc = withStance(doc, "fushimi", "p2", "not-interested");
    expect(groupOf(divergenceEntries(doc), "fushimi")).toBe("differing");
    doc = withStance(doc, "fushimi", "p2", "interested");
    expect(groupOf(divergenceEntries(doc), "fushimi")).toBe("agreed");
  });

  it("I — switching the active reader re-sides the view without touching the document", () => {
    let doc = twoTravellers();
    doc = withStance(doc, "fushimi", "p1", "interested");
    const before = JSON.stringify(doc.interests);
    const switched = withActiveTraveller(doc, "p2");
    expect(groupOf(divergenceEntries(switched), "fushimi")).toBe("only-them");
    expect(JSON.stringify(switched.interests)).toBe(before);
  });

  it("J — resetting a profile removes their places from the view and leaves the other's", () => {
    let doc = twoTravellers();
    doc = withStance(doc, "mine", "p1", "interested");
    doc = withStance(doc, "theirs", "p2", "interested");
    doc = withStance(doc, "split", "p1", "interested");
    doc = withStance(doc, "split", "p2", "not-interested");
    expect(divergenceEntries(doc)).toHaveLength(3);

    const reset = withTravellerReset(doc, "p1");
    const entries = divergenceEntries(reset);
    expect(entries.map((entry) => entry.placeId)).toEqual(["theirs"]);
    expect(groupOf(entries, "theirs")).toBe("only-them");
    expect(hasDifferingOpinions(entries)).toBe(false);
  });

  it("J — removing a traveller leaves no group that needs them, and never reattributes", () => {
    let doc = twoTravellers();
    doc = withStance(doc, "mine", "p1", "interested");
    doc = withStance(doc, "theirs", "p2", "interested");
    const reduced = withoutTraveller(doc, "p2");
    const entries = divergenceEntries(reduced);
    expect(entries.map((entry) => entry.placeId)).toEqual(["mine"]);
    // The surviving traveller did not inherit the other's interest.
    expect(groupOf(entries, "mine")).toBe("only-you");
  });

  it("J — a reset that empties the shortlist empties the view too", () => {
    let doc = twoTravellers();
    doc = withStance(doc, "mine", "p1", "interested");
    expect(divergenceEntries(withTravellerReset(doc, "p1"))).toHaveLength(0);
  });
});

describe("the module is a lens and stores nothing", () => {
  it("never mutates the document it reads", () => {
    let doc = twoTravellers();
    doc = withStance(doc, "fushimi", "p1", "interested");
    const snapshot = JSON.stringify(doc);
    divergenceEntries(doc, ["fushimi"]);
    shortlistFilterCounts(divergenceEntries(doc));
    expect(JSON.stringify(doc)).toBe(snapshot);
  });

  it("is deterministic — the same input yields the same view", () => {
    let doc = twoTravellers();
    doc = withStance(doc, "fushimi", "p1", "interested");
    doc = withStance(doc, "nara", "p2", "not-interested");
    doc = withStance(doc, "nara", "p1", "interested");
    expect(divergenceEntries(doc, ["nara"])).toEqual(divergenceEntries(doc, ["nara"]));
  });
});

describe("a filter row is offered only when it can partition the list", () => {
  function countsOf(doc: TravellersDocumentV1) {
    return shortlistFilterCounts(divergenceEntries(doc));
  }

  it("offers nothing for an empty list", () => {
    expect(shouldOfferFilters(countsOf(twoTravellers()))).toBe(false);
  });

  it("offers nothing when every place is in the same bucket", () => {
    let doc = twoTravellers();
    for (const id of ["a", "b", "c"]) {
      doc = withStance(doc, id, "p1", "interested");
      doc = withStance(doc, id, "p2", "interested");
    }
    expect(countsOf(doc)).toMatchObject({ all: 3, agreed: 3 });
    // "Todo" and "Los dos" would select the same three rows.
    expect(shouldOfferFilters(countsOf(doc))).toBe(false);
  });

  it("offers nothing when every place is one-sided either", () => {
    let doc = twoTravellers();
    doc = withStance(doc, "a", "p1", "interested");
    doc = withStance(doc, "b", "p2", "interested");
    expect(countsOf(doc)["only-one"]).toBe(2);
    expect(shouldOfferFilters(countsOf(doc))).toBe(false);
  });

  it("offers the row as soon as two buckets exist", () => {
    let doc = twoTravellers();
    doc = withStance(doc, "a", "p1", "interested");
    doc = withStance(doc, "a", "p2", "interested");
    doc = withStance(doc, "b", "p1", "interested");
    expect(shouldOfferFilters(countsOf(doc))).toBe(true);
  });

  it("keeps offering a filter the reader has already pressed, even at zero", () => {
    let doc = twoTravellers();
    doc = withStance(doc, "a", "p1", "interested");
    doc = withStance(doc, "a", "p2", "interested");
    const counts = countsOf(doc);
    expect(counts.differing).toBe(0);
    expect(shouldOfferFilters(counts, "all")).toBe(false);
    // The reader is standing in the disagreement filter and must not be stranded there.
    expect(shouldOfferFilters(counts, "differing")).toBe(true);
  });
});
