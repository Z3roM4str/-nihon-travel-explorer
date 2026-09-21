import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  PORTABLE_BACKUP_FORMAT,
  PORTABLE_BACKUP_VERSION,
  RESTORED_STORAGE_KEYS,
  applyRestore,
  backupFileName,
  buildPortableBackup,
  parseBackupEnvelope,
  planRestore,
  readPortableBackup,
  serializePortableBackup,
  summarizeRestore,
  type RestoreStorage,
} from "./portable-backup";
import {
  PLANNING_DRAFT_STORAGE_KEY,
  freshDraft,
  withInitialDays,
  withStartDate,
  withVisitStartTime,
  type ManualPlanningDraftV8,
} from "./planning-draft-v8";
import {
  TRAVELLERS_STORAGE_KEY,
  freshTravellersDocument,
  shortlistPlaceIds,
  withStance,
  type TravellersDocumentV1,
} from "./travellers";
import { getAllPlaces } from "../data/store";

/**
 * Block 13 — the portable backup contract.
 *
 * `exportedAt` is passed in everywhere; nothing here reads a clock, so none of it can start failing
 * with the calendar.
 */

const AT = "2026-09-18T10:00:00Z";

function ids(idFactory = idSeq()): () => string {
  return idFactory;
}
function idSeq(): () => string {
  let n = 0;
  return () => `t${++n}`;
}

/** Two travellers with real, differing stances — the Block 5 boundary this block must preserve. */
function twoTravellers(): TravellersDocumentV1 {
  let doc = freshTravellersDocument(ids());
  const [a, b] = doc.travellers;
  doc = withStance(doc, "JP-001", a.id, "interested");
  doc = withStance(doc, "JP-002", a.id, "interested");
  doc = withStance(doc, "JP-002", b.id, "not-interested");
  doc = withStance(doc, "JP-003", b.id, "interested");
  return doc;
}

function planFor(doc: TravellersDocumentV1): ManualPlanningDraftV8 {
  let draft = freshDraft(shortlistPlaceIds(doc));
  draft = withStartDate(draft, "2027-03-14");
  // `withDays` is deliberately a no-op in V5+; `withInitialDays` is what mints day ids.
  draft = withInitialDays(draft, [draft.routeIds.slice(0, 1), draft.routeIds.slice(1)], idSeq());
  draft = withVisitStartTime(draft, draft.routeIds[0], "09:30");
  return draft;
}

/** An in-memory storage that throws on `setItem`/`removeItem` for one chosen key. */
function memoryStorage(
  seed: Record<string, string> = {},
  failOn?: string
): RestoreStorage & { data: Record<string, string> } {
  const data: Record<string, string> = { ...seed };
  return {
    data,
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      if (failOn === key) throw new Error("quota");
      data[key] = value;
    },
    removeItem: (key) => {
      if (failOn === key) throw new Error("denied");
      delete data[key];
    },
  };
}

function withoutComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

const ALL_PLACE_IDS = getAllPlaces().map((place) => place.id);

// ── Construction, serialisation, round trip ───────────────────────────────────────────────────

