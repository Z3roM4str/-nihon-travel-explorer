import type { MinuteRange } from "./duration";
import { resolveDuration } from "./duration";
import type { PlanningBlock } from "./planning-block";
import { PLANNING_BLOCKS, blockKind, classifyPlanningBlock } from "./planning-block";
import { getPrefectureByCode, resolvePrefecture } from "../data/geography";
import type { Place } from "../types";

/**
 * Selection Intelligence: pure, descriptive aggregation over a set of places.
 *
 * Everything here takes a `Place[]` and returns numbers — never saved ids, never React
 * state, never storage. That is what lets the same functions describe a saved selection
 * today and a hub, a region or a route candidate later.
 *
 * Two invariants are carried by the types rather than by discipline:
 *   1. `visitTime` only ever accumulates quantified durations. Day-scale commitments are
 *      counted in `commitments` and never converted to minutes.
 *   2. Every total is a range. Sums add minima to minima and maxima to maxima; no average,
 *      median or midpoint ever collapses the uncertainty the editorial data carries.
 *
 * Nothing computed here is persisted. Saved ids remain the only stored user state.
 */

/** Places of one day-scale block, kept out of every hour total. */
export type Commitment = {
  block: PlanningBlock;
  places: Place[];
  count: number;
};

export type SelectionSummary = {
  savedCount: number;
  /** Sum of the quantified durations only; null when nothing in the set is quantified. */
  visitTime: MinuteRange | null;
  /** How many places contributed to `visitTime`. */
  quantifiedCount: number;
  /** Day-scale commitments, heaviest first, never folded into `visitTime`. */
  commitments: Commitment[];
  /** Total places across `commitments`. */
  commitmentCount: number;
  /** Places whose duration could not be classified at all. */
  withoutEstimate: Place[];
  /**
   * Every place contributing no minutes to `visitTime` — the day-scale commitments plus the
   * unclassifiable ones. This is what "sin estimación numérica" means to a reader, and it is
   * the list shown with each place's original editorial text.
   */
  nonQuantified: Place[];
};

/** Day-scale blocks in the order they are reported: heaviest commitment first. */
const COMMITMENT_ORDER: PlanningBlock[] = [
  "overnight-plus",
  "full-day",
  "half-to-full-day",
  "half-day",
];

export function summarizeSelection(places: Place[]): SelectionSummary {
  let minMinutes = 0;
  let maxMinutes = 0;
  let quantifiedCount = 0;
  const byCommitment = new Map<PlanningBlock, Place[]>();
  const withoutEstimate: Place[] = [];

  for (const place of places) {
    const block = classifyPlanningBlock(place.duration);
    const kind = blockKind(block);

    if (kind === "day-scale") {
      const list = byCommitment.get(block);
      if (list) list.push(place);
      else byCommitment.set(block, [place]);
      continue;
    }

    // A quantified block always resolves to a range; checking rather than asserting keeps
    // the sum honest if the classifier and the parser ever disagree.
    const range = kind === "quantified" ? resolveDuration(place.duration) : null;
    if (!range) {
      withoutEstimate.push(place);
      continue;
    }
    minMinutes += range.minMinutes;
    maxMinutes += range.maxMinutes;
    quantifiedCount += 1;
  }

  const commitments = COMMITMENT_ORDER.filter((block) => byCommitment.has(block)).map((block) => {
    const list = byCommitment.get(block) as Place[];
    return { block, places: list, count: list.length };
  });

  return {
    savedCount: places.length,
    visitTime: quantifiedCount > 0 ? { minMinutes, maxMinutes } : null,
    quantifiedCount,
    commitments,
    commitmentCount: commitments.reduce((total, entry) => total + entry.count, 0),
    withoutEstimate,
    nonQuantified: [...commitments.flatMap((entry) => entry.places), ...withoutEstimate],
  };
}

/** Distribution across the blocks actually present, in taxonomy order. */
export function blockDistribution(places: Place[]): Array<{ block: PlanningBlock; count: number }> {
  const counts = new Map<PlanningBlock, number>();
  for (const place of places) {
    const block = classifyPlanningBlock(place.duration);
    counts.set(block, (counts.get(block) ?? 0) + 1);
  }
  return PLANNING_BLOCKS.map((block) => ({ block, count: counts.get(block) ?? 0 })).filter(
    (entry) => entry.count > 0
  );
}

/**
 * A group of the selection along one dimension. `places` holds the very same `Place`
 * objects the store handed out — groups partition references, they never clone the dataset.
 */
export type SelectionGroup<K extends string = string> = {
  key: K;
  label: string;
  places: Place[];
  summary: SelectionSummary;
};

