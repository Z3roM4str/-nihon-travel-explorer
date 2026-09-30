import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { Place } from "../types";
import { formatRange, resolveDuration } from "../lib/duration";
import { unassignedCountText } from "../lib/day-timeline-presentation";
import { Icon } from "../icons/Icon";

type Props = {
  /** Saved places that are not in any day — `savedPlaces` minus the route, in saved order. */
  places: readonly Place[];
  onOpenPlace: (placeId: string) => void;
  /** «Añadir al día…»: opens the day/position sheet; it never rebuilds the rest of the trip (B9.2). */
  onAddToDay: (placeId: string) => void;
  /** B28: reorder handle listeners for one place (pointer/touch + keyboard). */
  handleProps?: (
    placeId: string,
    name: string
  ) => {
    onPointerDown: (event: PointerEvent<HTMLElement>) => void;
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
    onBlur: () => void;
  };
  /** B28: a placed stop is being carried and would drop here («Quitar del día»). */
  isDropTarget?: boolean;
  /** B28: the unassigned place being carried, dimmed in the list. */
  draggingId?: string | null;
  grabbedId?: string | null;
};

const LG_QUERY = "(min-width: 1200px)";

function useIsLarge(): boolean {
  const [large, setLarge] = useState(() =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia(LG_QUERY).matches
      : false
  );
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia(LG_QUERY);
    const update = () => setLarge(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return large;
}

/**
 * B27 (B9.1, `05 §7` item 4, `02 §D5`) — «Sin asignar»: the saved places that sit outside every day.
 *
 * Phone/tablet: a persistent handle («7 sitios sin día») that expands into a panel — a real
 * `<button aria-expanded>`, so it is reachable and operable from the keyboard. `lg`+: the same
 * content is a permanent column and the handle is a plain heading. No drag: every action is a
 * button (`Abrir` / `Añadir al recorrido`), and nothing here announces drag semantics (B9.2).
 */
export function UnassignedDrawer({
  places,
  onOpenPlace,
  onAddToDay,
  handleProps,
  isDropTarget,
  draggingId,
  grabbedId,
}: Props) {
  const large = useIsLarge();
  const [userOpen, setUserOpen] = useState(false);
  const asideRef = useRef<HTMLElement>(null);
  const open = large || userOpen;

  // Opening the drawer must reveal what it opened: bring the expanded panel into view.
  useEffect(() => {
    if (userOpen) asideRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [userOpen]);
  const title = unassignedCountText(places.length);

  return (
    <aside ref={asideRef} className={`unassigned ${open ? "unassigned--open" : ""} ${isDropTarget ? "unassigned--drop-target" : ""}`} aria-label="Sin asignar" data-unassigned>
      {large ? (
        <h3 className="unassigned__handle unassigned__handle--static" id="unassigned-title" tabIndex={-1}>
          {title}
        </h3>
      ) : (
        <button
          type="button"
          className="unassigned__handle"
          id="unassigned-title"
          aria-expanded={userOpen}
          aria-controls="unassigned-panel"
          onClick={() => setUserOpen((value) => !value)}
        >
          <span className="unassigned__grabber" aria-hidden="true" />
          <span className="unassigned__title">{title}</span>
          <Icon name={userOpen ? "abajo" : "arriba"} size={16} aria-hidden="true" />
        </button>
      )}

      <div id="unassigned-panel" className="unassigned__panel" hidden={!open}>
        {places.length === 0 ? (
          <p className="unassigned__empty">
            Todo lo que guardasteis en Quiero ir ya tiene día.
          </p>
        ) : (
          <>
            <p className="unassigned__note">
              Siguen en <strong>Quiero ir</strong>. Ábrelos para verlos, arrástralos a un día o usa «Añadir al día…».
            </p>
            <ul className="unassigned__list">
              {places.map((place) => {
                const range = resolveDuration(place.duration);
                const handle = handleProps?.(place.id, place.name);
                return (
                  <li
                    key={place.id}
                    className={`unassigned__item ${draggingId === place.id ? "unassigned__item--dragging" : ""}`}
                  >
                    {handle && (
                      <button
                        type="button"
                        id={`unassigned-handle-${place.id}`}
                        className="unassigned__handle-grip icon-button"
                        aria-label={`Arrastrar ${place.name} a un día`}
                        aria-describedby="reorder-instructions"
                        aria-pressed={grabbedId === place.id ? true : undefined}
                        title="Arrastrar a un día"
                        {...handle}
                      >
                        <Icon name="arrastrar" size={20} />
                      </button>
                    )}
                    <button
                      type="button"
                      className="unassigned__open"
                      onClick={() => onOpenPlace(place.id)}
                    >
                      <span className="unassigned__name">{place.name}</span>
                      <span className="unassigned__meta">
                        {range ? formatRange(range) : place.duration.raw}
                      </span>
                    </button>
                    <button
                      type="button"
                      id={`unassigned-add-${place.id}`}
                      className="unassigned__add"
                      onClick={() => onAddToDay(place.id)}
                      aria-label={`Añadir ${place.name} al día…`}
                      aria-haspopup="dialog"
                      title="Añadir al día…"
                    >
                      <span aria-hidden="true">＋</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </aside>
  );
}