describe("Block 13 — building and serialising", () => {
  it("builds an envelope with the discriminant, the version and the two documents", () => {
    const doc = twoTravellers();
    const backup = buildPortableBackup(doc, planFor(doc), AT);
    expect(backup.format).toBe(PORTABLE_BACKUP_FORMAT);
    expect(backup.version).toBe(PORTABLE_BACKUP_VERSION);
    expect(backup.exportedAt).toBe(AT);
    expect(Object.keys(backup).sort()).toEqual(["data", "exportedAt", "format", "version"]);
    expect(Object.keys(backup.data).sort()).toEqual(["planningDraft", "travellers"]);
  });

  it("keeps the envelope version independent of the documents' own versions", () => {
    const doc = twoTravellers();
    const backup = buildPortableBackup(doc, planFor(doc), AT);
    expect(backup.version).toBe(1);
    // The documents carry their own, unrelated numbers. Merging them would invalidate every file
    // on disk each time an internal schema moved.
    expect(backup.data.travellers.version).toBe(1);
    expect(backup.data.planningDraft?.version).toBe(8);
  });

  it("round-trips exactly", () => {
    const doc = twoTravellers();
    const backup = buildPortableBackup(doc, planFor(doc), AT);
    const result = readPortableBackup(serializePortableBackup(backup));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.backup).toEqual(backup);
  });

  it("round-trips a person who has marked places but not planned yet", () => {
    const backup = buildPortableBackup(twoTravellers(), null, AT);
    const result = readPortableBackup(serializePortableBackup(backup));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.backup.data.planningDraft).toBeNull();
  });

  it("is deterministic apart from exportedAt", () => {
    const doc = twoTravellers();
    const draft = planFor(doc);
    const a = serializePortableBackup(buildPortableBackup(doc, draft, AT));
    const b = serializePortableBackup(buildPortableBackup(doc, draft, AT));
    expect(a).toBe(b);
    const later = serializePortableBackup(
      buildPortableBackup(doc, draft, "2027-01-01T00:00:00Z")
    );
    expect(later).not.toBe(a);
    // …and the difference is ONLY that field.
    expect(later.replace(/"exportedAt": "[^"]*"/, "")).toBe(a.replace(/"exportedAt": "[^"]*"/, ""));
  });

  it("names the file recognisably without making the name load-bearing", () => {
    expect(backupFileName("2026-09-18")).toBe("nihon-backup-2026-09-18.json");
    // A file called anything at all still reads, because the discriminant is inside.
    const backup = buildPortableBackup(twoTravellers(), null, AT);
    expect(readPortableBackup(serializePortableBackup(backup)).ok).toBe(true);
  });
});

// ── What is in the file, and what must never be ───────────────────────────────────────────────

