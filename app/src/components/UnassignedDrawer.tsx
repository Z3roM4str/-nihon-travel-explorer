import { useEffect, useState } from "react";
import type { Place } from "../types";
import { formatRange, resolveDuration } from "../lib/duration";
import { unassignedCountText } from "../lib/day-timeline-presentation";
import { Icon } from "../icons/Icon";

type Props = {
  /** Saved places that are not in any day — `savedPlaces` minus the route, in saved order. */
  places: readonly Place[];
  onOpenPlace: (placeId: string) => void;
  /**
   * Adds one place to the route. In this planner a route-composition change discards the day split
   * (V8 keeps `days` a partition of `routeIds`), so when `confirmBeforeAdd` is true the drawer asks
   * first and says exactly what will happen.
   */
  onAddToRoute: (placeId: string) => void;
  confirmBeforeAdd: boolean;
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
export function UnassignedDrawer({ places, onOpenPlace, onAddToRoute, confirmBeforeAdd }: Props) {
  const large = useIsLarge();
  const [userOpen, setUserOpen] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const open = large || userOpen;
  const title = unassignedCountText(places.length);

  // A place that stops being unassigned (it was just added) can no longer be «pending confirmation».
  const pending = confirmId && places.some((place) => place.id === confirmId) ? confirmId : null;

  function requestAdd(placeId: string) {
    if (confirmBeforeAdd) setConfirmId(placeId);
    else onAddToRoute(placeId);
  }

  return (
    <aside className={`unassigned ${open ? "unassigned--open" : ""}`} aria-label="Sin asignar" data-unassigned>
      {large ? (
        <h3 className="unassigned__handle unassigned__handle--static" id="unassigned-title">
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
              Siguen en <strong>Quiero ir</strong>. Ábrelos para verlos o añádelos al recorrido.
            </p>
            <ul className="unassigned__list">
              {places.map((place) => {
                const range = resolveDuration(place.duration);
                const isPending = pending === place.id;
                return (
                  <li key={place.id} className="unassigned__item">
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
                      className="unassigned__add"
                      onClick={() => requestAdd(place.id)}
                      aria-label={`Añadir ${place.name} al recorrido`}
                      title="Añadir al recorrido"
                      aria-expanded={confirmBeforeAdd ? isPending : undefined}
                    >
                      <span aria-hidden="true">＋</span>
                    </button>
                    {isPending && (
                      <div className="unassigned__confirm" role="group" aria-label={`Confirmar añadir ${place.name}`}>
                        <p>
                          Añadir un sitio al recorrido <strong>rehace el reparto por días</strong>: las
                          paradas volverán a un solo día, con sus alojamientos por día sin elegir.
                        </p>
                        <div className="unassigned__confirm-actions">
                          <button
                            type="button"
                            className="button button--primary"
                            onClick={() => {
                              setConfirmId(null);
                              onAddToRoute(place.id);
                            }}
                          >
                            Añadir y rehacer el reparto
                          </button>
                          <button type="button" className="button button--secondary" onClick={() => setConfirmId(null)}>
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}
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
