import type { NavigationRegion, Prefecture, RegionSummary } from "../data/geography";
import { countPlacesInPrefecture } from "../data/geography";

type Props = {
  regions: RegionSummary[];
  activeRegion: NavigationRegion | null;
  selectedCode: string | null;
  /** Prefectures listed under the current context: one region, or the covered ones nationwide. */
  prefectures: Prefecture[];
  prefectureListLabel: string;
  onSelectRegion: (region: NavigationRegion | null) => void;
  onSelectPrefecture: (code: string) => void;
};

/**
 * The keyboard/screen-reader path through the same hierarchy the map offers: Japan →
 * region → prefecture. Everything here is a real button, so the national view is fully
 * navigable without ever touching a polygon.
 */
export function RegionNavigator({
  regions,
  activeRegion,
  selectedCode,
  prefectures,
  prefectureListLabel,
  onSelectRegion,
  onSelectPrefecture,
}: Props) {
  return (
    <div className="region-nav">
      <nav className="region-nav__section" aria-label="Regiones de Japón">
        <div className="region-nav__heading">
          <h2>Regiones</h2>
          {activeRegion && (
            <button
              type="button"
              className="button button--secondary region-nav__back"
              onClick={() => onSelectRegion(null)}
            >
              <span aria-hidden="true">←</span> Todo Japón
            </button>
          )}
        </div>

        <ul className="region-nav__list">
          {regions.map((summary) => {
            const isActive = summary.region === activeRegion;
            return (
              <li key={summary.region}>
                <button
                  type="button"
                  className={`region-nav__item ${isActive ? "region-nav__item--active" : ""}`}
                  aria-pressed={isActive}
                  onClick={() => onSelectRegion(isActive ? null : summary.region)}
                >
                  <span className="region-nav__name">{summary.region}</span>
                  <span className="region-nav__meta">
                    {summary.placeCount > 0 ? (
                      <>
                        {summary.placeCount} lugar{summary.placeCount === 1 ? "" : "es"}
                        <span className="visually-hidden"> verificados</span>
                      </>
                    ) : (
                      <span className="region-nav__meta--empty">Sin lugares aún</span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <nav className="region-nav__section" aria-label={prefectureListLabel}>
        <div className="region-nav__heading">
          <h2>{prefectureListLabel}</h2>
        </div>
        {prefectures.length === 0 ? (
          <p className="region-nav__empty">No hay prefecturas que mostrar aquí.</p>
        ) : (
          <ul className="region-nav__list">
            {prefectures.map((prefecture) => {
              const count = countPlacesInPrefecture(prefecture.code);
              const isSelected = prefecture.code === selectedCode;
              return (
                <li key={prefecture.code}>
                  <button
                    type="button"
                    className={`region-nav__item region-nav__item--prefecture ${
                      count > 0 ? "region-nav__item--covered" : ""
                    } ${isSelected ? "region-nav__item--active" : ""}`}
                    aria-pressed={isSelected}
                    onClick={() => onSelectPrefecture(prefecture.code)}
                  >
                    <span className="region-nav__name">
                      {prefecture.displayName}
                      <span className="region-nav__ja" lang="ja">
                        {prefecture.japaneseName}
                      </span>
                    </span>
                    <span className="region-nav__meta">
                      {count > 0 ? (
                        <>
                          {count} lugar{count === 1 ? "" : "es"}
                          <span className="visually-hidden"> verificados</span>
                        </>
                      ) : (
                        <span className="region-nav__meta--empty">Sin lugares aún</span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </nav>
    </div>
  );
}