describe("Block 13 — durable decisions only, no derived data", () => {
  const doc = twoTravellers();
  const text = serializePortableBackup(buildPortableBackup(doc, planFor(doc), AT));

  it("carries no catalogue, photography, zone, provenance or routing data", () => {
    for (const forbidden of [
      "photography",
      "assetPath",
      "licence",
      "license",
      "provenance",
      "consultedAt",
      "sourceUrl",
      "editorial",
      "nearby",
      "walking",
      "prefecture",
      "grade",
      "imageCount",
      "zones",
    ]) {
      expect(text).not.toContain(forbidden);
    }
  });

  it("carries no place names — only ids the catalogue resolves", () => {
    const names = getAllPlaces().map((place) => place.name);
    for (const name of names) expect(text).not.toContain(name);
  });

  it("does not export the derived shortlist as a second list", () => {
    // "Quiero ir" is computed from stances. A stored copy is the drift Block 5 designed out.
    expect(text).not.toContain("savedPlaceIds");
    expect(text).not.toContain("shortlist");
  });

  it("does not export the internal storage keys, or the scratch pad and UI flags", () => {
    expect(text).not.toContain("nihon.");
    expect(text).not.toContain("zoneComparison");
    expect(text).not.toContain("onboarding");
    expect(text).not.toContain("localStorage");
  });

  it("carries no token, secret, URL or blob", () => {
    expect(text).not.toMatch(/https?:\/\//);
    expect(text).not.toMatch(/token|secret|password|authorization|bearer|data:/i);
  });

  it("restores exactly two storage keys, and they are the two durable ones", () => {
    expect([...RESTORED_STORAGE_KEYS]).toEqual([
      TRAVELLERS_STORAGE_KEY,
      PLANNING_DRAFT_STORAGE_KEY,
    ]);
  });
});

// ── The two travellers stay two ───────────────────────────────────────────────────────────────

describe("Block 13 — the two-traveller boundary survives the trip", () => {
  it("preserves each person's identity and their separate stances", () => {
    const doc = twoTravellers();
    const [a, b] = doc.travellers;
    const result = readPortableBackup(serializePortableBackup(buildPortableBackup(doc, null, AT)));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const restored = result.backup.data.travellers;
    expect(restored.travellers.map((t) => t.id)).toEqual([a.id, b.id]);

    const jp002 = restored.interests.find((i) => i.placeId === "JP-002");
    // A wants it, B does not. Neither is collapsed into the other, and neither becomes shared.
    expect(jp002?.stances).toEqual([
      { travellerId: a.id, stance: "interested" },
      { travellerId: b.id, stance: "not-interested" },
    ]);
    expect(restored.interests.find((i) => i.placeId === "JP-003")?.stances).toEqual([
      { travellerId: b.id, stance: "interested" },
    ]);
  });

  it("keeps the planning draft shared — one trip, never one per person", () => {
    const doc = twoTravellers();
    const backup = buildPortableBackup(doc, planFor(doc), AT);
    expect(Array.isArray(backup.data.planningDraft)).toBe(false);
    expect(Object.keys(backup.data).sort()).toEqual(["planningDraft", "travellers"]);
  });

  it("counts stated preferences as statements, never as a score per place", () => {
    const doc = twoTravellers();
    const summary = summarizeRestore(planRestore(buildPortableBackup(doc, null, AT), ALL_PLACE_IDS));
    // JP-001 ×1, JP-002 ×2, JP-003 ×1.
    expect(summary.statedPreferenceCount).toBe(4);
    expect(summary.shortlistCount).toBe(shortlistPlaceIds(doc).length);
  });
});

// ── Blocking errors ───────────────────────────────────────────────────────────────────────────

describe("Block 13 — a bad file is refused, by name", () => {
  it("refuses an empty file", () => {
    expect(readPortableBackup("")).toEqual({ ok: false, problem: { kind: "empty" } });
    expect(readPortableBackup("   \n ")).toEqual({ ok: false, problem: { kind: "empty" } });
  });

  it("refuses text that is not JSON", () => {
    expect(readPortableBackup("hello")).toEqual({ ok: false, problem: { kind: "not-json" } });
    expect(readPortableBackup("{nope")).toEqual({ ok: false, problem: { kind: "not-json" } });
  });

  it("refuses JSON that is not an object", () => {
    for (const text of ["[]", '"a"', "3", "null", "true"]) {
      const r = readPortableBackup(text);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.problem.kind).toBe("not-an-object");
    }
  });

  it("refuses {} and anything without the discriminant", () => {
    expect(readPortableBackup("{}")).toEqual({
      ok: false,
      problem: { kind: "wrong-format", found: null },
    });
    expect(readPortableBackup(JSON.stringify({ format: "something-else", version: 1 }))).toEqual({
      ok: false,
      problem: { kind: "wrong-format", found: "something-else" },
    });
  });

  it("refuses a future version, and says it is a version rather than corruption", () => {
    const r = readPortableBackup(
      JSON.stringify({ format: PORTABLE_BACKUP_FORMAT, version: 2, exportedAt: AT, data: {} })
    );
    expect(r).toEqual({ ok: false, problem: { kind: "unsupported-version", found: 2 } });
  });

  it("checks the discriminant before the version, so a foreign file is never 'from the future'", () => {
    const r = readPortableBackup(JSON.stringify({ format: "other-app", version: 99 }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.problem.kind).toBe("wrong-format");
  });

  it("refuses a malformed envelope: bad exportedAt, missing or extra keys", () => {
    const base = {
      format: PORTABLE_BACKUP_FORMAT,
      version: 1,
      exportedAt: AT,
      data: { travellers: twoTravellers(), planningDraft: null },
    };
    for (const mutate of [
      (o: Record<string, unknown>) => delete o.exportedAt,
      (o: Record<string, unknown>) => (o.exportedAt = "2026-09-18"),
      (o: Record<string, unknown>) => (o.exportedAt = 17),
      (o: Record<string, unknown>) => (o.extra = "surprise"),
      (o: Record<string, unknown>) => delete o.data,
      (o: Record<string, unknown>) => (o.data = []),
      (o: Record<string, unknown>) => ((o.data as Record<string, unknown>).extra = 1),
      (o: Record<string, unknown>) => delete (o.data as Record<string, unknown>).travellers,
    ]) {
      const copy = JSON.parse(JSON.stringify(base)) as Record<string, unknown>;
      mutate(copy);
      const r = readPortableBackup(JSON.stringify(copy));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.problem.kind).toBe("invalid-envelope");
    }
  });

  it("refuses a strict-policy extra key rather than ignoring it", () => {
    const doc = twoTravellers();
    const backup = { ...buildPortableBackup(doc, null, AT), sneaky: true };
    const r = readPortableBackup(JSON.stringify(backup));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.problem.kind).toBe("invalid-envelope");
  });

  it("refuses a __proto__ key instead of silently ignoring it, and pollutes nothing", () => {
    const doc = twoTravellers();
    // Written as raw text on purpose: `__proto__:` in an object literal sets the prototype rather
    // than creating a key, so building this with an object literal would test nothing at all.
    const text = `{"format":"${PORTABLE_BACKUP_FORMAT}","version":1,"exportedAt":"${AT}","__proto__":{"polluted":true},"data":{"travellers":${JSON.stringify(doc)},"planningDraft":null}}`;
    const r = readPortableBackup(text);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.problem.kind).toBe("invalid-envelope");
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect((Object.prototype as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("refuses constructor/prototype keys in the envelope too", () => {
    for (const key of ["constructor", "prototype"]) {
      const text = `{"format":"${PORTABLE_BACKUP_FORMAT}","version":1,"exportedAt":"${AT}","data":{"travellers":null,"planningDraft":null},"${key}":{"x":1}}`;
      const r = readPortableBackup(text);
      expect(r.ok).toBe(false);
    }
    expect(({} as Record<string, unknown>).x).toBeUndefined();
  });

  it("refuses an invalid travellers document, by its own parser", () => {
    const bad = [
      null,
      {},
      { version: 2, travellers: [], interests: [], activeTravellerId: null },
      // saved ids that are not strings, via a stance on a non-string traveller
      { version: 1, travellers: [{ id: 5, label: "x" }], activeTravellerId: null, interests: [] },
      // a dangling stance: never reattributed to the other person, the whole file is refused
      {
        version: 1,
        travellers: [{ id: "a", label: "A" }],
        activeTravellerId: null,
        interests: [{ placeId: "JP-001", stances: [{ travellerId: "ghost", stance: "interested" }], carriedOver: false }],
      },
      // duplicate traveller ids
      {
        version: 1,
        travellers: [{ id: "a", label: "A" }, { id: "a", label: "B" }],
        activeTravellerId: null,
        interests: [],
      },
      // an active traveller who does not exist
      { version: 1, travellers: [{ id: "a", label: "A" }], activeTravellerId: "ghost", interests: [] },
    ];
    for (const travellers of bad) {
      const r = readPortableBackup(
        JSON.stringify({ format: PORTABLE_BACKUP_FORMAT, version: 1, exportedAt: AT, data: { travellers, planningDraft: null } })
      );
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.problem.kind).toBe("invalid-travellers");
    }
  });

  it("refuses a corrupt planning draft, by its own parser", () => {
    const doc = twoTravellers();
    for (const planningDraft of [
      {},
      { version: 8 },
      { version: 8, routeIds: [1, 2], days: null, startDate: null },
      // duplicate route ids
      { version: 3, routeIds: ["JP-001", "JP-001"], days: null, startDate: null, visitStartTimes: {} },
      // a visit time that this app's UI could not have produced
      { version: 3, routeIds: ["JP-001"], days: null, startDate: null, visitStartTimes: { "JP-001": "24:00" } },
      "a string",
      7,
    ]) {
      const r = readPortableBackup(
        JSON.stringify({ format: PORTABLE_BACKUP_FORMAT, version: 1, exportedAt: AT, data: { travellers: doc, planningDraft } })
      );
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.problem.kind).toBe("invalid-planning-draft");
    }
  });

  it("an internal migration cannot rescue a file whose envelope is invalid", () => {
    const doc = twoTravellers();
    // A perfectly migratable V3 draft inside a wrong-format envelope stays refused, and is refused
    // for the envelope, not the draft.
    const r = readPortableBackup(
      JSON.stringify({
        format: "nihon-backup",
        version: 1,
        exportedAt: AT,
        data: { travellers: doc, planningDraft: { version: 3, routeIds: [], days: null, startDate: null, visitStartTimes: {} } },
      })
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.problem.kind).toBe("wrong-format");
  });
});

