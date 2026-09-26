import { useEffect, useLayoutEffect, useRef } from "react";
import { Icon } from "../icons/Icon";

type Props = {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  labelledBy?: string;
  initialBodyScrollTop?: number;
  onBodyScroll?: (scrollTop: number) => void;
  /** B24 (DD-022): contador vivo junto al título, p. ej. «14 lugares». Sólo lo pasa quien tiene
   * resultados que contar; sin él la cabecera no cambia. */
  count?: string;
};

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Bloque 18 — `Sheet`, el contenedor de `04 §8` para todo lo que hoy es modal centrado.
 *
 * Entra desde abajo (`sheet-rise`), ocupa como máximo el 88 % de la altura visible con scroll
 * interno, y se cierra con Escape, con el fondo o con la `×`. Usado por el nuevo selector de
 * ciudad y por la hoja de filtros; ambos sustituyen construcciones ad hoc que hacían lo mismo
 * con menos disciplina de foco.
 */
export function Sheet({
  title,
  onClose,
  children,
  labelledBy,
  initialBodyScrollTop,
  onBodyScroll,
  count,
}: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const titleId = labelledBy ?? "sheet-title";

  useLayoutEffect(() => {
    if (initialBodyScrollTop !== undefined && bodyRef.current) {
      bodyRef.current.scrollTop = initialBodyScrollTop;
    }
  }, [initialBodyScrollTop]);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus({ preventScroll: true });
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
      const root = dialogRef.current;
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
    <div className="sheet-scrim" onClick={onClose} role="presentation">
      <div
        ref={dialogRef}
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sheet__grabber" aria-hidden="true" />
        <header className="sheet__head">
          <h2 id={titleId} className="sheet__title">
            {title}
          </h2>
          {count !== undefined && (
            <p className="sheet__count" role="status">
              {count}
            </p>
          )}
          <button
            ref={closeRef}
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Cerrar"
            title="Cerrar"
          >
            <Icon name="cerrar" size={16} />
          </button>
        </header>
        <div
          ref={bodyRef}
          className="sheet__body"
          onScroll={onBodyScroll ? (event) => onBodyScroll(event.currentTarget.scrollTop) : undefined}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
