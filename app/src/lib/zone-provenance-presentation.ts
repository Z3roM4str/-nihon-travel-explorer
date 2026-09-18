import type { ZoneProvenance, ZoneSourceTier } from "./accommodation-zone";
import { formatCivilDateDisplay } from "./civil-date";
import { freshnessFor, type SourceFreshnessState } from "./source-freshness";

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
export function sourceLinkLabel(
  source: ZoneProvenance,
  zoneName: string,
  freshnessText?: string
): string {
  /*
   * The consultation date stays LAST, and `freshnessText` is inserted before the zone rather than
   * appended. Block 7's audit pins this name with a `$`-anchored regex ending on the date, and
   * that anchor is worth keeping: it is what guarantees the date is not quietly buried mid-string
   * by some later addition. Block 10 had information to add, so it fitted the existing shape
   * instead of asking a historical gate to relax.
   */
  const freshness = freshnessText ? `, ${freshnessText}` : "";
  return `${sourceName(source)} — ${tierLabel(source.tier)}${freshness}, fuente de ${zoneName}, consultada el ${source.consultedAt}`;
}

/**
 * Block 10 — the discreet note beside a source that is due for a look, or `null`.
 *
 * `null` is the everyday answer, by design: with nothing past its horizon the source line renders
 * exactly as Block 7 left it. The same rule Block 5 applied to the card marker and Block 9 to the
 * ratings — say something only when it is something the reader does not already know.
 *
 * The wording is the whole point of this block. "Conviene volver a comprobarla" is a statement
 * about *our* checking, not about the claim: an old check has not been contradicted, it has simply
 * not been repeated. Nothing here says wrong, outdated, unreliable or error, and the audit forbids
 * that vocabulary.
 */
export function recheckNote(source: ZoneProvenance, today: string): string | null {
  return freshnessFor(source, today).state === "needs-recheck"
    ? "conviene volver a comprobarla"
    : null;
}

/**
 * The spelled-out freshness for assistive technology, appended to the link's accessible name.
 *
 * A screen-reader user gets the date either way; this says what the date *means*, which is the
 * thing sighted readers infer from the note's absence.
 */
export function freshnessAccessibleText(state: SourceFreshnessState): string {
  switch (state) {
    case "current":
      return "comprobada recientemente";
    case "needs-recheck":
      return "conviene volver a comprobarla; no significa que el dato sea incorrecto";
    case "no-periodic-recheck":
      return "no necesita comprobaciones periódicas";
    case "recheck-interval-unknown":
      // Block 11. Unreachable from a zone source — zone fact areas resolve only to a horizon or to
      // none — but this function takes a bare state, so the branch is required and is written to be
      // correct rather than to silence the compiler. It says both halves and neither more: the
      // claim can move, and Nihon is not pretending to know when to look again.
      return "puede cambiar sin aviso; Nihon no fija cada cuánto volver a comprobarla";
  }
}

/** The consultation date, written the way the rest of the app writes a date. */
export function consultedOnText(source: ZoneProvenance): string {
  return `Comprobada el ${formatCivilDateDisplay(source.consultedAt)}`;
}
