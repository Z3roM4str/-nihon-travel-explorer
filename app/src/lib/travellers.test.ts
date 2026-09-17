import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_TRAVELLER_LABELS,
  LEGACY_SAVED_PLACES_KEY,
  MAX_TRAVELLERS,
  TRAVELLERS_STORAGE_KEY,
  TRAVELLERS_VERSION,
  createTravellerId,
  findInterest,
  findTraveller,
  freshTravellersDocument,
  isInShortlist,
  loadTravellersDocument,
  migrateLegacySavedIds,
  parseTravellersDocument,
  reconcileTravellers,
  shortlistPlaceIds,
  stanceOf,
  summarizeInterest,
  tallyShortlist,
  withActiveTraveller,
  withNewTraveller,
  withStance,
  withToggledInterest,
  withTravellerLabel,
  withTravellerReset,
  withoutTraveller,
  writeTravellersDocument,
  type Storage,
  type TravellersDocumentV1,
} from "./travellers";

/** Deterministic ids, so every assertion names the traveller it means. */
function ids(...values: string[]): () => string {
  let index = 0;
  return () => values[index++] ?? `overflow-${index}`;
}

function memoryStorage(initial: Record<string, string> = {}): Storage & {
  values: Record<string, string>;
  reads: string[];
} {
  return {
    values: { ...initial },
    reads: [],
    getItem(key: string) {
      this.reads.push(key);
      return this.values[key] ?? null;
    },
    setItem(key: string, value: string) {
      this.values[key] = value;
    },
  };
}

const P1 = "t-1";
const P2 = "t-2";

function twoTravellers(): TravellersDocumentV1 {
  return freshTravellersDocument(ids(P1, P2));
}

// ── Shape and creation ────────────────────────────────────────────────────────────────────────

describe("the roster", () => {
  it("starts with two neutrally-labelled travellers and no opinions", () => {
    const doc = twoTravellers();
    expect(doc.version).toBe(TRAVELLERS_VERSION);
    expect(doc.travellers).toEqual([
      { id: P1, label: DEFAULT_TRAVELLER_LABELS[0] },
      { id: P2, label: DEFAULT_TRAVELLER_LABELS[1] },
    ]);
    expect(doc.interests).toEqual([]);
    expect(doc.activeTravellerId).toBe(P1);
  });

  it("is capped at two, so the roster cannot silently grow", () => {
    expect(MAX_TRAVELLERS).toBe(2);
    const doc = twoTravellers();
    expect(withNewTraveller(doc, "Persona 3", ids("t-3"))).toBe(doc);
  });

  it("mints ids that collide with nothing, and fails safely when it cannot", () => {
    expect(createTravellerId([], ids("a"))).toBe("a");
    expect(createTravellerId(["a"], () => "a")).toBeNull();
  });

  it("renames without inventing a default, and rejects a blank label", () => {
    const doc = withTravellerLabel(twoTravellers(), P1, "  Ana  ");
    expect(findTraveller(doc, P1)?.label).toBe("Ana");
    expect(withTravellerLabel(doc, P1, "   ")).toBe(doc);
    expect(withTravellerLabel(doc, "nope", "X")).toBe(doc);
  });

  it("tracks who is holding the device, and refuses an unknown one", () => {
    const doc = withActiveTraveller(twoTravellers(), P2);
    expect(doc.activeTravellerId).toBe(P2);
    expect(withActiveTraveller(doc, "ghost")).toBe(doc);
    expect(withActiveTraveller(doc, P2)).toBe(doc);
  });
});

// ── The twelve cases the block must cover ─────────────────────────────────────────────────────

