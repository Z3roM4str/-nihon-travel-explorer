import { useMemo, useState, useRef, useCallback } from "react";
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
import { Icon } from "../icons/Icon";

/** Hub → place count, computed once */
const HUB_SHORTCUTS = getHubs().map((hub) => ({ hub, placeCount: getPlacesByHub(hub).length }));

export type SheetHeight = "asa" | "25%" | "75%";

type Props = {
  activeRegion: NavigationRegion | null;
  selectedCode: string | null;
  onSelectRegion: (region: NavigationRegion | null) => void;
  onSelectPrefecture: (code: string | null) => void;
  onEnterHub: (hub: string) => void;
  onCloseMap?: () => void;
};

export function NationalExplorer({
  activeRegion,
  selectedCode,
  onSelectRegion,
  onSelectPrefecture,
  onEnterHub,
  onCloseMap,
}: Props) {
  const geometry = useJapanGeometry();
  const [attributionOpen, setAttributionOpen] = useState(false);
  const [sheetHeight, setSheetHeight] = useState<SheetHeight>("25%");

  const regions = useMemo(() => getRegionSummaries(), []);
  const selectedPrefecture = selectedCode ? getPrefectureByCode(selectedCode) ?? null : null;

  const prefectures = useMemo(() => {
    if (activeRegion) return getPrefecturesByRegion(activeRegion);
    return getPrefectures().filter((pref) => countPlacesInPrefecture(pref.code) > 0);
  }, [activeRegion]);

  const prefectureListLabel = activeRegion
    ? `Prefecturas de ${activeRegion}`
    : "Prefecturas con lugares verificados";

  const regionHubs = activeRegion ? getRegionSummary(activeRegion).hubs : [];

  // Cycle sheet height: 25% -> 75% -> asa -> 25%
  const cycleHeight = useCallback(() => {
    setSheetHeight((prev) => {
      if (prev === "25%") return "75%";
      if (prev === "75%") return "asa";
      return "25%";
    });
  }, []);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSheetHeight((prev) => (prev === "asa" ? "25%" : "75%"));
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        setSheetHeight((prev) => (prev === "75%" ? "25%" : "asa"));
      } else if (event.key === "Home") {
        event.preventDefault();
        setSheetHeight("asa");
      } else if (event.key === "End") {
        event.preventDefault();
        setSheetHeight("75%");
      } else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        cycleHeight();
      }
    },
    [cycleHeight]
  );

  // Touch / Drag handling
  const startYRef = useRef<number | null>(null);
  const startHeightRef = useRef<SheetHeight>("25%");

  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    startYRef.current = clientY;
    startHeightRef.current = sheetHeight;
  };

  const handleTouchEnd = (e: React.TouchEvent | React.MouseEvent) => {
    if (startYRef.current === null) return;
    const clientY = "changedTouches" in e ? e.changedTouches[0].clientY : e.clientY;
    const deltaY = clientY - startYRef.current;
    startYRef.current = null;

    if (Math.abs(deltaY) < 15) return; // minimal drag threshold

    if (deltaY < -40) {
      // Dragged UP -> expand
      setSheetHeight((prev) => (prev === "asa" ? "25%" : "75%"));
    } else if (deltaY > 40) {
      // Dragged DOWN -> shrink
      setSheetHeight((prev) => (prev === "75%" ? "25%" : "asa"));
    }
  };

  return (
    <div className="national">
      {/* Fullscreen Map Area */}
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

        {/* Floating Top Controls: Volver a la portada */}
        {onCloseMap && (
          <div className="national__top-controls">
            <button
              type="button"
              className="button button--secondary national__back-button"
              onClick={onCloseMap}
            >
              ‹ Volver a la portada
            </button>
          </div>
        )}

        {/* Floating ⓘ button for MLIT attribution */}
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

      {/* Draggable Bottom Sheet in 3 heights (asa, 25%, 75%) */}
      <aside
        className={`national__sheet national__sheet--${
          sheetHeight === "asa" ? "asa" : sheetHeight === "25%" ? "25" : "75"
        }`}
        aria-label="Explorar Japón por región y prefectura"
      >
        {/* Handle / Asa */}
        <div
          className="national__sheet-handle-row"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleTouchStart}
          onMouseUp={handleTouchEnd}
        >
          <button
            type="button"
            className="national__sheet-asa"
            onClick={cycleHeight}
            onKeyDown={handleKeyDown}
            aria-label={`Panel de navegación (${sheetHeight}). Presiona flechas arriba/abajo o enter para cambiar altura.`}
            title={`Panel de navegación (${sheetHeight})`}
          >
            <span className="national__sheet-asa-bar" aria-hidden="true" />
          </button>
          <div className="national__sheet-controls">
            <button
              type="button"
              className={`chip-toggle ${sheetHeight === "25%" ? "chip-toggle--pressed" : ""}`}
              onClick={() => setSheetHeight("25%")}
              aria-pressed={sheetHeight === "25%"}
              aria-label="Ajustar panel a 25%"
              title="Ajustar panel a 25%"
            >
              25%
            </button>
            <button
              type="button"
              className={`chip-toggle ${sheetHeight === "75%" ? "chip-toggle--pressed" : ""}`}
              onClick={() => setSheetHeight("75%")}
              aria-pressed={sheetHeight === "75%"}
              aria-label="Ajustar panel a 75%"
              title="Ajustar panel a 75%"
            >
              75%
            </button>
            <button
              type="button"
              className={`chip-toggle ${sheetHeight === "asa" ? "chip-toggle--pressed" : ""}`}
              onClick={() => setSheetHeight("asa")}
              aria-pressed={sheetHeight === "asa"}
              aria-label="Colapsar panel al asa"
              title="Colapsar panel al asa"
            >
              <Icon name="abajo" size={16} /> Asa
            </button>
          </div>
        </div>

        {/* Sheet Content (hidden if Asa) */}
        {sheetHeight !== "asa" && (
          <div className="national__sheet-content">
            <section className="national-start" aria-label="Empezar a explorar">
              <p className="national-start__lead">
                Elige una ciudad para empezar, o navega por regiones y prefecturas.
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
          </div>
        )}
      </aside>
    </div>
  );
}
