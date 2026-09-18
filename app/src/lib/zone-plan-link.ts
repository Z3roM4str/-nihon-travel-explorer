import type { Place } from "../types";
import type { AccommodationAnchor, DayAccommodationBoundary } from "./accommodation-commute";
import {
  getZoneById,
  proximityBand,
  straightLineKm,
  type AccommodationZone,
  type ProximityBand,
} from "./accommodation-zone";
import {
  findZoneChoiceForAnchor,
  findZoneChoiceForHub,
  type ZoneAccommodationChoice,
} from "./zone-accommodation-choice";

/**
 * Block 4 — what a chosen zone actually means for the days the user has planned.
 *
 * This module is the only place where the zone registry, the planning draft's zone choices and the
 * day plan meet. It answers three questions and refuses a fourth:
 *
 * 1. **Which hub is this day in?** A fact, read from `Place.hub` in the catalogue.
 * 2. **Is that hub's chosen zone the accommodation this day is actually planned from?** A fact
 *    about the user's own boundary choices — not a recommendation.
 * 3. **How far are this day's places from the chosen zone's station?** Straight-line geometry, in
 *    the same coarse bands `accommodation-zone.ts` already uses, and labelled as derived.
 *
 * The fourth question — *how long would that take* — has no honest answer here and is not
 * attempted. This repository has no runtime routing; `lib/transfer.ts` answers place→place for
 * recorded edges only and no recorded edge starts at a zone or at an anchor. Every minute figure in
 * the accommodation model stays exactly what `docs/ACCOMMODATION_COMMUTE_DESIGN.md` approved: a
 * number the user typed for one exact directed leg. Nothing in this file produces, estimates,
 * widens or converts a minute, and nothing here calls `getBestTransfer`.
 *
 * It also refuses to rank. A zone does not make a day better, shorter or more sensible, and there
 * is no verdict, score or "recommended" flag in any type below — only the geometry, and what the
 * user chose.
 */

/** A choice resolved against the live registry. `zone: null` is the honest state for a stored
 * choice whose zone is no longer in the catalogue — the decision is still the user's, we simply
 * cannot describe it any more, and nothing is deleted behind their back. */
export type ResolvedZoneChoice = {
  hub: string;
  zoneId: string;
  accommodationId: string;
  zone: AccommodationZone | null;
  anchor: AccommodationAnchor | null;
};

export function resolveZoneChoice(
  choice: ZoneAccommodationChoice,
  accommodations: readonly AccommodationAnchor[]
): ResolvedZoneChoice {
  return {
    hub: choice.hub,
    zoneId: choice.zoneId,
    accommodationId: choice.accommodationId,
    zone: getZoneById(choice.zoneId) ?? null,
    anchor: accommodations.find((entry) => entry.id === choice.accommodationId) ?? null,
  };
}

export function resolveZoneChoices(
  choices: readonly ZoneAccommodationChoice[],
  accommodations: readonly AccommodationAnchor[]
): ResolvedZoneChoice[] {
  return choices.map((choice) => resolveZoneChoice(choice, accommodations));
}

/**
 * What one side of one day's boundary is doing, expressed relative to that hub's chosen zone.
 *
 * `other-anchor` is deliberately a first-class, neutral state rather than a warning. A user who
 * chose a zone AND keeps a hand-made anchor for some days has done nothing wrong, and this layer's
 * job is to make that legible — never to "fix" it by rebinding the boundary.
 */
export type ZoneBoundarySideUse =
  | { kind: "empty-day" }
  | { kind: "unselected" }
  | { kind: "no-accommodation" }
  | { kind: "zone-anchor"; accommodationId: string }
  | {
      kind: "other-anchor";
      accommodationId: string;
      /** Set when that other anchor was itself seeded by a zone, and which hub's. Lets the UI say
       * "this Kioto day is planned from a Tokio zone's station" as a fact, without blocking it. */
      seededByZoneForHub: string | null;
    };

export type ZoneDayBoundaryUse = {
  start: ZoneBoundarySideUse;
  end: ZoneBoundarySideUse;
};

function sideUse(
  side: DayAccommodationBoundary["start"],
  dayIsEmpty: boolean,
  zoneAccommodationId: string | null,
  choices: readonly ZoneAccommodationChoice[]
): ZoneBoundarySideUse {
  if (dayIsEmpty) return { kind: "empty-day" };
  if (side.kind === "unselected") return { kind: "unselected" };
  if (side.kind === "no-accommodation") return { kind: "no-accommodation" };
  if (zoneAccommodationId !== null && side.accommodationId === zoneAccommodationId) {
    return { kind: "zone-anchor", accommodationId: side.accommodationId };
  }
  const seeding = findZoneChoiceForAnchor(choices, side.accommodationId);
  return {
    kind: "other-anchor",
    accommodationId: side.accommodationId,
    seededByZoneForHub: seeding ? seeding.hub : null,
  };
}

/** One place's straight-line distance from the zone's station. Geometry, never a travel time. */
export type ZoneDayProximityEntry = {
  placeId: string;
  placeName: string;
  km: number;
  band: ProximityBand;
};

export type ZoneDayProximity = {
  zoneId: string;
  anchorLabel: string;
  /** This day's places, in the day's own order — not re-sorted into a ranking. */
  entries: ZoneDayProximityEntry[];
  medianKm: number | null;
  byBand: Record<ProximityBand, number>;
};