// ── Delegated migration ───────────────────────────────────────────────────────────────────────

describe("Block 13 — the planning draft uses its own migration authority", () => {
  it("accepts an older draft and hands back the current version", () => {
    const doc = twoTravellers();
    const shortlist = shortlistPlaceIds(doc);
    const v3 = {
      version: 3,
      routeIds: [...shortlist],
      days: null,
      startDate: "2027-03-14",
      visitStartTimes: {},
    };
    const r = readPortableBackup(
      JSON.stringify({ format: PORTABLE_BACKUP_FORMAT, version: 1, exportedAt: AT, data: { travellers: doc, planningDraft: v3 } })
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // Migrated by planning-draft's own chain — this module implements no migration of its own.
    expect(r.backup.data.planningDraft?.version).toBe(8);
    expect(r.backup.data.planningDraft?.startDate).toBe("2027-03-14");
    expect(r.backup.data.planningDraft?.routeIds).toEqual(shortlist);
  });

  it("contains no migration logic of its own", async () => {
    const code = withoutComments(await readFile(new URL("./portable-backup.ts", import.meta.url), "utf8"));
    expect(code).not.toMatch(/migrateV\d/);
    expect(code).not.toMatch(/version === [2-7]/);
  });
});

// ── Reconciliation, and never hiding loss ─────────────────────────────────────────────────────

describe("Block 13 — losses are counted, never swallowed", () => {
  it("drops places the catalogue no longer has, and says how many", () => {
    let doc = freshTravellersDocument(ids());
    const [a] = doc.travellers;
    doc = withStance(doc, "JP-001", a.id, "interested");
    doc = withStance(doc, "JP-999", a.id, "interested");
    doc = withStance(doc, "JP-998", a.id, "interested");

    const plan = planRestore(buildPortableBackup(doc, null, AT), ALL_PLACE_IDS);
    expect(plan.droppedPlaceIds.sort()).toEqual(["JP-998", "JP-999"]);
    expect(summarizeRestore(plan).droppedPlaceCount).toBe(2);
    expect(plan.travellers.interests.map((i) => i.placeId)).toEqual(["JP-001"]);
  });

  it("reports nothing dropped when every place still exists", () => {
    const plan = planRestore(buildPortableBackup(twoTravellers(), null, AT), ALL_PLACE_IDS);
    expect(plan.droppedPlaceIds).toEqual([]);
    expect(summarizeRestore(plan).droppedPlaceCount).toBe(0);
  });

  it("prunes the plan against the shortlist that survives, not the one in the file", () => {
    let doc = freshTravellersDocument(ids());
    const [a] = doc.travellers;
    doc = withStance(doc, "JP-001", a.id, "interested");
    doc = withStance(doc, "JP-999", a.id, "interested");
    const draft = freshDraft(shortlistPlaceIds(doc));
    expect(draft.routeIds).toContain("JP-999");

    const plan = planRestore(buildPortableBackup(doc, draft, AT), ALL_PLACE_IDS);
    // A route entry cannot outlive the stance that put it there.
    expect(plan.planningDraft?.routeIds).toEqual(["JP-001"]);
  });

  it("summarises in human units, not schema", () => {
    const doc = twoTravellers();
    const summary = summarizeRestore(planRestore(buildPortableBackup(doc, planFor(doc), AT), ALL_PLACE_IDS));
    expect(summary.travellerLabels).toEqual(["Persona 1", "Persona 2"]);
    expect(summary.dayCount).toBe(2);
    expect(summary.startDate).toBe("2027-03-14");
    expect(summary.visitTimeCount).toBe(1);
    expect(summary.routeCount).toBeGreaterThan(0);
  });
});

// ── Applying: replace, never merge; rollback on failure ───────────────────────────────────────

describe("Block 13 — applying replaces, and rolls back", () => {
  it("writes both keys and replaces what was there", () => {
    const doc = twoTravellers();
    const plan = planRestore(buildPortableBackup(doc, planFor(doc), AT), ALL_PLACE_IDS);
    const storage = memoryStorage({
      [TRAVELLERS_STORAGE_KEY]: JSON.stringify(freshTravellersDocument(ids())),
      [PLANNING_DRAFT_STORAGE_KEY]: JSON.stringify(freshDraft(["JP-050"])),
    });
    expect(applyRestore(storage, plan)).toEqual({ ok: true });
    expect(JSON.parse(storage.data[TRAVELLERS_STORAGE_KEY])).toEqual(plan.travellers);
    expect(JSON.parse(storage.data[PLANNING_DRAFT_STORAGE_KEY])).toEqual(plan.planningDraft);
  });

  it("never merges: the previous shortlist and route are gone, not unioned", () => {
    const doc = twoTravellers();
    const plan = planRestore(buildPortableBackup(doc, planFor(doc), AT), ALL_PLACE_IDS);
    let other = freshTravellersDocument(ids());
    other = withStance(other, "JP-100", other.travellers[0].id, "interested");
    const storage = memoryStorage({
      [TRAVELLERS_STORAGE_KEY]: JSON.stringify(other),
      [PLANNING_DRAFT_STORAGE_KEY]: JSON.stringify(freshDraft(["JP-100"])),
    });
    applyRestore(storage, plan);
    const restored = JSON.parse(storage.data[TRAVELLERS_STORAGE_KEY]) as TravellersDocumentV1;
    expect(restored.interests.map((i) => i.placeId)).not.toContain("JP-100");
    expect(JSON.parse(storage.data[PLANNING_DRAFT_STORAGE_KEY]).routeIds).not.toContain("JP-100");
  });

  it("removes the stored plan when the backup has none, rather than leaving the old one", () => {
    const plan = planRestore(buildPortableBackup(twoTravellers(), null, AT), ALL_PLACE_IDS);
    const storage = memoryStorage({
      [TRAVELLERS_STORAGE_KEY]: "{}",
      [PLANNING_DRAFT_STORAGE_KEY]: JSON.stringify(freshDraft(["JP-100"])),
    });
    expect(applyRestore(storage, plan)).toEqual({ ok: true });
    // Leaving the previous itinerary behind would be an implicit merge arrived at by omission.
    expect(PLANNING_DRAFT_STORAGE_KEY in storage.data).toBe(false);
  });

  it("rolls back when the FIRST write fails, leaving storage exactly as it was", () => {
    const doc = twoTravellers();
    const plan = planRestore(buildPortableBackup(doc, planFor(doc), AT), ALL_PLACE_IDS);
    const before = {
      [TRAVELLERS_STORAGE_KEY]: "old-travellers",
      [PLANNING_DRAFT_STORAGE_KEY]: "old-draft",
    };
    const storage = memoryStorage({ ...before }, TRAVELLERS_STORAGE_KEY);
    const outcome = applyRestore(storage, plan);
    expect(outcome).toEqual({ ok: false, failedKey: TRAVELLERS_STORAGE_KEY, rolledBack: true });
    expect(storage.data).toEqual(before);
  });

  it("rolls back when the SECOND write fails — no half-restored trip survives", () => {
    const doc = twoTravellers();
    const plan = planRestore(buildPortableBackup(doc, planFor(doc), AT), ALL_PLACE_IDS);
    const before = {
      [TRAVELLERS_STORAGE_KEY]: "old-travellers",
      [PLANNING_DRAFT_STORAGE_KEY]: "old-draft",
    };
    const storage = memoryStorage({ ...before }, PLANNING_DRAFT_STORAGE_KEY);
    const outcome = applyRestore(storage, plan);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.failedKey).toBe(PLANNING_DRAFT_STORAGE_KEY);
      expect(outcome.rolledBack).toBe(true);
    }
    // The file's travellers must NOT be left beside the old plan: that is a trip nobody had.
    expect(storage.data).toEqual(before);
  });

  it("reports honestly when the rollback itself fails", () => {
    const doc = twoTravellers();
    const plan = planRestore(buildPortableBackup(doc, null, AT), ALL_PLACE_IDS);
    // Travellers is written once, then the draft removal throws, and the attempt to put travellers
    // back throws too — the one case where storage is left in a state nobody chose.
    const data: Record<string, string> = {
      [TRAVELLERS_STORAGE_KEY]: "old",
      [PLANNING_DRAFT_STORAGE_KEY]: "old-draft",
    };
    let travellerWrites = 0;
    const storage: RestoreStorage = {
      getItem: (k) => (k in data ? data[k] : null),
      setItem: (k, v) => {
        if (k === TRAVELLERS_STORAGE_KEY && ++travellerWrites > 1) throw new Error("denied");
        data[k] = v;
      },
      removeItem: () => {
        throw new Error("denied");
      },
    };
    const outcome = applyRestore(storage, plan);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.rolledBack).toBe(false);
  });

  it("importing the exact current backup is a no-op that still succeeds", () => {
    const doc = twoTravellers();
    const plan = planRestore(buildPortableBackup(doc, planFor(doc), AT), ALL_PLACE_IDS);
    const storage = memoryStorage();
    expect(applyRestore(storage, plan)).toEqual({ ok: true });
    const snapshot = { ...storage.data };
    expect(applyRestore(storage, plan)).toEqual({ ok: true });
    expect(storage.data).toEqual(snapshot);
  });
});

