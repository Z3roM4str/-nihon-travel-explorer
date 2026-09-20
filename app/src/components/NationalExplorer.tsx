import { useMemo, useState } from "react";
import type { NavigationRegion } from "../data/geography";
import {
  countPlacesInPrefecture,
  getPrefectureByCode,
  getPrefectures,
  getPrefecturesByRegion,
  getRegionSummaries,
  getRegionSummary,
} from "../data/geography";
import { getHubs, getPlacesByHub } from "../data/store";
import { useJapanGeometry } from "../data/useJapanGeometry";
import { NationalMap } from "./NationalMap";
import { PrefecturePanel } from "./PrefecturePanel";
import { RegionNavigator } from "./RegionNavigator";
import { Sheet } from "./Sheet";
import { MlitAttribution } from "./MlitAttribution";

/** Hub → place count, computed once: the entry screen's shortcut row never changes. */
const HUB_SHORTCUTS = getHubs().map((hub) => ({ hub, placeCount: getPlacesByHub(hub).length }));

type Props = {
  activeRegion: NavigationRegion | null;
  selectedCode: string | null;
  onSelectRegion: (region: NavigationRegion | null) => void;
  onSelectPrefecture: (code: string | null) => void;
  onEnterHub: (hub: string) => void;
};

/**
 * Japan → region → prefecture/hub, as one screen. The map and the list controls are two
 * views of the same state, so either can drive the whole journey; nothing here is reachable
 * only by clicking a polygon.
 */
export function NationalExplorer({
  activeRegion,
  selectedCode,
  onSelectRegion,
  onSelectPrefecture,
  onEnterHub,
}: Props) {
  const geometry = useJapanGeometry();
  const [attributionOpen, setAttributionOpen] = useState(false);
  const regions = useMemo(() => getRegionSummaries(), []);
  const selectedPrefecture = selectedCode ? getPrefectureByCode(selectedCode) ?? null : null;

  // Without a region chosen, the list is a nationwide shortcut to what Nihon actually
  // covers; inside a region it becomes the full set of that region's prefectures, covered
  // or not, so the gaps stay visible.
  const prefectures = useMemo(() => {
    if (activeRegion) return getPrefecturesByRegion(activeRegion);
    return getPrefectures().filter((pref) => countPlacesInPrefecture(pref.code) > 0);
  }, [activeRegion]);

  const prefectureListLabel = activeRegion
    ? `Prefecturas de ${activeRegion}`
    : "Prefecturas con lugares verificados";

  const regionHubs = activeRegion ? getRegionSummary(activeRegion).hubs : [];

  return (
    <div className="national">
      <aside className="national__sidebar" aria-label="Explorar Japón por región y prefectura">
        {/*
          The first thing a new arrival sees. The map and the region list are a complete
          Japan → región → prefectura → hub path, but neither says where to begin, and in
          practice most visits start at a known city. One line of orientation plus the seven
          hubs turns the entry screen into something answerable in a second, without removing
          the geographic route underneath it.
        */}
        <section className="national-start" aria-label="Empezar a explorar">
          <p className="national-start__lead">
            Elige una ciudad para empezar, o baja para recorrer Japón por regiones.
          </p>
          <ul className="national-start__hubs">
            {HUB_SHORTCUTS.map(({ hub, placeCount }) => (
              <li key={hub}>
                <button
                  type="button"
                  className="national-start__hub"
                  onClick={() => onEnterHub(hub)}
                >
                  <span className="national-start__hub-name">{hub}</span>
                  <span className="national-start__hub-count">
                    {placeCount}
                    <span className="visually-hidden"> lugares</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <RegionNavigator
          regions={regions}
          activeRegion={activeRegion}
          selectedCode={selectedCode}
          prefectures={prefectures}
          prefectureListLabel={prefectureListLabel}
          onSelectRegion={onSelectRegion}
          onSelectPrefecture={onSelectPrefecture}
        />

        {activeRegion && (
          <section className="region-hubs" aria-label={`Hubs de la región ${activeRegion}`}>
            <h2>Hubs en {activeRegion}</h2>
            {regionHubs.length === 0 ? (
              <p className="region-nav__empty">
                Todavía no tenemos lugares verificados situados en esta región.
              </p>
            ) : (
              <ul className="region-hubs__list">
                {regionHubs.map(({ hub, placeCount }) => (
                  <li key={hub}>
                    <button
                      type="button"
                      className="button button--secondary region-hubs__item"
                      onClick={() => onEnterHub(hub)}
                    >
                      <span>Explorar desde {hub}</span>
                      <span className="region-hubs__count">
                        {placeCount} lugar{placeCount === 1 ? "" : "es"}
                        <span className="visually-hidden"> situados en {activeRegion}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </aside>

      <main className="national__map-area">
        {geometry.status === "ready" ? (
          <NationalMap
            geometry={geometry.geometry}
            activeRegion={activeRegion}
            selectedCode={selectedCode}
            onSelectPrefecture={onSelectPrefecture}
          />
        ) : (
          <div className="national__map-fallback" role="status">
            {geometry.status === "loading"
              ? "Cargando el mapa de Japón…"
              : "No se pudo cargar el mapa de Japón. Puedes seguir explorando con la lista de regiones y prefecturas."}
          </div>
        )}

        {/*
          Bloque 18, `05 §3`: el aviso ya no ocupa una franja permanente bajo el mapa (defecto
          D5/D11) — vive detrás de este `ⓘ` y, íntegro, en Nosotros › Fuentes y licencias. Ni la
          geometría ni la navegación región/prefectura/hub cambian: sólo se reubica el texto.
        */}
        <button
          type="button"
          className="national__attribution-button tap-target-min"
          onClick={() => setAttributionOpen(true)}
          aria-label="Fuente de la geometría del mapa (MLIT)"
          title="Fuente de la geometría del mapa (MLIT)"
        >
          <span aria-hidden="true">ⓘ</span>
        </button>
        {attributionOpen && (
          <Sheet title="Fuente del mapa" onClose={() => setAttributionOpen(false)}>
            <MlitAttribution />
          </Sheet>
        )}

        {selectedPrefecture && (
          <div className="national__panel">
            <PrefecturePanel
              prefecture={selectedPrefecture}
              onEnterHub={onEnterHub}
              onClose={() => onSelectPrefecture(null)}
            />
          </div>
        )}
      </main>
    </div>
  );
}
