import { useEffect, useRef, type ReactNode } from "react";

type Props = { label: string; onClose: () => void; returnFocus: HTMLElement | null; children: ReactNode };
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function RouteDialog({ label, onClose, returnFocus, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = ref.current;
    const shell = document.querySelector<HTMLElement>(".astra-shell");
    const discovery = document.querySelector<HTMLElement>("#astra-content");
    shell?.setAttribute("inert", ""); discovery?.setAttribute("inert", "");
    (element?.querySelector(FOCUSABLE) as HTMLElement | null)?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.querySelector(".lightbox")) { event.preventDefault(); event.stopImmediatePropagation(); onClose(); return; }
      if (event.key !== "Tab" || !element) return;
      const controls = [...element.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (!controls.length) { event.preventDefault(); return; }
      const first=controls[0], last=controls[controls.length-1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", keydown, true);
    return () => { document.removeEventListener("keydown", keydown, true); shell?.removeAttribute("inert"); discovery?.removeAttribute("inert"); returnFocus?.focus(); };
  }, [onClose, returnFocus]);
  return <div className="astra-detail-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><div ref={ref} className="astra-detail-panel" role="dialog" aria-modal="true" aria-label={label}>{children}</div></div>;
}
