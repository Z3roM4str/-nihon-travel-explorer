import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

type Props = { label?: string; labelledBy?: string; role?: "dialog" | "alertdialog"; onClose: () => void; returnFocus: HTMLElement | null | (() => HTMLElement | null); children: ReactNode; overlayClassName?: string; panelClassName?: string };
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function RouteDialog({ label, labelledBy, role="dialog", onClose, returnFocus, children, overlayClassName="astra-detail-overlay", panelClassName="astra-detail-panel" }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  const onCloseRef = useRef(onClose);
  const returnFocusRef = useRef(returnFocus);

  useEffect(() => {
    onCloseRef.current = onClose;
    returnFocusRef.current = returnFocus;
  }, [onClose, returnFocus]);

  useEffect(() => {
    const element = ref.current;
    const overlay = element?.parentElement;
    const shell = document.querySelector<HTMLElement>(".astra-shell");
    const discovery = document.querySelector<HTMLElement>("#astra-content");
    shell?.setAttribute("inert", ""); discovery?.setAttribute("inert", "");
    (element?.querySelector(FOCUSABLE) as HTMLElement | null)?.focus();
    const keydown = (event: KeyboardEvent) => {
      const modals = [...document.querySelectorAll("[data-astra-modal]")];
      if (modals.at(-1) !== overlay) return;
      if (event.key === "Escape" && !document.querySelector(".lightbox")) { event.preventDefault(); event.stopImmediatePropagation(); onCloseRef.current(); return; }
      if (event.key !== "Tab" || !element) return;
      const controls = [...element.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (!controls.length) { event.preventDefault(); return; }
      const first=controls[0], last=controls[controls.length-1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", keydown, true);
    return () => {
      document.removeEventListener("keydown", keydown, true);
      queueMicrotask(() => {
        if (!document.querySelector("[data-astra-modal]")) {
          shell?.removeAttribute("inert");
          discovery?.removeAttribute("inert");
        }
        const returnFocus = returnFocusRef.current;
        const target=typeof returnFocus === "function" ? returnFocus() : returnFocus;
        if (target?.isConnected && !target.closest("[inert]")) {
          target?.focus();
        }
      });
    };
  }, []);
  return createPortal(<div className={overlayClassName} data-astra-modal="" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><div ref={ref} className={panelClassName} role={role} aria-modal="true" aria-label={label} aria-labelledby={labelledBy}>{children}</div></div>, document.body);
}
