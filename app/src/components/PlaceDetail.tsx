import { useEffect, useRef } from "react";
import type { NearbyRelation, Place } from "../types";
import { PlaceGallery } from "./PlaceGallery";
import { PlaceCard } from "./PlaceCard";
import { EvidenceMark } from "./EvidenceMark";
import { PersonToken } from "./PersonToken";
import { resolvePlaceImages } from "../data/place-images";
import { resolveDuration, formatRange } from "../lib/duration";
import { getBestTransfer, transferRelationLabel } from "../lib/transfer";
import {
  describeTransferForUi,
  transferEvidenceDetail,
  transferEvidenceLevel,
} from "../lib/transfer-display";
import { describeReservationForUi, interpretPlaceReservation } from "../lib/reservation";
import { describeFebMarStatusForUi, interpretPlaceFebMarStatus } from "../lib/feb-mar-status";
import { formatPrice, imageBriefText, isHiddenGem, splitCategory } from "../lib/place";
import { categoryPresentation } from "../lib/category-presentation";
import { interestLevelForPlace } from "../lib/interest-level";
import { stanceLines, travellerVariant } from "../lib/traveller-presentation";
import type { InterestStance, PlaceInterestSummary, Traveller } from "../lib/travellers";
import { Icon, type IconName } from "../icons/Icon";

/**
 * Bloque 20 (B4) — la ficha de lugar, reordenada según `05 §5`.
 *
 * El contrato que manda sobre todo lo demás: **ningún dato desaparece**. La matriz firmada de
 * las 55 filas de v1.1.0 → su destino exacto está en `docs/BLOCK_20_INVENTORY.md`, escrita
 * antes de tocar este fichero.
 *
 * Los cuatro defectos que corrige, por si alguien vuelve a introducirlos:
 *
 * - **D2** — la atribución fotográfica ya no se pinta entre la fotografía y el nombre; vive en
 *   `CreditsSheet` tras el `ⓘ` de la galería (`04 §7`).
 * - **D3** — pantalla completa en teléfono, sin ninguna barra encima.
 * - **D4** — desaparece el `×` flotante. El botón atrás flotante es la única salida visible, y
 *   nombra a dónde va.
 * - **D8** — la franja de los dos sólo se renderiza si alguien ha opinado, en vez de estrenarse
 *   con dos filas vacías.
 *
 * Y las tres decisiones que se cerraron antes de escribirlo (`09`): DDR-04 acota «Fuentes» a lo
 * que el modelo tiene de verdad, DDR-05 deja el planificador fuera de este bloque, y DDR-06
 * traslada la nota al pie de «Cerca de aquí» al `detail` del marcador de cada traslado.
 */

type Props = {
  place: Place;
  /** Block 5: the ACTIVE reader's own interest, not shared-shortlist membership. */
  isSaved: boolean;
  onToggleSaved: (id: string) => void;
  /**
   * Bloque 20 (`05 §5` pt. 12): «Cerca de aquí» pasa de lista de texto a `PlaceCard compact`, y
   * una tarjeta tiene su propio corazón. Sin este predicado la ficha tendría que afirmar que
   * ningún lugar cercano está guardado, que es una afirmación falsa — y `isSaved` sólo sabe del
   * lugar que se está leyendo.
   */
  isPlaceSaved: (id: string) => boolean;
  /** Block 5: the two-person picture, and the explicit refusal. Omitted, the detail renders
   * exactly as it did before this block. */
  travellers?: readonly Traveller[];
  interestSummary?: PlaceInterestSummary;
  activeStance?: InterestStance | null;
  onSetStance?: (placeId: string, stance: InterestStance | null) => void;
  onClose: () => void;
  nearby: NearbyRelation[];
  onSelectNearby: (id: string) => void;
  /** Resolves a nearby relation's target id to its place, wherever it lives in the dataset. */
  getPlace: (id: string) => Place | undefined;
  /** Place the user came from via a "nearby" jump, so they can step back. */
  previousPlace: Place | null;
  onBack: () => void;
  /**
   * Corrección final de B18 (punto 3/4): nombre visible de la superficie que abrió esta ficha
   * cuando no hay un `previousPlace` (base de la pila, no un salto "cerca de aquí") — hoy sólo
   * lo pasa Viaje («Dónde dormir»), porque es la única pestaña cuyo `ficheOrigin` no basta para
   * saber a qué volver. `null`/`undefined` reproduce el comportamiento anterior (sin chevron en
   * la base de la pila, sólo el cierre genérico).
   */
  originLabel?: string | null;
  /**
   * «Ver en el mapa» (punto 3): la única acción, desde una ficha abierta fuera de Explorar,
   * autorizada a cambiar de destino. Sólo Viaje la recibe hoy; `undefined` no renderiza nada —
   * ni Explorar (ya está en su propio mapa) ni Quiero ir (fuera del alcance de esta decisión)
   * ganan un botón nuevo.
   */
  onViewOnMap?: () => void;
  /**
   * Bloque 20 (B4, `04 §7`): el pie de `CreditsSheet` enlaza a «Fuentes y licencias» en
   * Nosotros. Es una acción explícita de cambio de destino, así que cumple la invariante 4 de
   * DD-015 —cierra la ficha de origen— y la ejecuta `App`, no este componente. `undefined` no
   * renderiza el pie: nunca un enlace que no lleva a ninguna parte.
   */
  onOpenSources?: () => void;
};

