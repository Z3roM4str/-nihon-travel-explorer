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

export function focusViajeSurfaceHeading(target: ViajeNavTarget): void {
  if (typeof document === "undefined" || typeof requestAnimationFrame === "undefined") return;
  let frames = 0;
  const attempt = () => {
    const heading = document.querySelector<HTMLElement>(HEADING_SELECTOR[target]);
    if (heading) {
      if (!heading.hasAttribute("tabindex")) heading.setAttribute("tabindex", "-1");
      heading.focus({ preventScroll: false });
      return;
    }
    frames += 1;
    if (frames < MAX_FRAMES) requestAnimationFrame(attempt);
  };
  requestAnimationFrame(attempt);
}
