import {
  SHORTLIST_FILTERS,
  shouldOfferFilters,
  type ShortlistFilterCounts,
  type ShortlistFilterKind,
} from "../lib/interest-divergence";
import { divergenceHeading, filterAccessibleName, filterLabel } from "../lib/divergence-presentation";

/**
 * Block 6 — "dónde no coincidimos", as one row of filters inside the list it filters.
 *
 * ## Why a filter and not a screen
 *
 * The question this answers — *which of these does only one of us want, and which has one of us
 * actually said no to* — is a question about the saved list. It belongs in the saved list. A
 * second main surface would have meant a second place to look for the same places, a second
 * navigation state, and a second idea of what "the list" is. This is one row of chips over rows
 * that were already there.
 *
 * ## Why most of it is usually absent
 *
 * A chip renders only when it would select something. A trip where the two of them agree on
 * everything shows "Todo" and "Los dos" and nothing else, and the everyday view is unchanged —
 * the same rule Block 5 used for the card marker, applied one level up. The chips are never the
 * only way to read the list: "Todo" is the default and it is Block 5's list exactly.
 *
 * ## What it is not
 *
 * It selects; it does not judge. No chip is styled as good or bad, none is a warning, the counts
 * are counts and there is no total to be a fraction of. `aria-pressed` carries the selection and
 * the visible text carries the name, so colour is never the only difference between a pressed and
 * an unpressed chip.
 */
export function ShortlistFilterBar({
  counts,
  active,
  onSelect,
}: {
  counts: ShortlistFilterCounts;
  active: ShortlistFilterKind;
  onSelect: (filter: ShortlistFilterKind) => void;
}) {
  // Nothing to partition means nothing to offer: see `shouldOfferFilters`.
  if (!shouldOfferFilters(counts, active)) return null;

  // "Todo" always; every other chip only when it has something to select. A chip that selects
  // nothing is noise, and a zero beside a name reads as a verdict about the trip.
  // The active chip stays even when it empties, so the reader can see that the answer to the
  // question they asked is now "none" rather than watching their own filter vanish.
  const visible = SHORTLIST_FILTERS.filter(
    (filter) => filter === "all" || counts[filter] > 0 || filter === active
  );
  return (
    <div
      className="shortlist-filters"
      role="group"
      aria-label={divergenceHeading(counts)}
    >
      {visible.map((filter) => {
        const selected = filter === active;
        return (
          <button
            key={filter}
            type="button"
            className={`shortlist-filters__chip ${
              selected ? "shortlist-filters__chip--active" : ""
            }`}
            aria-pressed={selected}
            aria-label={filterAccessibleName(filter, counts[filter])}
            onClick={() => onSelect(filter)}
          >
            <span className="shortlist-filters__label">{filterLabel(filter)}</span>
            <span className="shortlist-filters__count" aria-hidden="true">
              {counts[filter]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
