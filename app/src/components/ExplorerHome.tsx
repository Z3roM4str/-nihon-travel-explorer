import { useMemo } from "react";
import { getAllPlaces, getPlacesByHub } from "../data/store";
import { getPrefectures, countPlacesInPrefecture } from "../data/geography";
import { cardImageUrl, resolvePlaceImages } from "../data/place-images";
import { resolveDuration } from "../lib/duration";
import { PlaceCard } from "./PlaceCard";
import { Icon } from "../icons/Icon";
import type { Place } from "../types";
import type { OtherPersonMarker } from "../lib/traveller-presentation";

const MAIN_HUBS = ["Tokio", "Kioto", "Osaka", "Okinawa"] as const;
const MORE_HUBS = ["Sapporo", "Nagoya", "Fukuoka"] as const;

const HUB_JAPANESE_NAMES: Record<string, string> = {
  Tokio: "東京",
  Kioto: "京都",
  Osaka: "大阪",
  Okinawa: "沖縄",
};

type Props = {
  onEnterHub: (hub: string) => void;
  onOpenGlobalSearch: () => void;
  onOpenNationalMap: () => void;
  onSelectPlace: (id: string) => void;
  onToggleSaved: (id: string) => void;
  savedIds: string[];
  otherPersonMarkerFor?: (placeId: string) => OtherPersonMarker | null;
};

