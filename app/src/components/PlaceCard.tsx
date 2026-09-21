import { useLayoutEffect, useRef, useState } from "react";
import type { Place } from "../types";
import { CARD_IMAGE_WIDTH, cardImageUrl, resolvePlaceImages } from "../data/place-images";
import { formatRange, resolveDuration } from "../lib/duration";
import { interestLevelForPlace } from "../lib/interest-level";
import { isHiddenGem, splitCategory } from "../lib/place";
import { categoryPresentation } from "../lib/category-presentation";
import { interpretPlaceReservation } from "../lib/reservation";
import { describeFebMarStatusForUi, interpretPlaceFebMarStatus } from "../lib/feb-mar-status";
import type { OtherPersonMarker } from "../lib/traveller-presentation";
import { Icon } from "../icons/Icon";
import { PersonToken } from "./PersonToken";
import { PhotoPlaceholder } from "./PhotoPlaceholder";

type Variant = "normal" | "compact";

type Props = {
  place: Place;
  selected: boolean;
  saved: boolean;
  onSelect: (id: string) => void;
  onToggleSaved: (id: string) => void;
  /**
   * Bloque 19 (B3, `04 §5.5`): el `PersonToken` junto al corazón. `null` (el caso más común, y el
   * único que puede darse cuando nadie más ha opinado) no renderiza nada — nunca un token que
   * signifique "no". Función, no un valor precomputado, por la misma razón que
   * `interestMarkerFor`: la lista nunca calcula el marcador de una tarjeta que no va a pintar.
   */
  otherPersonMarker?: OtherPersonMarker | null;
  /** `04 §5.10`: fila horizontal, miniatura 72×72, una sola línea de metadato. Usada en B19 por
   * la hoja de búsqueda; Quiero ir/planner/«Cerca de aquí» siguen fuera de alcance (B4/B7/B9). */
  variant?: Variant;
  /**
   * `06 §6.3`: "`loading=\"lazy\"` en todo salvo: la primera tarjeta visible de una lista …, que
   * lleva `fetchpriority=\"high\"`". `false` (por defecto) para el resto — la lista nunca marca
   * más de una tarjeta como prioritaria a la vez.
   */
  priority?: boolean;
};

type MediaState = "loading" | "loaded" | "error";

/**
 * Visit time, shown only when the dataset actually supports one.
 *
 * `resolveDuration` returns null for day-scale text ("Día completo", "1–2 días") because those
 * are not visit minutes. Rather than hide the information, the raw editorial text is shown as
 * written — the card never invents a number, and never turns a day-scale commitment into a
 * minute range.
 */
function durationLabel(place: Place): string {
  const range = resolveDuration(place.duration);
  return range ? formatRange(range) : place.duration.raw.trim();
}

/**
 * The short "why this is worth it" line. `differentiator` is the dataset's own one-sentence
 * argument for the place, which is exactly what a scanning reader needs; `description` is the
 * factual what-it-is and is the fallback when no differentiator was recorded. Nothing is
 * generated: the full text stays available in the place detail, the card only clamps it.
 */
function reasonText(place: Place): string {
  const differentiator = place.differentiator?.trim();
  if (differentiator) return differentiator;
  return place.description?.trim() ?? "";
}

/**
 * Bloque 19 (B3, `04 §5.7`) — el segundo chip, cuando lo hay. Prioridad fija, uno solo:
 * aviso real > reserva obligatoria > joya escondida. «Aviso real» reutiliza la misma
 * interpretación que ya decide si la ficha muestra el recuadro de alerta de febrero–marzo 2027
 * (DD-011: el estado «pendiente de confirmar» no cuenta) — no se inventa un criterio nuevo.
 */
type SecondChip = { icon: "aviso" | "ticket" | "joya"; label: string } | null;

function secondChip(place: Place): SecondChip {
  const febMar = describeFebMarStatusForUi(interpretPlaceFebMarStatus(place));
  if (febMar.tone === "attention") return { icon: "aviso", label: febMar.label };

  if (interpretPlaceReservation(place).category === "required") {
    return { icon: "ticket", label: "Requiere reserva" };
  }

  if (isHiddenGem(place)) return { icon: "joya", label: "Hidden gem" };

  return null;
}

/**
 * Photo-led place card (`04 §5`).
 *
 * Markup note: the card is an `<article>`, not a `<button>`, because it carries two independent
 * actions — open the place, and save it. DDR-02 places the stretched open button directly under
 * the `<article>` so its box can cover media and body without escaping either one; the visible
 * name remains in the photographic band. The save control (and the other person's token, when
 * there is one) sit above that target. Nesting one button inside another is invalid HTML and
 * breaks keyboard and screen-reader behaviour.
 */
