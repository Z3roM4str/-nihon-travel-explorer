import { useState } from "react";
import type { Place } from "../types";
import { resolvePlaceImages } from "../data/place-images";
import { formatRange, resolveDuration } from "../lib/duration";
import { interestLevelForPlace, tourismCaution } from "../lib/interest-level";
import { isHiddenGem, splitCategory } from "../lib/place";
import { describeReservationForUi, interpretPlaceReservation } from "../lib/reservation";

type Props = {
  place: Place;
  selected: boolean;
  saved: boolean;
  onSelect: (id: string) => void;
  onToggleSaved: (id: string) => void;
  /** Adds the hub chip. Off inside a hub, where every card shares the same hub. */
  showHub?: boolean;
};

type MediaState = "loading" | "loaded" | "error";

/**
 * Visit time, shown only when the dataset actually supports one.
 *
 * `resolveDuration` returns null for day-scale text ("Día completo", "1–2 días") because those
 * are not visit minutes. Rather than hide the information, the raw editorial text is shown as
 * written — the card never invents a number, and never turns a day-scale commitment into a
 * minute range.
 */
function durationLabel(place: Place): string {
  const range = resolveDuration(place.duration);
  return range ? formatRange(range) : place.duration.raw.trim();
}

/**
 * The short "why this is worth it" line. `differentiator` is the dataset's own one-sentence
 * argument for the place, which is exactly what a scanning reader needs; `description` is the
 * factual what-it-is and is the fallback when no differentiator was recorded. Nothing is
 * generated: the full text stays available in the place detail, the card only clamps it.
 */
function reasonText(place: Place): string {
  const differentiator = place.differentiator?.trim();
  if (differentiator) return differentiator;
  return place.description?.trim() ?? "";
}

/**
 * Photo-led place card.
 *
 * Markup note: the card is an `<article>`, not a `<button>`, because it carries two independent
 * actions — open the place, and save it. The name's button is stretched over the whole card via
 * `.place-card__open::after` so the entire surface opens the place on any pointer, while the
 * save control sits above it in the stacking order. Nesting one button inside another (the
 * obvious shortcut) is invalid HTML and breaks keyboard and screen-reader behaviour.
 */
export function PlaceCard({ place, selected, saved, onSelect, onToggleSaved, showHub = false }: Props) {
  const [mediaState, setMediaState] = useState<MediaState>("loading");
  const images = resolvePlaceImages(place.id, place.images);
  const image = images[0];
  const hasPhoto = Boolean(image) && mediaState !== "error";
  const category = splitCategory(place.category);
  const interest = interestLevelForPlace(place);
  const caution = tourismCaution(place);
  const reservation = describeReservationForUi(
    interpretPlaceReservation(place),
    place.reservation.leadTime
  );
  const reason = reasonText(place);
  const zone = place.neighborhood || place.municipality;

  return (
    <article
      className={`place-card ${selected ? "place-card--selected" : ""} ${
        saved ? "place-card--saved" : ""
      }`}
      aria-current={selected ? "true" : undefined}
    >
      <div className={`place-card__media ${hasPhoto ? "" : "place-card__media--empty"}`}>
        {image && mediaState !== "error" ? (
          <>
            {mediaState === "loading" && <span className="place-card__skeleton" aria-hidden="true" />}
            <img
              className="place-card__image"
              src={image.url}
              alt=""
              loading="lazy"
              decoding="async"
              data-state={mediaState}
              onLoad={() => setMediaState("loaded")}
              onError={() => setMediaState("error")}
            />
          </>
        ) : (
          /* No stand-in photograph of somewhere else is ever shown — an editorial placeholder
             carrying the place's own category is honest about what is missing. */
          <span className="place-card__placeholder" aria-hidden="true">
            <span className="place-card__placeholder-icon">{category.icon || "⛩"}</span>
          </span>
        )}

        <span className={`interest-badge interest-badge--${interest.level} badge--grade-${place.grade}`}>
          <span className="interest-badge__glyph" aria-hidden="true">
            {interest.glyph}
          </span>
          <span className="interest-badge__label">{interest.label}</span>
        </span>

        <button
          type="button"
          className={`place-card__save ${saved ? "place-card__save--on" : ""}`}
          onClick={() => onToggleSaved(place.id)}
          aria-pressed={saved}
          aria-label={saved ? `Quitar ${place.name} de Quiero ir` : `Guardar ${place.name} en Quiero ir`}
          title={saved ? "Quitar de Quiero ir" : "Quiero ir"}
        >
          <span className="place-card__save-icon" aria-hidden="true">
            {saved ? "♥" : "♡"}
          </span>
        </button>
      </div>

      <div className="place-card__body">
        <h3 className="place-card__heading">
          {/* `data-stretch-target` names the element this control's `::after` actually covers.
              The button's own box is only the title text; its hit area is the whole card, and
              the tap-target audit needs to be able to tell those apart. */}
          <button
            type="button"
            className="place-card__open"
            data-stretch-target=".place-card"
            onClick={() => onSelect(place.id)}
          >
            {place.name}
            <span className="visually-hidden">
              . {interest.label}. {category.label} en {zone}.
            </span>
          </button>
        </h3>

        <p className="place-card__where">
          <span aria-hidden="true">{category.icon}</span> {category.label}
          <span aria-hidden="true"> · </span>
          <span className="place-card__zone">{zone}</span>
        </p>

        {reason && <p className="place-card__reason">{reason}</p>}

        <ul className="place-card__facts">
          <li className="place-card__fact">
            <span aria-hidden="true">⏱</span>
            <span className="visually-hidden">Tiempo de visita: </span>
            {durationLabel(place)}
          </li>
          {showHub && (
            <li className="place-card__fact place-card__fact--hub">
              <span aria-hidden="true">📍</span>
              <span className="visually-hidden">Zona: </span>
              {place.hub}
            </li>
          )}
          {isHiddenGem(place) && (
            <li className="place-card__fact place-card__fact--gem">
              <span aria-hidden="true">💎</span> Hidden gem
            </li>
          )}
          {caution && (
            <li className={`place-card__fact place-card__fact--tourism-${caution.level}`}>
              <span aria-hidden="true">👥</span> {caution.label}
            </li>
          )}
          {reservation.tag && (
            <li className="place-card__fact place-card__fact--reservation">
              <span aria-hidden="true">🎟</span> {reservation.tag.label}
            </li>
          )}
        </ul>
      </div>
    </article>
  );
}
