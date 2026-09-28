import { useCallback, useEffect, useRef, useState } from "react";
import type { PlaceImage } from "../types";
import { CARD_IMAGE_WIDTH, cardImageUrl } from "../data/place-images";
import { hasAnyAttribution } from "../lib/photography-attribution";
import { Icon } from "../icons/Icon";
import { CreditsSheet } from "./CreditsSheet";

/**
 * Bloque 20 (B4) — galería de la ficha (`04 §6`, `05 §5` pt. 1).
 *
 * Tres cambios de contrato respecto a v1.1.0:
 *
 * 1. **Deslizamiento nativo con `scroll-snap`, no un carrusel con índice en estado.** Todas las
 *    imágenes existen en el DOM dentro de una pista que scrollea; el índice se *deriva* de la
 *    posición de scroll en vez de gobernarla. Eso es lo que da el gesto del sistema —inercia,
 *    rebote, accesibilidad del scroll— gratis, y lo que `04 §6` pide literalmente.
 * 2. **A sangre y vertical**: 4:5 en teléfono, 4:3 en `md`+ dentro del panel. La fotografía es
 *    el contenido, no una franja decorativa.
 * 3. **Los créditos salen del flujo** (defecto D2): botón `ⓘ` de 32 px abajo-izquierda que abre
 *    `CreditsSheet` (`04 §7`). Ni un carácter de atribución entre la fotografía y el nombre.
 *
 * Cantidades, no breakpoints, deciden los indicadores (`04 §6`): la píldora del contador y las
 * flechas sólo con más de una imagen; los puntos sólo con **≤5**; las flechas, además, sólo en
 * `md`+ (eso sí es CSS, porque en teléfono el gesto es el dedo).
 */

type Props = {
  images: PlaceImage[];
  /** Editorial description of the photograph this place should eventually have. */
  imageBrief: string;
  placeName: string;
  /** `04 §7`: pie de `CreditsSheet` hacia Nosotros › Fuentes y licencias. */
  onOpenSources?: () => void;
};

/** `04 §6`: «Puntos **sólo** cuando hay ≤5 imágenes». Por encima, la píldora basta. */
const MAX_DOTS = 5;

/** Shown until licensed photography exists for a place — never a stand-in photo of somewhere else. */
function GalleryFallback({
  imageBrief,
  placeName,
}: {
  imageBrief: string;
  placeName: string;
}) {
  return (
    <div className="gallery gallery--fallback">
      <div className="gallery__fallback-inner">
        {/* Bloque 17 (B1): ya no lleva el emoji de categoría del dataset (03 §8). */}
        <Icon name="imagen" className="gallery__fallback-icon" width={32} height={32} />
        <p className="gallery__fallback-label">Sin fotografía disponible todavía</p>
        {imageBrief && (
          <p className="gallery__fallback-brief">
            <span className="visually-hidden">Imagen prevista para {placeName}: </span>
            {imageBrief}
          </p>
        )}
      </div>
    </div>
  );
}

