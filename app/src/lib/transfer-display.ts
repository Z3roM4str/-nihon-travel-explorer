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
