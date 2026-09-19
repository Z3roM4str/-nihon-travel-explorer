import { useState } from "react";
import type { Place } from "../types";
import { resolvePlaceImages } from "../data/place-images";
import { resolveDuration, formatRange } from "../lib/duration";
import { interpretPlaceReservation } from "../lib/reservation";
import { interpretPlaceFebMarStatus } from "../lib/feb-mar-status";
import { splitCategory } from "../lib/place";
import { placeHref } from "./navigation";
import { recommendationLabel, RECOMMENDATION_ICONS } from "./recommendation";

type Props = { place: Place; saved: boolean; onToggle: (id: string) => void; onOpen: (id: string) => void };

export function PlaceCard({ place, saved, onToggle, onOpen }: Props) {
  const [loadState, setLoadState] = useState<"loading"|"loaded"|"error">("loading");
  const [attempt, setAttempt] = useState(0);
  const image = resolvePlaceImages(place.id, place.images)[0];
  const duration = resolveDuration(place.duration);
  const reservation = interpretPlaceReservation(place);
  const seasonal = interpretPlaceFebMarStatus(place);
  const category = splitCategory(place.category).label;
  const href = placeHref(place.id, place.hub);
  return <article className="astra-card">
    <div className="astra-card__frame">
      {image && loadState === "error" ? <div className="astra-card__placeholder"><span aria-hidden="true">▧</span><span>No se pudo cargar la fotografía</span><button type="button" onClick={() => { setAttempt(v=>v+1); setLoadState("loading"); }}>Reintentar</button></div> :
        <a className="astra-card__image-link" href={href} onClick={e => { e.preventDefault(); onOpen(place.id); }} aria-label={`Ver detalles de ${place.name}`}>
          {image ? <>{loadState === "loading" && <div className="astra-card__loading">Cargando fotografía…</div>}<img key={attempt} src={image.url} alt={image.alt} loading="lazy" decoding="async" data-state={loadState} onLoad={() => setLoadState("loaded")} onError={() => setLoadState("error")} /></> :
            <div className="astra-card__placeholder"><span aria-hidden="true">▧</span><span>Fotografía pendiente</span></div>}
        </a>}
    </div>
    {image && <details className="astra-card__credit"><summary>Crédito de la foto</summary><div className="astra-card__credit-details"><p>{image.sourceUrl ? <a href={image.sourceUrl} target="_blank" rel="noreferrer">{image.source}</a> : image.source}{image.credit && ` · ${image.credit}`}</p>{image.license && <p>Licencia: {image.licenseUrl ? <a href={image.licenseUrl} target="_blank" rel="noreferrer">{image.license}</a> : image.license}</p>}{(image.attributionTitle || image.sourceFileTitle) && <p>Título: {image.attributionTitle || image.sourceFileTitle}</p>}{image.processing && <p>Procesamiento: {image.processing === "resized-and-webp-reencoded" ? "redimensionada y recodificada a WebP" : "recodificada a WebP"}. Recorte de visualización: 4:3.</p>}</div></details>}
    <div className="astra-card__body">
      <span className={`astra-recommendation astra-recommendation--${place.grade.toLowerCase()}`}><RecommendationIcon kind={RECOMMENDATION_ICONS[place.grade]} />{recommendationLabel(place.grade)}</span>
      <h2><a href={href} onClick={e => { e.preventDefault(); onOpen(place.id); }}>{place.name}</a></h2>
      <p className="astra-card__meta">{place.hub} · {place.neighborhood || place.municipality}<br />{category}</p>
      <p className="astra-card__description">{place.description}</p>
      <div className="astra-card__facts"><span>◷ {duration ? formatRange(duration) : place.duration.raw}</span>{reservation.category !== "not-required" && <span>Reserva: {reservation.raw}</span>}</div>
      {seasonal.tier !== "safe" && <details className="astra-card__season"><summary>Feb–mar: revisar condiciones</summary><p>{place.febMar2027.warning || place.febMar2027.status}</p></details>}
      <button type="button" className="astra-want" aria-pressed={saved} onClick={() => onToggle(place.id)}><span aria-hidden="true">{saved ? "♥" : "♡"}</span>{saved ? "En Mis guardados" : "Quiero ir"}</button>
    </div>
  </article>;
}

function RecommendationIcon({ kind }: { kind?: string }) {
  if (!kind) return null;
  const path = kind === "star" ? "M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3z" : kind === "check" ? "M8 12l2.5 2.5L16 9m5 3a9 9 0 11-18 0 9 9 0 0118 0z" : kind === "minus" ? "M8 12h8m5 0a9 9 0 11-18 0 9 9 0 0118 0z" : kind === "compass" ? "M15 9l-2 4-4 2 2-4 4-2zm6 3a9 9 0 11-18 0 9 9 0 0118 0z" : "M12 21a9 9 0 100-18 9 9 0 000 18z";
  return <svg className="astra-recommendation__icon" aria-hidden="true" viewBox="0 0 24 24"><path d={path} /></svg>;
}