export function PlaceGallery({ images, imageBrief, placeName, onOpenSources }: Props) {
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState<Record<string, true>>({});
  const [attempts, setAttempts] = useState<Record<string, number>>({});
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [creditsOpen, setCreditsOpen] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const wasLightboxOpen = useRef(false);
  const total = images.length;

  /**
   * El índice se lee de la pista, nunca al revés. `scrollLeft / ancho de la ranura` redondeado
   * es la diapositiva que el `scroll-snap` ha dejado centrada; con `scroll-snap-type: x
   * mandatory` el navegador garantiza que el reposo cae exactamente en un múltiplo.
   */
  const syncIndexFromScroll = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const slotWidth = track.clientWidth;
    if (slotWidth === 0) return;
    const next = Math.round(track.scrollLeft / slotWidth);
    setIndex((current) => {
      const clamped = Math.max(0, Math.min(total - 1, next));
      return clamped === current ? current : clamped;
    });
  }, [total]);

  /** Navegación explícita (flechas, puntos, teclado): mueve el scroll, y el scroll mueve el índice. */
  const goTo = useCallback(
    (next: number) => {
      const track = trackRef.current;
      if (!track || total === 0) return;
      const target = Math.max(0, Math.min(total - 1, next));
      track.scrollTo({ left: target * track.clientWidth, behavior: "smooth" });
    },
    [total]
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        goTo(index + 1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        goTo(index - 1);
      }
    },
    [goTo, index]
  );

  useEffect(() => {
    if (!lightboxOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        setLightboxOpen(false);
      } else if (event.key === "ArrowRight") {
        goTo(index + 1);
      } else if (event.key === "ArrowLeft") {
        goTo(index - 1);
      } else if (event.key === "Tab") {
        // The lightbox has exactly one focusable control (the close button). Without
        // this, Tab would move focus to whatever is behind the overlay — still
        // visually hidden under it, but reachable by keyboard, which is the classic
        // "focus escapes the modal" bug. Keeping it parked on the close button is a
        // complete trap here without needing a multi-element focus-cycling library.
        event.preventDefault();
      }
    }
    // Capture phase so Escape closes the lightbox before the detail panel sees it.
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [lightboxOpen, goTo, index]);

  useEffect(() => {
    // Restore focus to the control that opened the lightbox once it closes — only on
    // the true->false transition, never on initial mount (which would steal focus
    // from wherever it already sensibly is, e.g. the place-detail back button).
    if (wasLightboxOpen.current && !lightboxOpen) {
      openerRef.current?.focus();
    }
    wasLightboxOpen.current = lightboxOpen;
  }, [lightboxOpen]);

  if (total === 0) {
    return <GalleryFallback imageBrief={imageBrief} placeName={placeName} />;
  }

  const current = images[index];
  const showCounter = total > 1;
  const showDots = total > 1 && total <= MAX_DOTS;
  const showArrows = total > 1;
  const showCredits = hasAnyAttribution(images);

  return (
    <div className="gallery">
      <div className="gallery__viewport">
        <div
          className="gallery__track"
          ref={trackRef}
          onScroll={syncIndexFromScroll}
          onKeyDown={handleKeyDown}
          role="group"
          aria-roledescription="carrusel"
          aria-label={`Fotografías de ${placeName}`}
          tabIndex={0}
        >
          {images.map((image, slide) => {
            const isBroken = failed[image.url];
            const derivative = cardImageUrl(image.url);
            /** Omitted entirely when no derivative exists, so `src` alone decides. */
            const srcSet = derivative
              ? `${derivative} ${CARD_IMAGE_WIDTH}w, ${image.url} 1600w`
              : undefined;
            return (
              <div className="gallery__slide" key={image.url}>
                {isBroken ? (
                  <div className="gallery__error">
                    <p role="status">No se pudo cargar la imagen.</p>
                    {imageBrief && <p className="gallery__fallback-brief">{imageBrief}</p>}
                    <button
                      type="button"
                      className="gallery__retry"
                      aria-label={`Reintentar imagen ${slide + 1} de ${total}`}
                      title="Reintentar imagen"
                      onClick={() => {
                        setAttempts((state) => ({
                          ...state,
                          [image.url]: (state[image.url] ?? 0) + 1,
                        }));
                        setFailed((state) => {
                          const next = { ...state };
                          delete next[image.url];
                          return next;
                        });
                        // The error controls disappear while the same slide is requested again.
                        // Keep keyboard focus in the carousel and leave its index/scroll untouched.
                        trackRef.current?.focus({ preventScroll: true });
                      }}
                    >
                      Reintentar
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="gallery__zoom"
                    onClick={(event) => {
                      openerRef.current = event.currentTarget;
                      setLightboxOpen(true);
                    }}
                    aria-label={`Ampliar imagen ${slide + 1} de ${total}`}
                  >
                    {/* Two candidates, one photograph. The hero fills 390 CSS px on a phone and
                        480 in the desktop panel, so a DPR 2 phone is served the 800px rendition
                        instead of the 1600px original — the lightbox below always loads the
                        original, which is where full resolution actually matters. */}
                    <img
                      key={`${image.url}-${attempts[image.url] ?? 0}`}
                      src={image.url}
                      srcSet={srcSet}
                      sizes="(min-width: 840px) 480px, 100vw"
                      alt={image.alt}
                      // `06 §6.3` / `04 §6`: la primera imagen de la ficha es la que decide el
                      // LCP de la pantalla; el resto de la pista se carga cuando el dedo llega.
                      {...(slide === 0
                        ? { fetchPriority: "high" as const }
                        : { loading: "lazy" as const })}
                      decoding="async"
                      className="gallery__image"
                      onError={() => setFailed((state) => ({ ...state, [image.url]: true }))}
                    />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {showCounter && (
          <span className="gallery__counter" aria-hidden="true">
            {index + 1} / {total}
          </span>
        )}

        {showArrows && (
          <>
            <button
              type="button"
              className="gallery__nav gallery__nav--prev"
              onClick={() => goTo(index - 1)}
              aria-label="Imagen anterior"
              title="Imagen anterior"
            >
              <Icon name="atras" size={20} />
            </button>
            <button
              type="button"
              className="gallery__nav gallery__nav--next"
              onClick={() => goTo(index + 1)}
              aria-label="Imagen siguiente"
              title="Imagen siguiente"
            >
              <Icon name="siguiente" size={20} />
            </button>
          </>
        )}

        {showCredits && (
          <button
            type="button"
            className="gallery__credits"
            onClick={() => setCreditsOpen(true)}
            aria-label={`Créditos de las fotografías de ${placeName}`}
            title="Créditos de las fotografías"
          >
            <Icon name="info" size={16} />
          </button>
        )}

        {showDots && (
          <div className="gallery__dots" role="tablist" aria-label="Seleccionar imagen">
            {images.map((image, dotIndex) => (
              <button
                key={image.url}
                type="button"
                role="tab"
                aria-selected={dotIndex === index}
                aria-label={`Imagen ${dotIndex + 1} de ${total}`}
                title={`Imagen ${dotIndex + 1} de ${total}`}
                className={`gallery__dot ${dotIndex === index ? "gallery__dot--active" : ""}`}
                onClick={() => goTo(dotIndex)}
              />
            ))}
          </div>
        )}
      </div>

      <p className="visually-hidden" role="status">
        Imagen {index + 1} de {total}
      </p>

      {creditsOpen && (
        <CreditsSheet
          placeName={placeName}
          images={images}
          onClose={() => setCreditsOpen(false)}
          onOpenSources={onOpenSources}
        />
      )}

      {lightboxOpen && (
        <div
          className="lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={`Fotografía ampliada de ${placeName}`}
          onClick={() => setLightboxOpen(false)}
        >
          <button
            type="button"
            className="lightbox__close"
            onClick={() => setLightboxOpen(false)}
            aria-label="Cerrar imagen ampliada"
            title="Cerrar imagen ampliada"
            autoFocus
          >
            <Icon name="cerrar" size={20} />
          </button>
          <img src={current.url} alt={current.alt} className="lightbox__image" />
        </div>
      )}
    </div>
  );
}
