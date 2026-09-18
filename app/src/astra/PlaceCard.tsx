import { useState } from "react";
import type { Place } from "../types";
import { resolvePlaceImages } from "../data/place-images";
import { resolveDuration, formatRange } from "../lib/duration";
import { interpretPlaceReservation } from "../lib/reservation";
import { interpretPlaceFebMarStatus } from "../lib/feb-mar-status";
import { splitCategory } from "../lib/place";
import { placeHref } from "./navigation";
import { recommendationLabel } from "./recommendation";

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
    <a className="astra-card__image-link" href={href} onClick={e => { e.preventDefault(); onOpen(place.id); }} aria-label={`Ver detalles de ${place.name}`}>
      <div className="astra-card__frame">
        {image && loadState !== "error" ? <><div className="astra-card__loading" aria-hidden={loadState === "loaded"}>Cargando fotografía…</div><img key={attempt} src={image.url} alt={image.alt} loading="lazy" decoding="async" data-state={loadState} onLoad={() => setLoadState("loaded")} onError={() => setLoadState("error")} /></> :
          <div className="astra-card__placeholder"><span aria-hidden="true">▧</span><span>{image ? "No se pudo cargar la fotografía" : "Fotografía pendiente"}</span>{image && <button type="button" onClick={e => { e.preventDefault(); e.stopPropagation(); setAttempt(v=>v+1); setLoadState("loading"); }}>Reintentar</button>}</div>}
      </div>
    </a>
    <div className="astra-card__body">
      <span className={`astra-recommendation astra-recommendation--${place.grade.toLowerCase()}`}>{recommendationLabel(place.grade)}</span>
      <h2><a href={href} onClick={e => { e.preventDefault(); onOpen(place.id); }}>{place.name}</a></h2>
      <p className="astra-card__meta">{place.hub} · {place.neighborhood || place.municipality}<br />{category}</p>
      <p className="astra-card__description">{place.description}</p>
      <div className="astra-card__facts"><span>◷ {duration ? formatRange(duration) : place.duration.raw}</span>{reservation.category !== "not-required" && <span>Reserva: {reservation.raw}</span>}</div>
      {seasonal.tier !== "safe" && <details className="astra-card__season"><summary>Feb–mar: revisar condiciones</summary><p>{place.febMar2027.warning || place.febMar2027.status}</p></details>}
      <button type="button" className="astra-want" aria-pressed={saved} onClick={() => onToggle(place.id)}><span aria-hidden="true">{saved ? "♥" : "♡"}</span>{saved ? "En Mis guardados" : "Quiero ir"}</button>
    </div>
    {image && <details className="astra-card__credit"><summary>Crédito de la foto</summary><p>{image.sourceUrl ? <a href={image.sourceUrl} target="_blank" rel="noreferrer">{image.source}</a> : image.source}{image.credit && ` · ${image.credit}`}{image.license && ` · ${image.license}`}</p></details>}
  </article>;
}
