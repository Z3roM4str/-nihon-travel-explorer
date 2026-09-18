import zonesDoc from "../data/accommodation/zones.json";
import type { Place } from "../types";

/**
 * The accommodation-zone comparison layer.
 *
 * A zone is **not** a `Place` and **not** a cluster. `docs/ACCOMMODATION_COMMUTE_DESIGN.md`
 * settled that boundary: accommodation is a separate entity and must not be overloaded onto a
 * tourism POI merely because both have coordinates. This module keeps the same discipline —
 * it reads the zone registry and the places catalogue, and never writes a zone into a route,
 * a day assignment, or the transfer graph.
 *
 * Two kinds of statement live here and are deliberately never mixed:
 *
 * * **Facts** come from `zones.json` with provenance and are passed through untouched.
 * * **Editorial** is Nihon's own judgement on a 1–5 ordinal scale.
 * * **Derived** values are computed here from canonical coordinates. They are *straight-line*
 *   distances, and the naming says so everywhere, because this repository has no runtime
 *   routing and a walking/transit time would be an invention. `lib/transfer.ts` stays the only
 *   source of real travel times, and it is deliberately not consulted: it answers
 *   place→place for recorded edges, and no recorded edge starts at a zone.
 */

export type ZoneAnchor = { label: string; lat: number; lng: number; kind: "station" };

export type ZoneShinkansen = {
  served: boolean;
  nearestStation?: string;
  lines?: string[];
  note?: string;
};

export type ZoneAirportLink = { airport: string; service: string; directFromZone: boolean };

/**
 * The three kinds of checkable claim a zone makes. Block 7 named them so a source can say which
 * of them it actually supports, instead of one record standing silently behind all three.
 */
export type ZoneFactArea = "railLines" | "shinkansen" | "airportLinks";

export const ZONE_FACT_AREAS: readonly ZoneFactArea[] = [
  "railLines",
  "shinkansen",
  "airportLinks",
];

/**
 * How close a source is to the thing it describes — Block 7's authority ladder, in order.
 *
 * `operator` is the company or airport that runs the service being claimed; `authority` a public
 * body; `official-tourism` an official destination or administration site; `secondary` anything
 * else, including an encyclopedia. The tier is stored rather than inferred from the host, because
 * "is this the operator" is a judgement about the claim, not a fact about a domain name.
 *
 * A higher tier never makes a source correct. It is only worth preferring when it genuinely
 * supports the same claim — see `evidence`, which is where that is recorded.
 */
export type ZoneSourceTier = "operator" | "authority" | "official-tourism" | "secondary";

/** Best first. Used only to pick which source to show; never to score or rank a zone. */
export const ZONE_SOURCE_TIERS: readonly ZoneSourceTier[] = [
  "operator",
  "authority",
  "official-tourism",
  "secondary",
];

export type ZoneProvenance = {
  sourceUrl: string;
  sourceEntity: string;
  consultedAt: string;
  evidence: string;
  /** How close this source is to what it describes. */
  tier: ZoneSourceTier;
  /**
   * Which fact areas this source supports. Never empty.
   *
   * Two sources may both cover an area: that means each supports *some* claim in it, not that
   * either supports all of them. `evidence` is what says which. Listing an area a source does not
   * actually speak to would be the exact failure this field exists to prevent.
   */
  covers: ZoneFactArea[];
};

export type ZoneFacts = {
  railLines: string[];
  shinkansen: ZoneShinkansen;
  airportLinks: ZoneAirportLink[];
  /** The zone's station-level source. Present on every zone since Block 3. */
  provenance: ZoneProvenance;
  /**
   * Further sources, each scoped by `covers`. Additive: a zone without one is exactly the Block 3
   * record it always was. Block 7 uses it to put an airport or service operator behind the airport
   * links that were previously carried by the station's encyclopedia article alone.
   */
  sources?: ZoneProvenance[];
};

/** Every axis is ordinal 1–5. Higher always means "more of the named thing". */
export type ZoneEditorial = {
  nightlife: number;
  food: number;
  quiet: number;
  walkability: number;
  tourismIntensity: number;
  luggageEase: number;
  firstVisit: number;
  shortStay: number;
  lateArrival: number;
  earlyDeparture: number;
};

export type AccommodationZone = {
  id: string;
  hub: string;
  name: string;
  japaneseName: string;
  summary: string;
  anchor: ZoneAnchor;
  facts: ZoneFacts;
  editorial: ZoneEditorial;
  tradeoffs: string[];
  servesClusters: string[];
};

const ZONES: AccommodationZone[] = (zonesDoc as { zones: AccommodationZone[] }).zones;

export function getZones(): AccommodationZone[] {
  return ZONES;
}

export function getZonesForHub(hub: string): AccommodationZone[] {
  return ZONES.filter((zone) => zone.hub === hub);
}

