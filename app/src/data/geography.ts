import prefectureData from "./prefectures.json";
import { getAllPlaces } from "./store";
import type { Place } from "../types";

/**
 * Geographic layer, deliberately kept separate from the tourism dataset.
 *
 * A hub is an editorial/travel grouping ("explore this from Osaka"). A prefecture is real
 * administrative geography. A navigation region is a product-level grouping of prefectures.
 * They are not interchangeable: a hub routinely contains places that sit physically in
 * another prefecture — and sometimes in another region entirely. Everything here is keyed on
 * the 2-digit prefecture code so the map polygons and the tourism data are joined by code
 * rather than by fragile string comparison.
 */

export type NavigationRegion =
  | "Hokkaido"
  | "Tohoku"
  | "Kanto"
  | "Chubu"
  | "Kansai"
  | "Chugoku"
  | "Shikoku"
  | "Kyushu"
  | "Okinawa";

export type Prefecture = {
  /** JIS X 0401 prefecture code, zero-padded to 2 digits. Joins metadata to the GeoJSON. */
  code: string;
  japaneseName: string;
  /** Name Nihon shows in the interface (Spanish editorial spelling where one exists). */
  displayName: string;
  region: NavigationRegion;
  /** Extra spellings accepted when resolving `place.prefecture`; language/transliteration only. */
  aliases?: string[];
};

/**
 * Navigation taxonomy used by the Nihon interface. These are the conventional eight
 * geographic regions of Japan with Okinawa split out from Kyushu, which is how a traveller
 * reads the country. They are a product-level grouping for browsing, not an official
 * administrative division — see docs/GEOGRAPHY.md.
 */
export const NAVIGATION_REGIONS: NavigationRegion[] = [
  "Hokkaido",
  "Tohoku",
  "Kanto",
  "Chubu",
  "Kansai",
  "Chugoku",
  "Shikoku",
  "Kyushu",
  "Okinawa",
];

const prefectures = prefectureData as Prefecture[];

const prefecturesByCode = new Map(prefectures.map((pref) => [pref.code, pref]));

/** Case/diacritic-insensitive key so "Kioto", "Kyoto" and "KYOTO" all land on the same entry. */
function normalizeKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

/**
 * Lookup table from any accepted spelling of a prefecture to its code. Built from the
 * display name, the Japanese name and the explicit alias list — never from guesswork, so an
 * unknown tourism value fails loudly instead of being silently mapped somewhere plausible.
 */
const codeByName = new Map<string, string>();
for (const pref of prefectures) {
  for (const name of [pref.displayName, pref.japaneseName, ...(pref.aliases ?? [])]) {
    codeByName.set(normalizeKey(name), pref.code);
  }
}

export function getNavigationRegions(): NavigationRegion[] {
  return NAVIGATION_REGIONS;
}

export function getPrefectures(): Prefecture[] {
  return prefectures;
}

export function getPrefectureByCode(code: string): Prefecture | undefined {
  return prefecturesByCode.get(code);
}

export function getPrefecturesByRegion(region: NavigationRegion): Prefecture[] {
  return prefectures.filter((pref) => pref.region === region);
}

/** Resolves a `place.prefecture` value to its canonical prefecture, or undefined. */
export function resolvePrefecture(name: string): Prefecture | undefined {
  const code = codeByName.get(normalizeKey(name));
  return code ? prefecturesByCode.get(code) : undefined;
}

export type HubContribution = {
  hub: string;
  /** Places of that hub physically located in the prefecture/region being described. */
  placeCount: number;
};

export type PrefectureCoverage = {
  prefecture: Prefecture;
  placeCount: number;
  /** Hubs that contain places physically located here, most places first. */
  hubs: HubContribution[];
};

