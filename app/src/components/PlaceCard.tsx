import { useState } from "react";
import type { Place } from "../types";
import { CARD_IMAGE_WIDTH, cardImageUrl, resolvePlaceImages } from "../data/place-images";
import { formatRange, resolveDuration } from "../lib/duration";
import { interestLevelForPlace, tourismCaution } from "../lib/interest-level";
import { isHiddenGem, splitCategory } from "../lib/place";
import { describeReservationForUi, interpretPlaceReservation } from "../lib/reservation";
import type { InterestMarker } from "../lib/traveller-presentation";
import { Icon } from "../icons/Icon";

type Props = {
  place: Place;
  selected: boolean;
  saved: boolean;
  onSelect: (id: string) => void;
  onToggleSaved: (id: string) => void;
  /** Adds the hub chip. Off inside a hub, where every card shares the same hub. */
  showHub?: boolean;
  /**
   * Block 5: the two-person layer, and only when it has something to say.
   *
   * `null` for the two commonest states — nobody has an opinion, or the reader saved it and the
   * other person has not seen it yet — so most cards on a browse screen look exactly as they did
   * before this block. The card never carries a Persona 1 / Persona 2 pair, and never a score.
   */
  interestMarker?: InterestMarker | null;
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
export function PlaceCard({
  place,
  selected,
  saved,
  onSelect,
  onToggleSaved,
  showHub = false,
  interestMarker = null,
}: Props) {
  const [mediaState, setMediaState] = useState<MediaState>("loading");
  const images = resolvePlaceImages(place.id, place.images);
  const image = images[0];
  /** Falls back to the original whenever no derivative exists for this URL shape. */
  const cardSrc = image ? cardImageUrl(image.url) ?? image.url : undefined;
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
            {/* The card-sized rendition, not the 1600px detail hero. `sizes` describes the
                real card geometry at each breakpoint so the browser never fetches more than
                the slot needs; `width`/`height` are declared so the box is reserved before
                the bytes arrive and the card cannot shift under the text. */}
            <img
              className="place-card__image"
              src={cardSrc}
              width={CARD_IMAGE_WIDTH}
              height={Math.round((CARD_IMAGE_WIDTH * 9) / 16)}
              sizes="(min-width: 861px) 348px, (min-width: 620px) 390px, calc(100vw - 1.9rem)"
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
             is honest about what is missing. Bloque 17 (B1): ya no lleva el emoji de categoría
             del dataset (03 §8 "se recorta el emoji al renderizar"), sólo el icono de línea. */
          <span className="place-card__placeholder" aria-hidden="true">
            <Icon name="imagen" className="place-card__placeholder-icon" width={32} height={32} />
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
            <Icon name={saved ? "corazon-relleno" : "corazon"} size={20} />
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
          {/* Bloque 17 (B1): el emoji de categoría del dataset ya no se renderiza como icono de
              interfaz (03 §8). El mapa categoría → icono de línea es alcance de B3. */}
          {category.label}
          <span aria-hidden="true"> · </span>
          <span className="place-card__zone">{zone}</span>
        </p>

        {reason && <p className="place-card__reason">{reason}</p>}

        <ul className="place-card__facts">
          {interestMarker && (
            <li
              className={`place-card__fact place-card__interest place-card__interest--${interestMarker.tone}`}
            >
              <Icon name={interestMarker.glyph} size={16} /> {interestMarker.label}
              {/* The short label loses its subject out of context; the spelled-out sentence is
                  what a screen reader announces. */}
              <span className="visually-hidden">. {interestMarker.description}</span>
            </li>
          )}
          <li className="place-card__fact">
            <Icon name="reloj" size={16} />
            <span className="visually-hidden">Tiempo de visita: </span>
            {durationLabel(place)}
          </li>
          {showHub && (
            <li className="place-card__fact place-card__fact--hub">
              <Icon name="ubicacion" size={16} />
              <span className="visually-hidden">Zona: </span>
              {place.hub}
            </li>
          )}
          {isHiddenGem(place) && (
            <li className="place-card__fact place-card__fact--gem">
              <Icon name="joya" size={16} /> Hidden gem
            </li>
          )}
          {caution && (
            <li className={`place-card__fact place-card__fact--tourism-${caution.level}`}>
              <Icon name="personas" size={16} /> {caution.label}
            </li>
          )}
          {reservation.tag && (
            <li className="place-card__fact place-card__fact--reservation">
              <Icon name="ticket" size={16} /> {reservation.tag.label}
            </li>
          )}
        </ul>
      </div>
    </article>
  );
}
