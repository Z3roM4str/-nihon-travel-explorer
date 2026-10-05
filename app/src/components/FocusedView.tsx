import { useEffect, useRef } from "react";

import "./FocusedView.css";

type Props = {
  /** Nombre accesible de la vista (el título visible, si lo hay, debe coincidir). */
  label: string;
  /** Título visible; se omite cuando el contenido ya trae su propio encabezado. */
  title?: string;
  onClose: () => void;
  children: React.ReactNode;
};

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

/**
 * P-06 v2 — N3, vista enfocada. Pantalla completa para una tarea compleja o de lectura larga que
 * no cabe en una Sheet (cambiar el orden de un día, logística del día, herramientas del viaje).
 *
 * ESTADO PROVISIONAL (P-06·A/B): ofrece el contrato de foco y teclado (foco al abrir, Escape y
 * «Volver» cierran, Tab atrapado, el foco vuelve al disparador) pero todavía NO usa History API.
 * P-06·C la sustituye por la vista definitiva con `pushState`/`popstate`; los llamadores sólo
 * dependen de `onClose`, de modo que ese cambio no les afecta.
 */
export function FocusedView({ label, title, onClose, children }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    // Un hijo (p. ej. el encabezado del panel de orden) puede haber tomado ya el foco.
    if (!rootRef.current?.contains(document.activeElement)) backRef.current?.focus({ preventScroll: true });
    return () => {
      const active = document.activeElement;
      if (active && active !== document.body) return;
      if (opener && opener.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const root = rootRef.current;
      if (!root) return;
      const focusable = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (element) => element.offsetParent !== null
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [onClose]);

  return (
    <div ref={rootRef} className="focused-view" role="dialog" aria-modal="true" aria-label={label}>
      <header className="focused-view__bar">
        <button ref={backRef} type="button" className="focused-view__back" onClick={onClose}>
          <span aria-hidden="true">‹</span> Volver a Días
        </button>
        {title && <h2 className="focused-view__title">{title}</h2>}
      </header>
      <div className="focused-view__body">{children}</div>
    </div>
  );
}
