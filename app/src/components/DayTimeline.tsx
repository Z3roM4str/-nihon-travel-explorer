import type { ReactNode } from "react";

type Props = {
  /** `id` of the day heading, referenced by `aria-labelledby`. */
  headingId: string;
  /** «Día 3 · mié 24 feb · Kioto» — already composed by `dayHeadline`. */
  headline: string;
  /** «3–4 h de visitas · 4 paradas». */
  meta: string;
  /** Per-day controls (move day, delete day) — the same controls the day card always had. */
  headerActions?: ReactNode;
  /** A neutral warning that belongs under the headline (trip-bounds day warning). */
  headerNote?: ReactNode;
  /** Renders `emptyText` instead of the rail. */
  isEmpty: boolean;
  emptyText: string;
  /** `TripStop` list items, already interleaved with their connectors. */
  stops: ReactNode;
  /** Existing per-day signals and tools (weekday closure, reservations, alternatives …). */
  details?: ReactNode;
  /** «Dormís en …» + the day's own accommodation controls. */
  footer?: ReactNode;
};

/**
 * B27 (B9.1, `05 §7`, `04 §14`) — `DayTimeline`: the day as the primary object of Viaje.
 *
 * A pure layout shell. It owns no state and reads no planning module: the headline, counts, stops,
 * notices and footer are all handed in by `OrderedSequenceBuilder`, which keeps computing them
 * exactly as before. The day is an `<li>`-friendly `<section>` labelled by its own `<h3>`; the rail
 * is a real ordered list so a screen reader announces «lista de N elementos».
 */
export function DayTimeline({
  headingId,
  headline,
  meta,
  headerActions,
  headerNote,
  isEmpty,
  emptyText,
  stops,
  details,
  footer,
}: Props) {
  return (
    <section className="day-timeline" aria-labelledby={headingId}>
      <header className="day-timeline__header">
        <div className="day-timeline__heading">
          <h3 id={headingId} className="day-timeline__title" tabIndex={-1}>
            {headline}
          </h3>
          <p className="day-timeline__meta">{meta}</p>
          {headerNote}
        </div>
        {headerActions && <div className="day-timeline__actions day-card__header-actions">{headerActions}</div>}
      </header>

      {isEmpty ? (
        <p className="sequence-empty day-timeline__empty">{emptyText}</p>
      ) : (
        <ol className="day-timeline__stops" aria-labelledby={headingId}>
          {stops}
        </ol>
      )}

      {details && <div className="day-timeline__details">{details}</div>}
      {footer && <footer className="day-timeline__footer">{footer}</footer>}
    </section>
  );
}
