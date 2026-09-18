import {
  isInShortlist,
  summarizeInterest,
  type PlaceInterestSummary,
  type TravellersDocumentV1,
} from "./travellers";

/**
 * Block 6 — "dónde no coincidimos": a DERIVED view over the state Block 5 already stores.
 *
 * ## It creates nothing
 *
 * There is no new document, no new storage key, no new stance and no new planning decision in this
 * file. Every value it returns is computed on read from `TravellersDocumentV1` plus, for one
 * purely informational flag, the list of places the shared planner has already put in a day. If
 * the two-person layer were deleted tomorrow this module would have nothing left to say, which is
 * the correct dependency direction: it is a lens, not a second truth.
 *
 * ## Absence of an opinion is not a disagreement
 *
 * The one distinction this whole block exists to preserve:
 *
 * | what happened | what it is |
 * |---|---|
 * | *yo quiero ir / tú aún no has opinado* | **falta una opinión** — `only-you` / `only-them` |
 * | *yo quiero ir / tú has dicho que no*   | **opiniones distintas** — `differing` |
 *
 * Collapsing those two into one bucket called "desacuerdo" would tell the reader that their
 * travelling companion has rejected a place they have not even looked at. They stay separate
 * kinds, with separate copy and separate counts, and only `differing` is ever worded as a
 * difference of opinion. `hasDifferingOpinions` is deliberately about `differing` alone.
 *
 * ## It decides nothing
 *
 * No score, no percentage, no ranking, no matching, no "deberíais quitarlo", no suggestion that
 * either person give way, and no automatic edit to the route, the days, the dates, the anchors,
 * the zones, the legs or the segments. A place the planner already holds is reported as held —
 * `planned` — and that is the end of it. **Una preferencia no es una decisión de planificación**,
 * and this module reads the planner without ever writing to it.
 *
 * There is deliberately no function here that returns a number per place, and no ordering other
 * than the one the shortlist already has.
 */

/**
 * What the two of them have said about one shortlisted place, from the ACTIVE reader's side.
 *
 * The reader's side matters because "sólo tú" and "sólo la otra persona" are the same stored
 * state seen from two chairs, and the copy for each is different. Everything else is symmetric.
 */
export type DivergenceGroupKind =
  /** Every traveller said they want to go. */
  | "agreed"
  /** The reader wants to go; nobody else has said anything. */
  | "only-you"
  /** Somebody else wants to go; the reader has said nothing. */
  | "only-them"
  /** At least one wants to go and at least one said explicitly that they do not. */
  | "differing"
  /** In the list from before the profiles existed, and still nobody's stated opinion. */
  | "unclaimed";

export type DivergenceEntry = {
  placeId: string;
  group: DivergenceGroupKind;
  /**
   * The shared planner has already put this place in a day.
   *
   * Information, and only information. It never changes the group, never removes the place, never
   * reorders anything and never becomes a suggestion — a planning decision and a preference are
   * different kinds of statement and Block 4's remains the one that decides where a place goes.
   */
  planned: boolean;
};

/** The filter the reader can actually press. `only-one` covers both sides of "sólo lo quiere una
 * persona", because which of the two it is belongs on the row, not on a second chip. */
export type ShortlistFilterKind = "all" | "agreed" | "only-one" | "differing" | "unclaimed";

export const SHORTLIST_FILTERS: readonly ShortlistFilterKind[] = [
  "all",
  "agreed",
  "only-one",
  "differing",
  "unclaimed",
];

function groupFor(
  summary: PlaceInterestSummary,
  activeTravellerId: string | null
): DivergenceGroupKind | null {
  switch (summary.kind) {
    case "both":
      return "agreed";
    case "unclaimed":
      return "unclaimed";
    case "split":
      return "differing";
    case "only":
      return summary.interestedId === activeTravellerId ? "only-you" : "only-them";
    // Neither reaches the shortlist, so neither reaches this view.
    case "none":
    case "declined":
      return null;
  }
}

/**
 * The whole view, in the order the shortlist already has.
 *
 * Shortlist order is the order places entered it — the same order the saved list renders — so this
 * view never reorders anything and never introduces an ordering rule the reader cannot see. A
 * place that is not in the shortlist is not here at all.
 */
export function divergenceEntries(
  document: TravellersDocumentV1,
  plannedPlaceIds: readonly string[] = []
): DivergenceEntry[] {
  const planned = new Set(plannedPlaceIds);
  const entries: DivergenceEntry[] = [];
  for (const interest of document.interests) {
    if (!isInShortlist(interest)) continue;
    const group = groupFor(
      summarizeInterest(document, interest.placeId),
      document.activeTravellerId
    );
    if (group === null) continue;
    entries.push({ placeId: interest.placeId, group, planned: planned.has(interest.placeId) });
  }
  return entries;
}

export function matchesShortlistFilter(
  entry: DivergenceEntry,
  filter: ShortlistFilterKind
): boolean {
  switch (filter) {
    case "all":
      return true;
    case "only-one":
      return entry.group === "only-you" || entry.group === "only-them";
    case "agreed":
      return entry.group === "agreed";
    case "differing":
      return entry.group === "differing";
    case "unclaimed":
      return entry.group === "unclaimed";
  }
}

export type ShortlistFilterCounts = Record<ShortlistFilterKind, number>;

/** Plain tallies of what is in each bucket. Counts of facts, never a figure about the two people:
 * no percentage, no average, no score and nothing divided by anything. */
export function shortlistFilterCounts(
  entries: readonly DivergenceEntry[]
): ShortlistFilterCounts {
  const counts: ShortlistFilterCounts = {
    all: entries.length,
    agreed: 0,
    "only-one": 0,
    differing: 0,
    unclaimed: 0,
  };
  for (const entry of entries) {
    for (const filter of SHORTLIST_FILTERS) {
      if (filter === "all") continue;
      if (matchesShortlistFilter(entry, filter)) counts[filter] += 1;
    }
  }
  return counts;
}

/**
 * Whether a filter row would be worth showing at all.
 *
 * A filter earns its place only when it can PARTITION the list. With every saved place in one
 * bucket, "Todo" and that bucket's chip select the same rows, so the row would be two controls
 * that do the same thing — exactly the noise the everyday view is supposed not to carry.
 *
 * The one exception is a filter the reader has already pressed: it stays offered even when it has
 * emptied, because vanishing mid-use would strand them in a filtered list with no way back and no
 * explanation. That is also how the reader learns the answer is now "none".
 */
export function shouldOfferFilters(
  counts: ShortlistFilterCounts,
  active: ShortlistFilterKind = "all"
): boolean {
  if (active !== "all") return true;
  const populated = SHORTLIST_FILTERS.filter(
    (filter) => filter !== "all" && counts[filter] > 0
  );
  return populated.length >= 2;
}

/**
 * Whether anybody has actually disagreed with anybody.
 *
 * True for `differing` and nothing else. A list full of places only one person has looked at is
 * not a list of disagreements, and this function refusing to say so is the point of it.
 */
export function hasDifferingOpinions(entries: readonly DivergenceEntry[]): boolean {
  return entries.some((entry) => entry.group === "differing");
}

/**
 * How many places the planner already holds whose interest is one-sided or disputed.
 *
 * Reported so the two of them know the conversation has consequences that are already on a day.
 * It triggers nothing.
 */
export function plannedOneSidedCount(entries: readonly DivergenceEntry[]): number {
  return entries.filter((entry) => entry.planned && entry.group !== "agreed").length;
}