describe("A. Persona 1 saves a place", () => {
  it("records one stance, attributed to exactly that person", () => {
    const doc = withToggledInterest(twoTravellers(), "JP-001", P1);
    expect(doc.interests).toEqual([
      { placeId: "JP-001", stances: [{ travellerId: P1, stance: "interested" }], carriedOver: false },
    ]);
    expect(stanceOf(findInterest(doc, "JP-001"), P2)).toBeNull();
  });

  it("puts it in the shared shortlist straight away", () => {
    const doc = withToggledInterest(twoTravellers(), "JP-001", P1);
    expect(shortlistPlaceIds(doc)).toEqual(["JP-001"]);
  });

  it("reports it as wanted by one, with the other silent — not as a score", () => {
    const doc = withToggledInterest(twoTravellers(), "JP-001", P1);
    expect(summarizeInterest(doc, "JP-001")).toEqual({
      kind: "only",
      interestedId: P1,
      silentIds: [P2],
    });
  });

  it("toggles back off without touching anyone else", () => {
    let doc = withToggledInterest(twoTravellers(), "JP-001", P1);
    doc = withToggledInterest(doc, "JP-001", P1);
    expect(doc.interests).toEqual([]);
    expect(shortlistPlaceIds(doc)).toEqual([]);
  });
});

describe("B. Persona 2 later saves the same place", () => {
  it("adds a second stance rather than replacing the first", () => {
    let doc = withToggledInterest(twoTravellers(), "JP-001", P1);
    doc = withToggledInterest(doc, "JP-001", P2);
    expect(findInterest(doc, "JP-001")?.stances).toEqual([
      { travellerId: P1, stance: "interested" },
      { travellerId: P2, stance: "interested" },
    ]);
  });

  it("keeps the place in the shortlist exactly once", () => {
    let doc = withToggledInterest(twoTravellers(), "JP-001", P1);
    doc = withToggledInterest(doc, "JP-001", P2);
    expect(shortlistPlaceIds(doc)).toEqual(["JP-001"]);
  });
});

describe("C. Both are interested", () => {
  it("is reported as a coincidence of preferences", () => {
    let doc = withToggledInterest(twoTravellers(), "JP-001", P1);
    doc = withToggledInterest(doc, "JP-001", P2);
    expect(summarizeInterest(doc, "JP-001")).toEqual({ kind: "both" });
  });

  it("produces no number, score or ranking anywhere in the module's API", async () => {
    const code = (await readFile(new URL("./travellers.ts", import.meta.url), "utf8"))
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(code).not.toMatch(/\bscore\b|\bcompatib|\bpercent|\bmatch(Score|Percent)|\brating\b/i);
    expect(code).not.toMatch(/\brank\b|\bweight\b/i);
  });

  it("one person withdrawing leaves the other's interest exactly as it was", () => {
    let doc = withToggledInterest(twoTravellers(), "JP-001", P1);
    doc = withToggledInterest(doc, "JP-001", P2);
    doc = withToggledInterest(doc, "JP-001", P1);
    expect(summarizeInterest(doc, "JP-001")).toEqual({
      kind: "only",
      interestedId: P2,
      silentIds: [P1],
    });
    expect(shortlistPlaceIds(doc)).toEqual(["JP-001"]);
  });
});

describe("D. Only one person is interested", () => {
  it("keeps silence distinct from a refusal", () => {
    const doc = withToggledInterest(twoTravellers(), "JP-001", P1);
    const summary = summarizeInterest(doc, "JP-001");
    expect(summary.kind).toBe("only");
    expect(summarizeInterest(doc, "JP-001")).not.toMatchObject({ kind: "split" });
  });
});

describe("E. A person explicitly says they are not interested", () => {
  it("is a different state from having said nothing", () => {
    const silent = withToggledInterest(twoTravellers(), "JP-001", P1);
    const refused = withStance(silent, "JP-001", P2, "not-interested");
    expect(stanceOf(findInterest(silent, "JP-001"), P2)).toBeNull();
    expect(stanceOf(findInterest(refused, "JP-001"), P2)).toBe("not-interested");
  });

  it("does not remove a place the other person still wants — disagreement is shown, not resolved", () => {
    let doc = withToggledInterest(twoTravellers(), "JP-001", P1);
    doc = withStance(doc, "JP-001", P2, "not-interested");
    expect(summarizeInterest(doc, "JP-001")).toEqual({
      kind: "split",
      interestedIds: [P1],
      notInterestedIds: [P2],
    });
    expect(shortlistPlaceIds(doc)).toEqual(["JP-001"]);
  });

  it("leaves the shortlist only when nobody wants it", () => {
    let doc = withStance(twoTravellers(), "JP-001", P1, "not-interested");
    doc = withStance(doc, "JP-001", P2, "not-interested");
    expect(summarizeInterest(doc, "JP-001")).toEqual({
      kind: "declined",
      notInterestedIds: [P1, P2],
    });
    expect(shortlistPlaceIds(doc)).toEqual([]);
  });

  it("can be withdrawn back to no opinion, never flipped to interest", () => {
    let doc = withStance(twoTravellers(), "JP-001", P1, "not-interested");
    doc = withStance(doc, "JP-001", P1, null);
    expect(findInterest(doc, "JP-001")).toBeNull();
  });

  it("changing your mind replaces the refusal rather than stacking a second stance", () => {
    let doc = withStance(twoTravellers(), "JP-001", P1, "not-interested");
    doc = withToggledInterest(doc, "JP-001", P1);
    expect(findInterest(doc, "JP-001")?.stances).toEqual([
      { travellerId: P1, stance: "interested" },
    ]);
  });
});