// ── Purity ────────────────────────────────────────────────────────────────────────────────────

describe("Block 13 — the core is pure", () => {
  it("reads no clock, touches no storage directly and makes no request", async () => {
    const code = withoutComments(await readFile(new URL("./portable-backup.ts", import.meta.url), "utf8"));
    expect(code).not.toMatch(/new Date\(|Date\.now\(/);
    expect(code).not.toMatch(/localStorage|sessionStorage|indexedDB/);
    expect(code).not.toMatch(/fetch\(|XMLHttpRequest|navigator\.sendBeacon|WebSocket/);
    expect(code).not.toMatch(/document\.|window\./);
  });

  it("never casts an external file into a type", async () => {
    const code = withoutComments(await readFile(new URL("./portable-backup.ts", import.meta.url), "utf8"));
    // `as unknown` on JSON.parse is the opposite of a trust cast and is allowed; a cast to a
    // domain type would mean an arbitrary file had become valid state by assertion.
    expect(code).not.toMatch(/as\s+(NihonPortableBackupV1|TravellersDocumentV1|ManualPlanningDraftV8)/);
  });

  it("parsing writes nothing, whatever the file", () => {
    const storage = memoryStorage({ [TRAVELLERS_STORAGE_KEY]: "untouched" });
    const before = { ...storage.data };
    for (const text of ["", "nope", "{}", "[]", JSON.stringify({ format: PORTABLE_BACKUP_FORMAT, version: 9 })]) {
      readPortableBackup(text);
    }
    expect(storage.data).toEqual(before);
  });

  it("parseBackupEnvelope leaves the domain payloads untyped for their own parsers", () => {
    const r = parseBackupEnvelope({
      format: PORTABLE_BACKUP_FORMAT,
      version: 1,
      exportedAt: AT,
      data: { travellers: { anything: true }, planningDraft: 42 },
    });
    // The envelope is fine; judging what is inside is not its job.
    expect(r.ok).toBe(true);
  });
});

// ── The edges: the hook, and the words on screen ──────────────────────────────────────────────

describe("Block 13 — the browser edge is confined to one module", () => {
  const hook = () => readFile(new URL("../usePortableBackup.ts", import.meta.url), "utf8");

  /*
   * DDR-03 refina de dónde sale el almacenamiento, sin relajar nada.
   *
   * El requisito es el mismo: el borde del navegador vive confinado y el núcleo puro no toca ni
   * el reloj ni el almacenamiento. Lo que cambia es que ese borde ya no lo declara cada hook por
   * su cuenta — `usePortableBackup` declaraba su propio `browserStorage` con `localStorage`
   * dentro, igual que otros cuatro módulos —, sino que los cinco comparten
   * `lib/device-storage.ts`, que es además la única fuente de verdad del estado de persistencia.
   * El confinamiento es ahora MÁS estricto: un solo módulo en toda la aplicación toca
   * `localStorage`, en vez de cinco. El reloj sigue siendo de este hook y de nadie más.
   */
  it("the clock lives in the hook, storage lives in one shared module, and the core has neither", async () => {
    const code = withoutComments(await hook());
    expect(code).toMatch(/new Date\(\)/);
    // El hook ya no habla con `localStorage`: pasa por el adaptador compartido.
    expect(code).not.toMatch(/localStorage/);
    expect(code).toMatch(/deviceStorage/);

    const edge = withoutComments(
      await readFile(new URL("./device-storage.ts", import.meta.url), "utf8")
    );
    expect(edge).toMatch(/localStorage/);
    // El borde no lee el reloj: eso sigue siendo del hook.
    expect(edge).not.toMatch(/new Date\(/);

    const core = withoutComments(await readFile(new URL("./portable-backup.ts", import.meta.url), "utf8"));
    expect(core).not.toMatch(/localStorage|new Date\(/);
  });

  it("the hook never uploads anything, anywhere", async () => {
    const code = withoutComments(await hook());
    expect(code).not.toMatch(/fetch\(|XMLHttpRequest|sendBeacon|WebSocket|axios/);
    // A backup that could be posted somewhere would stop being a file under the person's control.
    expect(code).not.toMatch(/https?:\/\//);
  });

  it("only confirmImport writes, and it needs a plan prepareImport produced", async () => {
    const code = withoutComments(await hook());
    const confirm = code.slice(code.indexOf("const confirmImport"));
    expect(confirm).toMatch(/applyRestore\(browserStorage, plan\)/);
    const prepare = code.slice(code.indexOf("const prepareImport"), code.indexOf("const confirmImport"));
    expect(prepare).not.toMatch(/applyRestore|setItem|removeItem/);
  });

  it("the export uses only APIs available beyond Chromium, and revokes its URL out of band", async () => {
    // Block 14. No File System Access API, no vendor prefix, and the object URL is not revoked in
    // the same task as the click — the pattern Safari has historically cancelled downloads for.
    const code = withoutComments(await hook());
    expect(code).not.toMatch(/showSaveFilePicker|showOpenFilePicker|FileSystemWritableFileStream|webkit|msSave/);
    expect(code).toMatch(/new Blob\(/);
    expect(code).toMatch(/URL\.createObjectURL/);
    expect(code).toMatch(/setTimeout\(\(\) => URL\.revokeObjectURL\(url\), 0\)/);
    // The anchor must be in the document when clicked; a detached one is ignored on iOS.
    const exportFn = code.slice(code.indexOf("const exportBackup"), code.indexOf("const prepareImport"));
    expect(exportFn.indexOf("document.body.appendChild")).toBeLessThan(exportFn.indexOf("anchor.click()"));
  });

  it("a successful restore ends in a reload, because the in-memory trip is stale", async () => {
    // Without this the next heart pressed would write the PREVIOUS trip over the imported one.
    const code = withoutComments(await hook());
    expect(code).toMatch(/window\.location\.reload\(\)/);
  });
});

describe("Block 13 — the copy promises a file, never a service", () => {
  const ui = () => readFile(new URL("../components/TripBackup.tsx", import.meta.url), "utf8");

  it("never says synchronised, connected, cloud, account or shared", async () => {
    // Comments stripped first: the file's own doc comment exists to DENY those words, and matching
    // documentation rather than copy is the false positive Block 10 hit three times.
    const text = withoutComments(await ui());
    for (const word of ["sincroniz", "conectad", "la nube", "Cuenta", "iniciar sesión", "compartido autom"]) {
      expect(text.toLowerCase()).not.toContain(word.toLowerCase());
    }
  });

  it("says plainly that importing replaces", async () => {
    const text = await ui();
    expect(text).toMatch(/sustituir/i);
    expect(text).toMatch(/No se combinan/i);
  });

  it("says the file stays on the device", async () => {
    expect(await ui()).toMatch(/No se envía a ningún sitio/i);
  });
});