/**
 * One day, seen through the zone decision that applies to it.
 *
 * `hubs` lists every hub the day's places belong to. `singleHub` is non-null only when they all
 * agree, and a zone is attached ONLY then: a day that straddles Tokio and Kioto has no single
 * accommodation hub, and claiming one would be exactly the kind of invented logistics this block
 * is forbidden to produce. The day is still reported, with `chosenZone: null` and the reason
 * visible in `hubs`.
 */
export type ZoneDayLink = {
  dayOrdinal: number;
  placeIds: readonly string[];
  hubs: string[];
  singleHub: string | null;
  chosenZone: ResolvedZoneChoice | null;
  boundaryUse: ZoneDayBoundaryUse;
  proximity: ZoneDayProximity | null;
};

export type ZoneDayLinkInput = {
  placeIds: readonly string[];
  accommodationBoundary: DayAccommodationBoundary;
};

export type ZonePlanLinkDependencies = {
  resolvePlace: (placeId: string) => Place | null;
};

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Builds the per-day view for every day in the plan.
 *
 * Pure, and free of both the dataset and the registry at its edges: places arrive through
 * `resolvePlace` and the zone through the choice's own id, so tests drive it with fixtures.
 */
export function buildZoneDayLinks(
  days: readonly ZoneDayLinkInput[],
  choices: readonly ZoneAccommodationChoice[],
  accommodations: readonly AccommodationAnchor[],
  dependencies: ZonePlanLinkDependencies
): ZoneDayLink[] {
  return days.map((day, dayOrdinal) => {
    const places = day.placeIds
      .map((placeId) => dependencies.resolvePlace(placeId))
      .filter((place): place is Place => place !== null);
    const hubs = [...new Set(places.map((place) => place.hub))];
    const singleHub = hubs.length === 1 ? hubs[0] : null;

    const rawChoice = singleHub ? findZoneChoiceForHub(choices, singleHub) : null;
    const chosenZone = rawChoice ? resolveZoneChoice(rawChoice, accommodations) : null;
    const zoneAccommodationId = chosenZone ? chosenZone.accommodationId : null;
    const dayIsEmpty = day.placeIds.length === 0;

    let proximity: ZoneDayProximity | null = null;
    if (chosenZone?.zone && places.length > 0) {
      const zoneAnchor = chosenZone.zone.anchor;
      const entries = places.map((place) => {
        const km = straightLineKm(zoneAnchor, place.coordinates);
        return { placeId: place.id, placeName: place.name, km, band: proximityBand(km) };
      });
      const byBand: Record<ProximityBand, number> = { doorstep: 0, near: 0, moderate: 0, far: 0 };
      for (const entry of entries) byBand[entry.band] += 1;
      proximity = {
        zoneId: chosenZone.zoneId,
        anchorLabel: zoneAnchor.label,
        entries,
        medianKm: median(entries.map((entry) => entry.km)),
        byBand,
      };
    }

    return {
      dayOrdinal,
      placeIds: day.placeIds,
      hubs,
      singleHub,
      chosenZone,
      boundaryUse: {
        start: sideUse(day.accommodationBoundary.start, dayIsEmpty, zoneAccommodationId, choices),
        end: sideUse(day.accommodationBoundary.end, dayIsEmpty, zoneAccommodationId, choices),
      },
      proximity,
    };
  });
}

/**
 * Per-hub rollup: for each chosen zone, which days it actually applies to and how many of their
 * boundary sides are planned from it.
 *
 * These are counts of the user's own decisions, not a completeness score and not a nudge. A zone
 * that no day uses yet is a perfectly valid state — the user may have decided where to sleep long
 * before deciding which day starts where.
 */
export type ZoneHubLink = {
  hub: string;
  choice: ResolvedZoneChoice;
  dayOrdinals: number[];
  sidesPlannedFromZone: number;
  sidesPlannedFromAnotherAnchor: number;
  sidesUnselected: number;
  sidesNoAccommodation: number;
};

export function buildZoneHubLinks(
  dayLinks: readonly ZoneDayLink[],
  choices: readonly ZoneAccommodationChoice[],
  accommodations: readonly AccommodationAnchor[]
): ZoneHubLink[] {
  return choices.map((choice) => {
    const link: ZoneHubLink = {
      hub: choice.hub,
      choice: resolveZoneChoice(choice, accommodations),
      dayOrdinals: [],
      sidesPlannedFromZone: 0,
      sidesPlannedFromAnotherAnchor: 0,
      sidesUnselected: 0,
      sidesNoAccommodation: 0,
    };
    for (const day of dayLinks) {
      if (day.singleHub !== choice.hub) continue;
      link.dayOrdinals.push(day.dayOrdinal);
      for (const side of [day.boundaryUse.start, day.boundaryUse.end]) {
        if (side.kind === "zone-anchor") link.sidesPlannedFromZone += 1;
        else if (side.kind === "other-anchor") link.sidesPlannedFromAnotherAnchor += 1;
        else if (side.kind === "unselected") link.sidesUnselected += 1;
        else if (side.kind === "no-accommodation") link.sidesNoAccommodation += 1;
      }
    }
    return link;
  });
}
