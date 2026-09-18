import type {
  DivergenceEntry,
  DivergenceGroupKind,
  ShortlistFilterCounts,
  ShortlistFilterKind,
} from "./interest-divergence";
import type { Traveller } from "./travellers";

/**
 * Block 6 — the words for the derived view, and the discipline they keep.
 *
 * Every string here is a statement of something one of the two people actually pressed, or of
 * something the planner actually holds. Nothing is a verdict, a recommendation, a rating or an
 * instruction. The vocabulary is Block 5's, reused rather than reinvented: "Los dos", "Sólo
 * <nombre>", "no le interesa", "Sin reclamar" all already mean something on screen.
 *
 * The line Block 6 adds is **"Opiniones distintas"**, and it is used for exactly one situation:
 * somebody wants to go and somebody else has explicitly said they do not. A place one person has
 * saved and the other has simply not looked at is never described that way, because nothing has
 * been disagreed with yet. That is the whole reason the two live in separate kinds.
 *
 * Not written anywhere in this file, and forbidden by test: a percentage, a score, a compatibility
 * figure, "conflicto", "deberíais", "mejor opción", or any sentence that cannot be traced straight
 * back to a stored stance.
 */

function labelOf(travellers: readonly Traveller[], activeTravellerId: string | null): string {
  const other = travellers.find((entry) => entry.id !== activeTravellerId);
  return other ? other.label : "La otra persona";
}

/** The short name of a filter chip. `all` says what the list is, not how good it is. */
export function filterLabel(filter: ShortlistFilterKind): string {
  switch (filter) {
    case "all":
      return "Todo";
    case "agreed":
      return "Los dos";
    case "only-one":
      return "Sólo uno";
    case "differing":
      return "Opiniones distintas";
    case "unclaimed":
      return "Sin reclamar";
  }
}

/**
 * The accessible name of a filter chip: what it selects and how many there are.
 *
 * The count is in the accessible name because the visible badge beside the label is a number with
 * no subject, and a screen-reader user should not have to infer what it counts.
 */
export function filterAccessibleName(filter: ShortlistFilterKind, count: number): string {
  const plural = count === 1 ? "lugar" : "lugares";
  switch (filter) {
    case "all":
      return `Ver los ${count} ${plural} de la lista`;
    case "agreed":
      return `Ver los ${count} ${plural} que queréis los dos`;
    case "only-one":
      return `Ver los ${count} ${plural} que quiere sólo una persona`;
    case "differing":
      return `Ver los ${count} ${plural} con opiniones distintas`;
    case "unclaimed":
      return `Ver los ${count} ${plural} que nadie ha reclamado`;
  }
}

/**
 * One row's line inside a FILTERED view — never in the default one.
 *
 * In "Todo" the list stays exactly as Block 5 left it, markers and all, so the everyday view gains
 * no second indicator. The moment the reader asks a narrower question this line answers it in
 * full, from their own side, naming silence as silence.
 */
export function divergenceLine(
  group: DivergenceGroupKind,
  travellers: readonly Traveller[],
  activeTravellerId: string | null
): string {
  const other = labelOf(travellers, activeTravellerId);
  const alone = travellers.length < 2;
  switch (group) {
    case "agreed":
      return "Los dos quieren ir.";
    case "only-you":
      return alone ? "Sólo tú lo guardaste." : `Sólo tú lo guardaste. ${other} aún no ha opinado.`;
    case "only-them":
      return `Sólo ${other} lo guardó. Tú aún no has opinado.`;
    case "differing":
      return "Opiniones distintas: una persona quiere ir y la otra ha dicho que no le interesa.";
    case "unclaimed":
      return "Estaba en la lista antes de crear los perfiles. Nadie ha dicho todavía si le interesa.";
  }
}

/**
 * The note for a place the planner already holds, or `null` when there is nothing to add.
 *
 * `null` for an agreed place, because "los dos quieren ir y está planificado" is not news. It is
 * a statement of where the place already is, followed by the fact that reading this screen does
 * not move it — the boundary between a preference and a planning decision, said out loud.
 */
export function plannedNote(entry: DivergenceEntry): string | null {
  if (!entry.planned) return null;
  if (entry.group === "agreed") return null;
  return "Ya está en un día del recorrido. Esto no lo cambia.";
}

/**
 * The line under the filter row, stating what the reader is looking at.
 *
 * It renders only while a filter is active, so the default view keeps the single tally sentence
 * Block 5 gave it and gains nothing.
 */
export function filterStatusSentence(filter: ShortlistFilterKind, shown: number): string {
  if (filter === "all") return "";
  if (shown === 0) return emptyFilterSentence(filter);
  const plural = shown === 1 ? "lugar" : "lugares";
  switch (filter) {
    case "agreed":
      return `${shown} ${plural} que queréis los dos.`;
    case "only-one":
      return `${shown} ${plural} que quiere sólo una persona. Nadie ha dicho que no.`;
    case "differing":
      return `${shown} ${plural} con opiniones distintas.`;
    case "unclaimed":
      return `${shown} ${plural} que nadie ha reclamado todavía.`;
  }
}

/**
 * The empty state, one sentence per filter, each a fact rather than an absence.
 *
 * `differing` is the one the block was built for: **no explicit disagreement exists**, said
 * plainly and without implying that silence elsewhere is one.
 */
export function emptyFilterSentence(filter: ShortlistFilterKind): string {
  switch (filter) {
    case "all":
      return "Todavía no habéis guardado nada.";
    case "agreed":
      return "Todavía no hay ningún lugar que queráis los dos.";
    case "only-one":
      return "No hay ningún lugar que quiera sólo una persona.";
    case "differing":
      return "No hay opiniones distintas: nadie ha dicho que no a un lugar que la otra persona quiere.";
    case "unclaimed":
      return "No queda ningún lugar sin reclamar.";
  }
}

/**
 * The one-line header for the whole derived view, used as the filter group's accessible label.
 *
 * It counts, and stops there: a place with one opinion and a place with two opposed opinions are
 * reported as what they are, and the reader decides what that means.
 */
export function divergenceHeading(counts: ShortlistFilterCounts): string {
  if (counts.all === 0) return "Todavía no habéis guardado nada.";
  if (counts.differing === 0 && counts["only-one"] === 0 && counts.unclaimed === 0) {
    return "Filtrar la lista. Ahora mismo coincidís en todo lo guardado.";
  }
  return "Filtrar la lista por lo que ha dicho cada persona.";
}