function buildGroups<K extends string>(
  places: Place[],
  keyOf: (place: Place) => K | null,
  labelOf: (key: K, place: Place) => string
): SelectionGroup<K>[] {
  const buckets = new Map<K, Place[]>();
  const labels = new Map<K, string>();

  for (const place of places) {
    const key = keyOf(place);
    if (key === null) continue;
    const list = buckets.get(key);
    if (list) {
      list.push(place);
    } else {
      buckets.set(key, [place]);
      labels.set(key, labelOf(key, place));
    }
  }

  return [...buckets.entries()]
    .map(([key, list]) => ({
      key,
      label: labels.get(key) as string,
      places: list,
      summary: summarizeSelection(list),
    }))
    .sort((a, b) => b.places.length - a.places.length || a.label.localeCompare(b.label, "es"));
}

export function groupByHub(places: Place[]): SelectionGroup[] {
  return buildGroups(
    places,
    (place) => place.hub,
    (hub) => hub
  );
}

/**
 * Physical location, resolved through the geographic layer rather than by treating
 * `place.prefecture` as a label — the same join Phase 2C uses, so a hub's excursions land in
 * the prefecture they are really in.
 */
export function groupByPrefecture(places: Place[]): SelectionGroup[] {
  return buildGroups(
    places,
    (place) => resolvePrefecture(place.prefecture)?.code ?? null,
    (code) => getPrefectureByCode(code)?.displayName ?? code
  );
}

/**
 * Cluster membership is authoritative from the place itself: hub + cluster. The exported
 * `clusters.json` carries its own id lists and counts, but those are secondary metadata that
 * has drifted from the places, so nothing here reads them. Hub is part of the key because
 * cluster names being globally unique today is an accident of the dataset, not a guarantee.
 */
export type ClusterKey = string;

export function clusterKey(place: Place): ClusterKey {
  return `${place.hub}|${place.cluster}`;
}

export function groupByCluster(places: Place[]): SelectionGroup<ClusterKey>[] {
  return buildGroups(
    places,
    (place) => (place.cluster ? clusterKey(place) : null),
    (_key, place) => place.cluster
  );
}

/** The prefecture a group's places sit in, when they all agree on one. */
export function groupPrefectureName(group: SelectionGroup<string>): string | null {
  const codes = new Set<string>();
  for (const place of group.places) {
    const prefecture = resolvePrefecture(place.prefecture);
    if (prefecture) codes.add(prefecture.code);
  }
  if (codes.size !== 1) return null;
  const [code] = [...codes];
  return getPrefectureByCode(code)?.displayName ?? null;
}

/**
 * Factual concentration and spread of one hub's saved places across its clusters.
 *
 * Both readings are counts of what the user picked, nothing more. There is no distance, no
 * travel time and no judgement: Phase 3A treats a cluster as a grouping, not as a claim
 * about proximity in time.
 */
export type ConcentrationReport = {
  hub: string;
  savedCount: number;
  distinctClusters: number;
  singletonClusters: number;
  /** Clusters ordered by saved count, largest first. */
  clusters: SelectionGroup<ClusterKey>[];
  /** Smallest leading set of clusters reaching CONCENTRATION_SHARE of the hub. */
  topClusters: SelectionGroup<ClusterKey>[];
  topShare: number;
  dispersionRatio: number;
  hasConcentration: boolean;
  hasDispersion: boolean;
};

/** Nothing is stated about a hub the user has barely invested in. */
export const CONCENTRATION_MIN_SAVED = 4;
/** The leading clusters must cover this share of the hub before anything is stated. */
export const CONCENTRATION_SHARE = 0.6;
/** Proportion of one-place clusters at which the spread is worth stating. */
export const DISPERSION_RATIO = 0.7;

export function concentration(hub: string, places: Place[]): ConcentrationReport {
  const clusters = groupByCluster(places);
  const savedCount = places.length;
  const singletonClusters = clusters.filter((group) => group.places.length === 1).length;

  const topClusters: SelectionGroup<ClusterKey>[] = [];
  let covered = 0;
  for (const group of clusters) {
    if (savedCount > 0 && covered / savedCount >= CONCENTRATION_SHARE) break;
    topClusters.push(group);
    covered += group.places.length;
  }

  const topShare = savedCount > 0 ? covered / savedCount : 0;
  const dispersionRatio = clusters.length > 0 ? singletonClusters / clusters.length : 0;
  const eligible = savedCount >= CONCENTRATION_MIN_SAVED;

  return {
    hub,
    savedCount,
    distinctClusters: clusters.length,
    singletonClusters,
    clusters,
    topClusters,
    topShare,
    dispersionRatio,
    // Two guards keep the statement meaningful rather than arithmetically true. Needing
    // every cluster to reach the share describes the whole hub, not a concentration; and a
    // leading set built from one-place clusters is just the selection listed back, which is
    // what the dispersion reading is for.
    hasConcentration:
      eligible &&
      topShare >= CONCENTRATION_SHARE &&
      topClusters.length < clusters.length &&
      topClusters.every((group) => group.places.length > 1),
    hasDispersion: eligible && dispersionRatio >= DISPERSION_RATIO,
  };
}
