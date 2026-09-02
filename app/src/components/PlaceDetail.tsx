import { useEffect, useRef } from "react";
import type { NearbyRelation, Place } from "../types";

type Props = {
  place: Place;
  isSaved: boolean;
  onToggleSaved: (id: string) => void;
  onClose: () => void;
  nearby: NearbyRelation[];
  onSelectNearby: (id: string) => void;
  allPlaces: Place[];
};

function formatPrice(place: Place) {
  const { min, max, currency } = place.price;
  if (min === 0 && max === 0) return "Gratis";
  if (min === max) return `${min.toLocaleString()} ${currency}`;
  return `${min.toLocaleString()}–${max.toLocaleString()} ${currency}`;
}

function formatDuration(place: Place) {
  if (place.duration.minMinutes != null && place.duration.maxMinutes != null) {
    return `${place.duration.raw} (visita)`;
  }
  return place.duration.raw;
}

export function PlaceDetail({
  place,
  isSaved,
  onToggleSaved,
  onClose,
  nearby,
  onSelectNearby,
  allPlaces,
}: Props) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, [place.id]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const nearbyPlaces = nearby
    .map((rel) => ({ rel, place: allPlaces.find((p) => p.id === rel["Hacia ID"]) }))
    .filter((entry): entry is { rel: NearbyRelation; place: Place } => Boolean(entry.place));

  const isPending = place.febMar2027.status.includes("PENDIENTE");
  const isClosed = place.febMar2027.status.toUpperCase().includes("CERR");

  return (
    <div
      className="place-detail"
      role="dialog"
      aria-modal="true"
      aria-labelledby="place-detail-title"
      ref={panelRef}
    >
      <div className="place-detail__header">
        <button
          type="button"
          className="icon-button place-detail__close"
          onClick={onClose}
          ref={closeButtonRef}
          aria-label="Cerrar ficha de lugar"
        >
          ×
        </button>
      </div>

      <div className="place-detail__gallery">
        <div className="gallery-placeholder" role="img" aria-label={`Imagen sugerida: ${place.imageBrief}`}>
          <span className="gallery-placeholder__icon" aria-hidden="true">
            🖼️
          </span>
          <p className="gallery-placeholder__brief">{place.imageBrief}</p>
          <span className="gallery-placeholder__status">Galería pendiente de imágenes ({place.imageStatus})</span>
        </div>
      </div>

      <div className="place-detail__body">
        <div className="place-detail__title-row">
          <div>
            <h2 id="place-detail-title">{place.name}</h2>
            {place.japaneseName && <p className="place-detail__japanese">{place.japaneseName}</p>}
          </div>
          <span className={`badge badge--grade-${place.grade}`}>Grado {place.grade}</span>
        </div>

        <p className="place-detail__meta">
          {place.category} · {place.neighborhood || place.municipality}
        </p>

        <button
          type="button"
          className={`save-button ${isSaved ? "save-button--saved" : ""}`}
          onClick={() => onToggleSaved(place.id)}
          aria-pressed={isSaved}
        >
          {isSaved ? "✓ Guardado — Quiero ir" : "Quiero ir"}
        </button>

        <p className="place-detail__description">{place.description}</p>
        {place.differentiator && (
          <p className="place-detail__differentiator">
            <strong>Qué lo diferencia:</strong> {place.differentiator}
          </p>
        )}

        <dl className="fact-grid">
          <div className="fact">
            <dt>Duración de visita</dt>
            <dd>{formatDuration(place)}</dd>
          </div>
          <div className="fact">
            <dt>Precio</dt>
            <dd>{formatPrice(place)}</dd>
          </div>
          <div className="fact">
            <dt>Mejor momento</dt>
            <dd>
              {place.bestTime} · {place.bestSeason}
            </dd>
          </div>
          <div className="fact">
            <dt>Nivel turístico</dt>
            <dd>
              {place.tourismLevel} (afluencia {place.crowdLevel})
            </dd>
          </div>
          <div className="fact">
            <dt>Reserva</dt>
            <dd>{place.reservation.required ? `Sí — ${place.reservation.leadTime}` : "No requerida"}</dd>
          </div>
          <div className="fact">
            <dt>Horario</dt>
            <dd>{place.schedule.hours}</dd>
          </div>
          <div className="fact">
            <dt>Cierres</dt>
            <dd>{place.schedule.closures}</dd>
          </div>
          <div className="fact">
            <dt>Transporte</dt>
            <dd>{place.transport}</dd>
          </div>
          <div className="fact fact--full">
            <dt>Accesibilidad</dt>
            <dd>{place.accessibility}</dd>
          </div>
        </dl>

        {place.hiddenGemStatus && (
          <p className="place-detail__gem">
            <strong>Estatus:</strong> {place.hiddenGemStatus}
          </p>
        )}

        <div className={`alert-box ${isClosed ? "alert-box--closed" : isPending ? "alert-box--pending" : ""}`}>
          <h3>Advertencia febrero–marzo 2027</h3>
          <p>
            <strong>{place.febMar2027.status}</strong>
          </p>
          <p>{place.febMar2027.warning}</p>
          <p className="alert-box__action">Acción recomendada: {place.febMar2027.action}</p>
        </div>

        <div className="link-row">
          {place.officialUrl && (
            <a href={place.officialUrl} target="_blank" rel="noreferrer">
              Sitio oficial ↗
            </a>
          )}
          {place.googleMapsUrl && (
            <a href={place.googleMapsUrl} target="_blank" rel="noreferrer">
              Google Maps ↗
            </a>
          )}
        </div>

        {nearbyPlaces.length > 0 && (
          <div className="nearby-section">
            <h3>Cerca de aquí</h3>
            <ul className="nearby-list">
              {nearbyPlaces.map(({ rel, place: nearbyPlace }) => (
                <li key={nearbyPlace.id}>
                  <button type="button" className="nearby-item" onClick={() => onSelectNearby(nearbyPlace.id)}>
                    <span className="nearby-item__name">{nearbyPlace.name}</span>
                    <span className="nearby-item__meta">
                      {rel["Distancia km"]} km · ~{rel["Min aprox."]} min ({rel["Modo"]})
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
