import { useCallback, useEffect, useRef, useState } from "react";
import type { PlaceImage } from "../types";

type Props = {
  images: PlaceImage[];
  /** Editorial description of the photograph this place should eventually have. */
  imageBrief: string;
  placeName: string;
};

type LoadState = "loading" | "loaded" | "error";

const SWIPE_THRESHOLD_PX = 40;

function Attribution({ image }: { image: PlaceImage }) {
  const parts = [image.credit, image.license].filter(Boolean).join(" · ");
  if (!parts && !image.source) return null;
  return (
    <p className="gallery__credit">
      {image.sourceUrl ? (
        <a href={image.sourceUrl} target="_blank" rel="noreferrer">
          {image.source ?? "Fuente"}
        </a>
      ) : (
        image.source
      )}
      {parts && <span> {parts}</span>}
    </p>
  );
}

/** Shown until licensed photography exists for a place — never a stand-in photo of somewhere else. */
function GalleryFallback({ imageBrief, placeName }: { imageBrief: string; placeName: string }) {
  return (
    <div className="gallery gallery--fallback">
      <div className="gallery__fallback-inner">
        <span className="gallery__fallback-icon" aria-hidden="true">
          ⛩
        </span>
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
      }
    }
    // Capture phase so Escape closes the lightbox before the detail panel sees it.
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [lightboxOpen, goTo, index]);

  if (total === 0) {
    return <GalleryFallback imageBrief={imageBrief} placeName={placeName} />;
  }

  const current = images[index];

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
            className="gallery__zoom"
            onClick={() => setLightboxOpen(true)}
            aria-label={`Ampliar imagen ${index + 1} de ${total}`}
          >
            <img
              src={current.url}
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
            <button
              type="button"
              className="gallery__nav gallery__nav--prev"
              onClick={() => goTo(index - 1)}
              aria-label="Imagen anterior"
            >
              ‹
            </button>
            <button
              type="button"
              className="gallery__nav gallery__nav--next"
              onClick={() => goTo(index + 1)}
              aria-label="Imagen siguiente"
            >
              ›
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
            autoFocus
          >
            ×
          </button>
          <img src={current.url} alt={current.alt} className="lightbox__image" />
        </div>
      )}
    </div>
  );
}
