import { formatRange } from "../lib/duration";
import type { SequenceCandidate } from "../lib/sequence-comparison";

/** Shared read-only transfer coverage and evidence mix for an ordered sequence. */
export function SequenceCandidateSummary({
  candidate,
  dayLocal = false,
}: {
  candidate: SequenceCandidate;
  dayLocal?: boolean;
}) {
  const { summary } = candidate.sequence;
  const { validatedStatic, estimated, scheduleAware } = candidate.confidenceCounts;
  const parts: string[] = [];
  if (validatedStatic > 0) parts.push(`${validatedStatic} validado${validatedStatic === 1 ? "" : "s"}`);
  if (estimated > 0) parts.push(`${estimated} estimado${estimated === 1 ? "" : "s"}`);
  if (scheduleAware > 0) parts.push(`${scheduleAware} en vivo`);
  if (summary.unknownLegCount > 0) parts.push(`${summary.unknownLegCount} sin traslado`);

  return (
    <p className="comparison-candidate__stats">
      {dayLocal ? "Rango total conocido de traslados" : "Traslados"}: {summary.transferMinutes ? formatRange(summary.transferMinutes) : "Sin traslados registrados"}
      <br />
      {summary.legCount === 0
        ? (dayLocal ? "Sin traslados en este día" : "Sin traslados en este viaje")
        : `${summary.knownLegCount}/${summary.legCount} traslado${summary.legCount === 1 ? "" : "s"} registrado${summary.legCount === 1 ? "" : "s"}`}
      {parts.length > 0 && (
        <>
          <br />
          {parts.join(" · ")}
        </>
      )}
    </p>
  );
}
