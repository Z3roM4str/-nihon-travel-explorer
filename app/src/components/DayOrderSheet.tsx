import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Place } from "../types";
import { formatRange } from "../lib/duration";
import type { OrderedSequenceLeg } from "../lib/ordered-sequence";
import {
  compareSequences,
  type SequenceCandidate,
  type SequenceComparison,
} from "../lib/sequence-comparison";
import { describeTransferForUi, transferModeIcon } from "../lib/transfer-display";
import { Icon } from "../icons/Icon";
import { Sheet } from "./Sheet";
import { isSameOrder, moveItemDown, moveItemUp } from "./day-order";

type Props = {
  /** «Día 3 · mié 24 feb · Kioto» — the headline the day itself shows. */
  headline: string;
  dayNumber: number;
  /** The day's persisted order, read from the draft by the caller at the moment of rendering. */
  currentIds: readonly string[];
  placeById: ReadonlyMap<string, Place>;
  /**
   * The verified `evidence-complete-*` options for THIS day, rendered by the caller (their wording
   * and grouping are unchanged since Phase 3E). `load` copies an option's order into «Otro orden»;
   * it never writes the draft.
   */
  renderAlternatives?: (proposalIds: readonly string[], load: (ids: readonly string[]) => void) => ReactNode;
  /** The ONE way this sheet writes: called only from «Usar este orden». */
  onApply: (proposalIds: readonly string[]) => void;
  onClose: () => void;
};

function LegConnector({ leg }: { leg: OrderedSequenceLeg }) {
  if (!leg.transfer) {
    /* Bloque 17 (B1): sin icono "?" — una ausencia conocida no es un error
       (04 §14 "Sin traslado registrado: … nunca en rojo y nunca con ?"). */
    return <p className="sequence-leg sequence-leg--unknown">Sin traslado registrado</p>;
  }
  const display = describeTransferForUi(leg.transfer);
  return (
    <p className="sequence-leg">
      <Icon name={transferModeIcon(leg.transfer.mode)} size={16} /> {display.timeText} · {display.qualityLabel}
    </p>
  );
}

function OrderSummary({ candidate }: { candidate: SequenceCandidate }) {
  const { summary } = candidate.sequence;
  const { validatedStatic, estimated, scheduleAware } = candidate.confidenceCounts;
  const parts: string[] = [];
  if (validatedStatic > 0) parts.push(`${validatedStatic} validado${validatedStatic === 1 ? "" : "s"}`);
  if (estimated > 0) parts.push(`${estimated} estimado${estimated === 1 ? "" : "s"}`);
  if (scheduleAware > 0) parts.push(`${scheduleAware} en vivo`);
  if (summary.unknownLegCount > 0) parts.push(`${summary.unknownLegCount} sin traslado`);
  return (
    <p className="comparison-candidate__stats">
      Traslados: {summary.transferMinutes ? formatRange(summary.transferMinutes) : "—"}
      <br />
      {summary.legCount === 0
        ? "Sin traslados en este día"
        : `${summary.knownLegCount}/${summary.legCount} traslado${summary.legCount === 1 ? "" : "s"} registrado${
            summary.legCount === 1 ? "" : "s"
          }`}
      {parts.length > 0 && (
        <>
          <br />
          {parts.join(" · ")}
        </>
      )}
    </p>
  );
}

/**
 * The one place that turns a `SequenceComparisonOutcome` into prose for this tool. Candidate A is
 * always the persisted order and B the proposal. Every branch describes what THESE TWO orders imply;
 * none names a winner, ranks, or advises (Art. 5) — the gap is stated as a fact between two recorded
 * ranges, never as a reason to choose.
 */
