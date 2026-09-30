import type { WholeTripComposition } from "../lib/whole-trip-composition";
import type { ViajeNavTarget } from "./viajeSurfaceFocus";

/**
 * B31 (B9.5) — textos y tablas puras de las superficies «Resumen»: sin JSX ni estado, para que los
 * componentes presentacionales sólo exporten componentes y los tests fijen el contrato sin montar nada.
 */

export function wholeTripUnavailableText(
  reason: Extract<WholeTripComposition, { kind: "unavailable" }>["reason"]
): string {
  switch (reason) {
    case "no-day-assignment":
      return "Crea un reparto por días para describir el plan completo sin borrar sus límites.";
    case "invalid-day-partition":
      return "El reparto por días no coincide exactamente con el recorrido; no se muestran cálculos parciales.";
    case "unresolved-route-place":
      return "Un lugar del recorrido no se puede resolver; no se muestran cálculos parciales.";
  }
}


/** La ÚNICA nota de encuadre de Resumen (Art. 3, DDR-B31-04): la idea central del aviso que ya
 * existía (`whole-trip-composition__intro`), sin afirmaciones nuevas. */
export const RESUMEN_NOTE =
  "Describe únicamente los datos registrados para este reparto; no puntúa ni recomienda cambios.";

export const CALCULATED_DETAIL = "calculado por la aplicación con los datos registrados";

/** Destino de cada tarjeta (DDR-B31-07). Exportado para que los tests fijen el mapeo. */
export const SUMMARY_CARD_TARGETS = {
  visitas: { target: "dias", label: "Ver Visitas en Días" },
  traslados: { target: "dias", label: "Ver traslados registrados en Días" },
  alojamiento: { target: "dormir", label: "Ver Alojamiento en Dónde dormir" },
  rango: { target: "dias", label: "Ver Rango del viaje en Días" },
} as const satisfies Record<string, { target: ViajeNavTarget; label: string }>;


export type TripTimelineDay = {
  /** 1-based, exactly the «Día N» the day card shows. */
  ordinal: number;
  /** «Tokio», «Tokio y Kioto»… or `null` when the day has no resolvable city. */
  cityLabel: string | null;
  isEmpty: boolean;
};

/** «Día 2 · Tokio y Kioto» · «Día 3 · sin lugares» — text derivable from the day, no product content. */
export function timelineDayText(day: TripTimelineDay): string {
  if (day.isEmpty) return `Día ${day.ordinal} · sin lugares`;
  return day.cityLabel ? `Día ${day.ordinal} · ${day.cityLabel}` : `Día ${day.ordinal}`;
}
