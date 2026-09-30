import { useEffect, useMemo, useRef, useState } from "react";
import type { Place } from "../types";
import { compareSequences, type SequenceCandidate } from "../lib/sequence-comparison";
import {
  dayOrderComparisonResultText,
  hasSamePlaceOrder,
  isPlaceOrderPermutation,
  movePlaceToPosition,
} from "../lib/day-order-tool";
import type { OrderedSequenceLeg } from "../lib/ordered-sequence";
import { describeTransferForUi, transferModeIcon } from "../lib/transfer-display";
import { SequenceCandidateSummary as CandidateSummary } from "./SequenceCandidateSummary";
import { Icon } from "../icons/Icon";

export type DayOrderEvidenceAlternative = {
  dayId: string;
  baselineDayPlaceIds: readonly string[];
  candidateDayPlaceIds: readonly string[];
};

export type DayOrderEvidenceOption = {
  id: string;
  family: string;
  description: string;
  alternative: DayOrderEvidenceAlternative;
};

function SequenceList({
  candidate,
  placeById,
  editable,
  dayNumber,
  disabled,
  onMove,
}: {
  candidate: SequenceCandidate;
  placeById: ReadonlyMap<string, Place>;
  editable: boolean;
  dayNumber: number;
  disabled: boolean;
  onMove?: (fromIndex: number, toIndex: number) => void;
}) {
  const { placeIds, sequence } = candidate;
  return (
    <ol className={`day-order-tool__places${editable ? " day-order-tool__places--editable" : ""}`}>
      {placeIds.map((placeId, index) => (
        <li key={`${placeId}:${index}`} className="day-order-tool__place">
          <div className="day-order-tool__place-row">
            <span className="day-order-tool__position" aria-hidden="true">{index + 1}</span>
            <span className="day-order-tool__place-name">{placeById.get(placeId)?.name ?? "Lugar no disponible"}</span>
            {editable && (
              <label className="day-order-tool__move">
                <span>Mover a…</span>
                <select
                  aria-label={`Mover ${placeById.get(placeId)?.name ?? "lugar"} a la posición en la propuesta del Día ${dayNumber}`}
                  value={index + 1}
                  disabled={disabled}
                  onChange={(event) => onMove?.(index, Number(event.target.value) - 1)}
                >
                  {placeIds.map((_, position) => (
                    <option key={position} value={position + 1}>Posición {position + 1}</option>
                  ))}
                </select>
              </label>
            )}
          </div>
          {index < sequence.legs.length && (
            <TransferLeg leg={sequence.legs[index]} />
          )}
        </li>
      ))}
    </ol>
  );
}

function TransferLeg({ leg }: { leg: OrderedSequenceLeg }) {
  if (!leg.transfer) {
    return <p className="day-order-tool__leg day-order-tool__leg--unknown">Sin traslado registrado</p>;
  }
  const display = describeTransferForUi(leg.transfer);
  return (
    <p className="day-order-tool__leg">
      <Icon name={transferModeIcon(leg.transfer.mode)} size={16} /> {display.timeText} · {display.qualityLabel}
    </p>
  );
}