describe("F. A place only one person wants still reaches the planner", () => {
  it("is in the derived shortlist the planner reconciles against", () => {
    let doc = withToggledInterest(twoTravellers(), "JP-001", P1);
    doc = withStance(doc, "JP-002", P2, "not-interested");
    doc = withToggledInterest(doc, "JP-003", P2);
    expect(shortlistPlaceIds(doc)).toEqual(["JP-001", "JP-003"]);
  });

  it("the shortlist keeps the order places entered it", () => {
    let doc = withToggledInterest(twoTravellers(), "JP-003", P2);
    doc = withToggledInterest(doc, "JP-001", P1);
    doc = withToggledInterest(doc, "JP-002", P1);
    expect(shortlistPlaceIds(doc)).toEqual(["JP-003", "JP-001", "JP-002"]);
  });
});

describe("G. One day holds places preferred by different people", () => {
  it("each place keeps its own, independent summary", () => {
    let doc = withToggledInterest(twoTravellers(), "JP-001", P1);
    doc = withToggledInterest(doc, "JP-002", P2);
    doc = withToggledInterest(doc, "JP-003", P1);
    doc = withToggledInterest(doc, "JP-003", P2);

    expect(summarizeInterest(doc, "JP-001").kind).toBe("only");
    expect(summarizeInterest(doc, "JP-002").kind).toBe("only");
    expect(summarizeInterest(doc, "JP-003").kind).toBe("both");
  });

  it("tallies them as plain counts, never as a compatibility figure", () => {
    let doc = withToggledInterest(twoTravellers(), "JP-001", P1);
    doc = withToggledInterest(doc, "JP-002", P1);
    doc = withStance(doc, "JP-002", P2, "not-interested");
    doc = withToggledInterest(doc, "JP-003", P1);
    doc = withToggledInterest(doc, "JP-003", P2);
    expect(tallyShortlist(doc)).toEqual({ total: 3, both: 1, onlyOne: 1, split: 1, unclaimed: 0 });
  });
});

describe("I. Resetting and removing a profile", () => {
  it("resetting clears that person's stances and keeps the person", () => {
    let doc = withToggledInterest(twoTravellers(), "JP-001", P1);
    doc = withToggledInterest(doc, "JP-002", P2);
    doc = withTravellerReset(doc, P1);

    expect(doc.travellers).toHaveLength(2);
    expect(findInterest(doc, "JP-001")).toBeNull();
    expect(summarizeInterest(doc, "JP-002").kind).toBe("only");
  });

  it("resetting never reattributes a stance to the other person", () => {
    let doc = withToggledInterest(twoTravellers(), "JP-001", P1);
    doc = withToggledInterest(doc, "JP-001", P2);
    doc = withTravellerReset(doc, P1);
    expect(findInterest(doc, "JP-001")?.stances).toEqual([
      { travellerId: P2, stance: "interested" },
    ]);
  });

  it("removing takes the person and their stances, and nothing else", () => {
    let doc = withToggledInterest(twoTravellers(), "JP-001", P1);
    doc = withToggledInterest(doc, "JP-002", P2);
    doc = withoutTraveller(doc, P1);

    expect(doc.travellers.map((entry) => entry.id)).toEqual([P2]);
    expect(shortlistPlaceIds(doc)).toEqual(["JP-002"]);
  });

  it("hands the device to whoever is left when the active traveller goes", () => {
    const doc = withoutTraveller(withActiveTraveller(twoTravellers(), P1), P1);
    expect(doc.activeTravellerId).toBe(P2);
  });

  it("refuses to remove the last traveller", () => {
    const one = withoutTraveller(twoTravellers(), P2);
    expect(withoutTraveller(one, P1)).toBe(one);
  });

  it("a traveller can be added back, and starts with no opinions", () => {
    let doc = withoutTraveller(twoTravellers(), P2);
    doc = withNewTraveller(doc, "Persona 2", ids("t-3"));
    expect(doc.travellers.map((entry) => entry.label)).toEqual(["Persona 1", "Persona 2"]);
    expect(doc.interests).toEqual([]);
  });

  it("a place nobody is left to want leaves the shortlist, so the planner prunes it", () => {
    const doc = withoutTraveller(withToggledInterest(twoTravellers(), "JP-001", P1), P1);
    expect(shortlistPlaceIds(doc)).toEqual([]);
  });
});