function buildCoverage(places: Place[]): Map<string, PrefectureCoverage> {
  const coverage = new Map<string, PrefectureCoverage>();
  const hubCounts = new Map<string, Map<string, number>>();

  for (const place of places) {
    const pref = resolvePrefecture(place.prefecture);
    // Unresolvable values are a data defect, not something to paper over here; the
    // reproducible check lives in scripts/validate-geography.py.
    if (!pref) continue;

    const entry = coverage.get(pref.code);
    if (entry) entry.placeCount += 1;
    else coverage.set(pref.code, { prefecture: pref, placeCount: 1, hubs: [] });

    const hubs = hubCounts.get(pref.code) ?? new Map<string, number>();
    hubs.set(place.hub, (hubs.get(place.hub) ?? 0) + 1);
    hubCounts.set(pref.code, hubs);
  }

  for (const [code, hubs] of hubCounts) {
    const entry = coverage.get(code);
    if (!entry) continue;
    entry.hubs = [...hubs.entries()]
      .map(([hub, placeCount]) => ({ hub, placeCount }))
      .sort((a, b) => b.placeCount - a.placeCount || a.hub.localeCompare(b.hub, "es"));
  }

  return coverage;
}

/**
 * Coverage is derived from the real dataset on every load — no counts are ever written down
 * here, so refreshing the workbook is enough to change what the national map shows.
 */
const coverageByCode = buildCoverage(getAllPlaces());

/** Coverage for one prefecture, or null when Nihon has no verified place there yet. */
export function getPrefectureCoverage(code: string): PrefectureCoverage | null {
  return coverageByCode.get(code) ?? null;
}

export function getCoveredPrefectureCodes(): string[] {
  return [...coverageByCode.keys()].sort();
}

/** Number of verified places physically located in a prefecture. 0 when uncovered. */
export function countPlacesInPrefecture(code: string): number {
  return coverageByCode.get(code)?.placeCount ?? 0;
}

/** Hubs holding places physically located in a prefecture, most places first. */
export function getHubsForPrefecture(code: string): HubContribution[] {
  return coverageByCode.get(code)?.hubs ?? [];
}

export type RegionSummary = {
  region: NavigationRegion;
  prefectures: Prefecture[];
  coveredPrefectureCodes: string[];
  placeCount: number;
  hubs: HubContribution[];
};

const regionSummaries = new Map<NavigationRegion, RegionSummary>(
  NAVIGATION_REGIONS.map((region) => {
    const regionPrefectures = getPrefecturesByRegion(region);
    const hubTotals = new Map<string, number>();
    let placeCount = 0;
    const coveredPrefectureCodes: string[] = [];

    for (const pref of regionPrefectures) {
      const coverage = coverageByCode.get(pref.code);
      if (!coverage) continue;
      coveredPrefectureCodes.push(pref.code);
      placeCount += coverage.placeCount;
      for (const { hub, placeCount: count } of coverage.hubs) {
        hubTotals.set(hub, (hubTotals.get(hub) ?? 0) + count);
      }
    }

    const hubs = [...hubTotals.entries()]
      .map(([hub, count]) => ({ hub, placeCount: count }))
      .sort((a, b) => b.placeCount - a.placeCount || a.hub.localeCompare(b.hub, "es"));

    return [region, { region, prefectures: regionPrefectures, coveredPrefectureCodes, placeCount, hubs }];
  })
);

export function getRegionSummary(region: NavigationRegion): RegionSummary {
  // Every region in NAVIGATION_REGIONS is pre-computed above, so this is always defined.
  return regionSummaries.get(region) as RegionSummary;
}

export function getRegionSummaries(): RegionSummary[] {
  return NAVIGATION_REGIONS.map(getRegionSummary);
}

/** Hubs with at least one place physically located inside the region, most places first. */
export function getHubsForRegion(region: NavigationRegion): HubContribution[] {
  return getRegionSummary(region).hubs;
}

export type NationalSummary = {
  prefectureCount: number;
  coveredPrefectureCount: number;
  placeCount: number;
  regionCount: number;
  coveredRegionCount: number;
};

/** Headline numbers for the national view, all derived from the dataset. */
export function getNationalSummary(): NationalSummary {
  const summaries = getRegionSummaries();
  return {
    prefectureCount: prefectures.length,
    coveredPrefectureCount: coverageByCode.size,
    placeCount: [...coverageByCode.values()].reduce((total, entry) => total + entry.placeCount, 0),
    regionCount: NAVIGATION_REGIONS.length,
    coveredRegionCount: summaries.filter((summary) => summary.placeCount > 0).length,
  };
}
