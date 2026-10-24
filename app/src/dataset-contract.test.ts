import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import places from "./data/places.json";

/**
 * Block 3 A2. `imageStatus` was exported as the literal `"brief-only"` for all 214 places,
 * unconditionally, and nothing ever read it. Once photography existed the field was not merely
 * uninformative but false — it said "no photograph" about 157 places that have one, and it
 * misled the Block 1 handoff into telling a future session it identified the uncovered set.
 *
 * It was removed rather than re-derived. Whether a place has a photograph is answered
 * authoritatively by `photography-metadata.json`; re-deriving that into `places.json` would
 * create a second source of truth free to drift, and the workbook exporter neither knows nor
 * should know about the photography pipeline.
 *
 * These tests stop it coming back, and stop the same mistake being made in a new field.
 */

type Place = Record<string, unknown> & { id: string };
const rows = places as Place[];

describe("imageStatus is gone and stays gone", () => {
  it("appears on no place", () => {
    expect(rows.filter((place) => "imageStatus" in place).map((place) => place.id)).toEqual([]);
  });

  it("is not reintroduced by the exporter", async () => {
    const source = await readFile(new URL("../../scripts/export-dataset.py", import.meta.url), "utf8");
    expect(source).not.toMatch(/^\s*"imageStatus"\s*:/m);
  });

  it("is not declared on the Place type", async () => {
    const source = await readFile(new URL("./types.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/^\s*imageStatus\s*[?:]/m);
  });
});

describe("the dataset carries no other field that is constant across every place", () => {
  /**
   * The defect that made `imageStatus` harmful was not its name: it was a column with exactly
   * one distinct value pretending to be information. This finds any other, so the next one is
   * caught when it is added rather than two blocks later.
   *
   * Genuinely-constant fields are listed explicitly — each is a real, meaningful constant
   * rather than an unimplemented status.
   */
  const ALLOWED_CONSTANTS = new Set<string>([
    // Every place in the catalogue is priced in yen. A fact, not a stub.
    "currency",
    // The workbook's own revision date, shared by every row because the whole dataset was
    // exported from one revision. It is shown in the place detail ("Datos actualizados el …")
    // and moves when the workbook does, so it is real information that happens to be uniform.
    "updatedAt",
  ]);

  function flatten(value: unknown, prefix: string, out: Map<string, Set<string>>) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
        flatten(inner, prefix ? `${prefix}.${key}` : key, out);
      }
      return;
    }
    if (Array.isArray(value)) return;
    const set = out.get(prefix) ?? new Set<string>();
    set.add(JSON.stringify(value));
    out.set(prefix, set);
  }

  it("has no single-valued scalar field outside the allowed list", () => {
    const values = new Map<string, Set<string>>();
    for (const place of rows) flatten(place, "", values);
    const constant = [...values.entries()]
      .filter(([path, set]) => set.size === 1 && !ALLOWED_CONSTANTS.has(path.split(".").pop() ?? path))
      // A field that is empty everywhere is a different problem (missing data, not a fake
      // status) and is not what this test polices.
      .filter(([, set]) => ![`""`, "null"].includes([...set][0]))
      .map(([path, set]) => `${path} = ${[...set][0]}`);
    expect(constant).toEqual([]);
  });
});

describe("the fields the application actually reads all survived", () => {
  it("keeps every field the UI depends on", () => {
    const required = [
      "id", "hub", "region", "prefecture", "municipality", "neighborhood", "cluster",
      "name", "mapTitle", "category", "type", "grade", "description", "differentiator",
      "experience", "duration", "bestTime", "bestSeason", "crowdLevel", "tourismLevel",
      "price", "reservation", "schedule", "transport", "accessibility", "coordinates",
      "officialUrl", "googleMapsUrl", "imageBrief", "nearbyIds", "updatedAt", "febMar2027",
    ];
    for (const place of rows) {
      const missing = required.filter((field) => !(field in place));
      expect({ id: place.id, missing }).toEqual({ id: place.id, missing: [] });
    }
  });

  it("still has 214 places", () => {
    expect(rows).toHaveLength(214);
  });
});
