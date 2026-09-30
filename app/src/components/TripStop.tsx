import { useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import type { Place } from "../types";
import { resolvePlaceImages } from "../data/place-images";
import { thumbImageUrl, THUMB_IMAGE_WIDTH } from "../data/place-thumbnails";
import { categoryPresentation } from "../lib/category-presentation";
import { formatRange, resolveDuration } from "../lib/duration";
import { Icon } from "../icons/Icon";
import { EvidenceMark } from "./EvidenceMark";

/** The rendered box of the thumbnail (`04 §14`: «miniatura 56×56»). The file is the 400w rendition. */
const STOP_THUMB_CSS_PX = 56;

type Props = {
  place: Place;
  /** 1-based position inside its day; shown to sighted and assistive users alike («Parada 2 de 4»). */
  position: number;
  total: number;
  onOpenPlace: (placeId: string) => void;
  onOpenActions: (placeId: string) => void;
  /** The connector to the NEXT stop, rendered inside the same list item so the rail stays one unit. */
  connector?: ReactNode;
  /** B28 (B9.2): the reorder handle's listeners (pointer/touch + keyboard), from `useStopReorder`. */
  handleProps?: {
    onPointerDown: (event: PointerEvent<HTMLElement>) => void;
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
    onBlur: () => void;
  };
  /** This stop is the one being carried (dims it, its ghost follows the pointer). */
  dragging?: boolean;
  /** Keyboard-grabbed: the handle reads as pressed. */
  grabbed?: boolean;
  /** Where the insertion bar is drawn while another stop is carried over this day. */
  dropIndicator?: "before" | "after" | null;
};

/**
 * B27 (B9.1, `04 §14`) — `TripStop`: one place inside a `DayTimeline`.
 *
 * Presentation only. The open control and the actions control are siblings, never nested: opening
 * the place goes through the same `selectPlace(id, "viaje", …)` every other Viaje surface uses
 * (DD-015), and the per-row `↑ ↓ ×` trio that used to live here is gone (`10 §B9.1`, defect D10) —
 * its capabilities are reached through the single «Acciones» control (see `StopActionsSheet`).
 *
 * The thumbnail is the existing `-400w` derivative of the place's existing photograph
 * (`thumbImageUrl`), lazy-loaded; a place with no photograph, or whose photograph fails, shows the
 * same category-icon fallback `PlaceCard compact` uses — a missing photo never reads as an error.
 */
export function TripStop({
  place,
  position,
  total,
  onOpenPlace,
  onOpenActions,
  connector,
  handleProps,
  dragging,
  grabbed,
  dropIndicator,
}: Props) {
  const [imageFailed, setImageFailed] = useState(false);
  const image = resolvePlaceImages(place.id, place.images)[0];
  const src = image ? thumbImageUrl(image.url) ?? image.url : undefined;
  const range = resolveDuration(place.duration);
  const durationText = range ? formatRange(range) : place.duration.raw;

  return (
    <li
      className={`trip-stop ${dragging ? "trip-stop--dragging" : ""} ${
        dropIndicator ? `trip-stop--drop-${dropIndicator}` : ""
      }`}
      data-place-id={place.id}
    >
      <div className="trip-stop__card">
        <span className="trip-stop__node" aria-hidden="true" />
        <button
          type="button"
          className="trip-stop__open"
          onClick={() => onOpenPlace(place.id)}
        >
          <span className={`trip-stop__media ${src && !imageFailed ? "" : "trip-stop__media--empty"}`}>
            {src && !imageFailed ? (
              <img
                className="trip-stop__image"
                src={src}
                width={STOP_THUMB_CSS_PX}
                height={STOP_THUMB_CSS_PX}
                sizes={`${STOP_THUMB_CSS_PX}px`}
                alt=""
                loading="lazy"
                decoding="async"
                data-thumb-width={THUMB_IMAGE_WIDTH}
                onError={() => setImageFailed(true)}
              />
            ) : (
              <span className="trip-stop__placeholder" aria-hidden="true">
                <Icon name={categoryPresentation(place.category).icon} size={20} />
              </span>
            )}
          </span>
          <span className="trip-stop__text">
            <span className="trip-stop__name">{place.name}</span>
            <span className="trip-stop__duration">
              {durationText}
              {range && (
                <>
                  {" "}
                  <EvidenceMark level="estimado" label={false} />
                </>
              )}
            </span>
          </span>
        </button>
        <div className="trip-stop__tools">
        {handleProps && (
          <button
            type="button"
            id={`stop-handle-${place.id}`}
            className="trip-stop__handle icon-button"
            aria-label={`Reordenar ${place.name}, parada ${position} de ${total}`}
            aria-describedby="reorder-instructions"
            aria-pressed={grabbed ? true : undefined}
            title="Arrastrar para reordenar"
            {...handleProps}
          >
            <Icon name="arrastrar" size={24} />
          </button>
        )}
        <button
          type="button"
          id={`stop-actions-${place.id}`}
          className="trip-stop__actions icon-button"
          onClick={() => onOpenActions(place.id)}
          aria-haspopup="dialog"
          aria-label={`Acciones de ${place.name}, parada ${position} de ${total}`}
          title="Acciones de la parada"
        >
          <Icon name="opciones" size={20} />
        </button>
        </div>
      </div>
      {connector}
    </li>
  );
}
