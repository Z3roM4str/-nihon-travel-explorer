import { useEffect, useRef } from "react";
import type { NearbyRelation, Place } from "../types";
import { PlaceGallery } from "./PlaceGallery";
import { resolvePlaceImages } from "../data/place-images";
import { resolveDuration, formatRange } from "../lib/duration";
import { getBestTransfer, type TransferEdge } from "../lib/transfer";
import { describeTransferForUi, transferListFootnote } from "../lib/transfer-display";
import { describeReservationForUi, interpretPlaceReservation } from "../lib/reservation";
import {
  alertSeverity,
  formatPrice,
  imageBriefText,
  isHiddenGem,
  severityLabel,
  splitCategory,
} from "../lib/place";

type Props = {
  place: Place;
  isSaved: boolean;
  onToggleSaved: (id: string) => void;
  onClose: () => void;
  nearby: NearbyRelation[];
  onSelectNearby: (id: string) => void;
  /** Resolves a nearby relation's target id to its place, wherever it lives in the dataset. */
  getPlace: (id: string) => Place | undefined;
  /** Place the user came from via a "nearby" jump, so they can step back. */
  previousPlace: Place | null;
  onBack: () => void;
};

function QuickFact({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="quick-fact">
      <span className="quick-fact__icon" aria-hidden="true">
        {icon}
      </span>
      <span className="quick-fact__body">
        <span className="quick-fact__label">{label}</span>
        <span className="quick-fact__value">{value}</span>
      </span>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="detail-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

/**
 * A dedicated class for the confidence/quality label, distinct from `.nearby-item__relation`
 * (the relation-type text, e.g. "Cercano"). Reusing that class here would make the two
 * unrelated pieces of text impossible to style independently later, and would read as if
 * "confidence" were itself a kind of relation. The modifier only changes color/weight so a
 * validated route is visually distinguishable from an estimate, never the wording — that stays
 * owned by `describeTransferForUi`.
 */
function nearbyQualityClassName(transfer: TransferEdge | null): string {
  if (transfer?.confidence === "validated-static") return "nearby-item__quality nearby-item__quality--validated";
  if (transfer?.confidence === "schedule-aware") return "nearby-item__quality nearby-item__quality--live";
  return "nearby-item__quality";
}

export function PlaceDetail({
  place,
  isSaved,
  onToggleSaved,
  onClose,
  nearby,
  onSelectNearby,
  getPlace,
  previousPlace,
  onBack,
}: Props) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, [place.id]);

  // A nearby jump swaps the content of the same panel; start the new place from the top.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [place.id]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const images = resolvePlaceImages(place.id, place.images);
  const brief = imageBriefText(place);
  const duration = resolveDuration(place.duration);
  const category = splitCategory(place.category);
  const severity = alertSeverity(place.febMar2027.status);
  const reservation = describeReservationForUi(interpretPlaceReservation(place), place.reservation.leadTime);
  const showExperience = place.experience && place.experience !== place.description;

  const nearbyPlaces = nearby.flatMap((relation) => {
    const target = getPlace(relation["Hacia ID"]);
    if (!target) return [];
    return [
      {
        relation,
        target,
        transfer: getBestTransfer(place.id, target.id),
      },
    ];
  });
  const nearbyFootnote = transferListFootnote(nearbyPlaces.map(({ transfer }) => transfer));

  return (
    <div className="place-detail" aria-labelledby="place-detail-title">
      <div className="place-detail__bar">
        {previousPlace ? (
          <button type="button" className="place-detail__back" onClick={onBack}>
            <span aria-hidden="true">←</span> {previousPlace.name}
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          className="icon-button"
          onClick={onClose}
          ref={closeButtonRef}
          aria-label={`Cerrar la ficha de ${place.name}`}
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>

      <div className="place-detail__scroll" ref={scrollRef}>
        <PlaceGallery key={place.id} images={images} imageBrief={brief} placeName={place.name} />

        <div className="place-detail__body">
          <header className="place-detail__title-block">
            <p className="place-detail__eyebrow">
              <span aria-hidden="true">{category.icon}</span> {category.label}
              <span aria-hidden="true"> · </span>
              {place.neighborhood || place.municipality}
            </p>
            <h2 id="place-detail-title">{place.name}</h2>
            {place.japaneseName && (
              <p className="place-detail__japanese" lang="ja">
                {place.japaneseName}
              </p>
            )}
            <div className="tag-row">
              <span className={`tag tag--grade-${place.grade}`}>Grado {place.grade}</span>
              {isHiddenGem(place) && (
                <span className="tag tag--gem">
                  <span aria-hidden="true">💎</span> {place.hiddenGemStatus}
                </span>
              )}
              <span className="tag tag--muted">Turismo: {place.tourismLevel}</span>
              {reservation.tag && (
                <span className={`tag ${reservation.tag.className}`}>{reservation.tag.label}</span>
              )}
            </div>
          </header>

          <button
            type="button"
            className={`button button--primary save-button ${isSaved ? "save-button--saved" : ""}`}
            onClick={() => onToggleSaved(place.id)}
            aria-pressed={isSaved}
          >
            <span aria-hidden="true">{isSaved ? "✓" : "＋"}</span>
            {isSaved ? "Guardado en Quiero ir" : "Quiero ir"}
          </button>

          <p className="place-detail__description">{place.description}</p>

          {place.differentiator && (
            <section className="highlight">
              <h3 className="highlight__title">Por qué vale la pena</h3>
              <p>{place.differentiator}</p>
            </section>
          )}

          {showExperience && (
            <section className="place-detail__section">
              <h3>Qué se hace o se ve</h3>
              <p>{place.experience}</p>
            </section>
          )}

          <div className="quick-facts">
            <QuickFact
              icon="⏱"
              label="Tiempo de visita"
              value={duration ? formatRange(duration) : place.duration.raw}
            />
            <QuickFact icon="💴" label="Precio" value={formatPrice(place)} />
            <QuickFact icon="🕰" label="Mejor momento" value={place.bestTime} />
            <QuickFact icon="🗓" label="Mejor época" value={place.bestSeason} />
          </div>

          <section className={`alert alert--${severity}`}>
            <h3 className="alert__title">
              <span aria-hidden="true">{severity === "confirmed" ? "✓" : severity === "risk" ? "⚠" : "ⓘ"}</span>{" "}
              Febrero–marzo 2027
              <span className="alert__severity">{severityLabel(severity)}</span>
            </h3>
            <p className="alert__status">{place.febMar2027.status}</p>
            <p>{place.febMar2027.warning}</p>
            {place.febMar2027.action && (
              <p className="alert__action">
                <strong>Qué hacer:</strong> {place.febMar2027.action}
              </p>
            )}
          </section>

          <section className="place-detail__section">
            <h3>Información práctica</h3>
            <dl className="detail-rows">
              <Row label="Horario" value={place.schedule.hours} />
              <Row label="Cierres" value={place.schedule.closures} />
              <Row label="Reserva" value={reservation.practicalRow} />
              <Row label="Cómo llegar" value={place.transport} />
              <Row label="Accesibilidad" value={place.accessibility} />
              <Row label="Aglomeración" value={place.crowdLevel} />
            </dl>
          </section>

          <div className="link-row">
            {place.officialUrl && (
              <a className="button button--secondary" href={place.officialUrl} target="_blank" rel="noreferrer">
                Sitio oficial <span aria-hidden="true">↗</span>
              </a>
            )}
            {place.googleMapsUrl && (
              <a className="button button--secondary" href={place.googleMapsUrl} target="_blank" rel="noreferrer">
                Google Maps <span aria-hidden="true">↗</span>
              </a>
            )}
          </div>

          {nearbyPlaces.length > 0 && (
            <section className="place-detail__section">
              <h3>Cerca de aquí</h3>
              <ul className="nearby-list">
                {nearbyPlaces.map(({ relation, target, transfer }) => {
                  const display = transfer ? describeTransferForUi(transfer) : null;
                  return (
                    <li key={target.id}>
                      <button type="button" className="nearby-item" onClick={() => onSelectNearby(target.id)}>
                        <span className="nearby-item__text">
                          <span className="nearby-item__name">{target.name}</span>
                          <span className="nearby-item__relation">{relation["Relación"]}</span>
                        </span>
                        <span className="nearby-item__distance">
                          {display?.distanceText ?? `${relation["Distancia km"]} km`}
                          <span className="nearby-item__mode">
                            {relation["Modo"]} · {display?.timeText ?? `~${relation["Min aprox."]} min`}
                          </span>
                          <span className={nearbyQualityClassName(transfer)}>
                            {display?.qualityLabel ?? "Estimación geográfica"}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <p className="place-detail__footnote">{nearbyFootnote}</p>
            </section>
          )}

          <p className="place-detail__updated">Datos actualizados el {place.updatedAt}</p>
        </div>
      </div>
    </div>
  );
}
