import { useMemo } from "react";
import type { NavigationRegion } from "../data/geography";
import {
  countPlacesInPrefecture,
  getPrefectureByCode,
  getPrefectures,
  getPrefecturesByRegion,
  getRegionSummaries,
  getRegionSummary,
} from "../data/geography";
import { useJapanGeometry } from "../data/useJapanGeometry";
import { NationalMap } from "./NationalMap";
import { PrefecturePanel } from "./PrefecturePanel";
import { RegionNavigator } from "./RegionNavigator";

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

        <p className="national__attribution">
          Geometría derivada del <span lang="ja">国土数値情報 行政区域データ</span> (N03, 2026)
          del <span lang="ja">国土交通省</span> / MLIT. Versión simplificada creada por Nihon;
          no es un producto oficial de MLIT.
        </p>

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
