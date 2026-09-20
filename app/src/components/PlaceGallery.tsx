import { useCallback, useEffect, useRef, useState } from "react";
import type { PlaceImage } from "../types";
import { describePhotographyProcessing } from "../lib/photography-attribution";
import { CARD_IMAGE_WIDTH, cardImageUrl } from "../data/place-images";
import { Icon } from "../icons/Icon";

type Props = {
  images: PlaceImage[];
  /** Editorial description of the photograph this place should eventually have. */
  imageBrief: string;
  placeName: string;
};

type LoadState = "loading" | "loaded" | "error";

const SWIPE_THRESHOLD_PX = 40;

function Attribution({ image }: { image: PlaceImage }) {
  const processing = describePhotographyProcessing(image.processing);
  const hasAttribution =
    image.source ||
    image.credit ||
    image.license ||
    image.sourceFileTitle ||
    image.attributionTitle ||
    processing;

  if (!hasAttribution) return null;

  return (
    <p className="gallery__credit">
      {image.source && (
        <>
          {image.sourceUrl ? (
            <a href={image.sourceUrl} target="_blank" rel="noreferrer">
              {image.source}
            </a>
          ) : (
            image.source
          )}
        </>
      )}
      {image.credit && <span> · {image.credit}</span>}
      {image.license && (
        <span>
          {" · "}
          {image.licenseUrl ? (
            <a href={image.licenseUrl} target="_blank" rel="noreferrer">
              {image.license}
            </a>
          ) : (
            image.license
          )}
        </span>
      )}
      {image.sourceFileTitle && <span> · Archivo de Commons: {image.sourceFileTitle}</span>}
      {image.attributionTitle && <span> · Título de atribución: {image.attributionTitle}</span>}
      {processing && <span> · {processing}</span>}
    </p>
  );
}

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

export function PlaceGallery({ images, imageBrief, placeName }: Props) {
  const [index, setIndex] = useState(0);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const zoomButtonRef = useRef<HTMLButtonElement>(null);
  const wasLightboxOpen = useRef(false);
  const total = images.length;

  // The parent keys this component by place id, so index/loadState start fresh for each place
  // and only ever change from the navigation handlers below.
  const goTo = useCallback(
    (next: number) => {
      if (total === 0) return;
      const target = ((next % total) + total) % total;
      if (target === index) return;
      setIndex(target);
      setLoadState("loading");
    },
    [total, index]
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
    // from wherever it already sensibly is, e.g. the place-detail close button).
    if (wasLightboxOpen.current && !lightboxOpen) {
      zoomButtonRef.current?.focus();
    }
    wasLightboxOpen.current = lightboxOpen;
  }, [lightboxOpen]);

  if (total === 0) {
    return <GalleryFallback imageBrief={imageBrief} placeName={placeName} />;
  }

  const current = images[index];
  const currentCardUrl = cardImageUrl(current.url);
  /** Omitted entirely when no derivative exists, so `src` alone decides. */
  const heroSrcSet = currentCardUrl
    ? `${currentCardUrl} ${CARD_IMAGE_WIDTH}w, ${current.url} 1600w`
    : undefined;

  return (
    <div className="gallery">
      <div
        className="gallery__frame"
        onKeyDown={handleKeyDown}
        onTouchStart={(event) => {
          touchStartX.current = event.changedTouches[0].clientX;
        }}
        onTouchEnd={(event) => {
          const start = touchStartX.current;
          touchStartX.current = null;
          if (start === null) return;
          const delta = event.changedTouches[0].clientX - start;
          if (Math.abs(delta) < SWIPE_THRESHOLD_PX) return;
          goTo(delta < 0 ? index + 1 : index - 1);
        }}
        role="group"
        aria-roledescription="carrusel"
        aria-label={`Fotografías de ${placeName}`}
        tabIndex={0}
      >
        {loadState === "loading" && <div className="gallery__skeleton" aria-hidden="true" />}
        {loadState === "error" ? (
          <div className="gallery__error">
            <p>No se pudo cargar la imagen.</p>
            {imageBrief && <p className="gallery__fallback-brief">{imageBrief}</p>}
          </div>
        ) : (
          <button
            type="button"
            ref={zoomButtonRef}
            className="gallery__zoom"
            onClick={() => setLightboxOpen(true)}
            aria-label={`Ampliar imagen ${index + 1} de ${total}`}
          >
            {/* Two candidates, one photograph. The hero fills 390 CSS px on a phone and
                420 in the desktop panel, so a DPR 2 phone is served the 800px rendition
                instead of the 1600px original — the lightbox below always loads the
                original, which is where full resolution actually matters. */}
            <img
              src={current.url}
              srcSet={heroSrcSet}
              sizes="(min-width: 861px) 420px, 100vw"
              alt={current.alt}
              loading="lazy"
              decoding="async"
              className="gallery__image"
              data-state={loadState}
              onLoad={() => setLoadState("loaded")}
              onError={() => setLoadState("error")}
            />
          </button>
        )}

        {total > 1 && (
          <>
            <span className="gallery__counter" aria-hidden="true">
              {index + 1} / {total}
            </span>
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
      </div>

      {total > 1 && (
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

      <Attribution image={current} />
      <p className="visually-hidden" role="status">
        Imagen {index + 1} de {total}
      </p>

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
