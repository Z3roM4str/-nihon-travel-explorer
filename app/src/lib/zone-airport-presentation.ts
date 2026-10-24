import type { ZoneAirportLink } from "./accommodation-zone";

/**
 * Block 8 — how an airport link is worded, so "directo" cannot be read two ways.
 *
 * The panel used to render one word for the whole question: `directo` or `con enlace`. Both were
 * ambiguous. "Directo" did not say direct *by what* — a limousine bus and a Narita Express got the
 * same label although one is bound by traffic and the other by a timetable — and "con enlace" did
 * not say what the enlace was, a connection or a change.
 *
 * `directFromZone` has one meaning, unchanged since Block 3 and now written down: **the service
 * named in this record runs between the zone and the airport with no change.** It is a statement
 * about that one service, and it is mode-agnostic — the dataset has marked a coach direct since
 * Block 3, and that was always right.
 *
 * So the label names both halves: the mode, and whether a change is needed. Nothing here ranks a
 * mode above another. A coach is not worse than a train; it is a different journey, and the
 * traveller is the one who decides which they want.
 */

/** The short label beside the airport, e.g. "tren directo" or "autobús con transbordo". */
export function airportLinkConnection(link: ZoneAirportLink): string {
  const vehicle = link.mode === "bus" ? "autobús" : "tren";
  return link.directFromZone ? `${vehicle} directo` : `${vehicle} con transbordo`;
}

/**
 * The spelled-out version, for assistive technology and for anyone who wants the plain sentence.
 *
 * It says the thing the short label leaves implicit — that "directo" means no change at all, and
 * that the alternative needs at least one — because "direct" is exactly the word a reader can
 * reasonably take two ways.
 */
export function airportLinkDescription(link: ZoneAirportLink): string {
  const vehicle = link.mode === "bus" ? "autobús" : "tren";
  const change = link.directFromZone
    ? "sin transbordos"
    : "requiere al menos un transbordo";
  return `${link.airport}: ${link.service}. En ${vehicle}, ${change}.`;
}

/** A stable identity for one link inside one zone. Two records may share an airport — that is how
 * a zone says "a direct coach AND a rail route with a change" — so the airport alone is not a key. */
export function airportLinkKey(link: ZoneAirportLink): string {
  return `${link.airport}::${link.service}`;
}
