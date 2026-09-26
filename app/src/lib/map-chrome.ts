/**
 * Bloque 24 (P0-4e, Art. 11) — el cromo interactivo del mapa es zona de exclusión.
 *
 * Invariante: tras cualquier movimiento PROGRAMÁTICO del mapa (encuadre inicial, abrir un grupo,
 * centrar un lugar seleccionado), ninguna caja de impacto de 44×44 de un marcador o grupo queda
 * debajo de un control del mapa (la leyenda de intereses, los controles de Leaflet). El mapa trata
 * esos rectángulos como espacio no válido y, si hace falta, se desplaza lo mínimo para dejarlos
 * libres. Los movimientos que hace la persona con el dedo o la rueda no se corrigen: el mapa no
 * pelea con quien lo maneja.
 *
 * Geometría pura en píxeles del contenedor, sin Leaflet ni DOM, para poder probarla. Desplazar el
 * mapa traslada todos los puntos por igual, así que la agrupación de `map-grouping.ts` no cambia y
 * basta con buscar una traslación. No se asume ningún lugar, ciudad ni tamaño de pantalla: los
 * rectángulos se miden en vivo, así que la regla sigue valiendo si la leyenda cambia de tamaño.
 */

import { MARKER_HIT_SIZE } from "./map-grouping";

export type Rect = { left: number; top: number; right: number; bottom: number };
export type Point = { x: number; y: number };
export type Shift = { dx: number; dy: number };

const HALF = MARKER_HIT_SIZE / 2;
/** Holgura entre una caja de impacto y el borde del cromo tras corregir (evita contactos de 0 px). */
const CLEARANCE = 2;

function boxOf(point: Point, shift: Shift): Rect {
  const x = point.x + shift.dx;
  const y = point.y + shift.dy;
  return { left: x - HALF, top: y - HALF, right: x + HALF, bottom: y + HALF };
}

function intersects(a: Rect, b: Rect): boolean {
  return Math.min(a.right, b.right) > Math.max(a.left, b.left) && Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top);
}

function contains(outer: Rect, inner: Rect): boolean {
  return inner.left >= outer.left && inner.top >= outer.top && inner.right <= outer.right && inner.bottom <= outer.bottom;
}

/** Cajas de impacto que, desplazadas por `shift`, caen debajo de algún rectángulo de cromo. */
export function blockedTargets(
  targets: readonly Point[],
  chrome: readonly Rect[],
  shift: Shift = { dx: 0, dy: 0 }
): Point[] {
  return targets.filter((target) => {
    const box = boxOf(target, shift);
    return chrome.some((rect) => intersects(box, rect));
  });
}

/**
 * La traslación más corta que deja todas las cajas de impacto fuera del cromo, o `null` si no hace
 * falta moverse. Los objetivos liberados quedan enteros dentro de `viewport`; `keep` son otros objetivos que deben seguir enteros dentro de `viewport` (p. ej. el
 * lugar seleccionado): una traslación que los saque no vale. Si ninguna candidata cumple, devuelve
 * `null` y el mapa se queda como está (el gate B24 lo detectaría).
 *
 * Candidatas: para cada caja cercana a un rectángulo de cromo, los desplazamientos que la dejan
 * justo a cada lado de él, en cada eje, combinados entre sí; se prueban de menor a mayor longitud.
 */
export function chromeClearingShift(
  targets: readonly Point[],
  chrome: readonly Rect[],
  viewport: Rect,
  keep: readonly Point[] = []
): Shift | null {
  if (chrome.length === 0) return null;
  const blocked = blockedTargets(targets, chrome);
  if (blocked.length === 0) return null;
  // Liberar un objetivo empujándolo fuera de la pantalla no lo hace alcanzable: los que estaban
  // tapados tienen que quedar enteros dentro del encuadre, igual que los de `keep`.
  const mustStay = [...keep, ...blocked];
  const width = viewport.right - viewport.left;
  const height = viewport.bottom - viewport.top;
  const maxShift = Math.max(MARKER_HIT_SIZE * 2, Math.min(width, height) * 0.6);

  const xs = new Set<number>([0]);
  const ys = new Set<number>([0]);
  for (const rect of chrome) {
    for (const target of targets) {
      const toLeft = rect.left - CLEARANCE - (target.x + HALF);
      const toRight = rect.right + CLEARANCE - (target.x - HALF);
      const toTop = rect.top - CLEARANCE - (target.y + HALF);
      const toBottom = rect.bottom + CLEARANCE - (target.y - HALF);
      for (const dx of [toLeft, toRight]) if (Math.abs(dx) <= maxShift) xs.add(Math.round(dx));
      for (const dy of [toTop, toBottom]) if (Math.abs(dy) <= maxShift) ys.add(Math.round(dy));
    }
  }

  const candidates: Shift[] = [];
  for (const dx of xs) for (const dy of ys) if (dx !== 0 || dy !== 0) candidates.push({ dx, dy });
  candidates.sort((a, b) => Math.hypot(a.dx, a.dy) - Math.hypot(b.dx, b.dy));

  for (const shift of candidates) {
    if (blockedTargets(targets, chrome, shift).length > 0) continue;
    if (mustStay.some((point) => !contains(viewport, boxOf(point, shift)))) continue;
    return shift;
  }
  return null;
}
