/**
 * Bloque 24 (P0-4) — agrupación de marcadores del mapa de ciudad (`03 §9`).
 *
 * `03 §9`: «por encima de 12 marcadores visibles, se agrupan en un círculo con cifra
 * (`--type-num`), estilo indicador de estación». Art. 11: cada objetivo mide 44×44 como mínimo,
 * sin solapes ambiguos.
 *
 * Esto es geometría pura en píxeles de pantalla — `PlaceMap` proyecta, este módulo agrupa, y así
 * la regla se prueba sin Leaflet. Dos objetivos cuyas cajas cuadradas de 44 px estén a menos de
 * `--tap-gap` (8 px) en los DOS ejes se funden en un grupo; al terminar, ninguna pareja de
 * grupos está a menos de 52 px en distancia de Chebyshev, es decir, ninguna pareja de cajas se
 * toca. Sin dependencia nueva: una librería de agrupación trae su propio sistema visual (`08`).
 */

/** `03 §9`: umbral de marcadores visibles a partir del cual se agrupa. */
export const MAP_GROUP_THRESHOLD = 12;
/** Art. 11 / `--tap-min`: lado de la caja de impacto de cada marcador o grupo. */
export const MARKER_HIT_SIZE = 44;
/** `03 §7` / `--tap-gap`: separación mínima entre dos objetivos adyacentes. */
export const MARKER_HIT_GAP = 8;

export type ScreenPoint = { id: string; x: number; y: number };
export type MarkerGroup = { ids: string[]; x: number; y: number };

/** `03 §9`: se agrupa sólo POR ENCIMA de 12 marcadores visibles. */
export function shouldGroupMarkers(visibleCount: number): boolean {
  return visibleCount > MAP_GROUP_THRESHOLD;
}

function chebyshev(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

function merge(a: MarkerGroup, b: MarkerGroup): MarkerGroup {
  const total = a.ids.length + b.ids.length;
  return {
    ids: [...a.ids, ...b.ids],
    x: (a.x * a.ids.length + b.x * b.ids.length) / total,
    y: (a.y * a.ids.length + b.y * b.ids.length) / total,
  };
}

/**
 * Agrupa puntos de pantalla hasta que ninguna pareja de grupos queda a menos de `spacing` en
 * distancia de Chebyshev (cajas cuadradas: es la distancia que decide si dos cajas se tocan).
 * El centro de cada grupo es la media de sus miembros. Determinista: respeta el orden de entrada.
 */
export function groupScreenPoints(
  points: readonly ScreenPoint[],
  spacing: number = MARKER_HIT_SIZE + MARKER_HIT_GAP
): MarkerGroup[] {
  let groups: MarkerGroup[] = points.map((point) => ({ ids: [point.id], x: point.x, y: point.y }));
  let changed = true;
  while (changed) {
    changed = false;
    const next: MarkerGroup[] = [];
    for (const group of groups) {
      const index = next.findIndex((candidate) => chebyshev(candidate, group) < spacing);
      if (index === -1) {
        next.push(group);
      } else {
        next[index] = merge(next[index], group);
        changed = true;
      }
    }
    groups = next;
  }
  return groups;
}