export function getZoneById(id: string): AccommodationZone | undefined {
  return ZONES.find((zone) => zone.id === id);
}

// ── Provenance ────────────────────────────────────────────────────────────────────────────────

/**
 * Every source behind a zone's facts, station-level record first, in declaration order.
 *
 * Reading order is deliberately stable and not sorted: the data says what it says, and a list that
 * reordered itself would make two zones with the same sources look different.
 */
export function zoneSources(zone: AccommodationZone): ZoneProvenance[] {
  return [zone.facts.provenance, ...(zone.facts.sources ?? [])];
}

/** The sources that support claims in one fact area, in declaration order. */
export function sourcesForFactArea(
  zone: AccommodationZone,
  area: ZoneFactArea
): ZoneProvenance[] {
  return zoneSources(zone).filter((source) => source.covers.includes(area));
}

/**
 * The most authoritative source for one fact area, or `null` when nothing covers it.
 *
 * Ties are broken by declaration order rather than by anything clever, so the answer is stable and
 * a reader can find it in the file. This picks which source to *show*; it never decides whether a
 * claim is true, and it produces no number.
 */
export function bestSourceForFactArea(
  zone: AccommodationZone,
  area: ZoneFactArea
): ZoneProvenance | null {
  let best: ZoneProvenance | null = null;
  let bestRank = Number.POSITIVE_INFINITY;
  for (const source of sourcesForFactArea(zone, area)) {
    const rank = ZONE_SOURCE_TIERS.indexOf(source.tier);
    const resolved = rank === -1 ? ZONE_SOURCE_TIERS.length : rank;
    if (resolved < bestRank) {
      best = source;
      bestRank = resolved;
    }
  }
  return best;
}

/**
 * The distinct sources a zone rests on, for display: one entry per `sourceUrl`, first wins.
 *
 * The saved surface shows source *names*, and two entries pointing at the same page would read as
 * two independent confirmations of the same claim, which they are not.
 */
export function distinctZoneSources(zone: AccommodationZone): ZoneProvenance[] {
  const seen = new Set<string>();
  const out: ZoneProvenance[] = [];
  for (const source of zoneSources(zone)) {
    if (seen.has(source.sourceUrl)) continue;
    seen.add(source.sourceUrl);
    out.push(source);
  }
  return out;
}

/** Hubs this layer models. Deliberately a subset: a hub without zones offers no comparison. */
export function hubsWithZones(): string[] {
  return [...new Set(ZONES.map((zone) => zone.hub))];
}

const EARTH_RADIUS_KM = 6371;

/** Great-circle distance. Geometry, not a route — see the module note. */
export function straightLineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/**
 * Coarse bands rather than a number with decimals.
 *
 * A straight-line distance in Tokyo is a weak proxy for how long the trip takes — the rail
 * network, not the crow, decides that. Bands say what the geometry can honestly support
 * ("this is on your doorstep" / "this is across the city") without implying a travel time the
 * dataset cannot justify.
 */
export type ProximityBand = "doorstep" | "near" | "moderate" | "far";

export const PROXIMITY_BANDS: Record<ProximityBand, { maxKm: number; label: string; hint: string }> = {
  doorstep: { maxKm: 1.5, label: "A pie", hint: "Menos de 1,5 km en línea recta" },
  near: { maxKm: 4, label: "Cerca", hint: "1,5–4 km en línea recta" },
  moderate: { maxKm: 10, label: "Media distancia", hint: "4–10 km en línea recta" },
  far: { maxKm: Infinity, label: "Lejos", hint: "Más de 10 km en línea recta" },
};

export function proximityBand(km: number): ProximityBand {
  if (km <= PROXIMITY_BANDS.doorstep.maxKm) return "doorstep";
  if (km <= PROXIMITY_BANDS.near.maxKm) return "near";
  if (km <= PROXIMITY_BANDS.moderate.maxKm) return "moderate";
  return "far";
}

export type ZoneSavedPlacesFit = {
  zoneId: string;
  /** Saved places in this zone's hub — the only ones a zone here can speak to. */
  consideredCount: number;
  byBand: Record<ProximityBand, number>;
  /** Median straight-line distance, in km, or null when nothing was considered. */
  medianKm: number | null;
  /** The saved places closest to this zone, nearest first. */
  nearest: { placeId: string; name: string; km: number; band: ProximityBand }[];
};

/**
 * How a zone relates to the places the user actually saved.
 *
 * This is the layer's real argument: not "which zone is best" — nothing here declares that —
 * but "given what you two already chose, here is where each zone puts you". Only saved places
 * in the zone's own hub are considered; a saved place in Kioto says nothing about a Tokyo zone
 * and including it would quietly turn the median into noise.
 */
