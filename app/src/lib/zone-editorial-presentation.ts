import { NEUTRAL_AXES, type ZoneEditorial } from "./accommodation-zone";

/**
 * Block 9 — who owns a zone's editorial rating, and how it says so on screen.
 *
 * ## The governance contract, in one place
 *
 * A **zone editorial rating** is Nihon's own judgement about a neighbourhood, on a closed 1–5
 * ordinal scale, authored with the dataset and shipped with it. Three things follow, and this
 * module exists so that all three are stated rather than assumed:
 *
 * 1. **Nihon owns it.** No traveller can change it, and there is deliberately no editor. It is
 *    product content, in the same sense as a zone's name or its written drawbacks.
 * 2. **It is not a fact.** A fact carries provenance and could in principle be checked against a
 *    source; a rating cannot, and the validator refuses provenance inside `editorial` precisely so
 *    the two can never be confused. Nothing about the transport data behind a zone lends any
 *    weight to the judgement beside it.
 * 3. **It is not either traveller's preference.** Block 5 settled that exactly one thing in this
 *    app is personal — *does this person want to go here* — and a rating is not it. A rating says
 *    what a neighbourhood is like; wanting to go is what a person feels about it. The two can
 *    disagree freely and neither corrects the other.
 *
 * ## What Block 9 changed, and what it deliberately did not
 *
 * Block 3 recorded the debt as "the ratings have had no second reader": sixteen zones times ten
 * axes, authored in one pass, never peer-reviewed. That is a request for **human review of the
 * judgements**, not for the app to store a rating per traveller — which would contradict the rule
 * above and would answer a question nobody asked.
 *
 * So no editor was built. What this module does instead is make a rating **reviewable**: every
 * ordinal says it is criterio rather than a measurement, every axis says which direction means
 * what, and the axes where more is not better say so in words instead of in a colour.
 *
 * There is still no composite score anywhere, and there never should be: `tourismIntensity` and
 * `nightlife` have no good direction, so any total would have to pretend they did.
 */

/** Who authors and owns an editorial rating. There is exactly one answer, by design. */
export const EDITORIAL_OWNER = "Nihon" as const;

/**
 * The accessible reading of one ordinal.
 *
 * It used to be the bare string `"3 de 5"`, which to a screen reader is indistinguishable from a
 * measurement — the same shape as "3 of 5 platforms". Naming the owner is what makes it a stated
 * judgement, and it is the smallest change that does so.
 */
export function ratingAccessibleText(value: number): string {
  return `${value} de 5 · criterio de ${EDITORIAL_OWNER}`;
}

/** Which direction the marks run, for one axis. The model already knows; this is where it is said. */
export function axisDirectionHint(high: string): string {
  return `Más marcas = ${high.toLowerCase()}`;
}

/**
 * Whether an axis has a "better" direction at all.
 *
 * Some readers want a lively street and some are escaping one. An axis without a good direction
 * must never be coloured or worded as if it had one.
 */
export function axisHasNoGoodDirection(key: keyof ZoneEditorial): boolean {
  return NEUTRAL_AXES.has(key);
}

/** Said in words beside a neutral axis, because a muted colour is not a statement. */
export const NEUTRAL_AXIS_NOTE = "ni bueno ni malo";

/**
 * The one-sentence disclosure for the surface that shows every rating.
 *
 * It answers, without the reader needing to know the schema, the two questions this block exists
 * to make answerable: who decided this, and how does it relate to wanting to go.
 */
export function editorialDisclosure(): string {
  return (
    `Estas diez valoraciones son el criterio de ${EDITORIAL_OWNER}, no datos verificables ni la ` +
    `opinión de ninguno de los dos: describen cómo es la zona, no si queréis ir. No se pueden editar.`
  );
}