export function PlaceCard({
  place,
  selected,
  saved,
  onSelect,
  onToggleSaved,
  otherPersonMarker = null,
  variant = "normal",
  priority = false,
}: Props) {
  const [mediaState, setMediaState] = useState<MediaState>("loading");
  const images = resolvePlaceImages(place.id, place.images);
  const image = images[0];
  /** Falls back to the original whenever no derivative exists for this URL shape. */
  const cardSrc = image ? cardImageUrl(image.url) ?? image.url : undefined;
  const hasPhoto = Boolean(image) && mediaState !== "error";
  const category = splitCategory(place.category);
  const { label: categoryLabel } = categoryPresentation(place.category);
  const interest = interestLevelForPlace(place);
  const reason = reasonText(place);
  const zone = place.neighborhood || place.municipality;
  const chip2 = variant === "normal" ? secondChip(place) : null;

  // `04 §5.2`: el nombre nace en `--type-title-m` (20/26); si a esa medida el texto no cabe en
  // 2 líneas, baja a `--type-title-s` (17/24) — nunca se trunca con puntos suspensivos en mitad
  // de una palabra. La detección compara `scrollHeight` (altura real del texto sin recortar)
  // contra `clientHeight` (tope de 2 líneas que fija el CSS), no `-webkit-line-clamp`, cuyo
  // `scrollHeight` no es fiable para esta comparación entre motores. Sólo aplica a la variante
  // `normal`: `compact` no coloca el nombre sobre una fotografía.
  const nameRef = useRef<HTMLSpanElement>(null);
  const [nameTight, setNameTight] = useState(false);

  useLayoutEffect(() => {
    if (variant !== "normal") return;
    const node = nameRef.current;
    if (!node) return;
    setNameTight(node.scrollHeight > node.clientHeight + 1);
  }, [variant, place.name]);

  const nameSlot =
    variant === "normal" ? (
      <span
        ref={nameRef}
        className={`place-card__name-text ${nameTight ? "place-card__name-text--tight" : ""}`.trim()}
      >
        {place.name}
      </span>
    ) : (
      place.name
    );

  const openButton = (
    <button
      type="button"
      className="place-card__open"
      data-stretch-target=".place-card"
      onClick={() => onSelect(place.id)}
      aria-label={`${place.name}. ${interest.label}. ${category.label} en ${zone}.`}
    />
  );

  if (variant === "compact") {
    return (
      <article
        className={`place-card place-card--compact ${selected ? "place-card--selected" : ""} ${
          saved ? "place-card--saved" : ""
        }`}
        aria-current={selected ? "true" : undefined}
      >
        {openButton}
        <div className={`place-card__media ${hasPhoto ? "" : "place-card__media--empty"}`}>
          {image && mediaState !== "error" ? (
            <img
              className="place-card__image"
              src={cardSrc}
              width={CARD_IMAGE_WIDTH}
              height={CARD_IMAGE_WIDTH}
              sizes="72px"
              alt=""
              {...(priority ? { fetchPriority: "high" as const } : { loading: "lazy" as const })}
              decoding="async"
              data-state={mediaState}
              onLoad={() => setMediaState("loaded")}
              onError={() => setMediaState("error")}
            />
          ) : (
            <span className="place-card__placeholder-compact" aria-hidden="true">
              <Icon name={categoryPresentation(place.category).icon} size={20} />
            </span>
          )}
        </div>
        <div className="place-card__body">
          <h3 className="place-card__heading">{nameSlot}</h3>
          <p className="place-card__meta">
            {categoryLabel}
            <span aria-hidden="true"> · </span>
            {zone}
          </p>
        </div>
        <button
          type="button"
          className={`place-card__save place-card__save--compact tap-target-min ${
            saved ? "place-card__save--on" : ""
          }`}
          onClick={() => onToggleSaved(place.id)}
          aria-pressed={saved}
          aria-label={saved ? `Quitar ${place.name} de Quiero ir` : `Guardar ${place.name} en Quiero ir`}
          title={saved ? "Quitar de Quiero ir" : "Quiero ir"}
        >
          <span className="place-card__save-icon" aria-hidden="true">
            <Icon name={saved ? "corazon-relleno" : "corazon"} size={16} />
          </span>
        </button>
      </article>
    );
  }

  return (
    <article
      className={`place-card ${selected ? "place-card--selected" : ""} ${
        saved ? "place-card--saved" : ""
      }`}
      aria-current={selected ? "true" : undefined}
    >
      {openButton}
      <div className={`place-card__media ${hasPhoto ? "" : "place-card__media--empty"}`}>
        {image && mediaState !== "error" ? (
          <>
            {mediaState === "loading" && <span className="place-card__skeleton" aria-hidden="true" />}
            {/* The card-sized rendition, not the 1600px detail hero. `sizes` describes the
                real card geometry at each breakpoint so the browser never fetches more than
                the slot needs; `width`/`height` are declared so the box is reserved before
                the bytes arrive and the card cannot shift under the text. */}
            <img
              className="place-card__image"
              src={cardSrc}
              width={CARD_IMAGE_WIDTH}
              height={Math.round((CARD_IMAGE_WIDTH * 3) / 4)}
              // Corrección de B19 (DD-016): la geometría real de la ranura en cada tramo, ahora
              // que la lista se queda con todo el ancho que el raíl no usa (`App.css`) y decide
              // sus columnas por el ancho de su propia región (`discovery.css`). `NavRail` mide
              // 88px desde `md` y el raíl del mapa 480px desde `lg`; `padding`/`gap` de la
              // rejilla son 12px. Es una pista para el selector de resolución, no un breakpoint
              // de layout: aproximar por lo alto no rompe nada, servir de más sí.
              sizes="(min-width: 1200px) 340px, (min-width: 840px) calc(50vw - 62px), (min-width: 600px) calc(50vw - 18px), calc(100vw - 24px)"
              alt=""
              {...(priority ? { fetchPriority: "high" as const } : { loading: "lazy" as const })}
              decoding="async"
              data-state={mediaState}
              onLoad={() => setMediaState("loaded")}
              onError={() => setMediaState("error")}
            />
          </>
        ) : (
          <PhotoPlaceholder place={place} variant={mediaState === "error" ? "error" : "missing"} />
        )}

        {/* `04 §5`: el nombre y la línea de categoría·zona van sobre la fotografía, con
            `--scrim-bottom` obligatorio. Sin fotografía, `PhotoPlaceholder` ya muestra el
            nombre por su cuenta (`04 §9`) — este overlay se oculta visualmente mientras el
            botón que abre la ficha (y su nombre accesible) sigue existiendo, para que el
            comportamiento de apertura/foco no dependa de si hay foto. */}
        <div className={`place-card__overlay ${hasPhoto ? "" : "place-card__overlay--hidden"}`}>
          {/* Corrección de B19 (DD-016): la banda es un elemento propio porque su scrim tiene
              que apoyarse en SU altura —la del texto—, no en la de la fotografía. Con el
              degradado puesto sobre el overlay entero, el borde superior del texto caía donde
              `--scrim-bottom` ya vale ~0.05 y sólo un `text-shadow` (prohibido por `03 §5`) lo
              sostenía. Ver `styles/discovery.css`, `.place-card__band`. */}
          <div className="place-card__band">
            {interest.level === "imprescindible" && (
              <span className="place-card__badge">
                <span aria-hidden="true">★</span> Imprescindible
              </span>
            )}
            <h3 className="place-card__heading">{nameSlot}</h3>
            <p className="place-card__where">
              {categoryLabel}
              <span aria-hidden="true"> · </span>
              {zone}
            </p>
          </div>
        </div>

        {images.length > 1 && (
          <span className="place-card__photo-count">
            {images.length} foto{images.length === 1 ? "" : "s"}
          </span>
        )}

        <button
          type="button"
          className={`place-card__save tap-target-min ${saved ? "place-card__save--on" : ""}`}
          onClick={() => onToggleSaved(place.id)}
          aria-pressed={saved}
          aria-label={saved ? `Quitar ${place.name} de Quiero ir` : `Guardar ${place.name} en Quiero ir`}
          title={saved ? "Quitar de Quiero ir" : "Quiero ir"}
        >
          <span className="place-card__save-icon" aria-hidden="true">
            <Icon name={saved ? "corazon-relleno" : "corazon"} size={20} />
          </span>
        </button>

        {otherPersonMarker &&
          (otherPersonMarker.both ? (
            <PersonToken traveller={null} both size="xs" className="place-card__person-token" />
          ) : (
            <PersonToken
              traveller={otherPersonMarker.traveller}
              variant={otherPersonMarker.variant}
              size="xs"
              className="place-card__person-token"
              label={`${otherPersonMarker.traveller.label} quiere ir`}
            />
          ))}
      </div>

      <div className="place-card__body">
        {reason && <p className="place-card__reason">{reason}</p>}

        {(durationLabel(place) || chip2) && (
          <ul className="place-card__chips">
            <li className="place-card__chip">
              <Icon name="reloj" size={16} />
              <span className="visually-hidden">Tiempo de visita: </span>
              {durationLabel(place)}
            </li>
            {chip2 && (
              <li
                className={`place-card__chip ${
                  chip2.icon === "aviso" ? "place-card__chip--attention" : ""
                }`.trim()}
              >
                <Icon name={chip2.icon} size={16} /> {chip2.label}
              </li>
            )}
          </ul>
        )}
      </div>
    </article>
  );
}
