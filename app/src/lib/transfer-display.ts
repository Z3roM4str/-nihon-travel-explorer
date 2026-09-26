import type { TransferEdge, TransferMode } from "./transfer";
import type { IconName } from "../icons/Icon";

const NUMBER_FORMAT = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 2 });

export type TransferDisplay = {
  distanceText: string;
  timeText: string;
  qualityLabel: "Estimación geográfica" | "Ruta a pie validada" | "Ruta validada" | "Horario en vivo";
};

function formatMinutes(edge: TransferEdge): string {
  const { minMinutes, maxMinutes } = edge.minutes;
  const range =
    minMinutes === maxMinutes
      ? `${NUMBER_FORMAT.format(minMinutes)} min`
      : `${NUMBER_FORMAT.format(minMinutes)}–${NUMBER_FORMAT.format(maxMinutes)} min`;
  return edge.confidence === "estimated" ? `~${range}` : range;
}

/**
 * Presentation-only mapping for one already-resolved TransferEdge. It never changes confidence,
 * provenance, direction, or fallback semantics; those remain owned by getBestTransfer().
 */
export function describeTransferForUi(edge: TransferEdge): TransferDisplay {
  let qualityLabel: TransferDisplay["qualityLabel"];
  switch (edge.confidence) {
    case "estimated":
      qualityLabel = "Estimación geográfica";
      break;
    case "validated-static":
      qualityLabel = edge.mode === "walk" ? "Ruta a pie validada" : "Ruta validada";
      break;
    case "schedule-aware":
      qualityLabel = "Horario en vivo";
      break;
  }

  return {
    distanceText: `${NUMBER_FORMAT.format(edge.distanceKm)} km`,
    timeText: formatMinutes(edge),
    qualityLabel,
  };
}

/**
 * An icon name derived from the edge's own, real `mode` — never guessed from `rawMode` text
 * or hardcoded per relation. Kept alongside `describeTransferForUi` so both readings of an
 * edge come from the same closed `TransferMode` vocabulary rather than drifting independently.
 *
 * Bloque 17 (B1): devuelve el nombre de un icono de línea propio, no un glifo emoji (00
 * "Patrones explícitamente prohibidos" · 03 §8). Cada modo sigue teniendo un icono distinto.
 */
export function transferModeIcon(mode: TransferMode): IconName {
  let icon: IconName;
  switch (mode) {
    case "walk":
      icon = "a-pie";
      break;
    case "local-transit":
      icon = "tren";
      break;
    case "disney-resort-line":
      icon = "monorriel";
      break;
  }
  return icon;
}

export function transferListFootnote(edges: readonly (TransferEdge | null)[]): string {
  const hasValidated = edges.some((edge) => edge?.confidence === "validated-static");
  const hasEstimated = edges.some((edge) => !edge || edge.confidence === "estimated");
  const hasScheduleAware = edges.some((edge) => edge?.confidence === "schedule-aware");

  if (hasScheduleAware) {
    return "Los horarios en vivo se identifican explícitamente; las rutas validadas son estáticas y las estimaciones geográficas siguen marcadas como aproximadas.";
  }
  if (hasValidated && hasEstimated) {
    return "Las rutas a pie validadas usan distancia y tiempo de ruta calculados. Los demás traslados siguen siendo estimaciones geográficas; ninguno es un horario en vivo.";
  }
  if (hasValidated) {
    return "Las rutas a pie validadas usan distancia y tiempo de ruta calculados. Son datos estáticos, no horarios en vivo.";
  }
  return "Estos traslados siguen siendo estimaciones geográficas; no son tiempos de ruta validados ni horarios en vivo.";
}

/**
 * Bloque 20 (B4) — DDR-06: **la reubicación de la nota al pie, no su pérdida.**
 *
 * Hasta v1.1.0, «Cerca de aquí» llevaba un párrafo (`transferListFootnote`) que explicaba en
 * prosa de dónde salían los traslados de la lista. `04 §2` prohíbe que un bloque con marcador
 * lleve además un párrafo que repita lo mismo, y `05 §5` pt. 12 pide un `EvidenceMark` por
 * traslado. DDR-06 se resolvió por la opción (a): el marcador sustituye a la nota **y se queda
 * con su información**.
 *
 * Estas dos funciones son ese traslado. Cada una de las cuatro afirmaciones que la nota hacía
 * sobre la lista entera vive ahora en el `detail` del marcador del traslado concreto al que se
 * refiere — que es además donde es exacta, porque la nota tenía que generalizar sobre una lista
 * con traslados de distinta confianza:
 *
 * | La nota decía (sobre la lista) | El marcador dice (sobre ESE traslado) |
 * |---|---|
 * | «las rutas validadas usan distancia y tiempo de ruta calculados… son datos estáticos, no horarios en vivo» | `◼` + «Ruta (a pie) validada: distancia y tiempo de ruta calculados; datos estáticos, no un horario en vivo» |
 * | «los demás traslados siguen siendo estimaciones geográficas; ninguno es un horario en vivo» | `◇` + «Estimación geográfica: no es un tiempo de ruta validado ni un horario en vivo» |
 * | «los horarios en vivo se identifican explícitamente» | `◼` + «Horario en vivo: se identifica explícitamente como tal, no es una ruta estática ni una estimación geográfica» |
 * | (un traslado ausente se presentaba como estimación) | `◇` + el mismo texto de estimación — el *fallback* **no asciende de confianza** |
 *
 * **Ninguna procedencia nueva y ningún ascenso de confianza.** El nivel sale del `confidence`
 * que `getBestTransfer()` ya resolvió, y la primera mitad del texto es el `qualityLabel` que
 * `describeTransferForUi()` ya producía. `◼` para `validated-static` es lo que `05 §5` pt. 12
 * fija literalmente; `null` (sin traslado registrado) es `◇`, como siempre.
 *
 * `transferListFootnote` sigue existiendo y sigue probada: lo que cambia es que la ficha ya no
 * la renderiza.
 */
export type TransferEvidenceLevel = "verificado" | "estimado";

export function transferEvidenceLevel(edge: TransferEdge | null): TransferEvidenceLevel {
  if (!edge) return "estimado";
  return edge.confidence === "estimated" ? "estimado" : "verificado";
}

const ESTIMATED_DETAIL =
  "Estimación geográfica: no es un tiempo de ruta validado ni un horario en vivo";

export function transferEvidenceDetail(edge: TransferEdge | null): string {
  if (!edge) return ESTIMATED_DETAIL;
  switch (edge.confidence) {
    case "estimated":
      return ESTIMATED_DETAIL;
    case "validated-static":
      return `${describeTransferForUi(edge).qualityLabel}: distancia y tiempo de ruta calculados; datos estáticos, no un horario en vivo`;
    case "schedule-aware":
      return `${describeTransferForUi(edge).qualityLabel}: se identifica explícitamente como tal, no es una ruta estática ni una estimación geográfica`;
  }
}
