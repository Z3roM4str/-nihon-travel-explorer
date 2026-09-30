import type { AccommodationAnchor, DayAccommodationBoundary } from "./accommodation-commute";
import type { ZoneDayLink } from "./zone-plan-link";

/**
 * B27 (B9.1, `05 §7`, `04 §14`) — the pure presentation rules behind `DayTimeline`.
 *
 * Everything here is a READ over state the planner already owns. Nothing is stored, nothing is
 * derived that the planning modules do not already derive, and no day id, order or transfer is
 * produced: the day list, its ordinal, its places, its boundary and its date arrive as arguments
 * exactly as `OrderedSequenceBuilder` already computes them.
 */

/** «mié 24 feb» — the short civil date used in a day headline. `iso` is a valid `YYYY-MM-DD` the
 * draft already validated; an unparsable string is echoed rather than guessed at. */
export function formatCivilDateShort(iso: string, locale: string = "es"): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  })
    .format(date)
    .replace(/[.,]/g, "");
}

/** «22 feb – 5 mar» — the trip range in the tab header (`05 §7` item 1). Both ends must exist; a
 * single known bound reads as «desde …» / «hasta …» rather than inventing the other one. */
export function formatTripRangeShort(startDate: string | null, endDate: string | null): string | null {
  const day = (iso: string) => formatCivilDateShort(iso).replace(/^\S+\s/, "");
  if (startDate && endDate) return `${day(startDate)} – ${day(endDate)}`;
  if (startDate) return `desde el ${day(startDate)}`;
  if (endDate) return `hasta el ${day(endDate)}`;
  return null;
}

/**
 * The city part of a day headline. It is the catalogue's own `Place.hub` of the day's places —
 * a fact — and never a guess: an empty day has none, a one-hub day names it, and a day whose
 * places span several hubs lists exactly those hubs (`ZoneDayLink.hubs`, in the day's own order)
 * instead of picking one to stand for the day.
 */
export function dayCityLabel(hubs: readonly string[]): string | null {
  if (hubs.length === 0) return null;
  if (hubs.length === 1) return hubs[0];
  return `${hubs.slice(0, -1).join(", ")} y ${hubs[hubs.length - 1]}`;
}

/** «Día 3 · mié 24 feb · Kioto» — parts that are unknown are simply left out. */
export function dayHeadline(ordinal: number, dateShort: string | null, city: string | null): string {
  return [`Día ${ordinal}`, dateShort, city].filter((part): part is string => Boolean(part)).join(" · ");
}

export function stopCountText(count: number): string {
  return count === 1 ? "1 parada" : `${count} paradas`;
}

/** «7 sitios sin día» — the handle of the «Sin asignar» drawer (`05 §7` item 4). */
export function unassignedCountText(count: number): string {
  return count === 1 ? "1 sitio sin día" : `${count} sitios sin día`;
}

export type DaySleepLine =
  | { kind: "chosen"; zoneOrPlace: string }
  | { kind: "none" };

/**
 * The «Dormís en …» footer of a day (`05 §7` item 3).
 *
 * Only what the reader already chose is named:
 *  1. the accommodation anchor picked for THIS day's end — the zone's name when that anchor is the
 *     zone's own station, otherwise the anchor's label;
 *  2. failing that, the accommodation zone the reader chose for the day's single hub.
 * A day whose end is `unselected`/`no-accommodation` and whose hub has no zone choice says
 * «Sin alojamiento elegido». Nothing is inferred from neighbouring days, nothing is defaulted.
 */
export function daySleepLine(
  boundary: DayAccommodationBoundary | null,
  link: Pick<ZoneDayLink, "chosenZone"> | null,
  accommodations: readonly AccommodationAnchor[]
): DaySleepLine {
  const end = boundary?.end;
  if (end && end.kind === "accommodation") {
    const zoneAnchor = link?.chosenZone;
    if (zoneAnchor && zoneAnchor.accommodationId === end.accommodationId && zoneAnchor.zone) {
      return { kind: "chosen", zoneOrPlace: zoneAnchor.zone.name };
    }
    const anchor = accommodations.find((entry) => entry.id === end.accommodationId);
    if (anchor) return { kind: "chosen", zoneOrPlace: anchor.label };
  }
  if (link?.chosenZone?.zone && (!end || end.kind === "unselected")) {
    return { kind: "chosen", zoneOrPlace: link.chosenZone.zone.name };
  }
  return { kind: "none" };
}

export type MoveDestination = {
  dayIndex: number;
  /** How many places the target day would hold AFTER the move. */
  positions: number;
};

/**
 * «Mover a…» (B27 conservation bridge; B9.2 owns the full reordering system). Given the day a
 * place currently sits in and the size of every day, lists the explicit (day, position) targets.
 * Within its own day a place can take any of the `n` slots; in another day it can take any of the
 * `m + 1` slots (before the first … after the last).
 */
export function moveTargets(dayPlaceCounts: readonly number[], fromDayIndex: number): MoveDestination[] {
  return dayPlaceCounts.map((count, dayIndex) => ({
    dayIndex,
    positions: dayIndex === fromDayIndex ? count : count + 1,
  }));
}
