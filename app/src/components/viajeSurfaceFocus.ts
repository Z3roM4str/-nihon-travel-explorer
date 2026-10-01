/**
 * B31 (DDR-B31-07) — «foco lógico» tras un salto entre sub-pestañas de Viaje.
 *
 * Lectura mínima de la norma: cuando una tarjeta de Resumen navega a otra superficie, el foco va al
 * encabezado h2 de la superficie de destino (`tabIndex -1`). Nada más. Este módulo sólo TOCA el DOM:
 * no guarda estado, no escribe en storage ni en el historial. El destino aún puede estar montándose
 * (la superficie cambia de instancia, y «Dónde dormir» se carga en diferido), así que se busca el
 * encabezado durante unos fotogramas y se abandona si no aparece.
 */

export type ViajeNavTarget = "dias" | "dormir";

/** El h2 de cada superficie de destino. «Días» lo marca `data-viaje-surface`; «Dónde dormir» trae
 * su propio id (`ZoneComparison`). */
const HEADING_SELECTOR: Record<ViajeNavTarget, string> = {
  dias: '[data-viaje-surface="dias"] h2',
  dormir: "#zone-panel-title",
};

const MAX_FRAMES = 90;
/** Ventana (ms) en la que se protege el foco del encabezado frente al montaje de la superficie. */
const GUARD_MS = 1000;

/** Mantiene el foco en `heading` durante `GUARD_MS` si el propio montaje de la superficie lo desplaza
 * a otro control de su panel (`ZoneComparison` enfoca su botón de cierre en un `useEffect`, y en WebKit
 * ese efecto puede ejecutarse tarde). La guarda se retira en cuanto la persona pulsa una tecla o toca. */
function guardFocus(heading: HTMLElement): void {
  const panel = heading.closest<HTMLElement>("[aria-labelledby], [data-viaje-surface]");
  const onFocusIn = (event: FocusEvent) => {
    const target = event.target as Node | null;
    if (!heading.isConnected || target === heading) return;
    if (target === document.body || (panel && target && panel.contains(target))) {
      heading.focus({ preventScroll: false });
    }
  };
  const release = () => {
    clearTimeout(timer);
    document.removeEventListener("focusin", onFocusIn, true);
    document.removeEventListener("keydown", release, true);
    document.removeEventListener("pointerdown", release, true);
  };
  const timer = setTimeout(release, GUARD_MS);
  document.addEventListener("focusin", onFocusIn, true);
  document.addEventListener("keydown", release, true);
  document.addEventListener("pointerdown", release, true);
}

export function focusViajeSurfaceHeading(target: ViajeNavTarget): void {
  if (typeof document === "undefined" || typeof requestAnimationFrame === "undefined") return;
  let frames = 0;
  const attempt = () => {
    const heading = document.querySelector<HTMLElement>(HEADING_SELECTOR[target]);
    if (heading) {
      if (!heading.hasAttribute("tabindex")) heading.setAttribute("tabindex", "-1");
      // Una tarea después: los efectos pasivos de React del montaje (ya encolados) corren antes y
      // no pueden robar el foco que se da ahora; `guardFocus` queda como red de seguridad.
      setTimeout(() => {
        if (!heading.isConnected) return;
        heading.focus({ preventScroll: false });
        guardFocus(heading);
      }, 0);
      return;
    }
    frames += 1;
    if (frames < MAX_FRAMES) requestAnimationFrame(attempt);
  };
  requestAnimationFrame(attempt);
}