describe("J. Opening a draft from before this layer existed", () => {
  it("carries the old shortlist over without inventing anyone's opinion", () => {
    const doc = migrateLegacySavedIds(["JP-001", "JP-002"], ids(P1, P2));
    expect(doc.interests).toEqual([
      { placeId: "JP-001", stances: [], carriedOver: true },
      { placeId: "JP-002", stances: [], carriedOver: true },
    ]);
    for (const interest of doc.interests) expect(interest.stances).toEqual([]);
  });

  it("keeps every carried-over place in the shortlist", () => {
    const doc = migrateLegacySavedIds(["JP-001", "JP-002"], ids(P1, P2));
    expect(shortlistPlaceIds(doc)).toEqual(["JP-001", "JP-002"]);
  });

  it("reports them as unclaimed rather than as anybody's choice", () => {
    const doc = migrateLegacySavedIds(["JP-001"], ids(P1, P2));
    expect(summarizeInterest(doc, "JP-001")).toEqual({ kind: "unclaimed" });
    expect(tallyShortlist(doc)).toEqual({ total: 1, both: 0, onlyOne: 0, split: 0, unclaimed: 1 });
  });

  it("claiming one clears the unclaimed flag for good", () => {
    let doc = migrateLegacySavedIds(["JP-001"], ids(P1, P2));
    doc = withToggledInterest(doc, "JP-001", P1);
    expect(findInterest(doc, "JP-001")).toEqual({
      placeId: "JP-001",
      stances: [{ travellerId: P1, stance: "interested" }],
      carriedOver: false,
    });

    // Going quiet again is not the same as never having been asked.
    doc = withToggledInterest(doc, "JP-001", P1);
    expect(findInterest(doc, "JP-001")).toBeNull();
  });

  it("clearing a stance nobody ever set leaves an unclaimed place alone", () => {
    const doc = migrateLegacySavedIds(["JP-001"], ids(P1, P2));
    expect(withStance(doc, "JP-001", P1, null)).toBe(doc);
    expect(shortlistPlaceIds(withStance(doc, "JP-001", P1, null))).toEqual(["JP-001"]);
  });

  it("skips duplicates and non-strings in a legacy array without failing", () => {
    const doc = migrateLegacySavedIds(["JP-001", "JP-001", 7, null, "", "JP-002"], ids(P1, P2));
    expect(doc.interests.map((entry) => entry.placeId)).toEqual(["JP-001", "JP-002"]);
  });
});

// ── K. Invalid data, orphan references, old schema ────────────────────────────────────────────