function comparisonText(comparison: SequenceComparison): { headline: string; detail: string | null } {
  switch (comparison.outcome) {
    case "a-clearly-faster":
      return {
        headline: `El orden actual suma al menos ${comparison.guaranteedAdvantageMinutes} min menos de traslado que el otro orden.`,
        detail: "Es la diferencia mínima entre los rangos registrados de ambos órdenes.",
      };
    case "b-clearly-faster":
      return {
        headline: `El otro orden suma al menos ${comparison.guaranteedAdvantageMinutes} min menos de traslado que el orden actual.`,
        detail: "Es la diferencia mínima entre los rangos registrados de ambos órdenes.",
      };
    case "equivalent":
      return { headline: "Los traslados conocidos de ambos órdenes son iguales.", detail: null };
    case "overlapping":
      return {
        headline: "No hay una diferencia clara con los datos disponibles.",
        detail: "Los rangos de traslado de ambos órdenes se superponen.",
      };
    case "incomplete": {
      const aIncomplete = !comparison.candidateA.sequence.summary.complete;
      const bIncomplete = !comparison.candidateB.sequence.summary.complete;
      return {
        headline: "Comparación incompleta: faltan traslados registrados.",
        detail:
          aIncomplete && bIncomplete
            ? "Ambos órdenes contienen al menos un traslado sin registrar."
            : aIncomplete
              ? "El orden actual contiene al menos un traslado sin registrar."
              : "El otro orden contiene al menos un traslado sin registrar.",
      };
    }
    case "invalid":
      return { headline: "Estos órdenes no se pueden comparar.", detail: "No representan exactamente el mismo conjunto de lugares." };
  }
}

/**
 * B29 (B9.3, `05 §7`) — «Probar otro orden»: a sheet LOCAL to one day.
 *
 * It shows the day's current order, a proposal the reader reorders (it starts as a COPY of the
 * current order — not something Nihon proposes), the comparison `sequence-comparison.ts` already
 * computes, and the verified alternatives as options. The proposal is transient component state:
 * opening, editing, choosing an option, Escape and «Cancelar» never touch the draft. Only
 * «Usar este orden» calls `onApply`.
 */
