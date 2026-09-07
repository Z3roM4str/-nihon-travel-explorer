import type { Place } from "../types";
import { interpretPlaceHours, type RecordedHoursFact } from "./recorded-hours";

/**
 * Phase 3D-E — route-level recorded-hours planning summary.
 *
 * A small, pure aggregation over an explicit, user-ordered list of places (the current canonical
 * route, Phase 3C-A), composing `recorded-hours.ts`'s `RecordedHoursFact` per place without
 * merging it with anything else — no closure state (Phase 3D-B), no `bestTime`, no `febMar2027`,
 * no `startDate` or derived day date. See `recorded-hours.ts`'s own doc for the exact product
 * boundary this stays inside.
 *
 * **Unlike `reservation-planning.ts`, no place is ever omitted.** Every route place has hours
 * information relevant to planning — even when the honest signal is "variable," "depends on an
 * outside operator," or "unknown" — so `items` always has exactly one entry per input place. There
 * is nothing here analogous to `reservation-planning.ts`'s `not-applicable` omission rule.
 *
 * **A duplicate `place.id` in `places` is a fail-loud invariant violation, not a case this module
 * silently repairs** — the same convention `reservation-planning.ts` established (see its own doc
 * for the rationale: the canonical persisted route is supposed to be duplicate-free already, so a
 * duplicate reaching this function means an upstream invariant already regressed, and silently
 * deduplicating would hide that defect instead of surfacing it).
 */

export type RecordedHoursPlanningItem = {
  placeId: string;
  placeName: string;
  hours: RecordedHoursFact;
};

export type RecordedHoursSummary = {
  /** Count of items whose hours fact is `"recorded-24h"` or `"recorded-interval"` (tier `safe`). */
  safeCount: number;
  /** Count of items whose hours fact is `"conditional"` (tier `partial`). */
  conditionalCount: number;
  /** Count of items whose hours fact is `"external-dependency"` (tier `opaque`). */
  externalDependencyCount: number;
  /** Count of items whose hours fact is `"unknown"` (tier `unknown`). */
  unknownCount: number;
  /**
   * Exactly the input places' order — never resorted by opening time, closing time, tier,
   * category, "urgency," duration, or reservation state. Reordering the input route changes this
   * order; it never changes what any individual item says.
   */
  items: RecordedHoursPlanningItem[];
};

/**
 * Builds the recorded-hours summary for `places` in exactly the order given. Every place produces
 * exactly one item — nothing is omitted, regardless of tier.
 *
 * @throws {Error} if the same `place.id` appears more than once in `places` — see the module doc
 * above for why this is a fail-loud invariant rather than a silent deduplication. The error names
 * the exact duplicate id. A valid, duplicate-free input's behavior is completely unaffected by
 * this guard.
 */
export function buildRecordedHoursSummary(places: readonly Place[]): RecordedHoursSummary {
  const items: RecordedHoursPlanningItem[] = [];
  let safeCount = 0;
  let conditionalCount = 0;
  let externalDependencyCount = 0;
  let unknownCount = 0;
  const seenIds = new Set<string>();

  for (const place of places) {
    if (seenIds.has(place.id)) {
      throw new Error(`buildRecordedHoursSummary: duplicate place id in route: ${place.id}`);
    }
    seenIds.add(place.id);

    const hours = interpretPlaceHours(place);
    items.push({ placeId: place.id, placeName: place.name, hours });

    if (hours.kind === "recorded-24h" || hours.kind === "recorded-interval") {
      safeCount += 1;
    } else if (hours.kind === "conditional") {
      conditionalCount += 1;
    } else if (hours.kind === "external-dependency") {
      externalDependencyCount += 1;
    } else {
      unknownCount += 1;
    }
  }

  return { safeCount, conditionalCount, externalDependencyCount, unknownCount, items };
}