/**
 * `05 §5` pt. 10: «Cada valor con su `EvidenceMark`».
 *
 * El nivel honesto para **todos** los datos prácticos de la ficha es `Registrado` (`◧`), que
 * `03 §1.4` define exactamente como «está en el dataset de investigación». No es `Verificado`:
 * nada de esta pantalla se consulta contra una fuente oficial en tiempo de lectura, y decir
 * `◼` afirmaría una consulta que nadie ha hecho. No es `Estimado` ni `Nihon dice`: los valores
 * no se calculan aquí ni son juicio editorial, son campos registrados del catálogo.
 *
 * Uniforme y verdadero vale más que variado e inventado. Cuando el dataset gane procedencia
 * real por campo —el trabajo que DDR-04 deja fuera de este bloque—, este nivel podrá
 * diferenciarse por campo con evidencia detrás.
 *
 * Se renderiza en modo sólo-glifo (`label={false}`): el texto no desaparece, pasa a
 * `aria-label`/`title` (`04 §2`), y la rejilla no se llena de diez etiquetas idénticas.
 */
const RECORDED = "registrado" as const;

function RecordedMark() {
  return <EvidenceMark level={RECORDED} label={false} />;
}

function QuickFact({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="quick-fact">
      <span className="quick-fact__icon" aria-hidden="true">
        <Icon name={icon} size={20} />
      </span>
      <span className="quick-fact__body">
        <span className="quick-fact__label">{label}</span>
        <span className="quick-fact__value">
          {value} <RecordedMark />
        </span>
      </span>
    </div>
  );
}

/** Una fila de dato práctico. `extra` es la degradación de DD-011: cuando el aviso de
 * febrero–marzo 2027 no llega a ser un problema real, baja aquí como una línea más. */
function Row({
  label,
  value,
  extra,
}: {
  label: string;
  value: string;
  extra?: React.ReactNode;
}) {
  if (!value && !extra) return null;
  return (
    <div className="detail-row">
      <dt>{label}</dt>
      <dd>
        {value && (
          <span className="detail-row__value">
            {value} <RecordedMark />
          </span>
        )}
        {extra}
      </dd>
    </div>
  );
}