export function ExplorerHome({
  onEnterHub,
  onOpenGlobalSearch,
  onOpenNationalMap,
  onSelectPlace,
  onToggleSaved,
  savedIds,
  otherPersonMarkerFor,
}: Props) {
  const savedSet = useMemo(() => new Set(savedIds), [savedIds]);
  const allPlaces = useMemo(() => getAllPlaces(), []);

  // Compute number of prefectures with places dynamically
  const coveredPrefecturesCount = useMemo(() => {
    return getPrefectures().filter((p) => countPlacesInPrefecture(p.code) > 0).length;
  }, []);

  // Hero image resolution for main hubs (Grade S place with photo preferred)
  const cityHeroes = useMemo(() => {
    const heroes: Record<string, { url: string; alt: string } | null> = {};
    for (const hub of MAIN_HUBS) {
      const places = getPlacesByHub(hub);
      const gradeS = places.filter((p) => p.grade === "S");
      let found: { url: string; alt: string } | null = null;
      for (const p of gradeS) {
        const imgs = resolvePlaceImages(p.id, p.images);
        if (imgs.length > 0 && imgs[0]) {
          found = { url: cardImageUrl(imgs[0].url) || imgs[0].url, alt: imgs[0].alt || p.name };
          break;
        }
      }
      if (!found) {
        for (const p of places) {
          const imgs = resolvePlaceImages(p.id, p.images);
          if (imgs.length > 0 && imgs[0]) {
            found = { url: cardImageUrl(imgs[0].url) || imgs[0].url, alt: imgs[0].alt || p.name };
            break;
          }
        }
      }
      heroes[hub] = found;
    }
    return heroes;
  }, []);

  // Editorial Collections derived dynamically from the dataset
  const collections = useMemo(() => {
    return [
      {
        id: "imprescindibles",
        title: "Imprescindibles",
        subtitle: "Los lugares que más justifican el viaje.",
        places: allPlaces.filter((p) => p.grade === "S"),
      },
      {
        id: "joyas-escondidas",
        title: "Joyas escondidas",
        subtitle: "Sitios especiales que suelen quedar fuera de lo más obvio.",
        places: allPlaces.filter((p) => p.hiddenGemStatus === "Hidden Gem real"),
      },
      {
        id: "menos-saturado",
        title: "Menos saturado",
        subtitle: "Alternativas para disfrutar con menos gente alrededor.",
        places: allPlaces.filter((p) => p.hiddenGemStatus === "Alternativa menos saturada"),
      },
      {
        id: "para-una-tarde",
        title: "Para una tarde",
        subtitle: "Planes que caben bien en un par de horas.",
        places: allPlaces.filter((p) => {
          const dur = resolveDuration(p.duration);
          return dur !== null && dur.maxMinutes <= 120;
        }),
      },
    ];
  }, [allPlaces]);

  return (
    <div className="explorer-home">
      {/* Buscador pegajoso */}
      <div className="explorer-home__search-bar">
        <button
          type="button"
          className="search-field explorer-home__search-button"
          onClick={onOpenGlobalSearch}
        >
          <span className="search-field__icon" aria-hidden="true">
            <Icon name="buscar" size={16} />
          </span>
          <span className="search-field__placeholder">Buscar en todo Japón</span>
        </button>
      </div>

      {/* Section: Ciudades */}
      <section className="national-start" aria-label="Empezar a explorar">
        <p className="national-start__lead">
          Elige una ciudad para empezar, o explora Japón en el mapa.
        </p>
        <h2 className="explorer-home__section-title">Ciudades</h2>
        <div className="explorer-home__cities">
          {MAIN_HUBS.map((hub) => {
            const count = getPlacesByHub(hub).length;
            const hero = cityHeroes[hub];
            const jaName = HUB_JAPANESE_NAMES[hub];
            return (
              <button
                key={hub}
                type="button"
                className="national-start__hub explorer-home__city-card"
                onClick={() => onEnterHub(hub)}
              >
                {hero ? (
                  <img
                    src={hero.url}
                    alt=""
                    aria-hidden="true"
                    className="explorer-home__city-image"
                    loading="eager"
                  />
                ) : (
                  <div className="explorer-home__city-placeholder" />
                )}
                <div className="explorer-home__city-overlay">
                  <div className="explorer-home__city-info">
                    <span className="national-start__hub-name explorer-home__city-name">{hub}</span>
                    {jaName && (
                      <span lang="ja" className="explorer-home__city-ja">
                        {jaName}
                      </span>
                    )}
                    {/* DD-018 (D-M1): sin píldora — cifra en `--type-num` sobre el scrim. */}
                    <span className="explorer-home__city-count">{count} lugares</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Section: Más destinos */}
      <section className="explorer-home__more" aria-label="Más destinos">
        <h2 className="explorer-home__section-title">Más destinos</h2>
        <div className="explorer-home__more-row">
          {MORE_HUBS.map((hub) => {
            const count = getPlacesByHub(hub).length;
            const label = `${count} ${count === 1 ? "lugar" : "lugares"} por ahora`;
            return (
              <button
                key={hub}
                type="button"
                className="national-start__hub explorer-home__more-card"
                onClick={() => onEnterHub(hub)}
              >
                <span className="national-start__hub-name explorer-home__more-name">{hub}</span>
                <span className="national-start__hub-count explorer-home__more-count">{label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Section: Colecciones editoriales */}
      <section className="explorer-home__collections" aria-label="Colecciones editoriales">
        {collections.map((col) => (
          <div key={col.id} className="explorer-home__collection">
            <div className="explorer-home__collection-header">
              <h3 className="explorer-home__collection-title">{col.title}</h3>
              <p className="explorer-home__collection-subtitle">{col.subtitle}</p>
            </div>
            <div className="explorer-home__collection-carousel">
              {col.places.map((place: Place) => (
                <div key={place.id} className="explorer-home__collection-item">
                  <PlaceCard
                    place={place}
                    selected={false}
                    saved={savedSet.has(place.id)}
                    onSelect={onSelectPlace}
                    onToggleSaved={onToggleSaved}
                    otherPersonMarker={
                      otherPersonMarkerFor ? otherPersonMarkerFor(place.id) : null
                    }
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* Section: Mapa de Japón Card */}
      <section className="explorer-home__map-card-section" aria-label="Mapa de Japón">
        <button type="button" className="explorer-home__map-card" onClick={onOpenNationalMap}>
          <div className="explorer-home__map-card-icon" aria-hidden="true">
            <Icon name="mapa" size={24} />
          </div>
          <div className="explorer-home__map-card-text">
            <span className="explorer-home__map-card-title">Ver Japón en el mapa</span>
            <span className="explorer-home__map-card-subtitle">
              {`47 prefecturas · ${coveredPrefecturesCount} con lugares en Nihon`}
            </span>
          </div>
        </button>
      </section>
    </div>
  );
}
