import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { PlaceImage } from "../types";
import { describePhotographyProcessing } from "../lib/photography-attribution";

type Props = { images: PlaceImage[]; imageBrief: string; placeName: string };
type LoadState = "loading" | "loaded" | "error";
const SWIPE_THRESHOLD_PX = 40;
const FOCUSABLE = 'a[href],button,input,select,textarea,summary,[tabindex]';

function isTabbable(element: HTMLElement): boolean {
  if (element.matches(':disabled,[tabindex="-1"]') || element.tabIndex < 0) return false;
  if (element.closest('[hidden],[inert],[aria-hidden="true"]')) return false;
  for (let current: HTMLElement | null = element; current; current = current.parentElement) {
    const style = getComputedStyle(current);
    if (style.display === "none" || style.visibility === "hidden") return false;
  }
  const closedDetails = element.closest("details:not([open])");
  if (closedDetails && element !== closedDetails.querySelector(":scope > summary")) return false;
  return true;
}

function tabbableElements(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(isTabbable);
}

export function PhotographyAttribution({ image }: { image: PlaceImage }) {
  const processing = describePhotographyProcessing(image.processing);
  if (!(image.source || image.credit || image.license || image.sourceFileTitle || image.attributionTitle || processing)) return null;
  return <p className="gallery__credit">
    {image.source && (image.sourceUrl ? <a href={image.sourceUrl} target="_blank" rel="noreferrer">{image.source}</a> : image.source)}
    {image.credit && <span> · {image.credit}</span>}
    {image.license && <span> · {image.licenseUrl ? <a href={image.licenseUrl} target="_blank" rel="noreferrer">{image.license}</a> : image.license}</span>}
    {image.sourceFileTitle && <span> · Archivo de Commons: {image.sourceFileTitle}</span>}
    {image.attributionTitle && <span> · Título de atribución: {image.attributionTitle}</span>}
    {processing && <span> · {processing}</span>}
    <span> · Recorte de visualización 4:3</span>
  </p>;
}

function GalleryFallback({ placeName }: { placeName: string }) {
  return <div className="gallery gallery--fallback" role="img" aria-label={`Fotografía pendiente de ${placeName}`}>
    <div className="gallery__fallback-inner"><span className="gallery__fallback-icon" aria-hidden="true">▧</span><p className="gallery__fallback-label">Fotografía pendiente</p><p className="gallery__fallback-category">Aún no hay una imagen verificada para este lugar.</p></div>
  </div>;
}

export function PlaceGallery({ images, placeName }: Props) {
  const [index, setIndex] = useState(0);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [attempt, setAttempt] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const zoomButtonRef = useRef<HTMLButtonElement>(null);
  const lightboxRef = useRef<HTMLDivElement>(null);
  const total = images.length;

  const goTo = useCallback((next: number) => {
    if (total < 2) return;
    const target = ((next % total) + total) % total;
    if (target !== index) { setIndex(target); setLoadState("loading"); setAttempt(0); }
  }, [index, total]);

  const closeLightbox = useCallback(() => setLightboxOpen(false), []);
  useEffect(() => {
    if (!lightboxOpen) return;
    const element = lightboxRef.current;
    const opener = zoomButtonRef.current;
    const parentDialog = opener?.closest<HTMLElement>('[role="dialog"][aria-modal="true"]') ?? null;
    const parentWasInert = parentDialog?.hasAttribute("inert") ?? false;
    parentDialog?.setAttribute("inert", "");
    if (element) tabbableElements(element)[0]?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); closeLightbox(); return; }
      if (event.key === "ArrowRight") { event.preventDefault(); goTo(index + 1); return; }
      if (event.key === "ArrowLeft") { event.preventDefault(); goTo(index - 1); return; }
      if (event.key !== "Tab" || !element) return;
      const controls = tabbableElements(element);
      if (!controls.length) { event.preventDefault(); return; }
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      if (!parentWasInert) parentDialog?.removeAttribute("inert");
      queueMicrotask(() => opener?.focus());
    };
  }, [closeLightbox, goTo, index, lightboxOpen]);

  if (!total) return <GalleryFallback placeName={placeName} />;
  const current = images[index];
  const navigation = total > 1 && <>
    <button type="button" className="gallery__nav gallery__nav--prev" onClick={() => goTo(index - 1)} aria-label="Imagen anterior">‹</button>
    <button type="button" className="gallery__nav gallery__nav--next" onClick={() => goTo(index + 1)} aria-label="Imagen siguiente">›</button>
  </>;
  const touchProps = {
    onTouchStart: (event: React.TouchEvent) => { const t = event.changedTouches[0]; touchStart.current = { x: t.clientX, y: t.clientY }; },
    onTouchEnd: (event: React.TouchEvent) => {
      const start = touchStart.current; touchStart.current = null;
      if (!start) return;
      const t = event.changedTouches[0], dx = t.clientX - start.x, dy = t.clientY - start.y;
      if (Math.abs(dx) >= SWIPE_THRESHOLD_PX && Math.abs(dx) > Math.abs(dy)) goTo(dx < 0 ? index + 1 : index - 1);
    },
  };

  return <div className="gallery">
    <div className="gallery__frame" {...touchProps} onKeyDown={event => { if (event.key === "ArrowRight") goTo(index + 1); if (event.key === "ArrowLeft") goTo(index - 1); }} role="group" aria-roledescription={total > 1 ? "carrusel" : undefined} aria-label={`Fotografías de ${placeName}`}>
      {loadState === "loading" && <div className="gallery__skeleton" aria-hidden="true" />}
      {loadState === "error" ? <div className="gallery__error"><p>No pudimos cargar esta foto.</p><button type="button" onClick={() => { setAttempt(v => v + 1); setLoadState("loading"); }}>Reintentar</button></div> :
        <button type="button" ref={zoomButtonRef} className="gallery__zoom" onClick={() => setLightboxOpen(true)} aria-label={`Ver ${placeName} a pantalla completa`}>
          <img key={`${index}-${attempt}`} src={current.url} alt={current.alt} loading={index === 0 ? "eager" : "lazy"} decoding="async" width="1200" height="900" className="gallery__image" data-state={loadState} onLoad={() => setLoadState("loaded")} onError={() => setLoadState("error")} />
        </button>}
      {navigation}
      {total > 1 && <span className="gallery__counter">{index + 1} de {total}</span>}
    </div>
    <details className="gallery__attribution"><summary>Créditos de la foto</summary><PhotographyAttribution image={current} /></details>
    <p className="visually-hidden" role="status">Imagen {index + 1} de {total}</p>
    {lightboxOpen && createPortal(<div ref={lightboxRef} className="lightbox" role="dialog" aria-modal="true" aria-labelledby="lightbox-title" data-astra-modal="lightbox">
      <header className="lightbox__bar"><div><strong id="lightbox-title">{placeName}</strong><span>{index + 1} de {total}</span></div><button type="button" className="lightbox__close" onClick={closeLightbox} aria-label="Cerrar pantalla completa">×</button></header>
      <div className="lightbox__stage" {...touchProps}><img src={current.url} alt={current.alt} className="lightbox__image" />{navigation}</div>
      <details className="lightbox__attribution"><summary>Créditos de la foto</summary><PhotographyAttribution image={current} /></details>
    </div>, document.body)}
  </div>;
}