export function PlaceDetail({
  place,
  isSaved,
  onToggleSaved,
  isPlaceSaved,
  travellers,
  interestSummary,
  activeStance = null,
  onSetStance,
  onClose,
  nearby,
  onSelectNearby,
  getPlace,
  previousPlace,
  onBack,
  originLabel = null,
  onViewOnMap,
  onOpenSources,
}: Props) {
  const backButtonRef = useRef<HTMLButtonElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    backButtonRef.current?.focus();
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
  const { icon: categoryLineIcon } = categoryPresentation(place.category);
  const interest = interestLevelForPlace(place);
  const febMarStatus = describeFebMarStatusForUi(interpretPlaceFebMarStatus(place));
  const reservation = describeReservationForUi(interpretPlaceReservation(place), place.reservation.leadTime);
  const showExperience = place.experience && place.experience !== place.description;
  const zone = place.neighborhood || place.municipality;

  /**
   * DD-011 / `05 §5` pt. 11 — el aviso deja de ser permanente. Sólo se renderiza como alerta
   * **si hay un problema real**; el estado «pendiente de confirmar» no lo es, y baja a una línea
   * dentro de «Horario» con marcador `◧`. Es exactamente el mismo criterio que `PlaceCard` ya
   * usa para decidir su segundo chip (`04 §5.7`), leído de la misma función — no un umbral nuevo.
   */
  const febMarIsRealProblem = febMarStatus.tone === "attention";
  const febMarDegradesToScheduleLine = febMarStatus.tone === "pending";

  /**
   * D8 — la franja de los dos, sólo si alguien ha opinado. `stanceLines` devuelve siempre una
   * línea por viajero, «todavía no ha dicho nada» incluida; lo que este bloque cambia es que
   * dos silencios no son una opinión y no estrenan la ficha con dos filas vacías.
   */
  const lines = travellers && interestSummary ? stanceLines(interestSummary, travellers) : [];
  const someoneHasSpoken = lines.some((line) => line.stance !== "silent");

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

  /**
   * D4 — el `×` flotante desaparece. Queda un único botón atrás flotante arriba-izquierda sobre
   * `--scrim-top` (`05 §5` pt. 1) que, además, **dice a dónde va**: al lugar anterior cuando se
   * llegó por un salto «cerca de aquí», o a la superficie que abrió la ficha cuando ésta la
   * nombra. Sin nombre que mostrar conserva el nombre accesible exacto de v1.1.0 («Cerrar la
   * ficha de …»), que sigue siendo verdad: cerrar la ficha es volver a la lista.
   */
  const backTarget = previousPlace
    ? { label: previousPlace.name, action: onBack }
    : originLabel
      ? { label: originLabel, action: onClose }
      : { label: null, action: onClose };
  const backAccessibleName = backTarget.label
    ? `Volver a ${backTarget.label}`
    : `Cerrar la ficha de ${place.name}`;

  return (
    <div className="place-detail" aria-labelledby="place-detail-title">
      <div className="place-detail__scroll" ref={scrollRef}>
        <div className="place-detail__hero">
          <PlaceGallery
            key={place.id}
            images={images}
            imageBrief={brief}
            placeName={place.name}
            onOpenSources={onOpenSources}
          />
          <button
            type="button"
            className="place-detail__back"
            ref={backButtonRef}
            onClick={backTarget.action}
            aria-label={backAccessibleName}
            title={backAccessibleName}
          >
            <Icon name="atras" size={20} />
            {backTarget.label && <span className="place-detail__back-label">{backTarget.label}</span>}
          </button>
        </div>

        <div className="place-detail__body">
          <header className="place-detail__title-block">
            {/* pt. 5 — insignia «★ Imprescindible» SÓLO si grado S. Nunca «Grado A» (Art. 6,
                `04 §5.3`): la letra sobrevive en «Fuentes», y en ningún otro sitio. */}
            {interest.level === "imprescindible" && (
              <p className="place-detail__badge">
                <span aria-hidden="true">★</span> Imprescindible
              </p>
            )}
            <h2 id="place-detail-title">{place.name}</h2>
            {place.japaneseName && (
              <p className="place-detail__japanese" lang="ja">
                {place.japaneseName}
              </p>
            )}
            {/* pt. 4 — una sola línea de categoría y barrio, DEBAJO del nombre y con un solo
                `·` (`03 §2.3`: prohibidos los eyebrows y las cadenas de tres partes). */}
            <p className="place-detail__where">
              <Icon name={categoryLineIcon} size={16} aria-hidden="true" />
              {category.label}
              <span aria-hidden="true"> · </span>
              {zone}
            </p>
            {isHiddenGem(place) && (
              <p className="place-detail__gem">
                <Icon name="joya" size={16} aria-hidden="true" /> {place.hiddenGemStatus}
              </p>
            )}
          </header>

          {/* pt. 6 — el primario a ancho completo y «No me interesa» a su lado, en `quiet`.
              El rechazo explícito sube aquí desde el bloque de los dos: es una respuesta, no
              una nota al margen. */}
          <div className="place-detail__actions">
            <button
              type="button"
              className={`button button--primary button--lg save-button ${isSaved ? "save-button--saved" : ""}`}
              onClick={() => onToggleSaved(place.id)}
              aria-pressed={isSaved}
            >
              <span aria-hidden="true" className="save-button__icon">
                <Icon name={isSaved ? "corazon-relleno" : "corazon"} size={20} />
              </span>
              {isSaved ? "Ya lo quieres ver" : "Quiero ir"}
            </button>

            {onSetStance && (
              <button
                type="button"
                className="button button--quiet place-interest__decline"
                aria-pressed={activeStance === "not-interested"}
                onClick={() =>
                  onSetStance(place.id, activeStance === "not-interested" ? null : "not-interested")
                }
              >
                {activeStance === "not-interested" ? "Quitar «no me interesa»" : "No me interesa"}
              </button>
            )}
          </div>

          {/*
            Corrección final de B18 (punto 3): la única salida explícita y etiquetada de una
            ficha abierta desde Viaje. Reutiliza el patrón ya existente de botón secundario
            (idéntico al "Abrir el planificador" de `ZoneComparison`) en vez de inventar un
            bloque visual nuevo — cero CSS nuevo. Etiqueta completa, nunca icon-only.
          */}
          {onViewOnMap && (
            <button
              type="button"
              className="button button--secondary place-detail__view-on-map"
              onClick={onViewOnMap}
            >
              <Icon name="mapa" size={16} /> Ver en el mapa
            </button>
          )}

          {/*
            pt. 7 — la franja de los dos. Una sola línea, y sólo si alguien ha opinado.

            Sigue sin totalizarse, puntuarse o convertirse en una sugerencia: son dos
            preferencias declaradas una al lado de la otra, y qué hacer con ellas es asunto de
            quien lee. «Todavía no ha dicho nada» sigue siendo una respuesta de primera clase
            **cuando la otra persona sí ha dicho algo**; lo que D8 corrige es estrenar la ficha
            con dos silencios presentados como si fueran información.
          */}
          {travellers && travellers.length > 0 && someoneHasSpoken && (
            <p className="place-interest__line">
              {lines.map((line, position) => (
                <span key={line.travellerId} className="place-interest__person">
                  {position > 0 && <span aria-hidden="true" className="place-interest__sep"> · </span>}
                  {/* El token es la marca visual de quién habla; el nombre va escrito justo
                      al lado, así que repetirlo en `aria-label` haría que un lector de
                      pantalla lo dijera dos veces (`04 §1`). */}
                  <span aria-hidden="true">
                    <PersonToken
                      traveller={travellers.find((entry) => entry.id === line.travellerId) ?? null}
                      variant={travellerVariant(travellers, line.travellerId)}
                      size="xs"
                    />
                  </span>{" "}
                  <strong>{line.label}</strong> {line.text}
                </span>
              ))}
            </p>
          )}

          {/* pt. 8 — «el mejor tratamiento tipográfico del producto»: `--type-quote`,
              `--font-voice`, sin comillas decorativas, filete vertical `--shu-600` de 2 px. */}
          {place.differentiator && (
            <section className="highlight">
              <h3 className="highlight__title">Por qué vale la pena</h3>
              <p className="highlight__quote">{place.differentiator}</p>
            </section>
          )}

          {/* pt. 9 — «Qué es» gana título propio; «Qué se hace o se ve» se conserva. */}
          <section className="place-detail__section">
            <h3>Qué es</h3>
            <p>{place.description}</p>
          </section>

          {showExperience && (
            <section className="place-detail__section">
              <h3>Qué se hace o se ve</h3>
              <p>{place.experience}</p>
            </section>
          )}

          {/* pt. 11 — el aviso, sólo si hay un problema real (DD-011). Va ANTES de los datos
              prácticos porque cuando existe es lo que cambia la decisión; cuando no existe, no
              ocupa nada. */}
          {febMarIsRealProblem && (
            <section className={`alert alert--${febMarStatus.cssModifier}`}>
              <h3 className="alert__title">
                <Icon name={febMarStatus.icon} size={20} /> Febrero–marzo 2027
                <span className="alert__severity">{febMarStatus.label}</span>
              </h3>
              <p className="alert__status">{place.febMar2027.status}</p>
              <p>{place.febMar2027.warning}</p>
              {place.febMar2027.action && (
                <p className="alert__action">
                  <strong>Qué hacer:</strong> {place.febMar2027.action}
                </p>
              )}
            </section>
          )}

          {/* pt. 10 — datos prácticos: rejilla de 2 columnas y, debajo, las filas. Títulos en
              caja de frase, nunca en mayúsculas (`03 §2.3`). */}
          <section className="place-detail__section">
            <h3>Datos prácticos</h3>
            <div className="quick-facts">
              <QuickFact
                icon="reloj"
                label="Tiempo de visita"
                value={duration ? formatRange(duration) : place.duration.raw}
              />
              <QuickFact icon="precio" label="Precio" value={formatPrice(place)} />
              <QuickFact icon="reloj" label="Mejor momento" value={place.bestTime} />
              <QuickFact icon="calendario" label="Mejor época" value={place.bestSeason} />
            </div>
            <dl className="detail-rows">
              <Row
                label="Horario"
                value={place.schedule.hours}
                extra={
                  febMarDegradesToScheduleLine ? (
                    <span className="detail-row__note">
                      Sin cierre confirmado para feb–mar 2027 · reconfirmar antes de ir{" "}
                      <EvidenceMark level={RECORDED} detail={place.febMar2027.status} label={false} />
                    </span>
                  ) : undefined
                }
              />
              <Row label="Cierres" value={place.schedule.closures} />
              <Row label="Reserva" value={reservation.practicalRow} />
              <Row label="Cómo llegar" value={place.transport} />
              <Row label="Accesibilidad" value={place.accessibility} />
              <Row label="Afluencia" value={place.crowdLevel} />
              <Row label="Turismo" value={place.tourismLevel} />
            </dl>
          </section>

          {/* pt. 12 — «Cerca de aquí»: carrusel horizontal de `PlaceCard compact` con miniatura.
              Cada traslado lleva su `EvidenceMark` y, dentro de él, la distinción semántica que
              hasta v1.1.0 explicaba la nota al pie (DDR-06). Aquí NO hay nota al pie. */}
          {nearbyPlaces.length > 0 && (
            <section className="place-detail__section">
              <h3>Cerca de aquí</h3>
              <ul className="nearby-carousel">
                {nearbyPlaces.map(({ relation, target, transfer }) => {
                  const display = transfer ? describeTransferForUi(transfer) : null;
                  return (
                    <li key={target.id} className="nearby-carousel__item">
                      <PlaceCard
                        place={target}
                        variant="compact"
                        selected={false}
                        saved={isPlaceSaved(target.id)}
                        onSelect={onSelectNearby}
                        onToggleSaved={onToggleSaved}
                      />
                      <p className="nearby-carousel__transfer">
                        <span className="nearby-carousel__relation">
                          {transferRelationLabel(relation["Relación"])}
                        </span>
                        <span className="nearby-carousel__figures">
                          {display?.distanceText ?? `${relation["Distancia km"]} km`}
                          <span aria-hidden="true"> · </span>
                          {relation["Modo"]} {display?.timeText ?? `~${relation["Min aprox."]} min`}
                        </span>
                        <EvidenceMark
                          level={transferEvidenceLevel(transfer)}
                          detail={transferEvidenceDetail(transfer)}
                        />
                      </p>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* pt. 13 — enlaces. */}
          <div className="link-row">
            {place.officialUrl && (
              <a className="button button--secondary" href={place.officialUrl} target="_blank" rel="noreferrer">
                Sitio oficial <Icon name="enlace-externo" size={16} />
              </a>
            )}
            {place.googleMapsUrl && (
              <a className="button button--secondary" href={place.googleMapsUrl} target="_blank" rel="noreferrer">
                Google Maps <Icon name="enlace-externo" size={16} />
              </a>
            )}
          </div>

          {/*
            pt. 14 — «Fuentes», plegada por defecto. **DDR-04**: sólo evidencia que existe de
            verdad para ESTE lugar — el grado original (la letra, que `08` prohíbe fuera de
            aquí), la fecha de actualización del registro, y los enlaces que el contrato ya
            reconoce como fuente.

            Lo que NO hay, y no se fabrica: `provenance`, `consultedAt`, frescura por lugar y
            versión del dataset no existen en el modelo `Place`. No se derivan desde `updatedAt`
            —que significa «cuándo se actualizó el registro», no «cuándo se consultó una
            fuente»— y no se rellenan con placeholders del tipo «Procedencia: no disponible».
            Cuando existan en datos, `05 §5` pt. 14 volverá a admitirlos.
          */}
          <details className="place-sources">
            <summary className="place-sources__summary">Fuentes</summary>
            <dl className="place-sources__list">
              <div className="place-sources__row">
                <dt>Grado original</dt>
                <dd>
                  {place.grade} · {interest.label}
                  <span className="place-sources__gloss">{interest.description}</span>
                </dd>
              </div>
              <div className="place-sources__row">
                <dt>Registro actualizado</dt>
                <dd>{place.updatedAt}</dd>
              </div>
              {place.officialUrl && (
                <div className="place-sources__row">
                  <dt>Sitio oficial</dt>
                  <dd>
                    <a href={place.officialUrl} target="_blank" rel="noreferrer">
                      {place.officialUrl}
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          </details>
        </div>
      </div>
    </div>
  );
}