describe("K. Malformed input fails closed", () => {
  function validDocument(): unknown {
    return {
      version: 1,
      travellers: [
        { id: P1, label: "Persona 1" },
        { id: P2, label: "Persona 2" },
      ],
      activeTravellerId: P1,
      interests: [
        { placeId: "JP-001", stances: [{ travellerId: P1, stance: "interested" }], carriedOver: false },
      ],
    };
  }

  it("accepts a valid document verbatim", () => {
    expect(parseTravellersDocument(validDocument())).toEqual(validDocument());
  });

  it.each([
    ["a non-object", "nope"],
    ["null", null],
    ["an array", []],
    ["a future version", { ...(validDocument() as object), version: 2 }],
    ["a missing version", { travellers: [], activeTravellerId: null, interests: [] }],
    ["travellers that are not an array", { ...(validDocument() as object), travellers: {} }],
    ["interests that are not an array", { ...(validDocument() as object), interests: {} }],
    ["an empty roster", { ...(validDocument() as object), travellers: [], activeTravellerId: null }],
    [
      "more travellers than the cap",
      {
        ...(validDocument() as object),
        travellers: [
          { id: "a", label: "A" },
          { id: "b", label: "B" },
          { id: "c", label: "C" },
        ],
        activeTravellerId: "a",
        interests: [],
      },
    ],
    [
      "duplicate traveller ids",
      {
        ...(validDocument() as object),
        travellers: [
          { id: P1, label: "A" },
          { id: P1, label: "B" },
        ],
        interests: [],
      },
    ],
    ["a blank traveller label", { ...(validDocument() as object), travellers: [{ id: P1, label: " " }], activeTravellerId: P1, interests: [] }],
    ["an unknown active traveller", { ...(validDocument() as object), activeTravellerId: "ghost" }],
    ["a non-string active traveller", { ...(validDocument() as object), activeTravellerId: 7 }],
  ])("rejects %s", (_label, value) => {
    expect(parseTravellersDocument(value)).toBeNull();
  });

  it("rejects a stance referencing a traveller who does not exist — never drops or reattributes it", () => {
    expect(
      parseTravellersDocument({
        ...(validDocument() as object),
        interests: [
          { placeId: "JP-001", stances: [{ travellerId: "ghost", stance: "interested" }], carriedOver: false },
        ],
      })
    ).toBeNull();
  });

  it("rejects two stances by the same traveller on one place rather than letting one win", () => {
    expect(
      parseTravellersDocument({
        ...(validDocument() as object),
        interests: [
          {
            placeId: "JP-001",
            stances: [
              { travellerId: P1, stance: "interested" },
              { travellerId: P1, stance: "not-interested" },
            ],
            carriedOver: false,
          },
        ],
      })
    ).toBeNull();
  });

  it("rejects two records for the same place", () => {
    expect(
      parseTravellersDocument({
        ...(validDocument() as object),
        interests: [
          { placeId: "JP-001", stances: [{ travellerId: P1, stance: "interested" }], carriedOver: false },
          { placeId: "JP-001", stances: [], carriedOver: true },
        ],
      })
    ).toBeNull();
  });

  it("rejects an empty record that no setter could have produced", () => {
    expect(
      parseTravellersDocument({
        ...(validDocument() as object),
        interests: [{ placeId: "JP-001", stances: [], carriedOver: false }],
      })
    ).toBeNull();
  });

  it("rejects an unknown stance value rather than coercing it", () => {
    expect(
      parseTravellersDocument({
        ...(validDocument() as object),
        interests: [
          { placeId: "JP-001", stances: [{ travellerId: P1, stance: "maybe" }], carriedOver: false },
        ],
      })
    ).toBeNull();
  });

  it("prunes places the catalogue no longer knows, at reconcile rather than at parse", () => {
    let doc = withToggledInterest(twoTravellers(), "JP-001", P1);
    doc = withToggledInterest(doc, "JP-GONE", P2);
    const reconciled = reconcileTravellers(doc, ["JP-001"]);
    expect(reconciled.interests.map((entry) => entry.placeId)).toEqual(["JP-001"]);
    expect(reconcileTravellers(reconciled, ["JP-001"])).toBe(reconciled);
  });
});

// ── L. Persistence ────────────────────────────────────────────────────────────────────────────