export function zoneSavedPlacesFit(
  zone: AccommodationZone,
  savedPlaces: Place[],
  nearestLimit = 3
): ZoneSavedPlacesFit {
  const relevant = savedPlaces.filter((place) => place.hub === zone.hub);
  const measured = relevant
    .map((place) => ({
      placeId: place.id,
      name: place.name,
      km: straightLineKm(zone.anchor, place.coordinates),
    }))
    .sort((a, b) => a.km - b.km);

  const byBand: Record<ProximityBand, number> = { doorstep: 0, near: 0, moderate: 0, far: 0 };
  for (const entry of measured) byBand[proximityBand(entry.km)] += 1;

  let medianKm: number | null = null;
  if (measured.length > 0) {
    const mid = Math.floor(measured.length / 2);
    medianKm =
      measured.length % 2 === 0 ? (measured[mid - 1].km + measured[mid].km) / 2 : measured[mid].km;
  }

  return {
    zoneId: zone.id,
    consideredCount: measured.length,
    byBand,
    medianKm,
    nearest: measured.slice(0, nearestLimit).map((entry) => ({
      ...entry,
      band: proximityBand(entry.km),
    })),
  };
}

/**
 * Ranks zones by how close they sit to the user's saved places.
 *
 * Returned in order, but the order is explicitly *not* a verdict: it answers one question
 * (proximity to a list the user wrote) and says nothing about whether the reader would rather
 * sleep somewhere quiet, or cheap, or next to the Shinkansen. The UI presents it as an answer
 * to that one question and never as "the best zone".
 *
 * Zones with nothing to measure sort last rather than first, so an empty saved list does not
 * silently produce a winner.
 */
export function rankZonesBySavedPlaces(
  zones: AccommodationZone[],
  savedPlaces: Place[]
): { zone: AccommodationZone; fit: ZoneSavedPlacesFit }[] {
  return zones
    .map((zone) => ({ zone, fit: zoneSavedPlacesFit(zone, savedPlaces) }))
    .sort((a, b) => {
      if (a.fit.medianKm === null && b.fit.medianKm === null) return 0;
      if (a.fit.medianKm === null) return 1;
      if (b.fit.medianKm === null) return -1;
      return a.fit.medianKm - b.fit.medianKm;
    });
}

/** Axis labels, and what a high score means, so the UI never has to guess. */
export const EDITORIAL_AXES: {
  key: keyof ZoneEditorial;
  label: string;
  high: string;
  group: "carácter" | "conveniencia";
}[] = [
  { key: "food", label: "Comer", high: "Mucha y variada oferta a pie", group: "carácter" },
  { key: "nightlife", label: "Vida nocturna", high: "Mucha actividad de noche", group: "carácter" },
  { key: "quiet", label: "Tranquilidad", high: "Se duerme sin ruido de calle", group: "carácter" },
  { key: "walkability", label: "Se camina bien", high: "Mucho alcanzable a pie", group: "carácter" },
  { key: "tourismIntensity", label: "Saturación turística", high: "Muy concurrido", group: "carácter" },
  { key: "luggageEase", label: "Con maletas", high: "Fácil llegar con equipaje", group: "conveniencia" },
  { key: "firstVisit", label: "Primera visita", high: "Buena base para conocer la ciudad", group: "conveniencia" },
  { key: "shortStay", label: "Estancia corta", high: "Rinde en pocos días", group: "conveniencia" },
  { key: "lateArrival", label: "Llegada nocturna", high: "Cómodo llegar tarde", group: "conveniencia" },
  { key: "earlyDeparture", label: "Salida temprana", high: "Cómodo salir pronto", group: "conveniencia" },
];

/**
 * Axes where a *higher* number is not automatically better.
 *
 * `tourismIntensity` is the clear case: some readers want the buzz and some are fleeing it.
 * The UI must not colour it as "good", and no composite score may fold it in — which is why
 * this module deliberately exposes no overall score at all.
 */
export const NEUTRAL_AXES: ReadonlySet<keyof ZoneEditorial> = new Set([
  "tourismIntensity",
  "nightlife",
]);

/**
 * Where two zones genuinely differ on an axis, largest gap first.
 *
 * A comparison that lists ten near-identical rows teaches nothing. This surfaces the axes
 * where the choice actually costs something, which is the whole point of the screen.
 */
export function editorialContrasts(
  zones: AccommodationZone[],
  minSpread = 2
): { key: keyof ZoneEditorial; label: string; spread: number; high: string }[] {
  if (zones.length < 2) return [];
  return EDITORIAL_AXES.map((axis) => {
    const values = zones.map((zone) => zone.editorial[axis.key]);
    return { ...axis, spread: Math.max(...values) - Math.min(...values) };
  })
    .filter((axis) => axis.spread >= minSpread)
    .sort((a, b) => b.spread - a.spread);
}