export function DayOrderToolPanel({
  panelId,
  toolDayId,
  dayNumber,
  dateLabel,
  hubLabel,
  baselineDayPlaceIds,
  currentDayPlaceIds,
  routeIds,
  placeById,
  options,
  onClose,
  onApply,
}: {
  panelId: string;
  toolDayId: string;
  dayNumber: number;
  dateLabel: string | null;
  hubLabel: string | null;
  baselineDayPlaceIds: readonly string[];
  currentDayPlaceIds: readonly string[] | null;
  routeIds: readonly string[];
  placeById: ReadonlyMap<string, Place>;
  options: readonly DayOrderEvidenceOption[];
  onClose: () => void;
  onApply: (proposalIds: readonly string[]) => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [proposalIds, setProposalIds] = useState(() => [...baselineDayPlaceIds]);
  const [optionMessage, setOptionMessage] = useState("");

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  const comparison = useMemo(
    () => compareSequences(baselineDayPlaceIds, proposalIds),
    [baselineDayPlaceIds, proposalIds]
  );
  const comparisonText = dayOrderComparisonResultText(comparison);
  const dayIsStale = currentDayPlaceIds === null ||
    !hasSamePlaceOrder(currentDayPlaceIds, baselineDayPlaceIds) ||
    baselineDayPlaceIds.some((placeId) => !routeIds.includes(placeId));
  const proposalIsValid = isPlaceOrderPermutation(baselineDayPlaceIds, proposalIds);
  const proposalChanged = !hasSamePlaceOrder(baselineDayPlaceIds, proposalIds);
  const canApply = !dayIsStale && comparison.sameSet && proposalIsValid && proposalChanged;

  const validOptions = useMemo(() => dayIsStale
    ? []
    : options.filter((option) =>
        option.alternative.dayId === toolDayId &&
        hasSamePlaceOrder(option.alternative.baselineDayPlaceIds, baselineDayPlaceIds) &&
        isPlaceOrderPermutation(baselineDayPlaceIds, option.alternative.candidateDayPlaceIds)
      ), [baselineDayPlaceIds, dayIsStale, options, toolDayId]);
  const optionGroups = useMemo(() => {
    const groups = new Map<string, DayOrderEvidenceOption[]>();
    for (const option of validOptions) {
      const group = groups.get(option.family);
      if (group) group.push(option);
      else groups.set(option.family, [option]);
    }
    return [...groups.entries()];
  }, [validOptions]);

  function tryOption(option: DayOrderEvidenceOption) {
    const alternative = option.alternative;
    if (
      dayIsStale ||
      alternative.dayId !== toolDayId ||
      !hasSamePlaceOrder(alternative.baselineDayPlaceIds, baselineDayPlaceIds) ||
      !isPlaceOrderPermutation(baselineDayPlaceIds, alternative.candidateDayPlaceIds)
    ) {
      setOptionMessage("Esta opción ya no corresponde al orden capturado. Cierra y vuelve a abrir la herramienta.");
      return;
    }
    setProposalIds([...alternative.candidateDayPlaceIds]);
    setOptionMessage("La opción se cargó en Propuesta. Todavía no se ha usado en el viaje.");
  }

  return (
    <section id={panelId} className="day-order-tool" aria-labelledby={`${panelId}-heading`}>
      <header className="day-order-tool__header">
        <div>
          <h3 id={`${panelId}-heading`} ref={headingRef} tabIndex={-1}>
            Probar otro orden · Día {dayNumber}
          </h3>
          {(dateLabel || hubLabel) && (
            <p className="day-order-tool__context">
              {[dateLabel, hubLabel].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Cerrar Probar otro orden" title="Cerrar Probar otro orden">
          <Icon name="cerrar" size={16} />
        </button>
      </header>

      {dayIsStale && (
        <p className="day-order-tool__stale" role="alert">
          El orden de este día cambió mientras la propuesta estaba abierta. Cierra y vuelve a abrir la herramienta para empezar de nuevo.
        </p>
      )}

      <div className="day-order-tool__orders">
        <section className="day-order-tool__order" aria-labelledby={`${panelId}-current`}>
          <h4 id={`${panelId}-current`}>Orden actual</h4>
          <SequenceList candidate={comparison.candidateA} placeById={placeById} editable={false} dayNumber={dayNumber} disabled={dayIsStale} />
          <CandidateSummary candidate={comparison.candidateA} dayLocal />
        </section>

        <section className="day-order-tool__order" aria-labelledby={`${panelId}-proposal`}>
          <h4 id={`${panelId}-proposal`}>Propuesta</h4>
          <SequenceList
            candidate={comparison.candidateB}
            placeById={placeById}
            editable
            dayNumber={dayNumber}
            disabled={dayIsStale}
            onMove={(fromIndex, toIndex) => setProposalIds((ids) => movePlaceToPosition(ids, fromIndex, toIndex))}
          />
          <CandidateSummary candidate={comparison.candidateB} dayLocal />
        </section>
      </div>

      <section className="day-order-tool__comparison" aria-labelledby={`${panelId}-comparison`}>
        <h4 id={`${panelId}-comparison`}>Comparación de traslados</h4>
        {comparisonText.kind === "error" ? (
          <p role="alert">{comparisonText.headline} {comparisonText.detail}</p>
        ) : (
          <div role="status" aria-live="polite">
            <p className="day-order-tool__comparison-headline">{comparisonText.headline}</p>
            {comparisonText.detail && <p>{comparisonText.detail}</p>}
          </div>
        )}
      </section>

      <section className="day-order-tool__options" aria-labelledby={`${panelId}-options`}>
        <h4 id={`${panelId}-options`}>Opciones comprobadas</h4>
        <p className="day-order-tool__disclaimer">
          «Comprobado con datos completos» indica que esa alternativa cumple el contrato de evidencia registrada. Los traslados registrados no incluyen horarios, reservas, alojamiento, puerta a puerta ni el viaje completo.
        </p>
        {!dayIsStale && validOptions.length === 0 && (
          <p className="day-order-tool__empty">No hay opciones comprobadas con datos completos para este día.</p>
        )}
        {optionGroups.map(([family, familyOptions]) => (
          <details className="day-order-tool__group" key={family}>
            <summary>{family} · {familyOptions.length}</summary>
            <ul className="day-order-tool__option-list">
              {familyOptions.map((option) => (
                <li className="day-order-tool__option" key={option.id}>
                  <p>{option.description}</p>
                  <span className="day-order-tool__badge">Comprobado con datos completos</span>
                  <button type="button" className="button button--secondary" disabled={dayIsStale} onClick={() => tryOption(option)}>
                    Probar esta opción
                  </button>
                </li>
              ))}
            </ul>
          </details>
        ))}
        <p className="visually-hidden" role="status" aria-live="polite">{optionMessage}</p>
      </section>

      {!dayIsStale && !proposalChanged && (
        <p className="day-order-tool__unchanged">La propuesta coincide con el orden actual.</p>
      )}

      <footer className="day-order-tool__actions">
        <button type="button" className="button button--secondary" onClick={onClose}>Cancelar</button>
        <button
          type="button"
          className="button button--primary"
          disabled={!canApply}
          onClick={() => onApply([...proposalIds])}
        >
          Usar este orden
        </button>
      </footer>
    </section>
  );
}
