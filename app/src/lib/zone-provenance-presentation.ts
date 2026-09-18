import type { ZoneProvenance, ZoneSourceTier } from "./accommodation-zone";

/**
 * Block 7 — how a zone's sources are named on screen.
 *
 * The comparison panel used to render one link whose entire text was the word "Fuente". The reader
 * could not tell an airport operator's own access page from an encyclopedia article without
 * opening it, which is the one thing a provenance line exists to tell them. These helpers give the
 * link a name and say how close that source is to what it describes.
 *
 * Nothing here judges a zone, and the tier is never presented as a quality score: it says where a
 * statement comes from, not whether the zone is a good place to sleep.
 */

/**
 * The short, readable name of a source.
 *
 * `sourceEntity` is written for an auditor — "Narita International Airport — acceso ferroviario
 * (operador del aeropuerto)" — and the qualification after the dash or comma is what the tier
 * already says on screen. This takes the part before it, and falls back to the whole string rather
 * than to anything invented.
 */
export function sourceName(source: ZoneProvenance): string {
  const head = source.sourceEntity.split(/\s+—\s+|,/)[0].trim();
  return head.length > 0 ? head : source.sourceEntity.trim();
}

/** What the tier means, in words. Never rendered as a colour alone, and never as a number. */
export function tierLabel(tier: ZoneSourceTier): string {
  switch (tier) {
    case "operator":
      return "operador";
    case "authority":
      return "organismo oficial";
    case "official-tourism":
      return "turismo oficial";
    case "secondary":
      return "fuente secundaria";
  }
}

/**
 * The accessible name for one source link.
 *
 * It carries the zone, because the same source legitimately backs several zones and a screen
 * reader listing "Narita International Airport" four times would not say which column each
 * belonged to. It also carries the consultation date, which the visible line keeps short.
 */
export function sourceLinkLabel(source: ZoneProvenance, zoneName: string): string {
  return `${sourceName(source)} — ${tierLabel(source.tier)}, fuente de ${zoneName}, consultada el ${source.consultedAt}`;
}
