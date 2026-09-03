import { useEffect, useRef } from "react";
import type { Prefecture } from "../data/geography";
import { getHubsForPrefecture, countPlacesInPrefecture } from "../data/geography";

type Props = {
  prefecture: Prefecture;
  onEnterHub: (hub: string) => void;
  onClose: () => void;
};

/**
 * Contextual card for one prefecture. It answers the two questions the national map raises:
 * what does Nihon actually have here, and which hub do I open to explore it. The hub list is
 * derived from the places physically located in this prefecture, so a prefecture can offer
 * more than one hub — and a prefecture whose places belong editorially to a distant hub still
 * points at that hub rather than pretending prefecture and hub are the same thing.
 */
export function PrefecturePanel({ prefecture, onEnterHub, onClose }: Props) {
  const count = countPlacesInPrefecture(prefecture.code);
  const hubs = getHubsForPrefecture(prefecture.code);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    closeRef.current?.focus();
  }, [prefecture.code]);

  return (
    <section
      className="prefecture-panel"
      aria-labelledby="prefecture-panel-title"
      role="region"
      tabIndex={-1}
    >
      <header className="prefecture-panel__header">
        <div>
          <h2 id="prefecture-panel-title">{prefecture.displayName}</h2>
          <p className="prefecture-panel__sub">
            <span lang="ja">{prefecture.japaneseName}</span>
            <span aria-hidden="true"> · </span>
            <span>Región {prefecture.region}</span>
          </p>
        </div>
        <button
          ref={closeRef}
          type="button"
          className="icon-button"
          onClick={onClose}
          aria-label={`Cerrar la ficha de ${prefecture.displayName}`}
        >
          <span aria-hidden="true">×</span>
        </button>
      </header>

      <p className="prefecture-panel__count">
        {count > 0 ? (
          <>
            <strong>{count}</strong> lugar{count === 1 ? "" : "es"} verificado
            {count === 1 ? "" : "s"} en la base Nihon
          </>
        ) : (
          "Aún no hay lugares verificados de esta prefectura en la base Nihon."
        )}
      </p>

      {count > 0 ? (
        <div className="prefecture-panel__hubs">
          <h3>Explorar desde</h3>
          <p className="prefecture-panel__hint">
            Los lugares de esta prefectura se exploran desde estos hubs de viaje.
          </p>
          <ul className="prefecture-panel__hub-list">
            {hubs.map(({ hub, placeCount }) => (
              <li key={hub}>
                <button
                  type="button"
                  className="button button--primary prefecture-panel__hub"
                  onClick={() => onEnterHub(hub)}
                >
                  <span>Explorar desde {hub}</span>
                  <span className="prefecture-panel__hub-count">
                    {placeCount} lugar{placeCount === 1 ? "" : "es"}
                    <span className="visually-hidden"> de {prefecture.displayName}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="prefecture-panel__empty">
          Sigue siendo parte del mapa, pero no mostramos exploración donde todavía no tenemos
          contenido verificado.
        </p>
      )}
    </section>
  );
}