export function DayOrderSheet({
  headline,
  dayNumber,
  currentIds,
  placeById,
  renderAlternatives,
  onApply,
  onClose,
}: Props) {
  const [proposalIds, setProposalIds] = useState<string[]>(() => [...currentIds]);
  const [status, setStatus] = useState("");
  const focusRef = useRef<string | null>(null);

  useEffect(() => {
    const id = focusRef.current;
    if (!id) return;
    focusRef.current = null;
    document.getElementById(id)?.focus();
  });

  const nameOf = (placeId: string) => placeById.get(placeId)?.name ?? placeId;
  const unchanged = isSameOrder(proposalIds, currentIds);
  const comparison = useMemo(() => compareSequences(currentIds, proposalIds), [currentIds, proposalIds]);
  const result = unchanged
    ? { headline: "El otro orden es igual al orden actual.", detail: "Reordénalo o carga una alternativa para compararlos." }
    : comparisonText(comparison);

  function move(index: number, direction: -1 | 1) {
    const placeId = proposalIds[index];
    const next = direction === -1 ? moveItemUp(proposalIds, index) : moveItemDown(proposalIds, index);
    const nextIndex = next.indexOf(placeId);
    setProposalIds(next);
    setStatus(`${nameOf(placeId)}: posición ${nextIndex + 1} de ${next.length} en «Otro orden».`);
    const canRepeat = direction === -1 ? nextIndex > 0 : nextIndex < next.length - 1;
    const dir = canRepeat ? direction : ((-direction) as -1 | 1);
    focusRef.current = `day-order-${dir === -1 ? "up" : "down"}-${placeId}`;
  }

  function load(ids: readonly string[]) {
    setProposalIds([...ids]);
    setStatus("Alternativa cargada en «Otro orden». Todavía no se ha aplicado.");
  }

  const currentPlaces = currentIds.map((id) => ({ id, name: nameOf(id) }));

  return (
    <Sheet title={`Probar otro orden · Día ${dayNumber}`} onClose={onClose} labelledBy="day-order-title">
      <div className="day-order" data-day-order-sheet="">
        <p className="day-order__scope">{headline}</p>
        <p className="day-order__intro">
          Vosotros decidís el orden. Nada cambia en el día hasta que pulséis «Usar este orden».
        </p>
        <p className="visually-hidden" role="status" aria-live="polite" data-day-order-status="">
          {status}
        </p>

        <section className="day-order__block day-order__block--current" aria-labelledby="day-order-current-heading">
          <h3 id="day-order-current-heading">Orden actual</h3>
          <ol className="sequence-list sequence-list--compact" aria-labelledby="day-order-current-heading">
            {currentPlaces.map((place, index) => (
              <li key={place.id} className="sequence-item">
                <div className="sequence-item__row">
                  <span className="sequence-item__index" aria-hidden="true">
                    {index + 1}
                  </span>
                  <span className="sequence-item__name">{place.name}</span>
                </div>
                {index < comparison.candidateA.sequence.legs.length && (
                  <LegConnector leg={comparison.candidateA.sequence.legs[index]} />
                )}
              </li>
            ))}
          </ol>
          <OrderSummary candidate={comparison.candidateA} />
        </section>

        <section className="day-order__block day-order__block--proposal" aria-labelledby="day-order-proposal-heading">
          <h3 id="day-order-proposal-heading">Otro orden</h3>
          <p className="day-order__hint" id="day-order-proposal-hint">
            Empieza igual que el orden actual. Muévelo con las flechas de cada parada.
          </p>
          <ol
            className="sequence-list sequence-list--compact"
            aria-labelledby="day-order-proposal-heading"
            aria-describedby="day-order-proposal-hint"
          >
            {proposalIds.map((placeId, index) => (
              <li key={placeId} className="sequence-item">
                <div className="sequence-item__row">
                  <span className="sequence-item__index" aria-hidden="true">
                    {index + 1}
                  </span>
                  <span className="sequence-item__name">{nameOf(placeId)}</span>
                  <div className="sequence-item__controls">
                    <button
                      type="button"
                      id={`day-order-up-${placeId}`}
                      className="icon-button icon-button--small"
                      onClick={() => move(index, -1)}
                      disabled={index === 0}
                      aria-label={`Mover ${nameOf(placeId)} hacia arriba en otro orden`}
                      title={`Mover ${nameOf(placeId)} hacia arriba`}
                    >
                      <Icon name="arriba" size={16} />
                    </button>
                    <button
                      type="button"
                      id={`day-order-down-${placeId}`}
                      className="icon-button icon-button--small"
                      onClick={() => move(index, 1)}
                      disabled={index === proposalIds.length - 1}
                      aria-label={`Mover ${nameOf(placeId)} hacia abajo en otro orden`}
                      title={`Mover ${nameOf(placeId)} hacia abajo`}
                    >
                      <Icon name="abajo" size={16} />
                    </button>
                  </div>
                </div>
                {index < comparison.candidateB.sequence.legs.length && (
                  <LegConnector leg={comparison.candidateB.sequence.legs[index]} />
                )}
              </li>
            ))}
          </ol>
          <OrderSummary candidate={comparison.candidateB} />
        </section>

        <section className="comparison-result day-order__comparison" aria-labelledby="day-order-comparison-heading">
          <h3 id="day-order-comparison-heading">Comparación de traslados</h3>
          <p className="comparison-result__headline">{result.headline}</p>
          {result.detail && <p className="comparison-result__detail">{result.detail}</p>}
          <p className="comparison-result__detail">
            El tiempo de visita no cambia; solo se comparan el orden y sus traslados registrados.
          </p>
        </section>

        {renderAlternatives?.(proposalIds, load)}

        <div className="day-order__actions">
          <button
            type="button"
            className="button button--primary"
            onClick={() => onApply(proposalIds)}
            disabled={unchanged}
            aria-describedby={unchanged ? "day-order-apply-hint" : undefined}
          >
            Usar este orden
          </button>
          <button type="button" className="button button--secondary" onClick={onClose}>
            Cancelar
          </button>
          {unchanged && (
            <p className="day-order__hint" id="day-order-apply-hint">
              Aún no hay nada que aplicar: «Otro orden» es igual al actual.
            </p>
          )}
        </div>
      </div>
    </Sheet>
  );
}