describe("L. Persistence", () => {
  it("round-trips through storage", () => {
    const storage = memoryStorage();
    const doc = withToggledInterest(twoTravellers(), "JP-001", P1);
    writeTravellersDocument(storage, doc);
    expect(loadTravellersDocument(storage, ids("x"))).toEqual(doc);
  });

  it("uses its own key and never writes the planning draft's", () => {
    expect(TRAVELLERS_STORAGE_KEY).toBe("nihon.travellers.v1");
    const storage = memoryStorage();
    writeTravellersDocument(storage, twoTravellers());
    expect(Object.keys(storage.values)).toEqual([TRAVELLERS_STORAGE_KEY]);
  });

  it("migrates the legacy list only when no document exists yet", () => {
    const storage = memoryStorage({ [LEGACY_SAVED_PLACES_KEY]: JSON.stringify(["JP-001"]) });
    const migrated = loadTravellersDocument(storage, ids(P1, P2));
    expect(migrated.interests).toEqual([{ placeId: "JP-001", stances: [], carriedOver: true }]);
  });

  it("never reads the legacy key once a document exists", () => {
    const doc = withToggledInterest(twoTravellers(), "JP-009", P1);
    const storage = memoryStorage({
      [TRAVELLERS_STORAGE_KEY]: JSON.stringify(doc),
      [LEGACY_SAVED_PLACES_KEY]: JSON.stringify(["JP-001"]),
    });
    const loaded = loadTravellersDocument(storage, ids("x"));
    expect(loaded.interests.map((entry) => entry.placeId)).toEqual(["JP-009"]);
    expect(storage.reads).not.toContain(LEGACY_SAVED_PLACES_KEY);
  });

  it("leaves the legacy key in place rather than deleting the reader's data", () => {
    const storage = memoryStorage({ [LEGACY_SAVED_PLACES_KEY]: JSON.stringify(["JP-001"]) });
    loadTravellersDocument(storage, ids(P1, P2));
    expect(storage.values[LEGACY_SAVED_PLACES_KEY]).toBe(JSON.stringify(["JP-001"]));
  });

  it("falls back to a fresh roster on unparseable JSON, a malformed document or a hostile legacy value", () => {
    const cases: Record<string, string>[] = [
      { [TRAVELLERS_STORAGE_KEY]: "{not json" },
      { [TRAVELLERS_STORAGE_KEY]: JSON.stringify({ version: 99 }) },
      { [LEGACY_SAVED_PLACES_KEY]: "{not json" },
      { [LEGACY_SAVED_PLACES_KEY]: JSON.stringify({ nope: true }) },
    ];
    for (const values of cases) {
      const loaded = loadTravellersDocument(memoryStorage(values), ids(P1, P2));
      expect(loaded.version).toBe(1);
      expect(loaded.travellers).toHaveLength(2);
      expect(loaded.interests).toEqual([]);
    }
  });

  it("survives storage that throws on read and on write", () => {
    const throwing: Storage = {
      getItem() {
        throw new Error("blocked");
      },
      setItem() {
        throw new Error("blocked");
      },
    };
    expect(loadTravellersDocument(throwing, ids(P1, P2)).travellers).toHaveLength(2);
    expect(() => writeTravellersDocument(throwing, twoTravellers())).not.toThrow();
  });

  it("an empty roster is never written, because it can never be produced", () => {
    const doc = withoutTraveller(twoTravellers(), P2);
    expect(doc.travellers).toHaveLength(1);
    expect(parseTravellersDocument(JSON.parse(JSON.stringify(doc)))).toEqual(doc);
  });
});

// ── The boundary this module must not cross ───────────────────────────────────────────────────

describe("the trip stays shared", () => {
  it("holds no route, day, date, anchor, leg, segment or zone state", async () => {
    const code = (await readFile(new URL("./travellers.ts", import.meta.url), "utf8"))
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    for (const forbidden of [
      "routeIds",
      "days",
      "startDate",
      "endDate",
      "visitStartTimes",
      "accommodations",
      "accommodationLegs",
      "interHubSegments",
      "zoneAccommodationChoices",
    ]) {
      expect(code, forbidden).not.toContain(forbidden);
    }
  });

  it("imports nothing from the planning draft and touches no network", async () => {
    const code = await readFile(new URL("./travellers.ts", import.meta.url), "utf8");
    expect(code).not.toMatch(/from "\.\/planning-draft/);
    expect(code).not.toMatch(/\bfetch\(|XMLHttpRequest|navigator\.|localStorage/);
  });

  it("keeps preference and planning decision as different words", () => {
    const doc = withToggledInterest(twoTravellers(), "JP-001", P1);
    const interest = findInterest(doc, "JP-001");
    expect(interest).not.toHaveProperty("dayId");
    expect(interest).not.toHaveProperty("visitDate");
    expect(interest).not.toHaveProperty("order");
    expect(isInShortlist(interest!)).toBe(true);
  });
});
