import { useEffect, useMemo, useRef, useState } from "react";
import type { Place } from "../types";
import { formatRange } from "../lib/duration";
import { summarizeSelection } from "../lib/selection";
import { buildOrderedSequence, type OrderedSequenceLeg } from "../lib/ordered-sequence";
import { compareSequences, type SequenceCandidate, type SequenceComparison } from "../lib/sequence-comparison";
import { describeTransferForUi, transferModeIcon } from "../lib/transfer-display";

type Props = {
  /** The wishlist, in its saved order — the source the route draft is initialized from and
   * the set a place can be added back from. Never mutated: removing a place from the route
   * here does not unsave it, and this component never calls anything that changes "Quiero ir". */
  savedPlaces: Place[];
  onClose: () => void;
};

/**
 * Phase 3C-A — Ordered Sequence Builder, extended by Phase 3C-B — User-Defined Sequence
 * Comparison.
 *
 * The user defines an explicit order over (a subset of) their saved places; this component
 * describes the logistics of THAT EXACT ORDER via `buildOrderedSequence`. It never chooses,
 * suggests, or optimises an order itself — see `ordered-sequence.ts` for the guarantees that
 * rests on.
 *
 * The route draft is local component state, separate from "Quiero ir": it is initialized from
 * `savedPlaces` once, on mount (this component is conditionally rendered rather than always
 * mounted, so a fresh mount is exactly "the builder opens" — the same lifecycle
 * `SelectionAnalysis` already relies on). It is never persisted — no new localStorage key,
 * no change to the existing saved-ids format.
 *
 * Phase 3C-B adds a second, user-defined order ("orden B") to compare against the current
 * route ("orden A"), rendered as a **nested view inside this same dialog** rather than a
 * second modal — one focus trap, one Escape-closes-everything behaviour, no stacked dialogs.
 * Both candidates are fixed to the exact set of places the route contained when the comparison
 * was opened: the comparison view only reorders (move up/down), it never adds or removes a
 * place — composition is a builder-view concern, ordering is a comparison-view concern. See
 * `sequence-comparison.ts` for why an unknown leg or an overlapping range never produces a
 * declared winner.
 */

function LegConnector({ leg }: { leg: OrderedSequenceLeg }) {
  if (!leg.transfer) {
    return (
      <p className="sequence-leg sequence-leg--unknown">
        <span aria-hidden="true">❓</span> Sin traslado registrado
      </p>
    );
  }
  const display = describeTransferForUi(leg.transfer);
  return (
    <p className="sequence-leg">
      <span aria-hidden="true">{transferModeIcon(leg.transfer.mode)}</span> {display.timeText} ·{" "}
      {display.qualityLabel}
    </p>
  );
}

function moveItemUp<T>(items: T[], index: number): T[] {
  if (index <= 0) return items;
  const next = [...items];
  [next[index - 1], next[index]] = [next[index], next[index - 1]];
  return next;
}

function moveItemDown<T>(items: T[], index: number): T[] {
  if (index >= items.length - 1) return items;
  const next = [...items];
  [next[index], next[index + 1]] = [next[index + 1], next[index]];
  return next;
}

/**
 * One reorderable, place-specific list — the main route draft and each comparison candidate
 * all render through this so the accessible reorder mechanics (move up/down, disabled at the
 * ends, place-specific `aria-label`s) exist in exactly one place. `labelSuffix` disambiguates
 * which list a screen-reader user is moving something within (e.g. " en orden A"); `onRemove`
 * is only passed by the main route draft — the comparison view never adds or removes a place.
 */
function ReorderableList({
  places,
  legs,
  labelSuffix,
  onMoveUp,
  onMoveDown,
  onRemove,
  compact,
}: {
  places: Place[];
  legs: OrderedSequenceLeg[];
  labelSuffix: string;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onRemove?: (id: string) => void;
  compact?: boolean;
}) {
  return (
    <ol className={`sequence-list ${compact ? "sequence-list--compact" : ""}`}>
      {places.map((place, index) => (
        <li key={place.id} className="sequence-item">
          <div className="sequence-item__row">
            <span className="sequence-item__index" aria-hidden="true">
              {index + 1}
            </span>
            <span className="sequence-item__name">{place.name}</span>
            <div className="sequence-item__controls">
              <button
                type="button"
                className="icon-button icon-button--small"
                onClick={() => onMoveUp(index)}
                disabled={index === 0}
                aria-label={`Mover ${place.name} hacia arriba${labelSuffix}`}
              >
                <span aria-hidden="true">↑</span>
              </button>
              <button
                type="button"
                className="icon-button icon-button--small"
                onClick={() => onMoveDown(index)}
                disabled={index === places.length - 1}
                aria-label={`Mover ${place.name} hacia abajo${labelSuffix}`}
              >
                <span aria-hidden="true">↓</span>
              </button>
              {onRemove && (
                <button
                  type="button"
                  className="icon-button icon-button--small"
                  onClick={() => onRemove(place.id)}
                  aria-label={`Quitar ${place.name} del recorrido`}
                >
                  <span aria-hidden="true">×</span>
                </button>
              )}
            </div>
          </div>
          {index < legs.length && <LegConnector leg={legs[index]} />}
        </li>
      ))}
    </ol>
  );
}

function CandidateSummary({ candidate }: { candidate: SequenceCandidate }) {
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
        ? "Sin tramos en este recorrido"
        : `${summary.knownLegCount}/${summary.legCount} tramo${summary.legCount === 1 ? "" : "s"} cubierto${
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
 * The one place that turns a `SequenceComparisonOutcome` into Spanish prose. Every branch is
 * phrased as a statement about *these two orders*, never as a claim about the best possible
 * route — Phase 3C-B never evaluates more than the two candidates it was given.
 */
function comparisonResultText(comparison: SequenceComparison): { headline: string; detail: string | null } {
  let headline: string;
  let detail: string | null;
  switch (comparison.outcome) {
    case "a-clearly-faster":
      headline = "Entre estos dos órdenes, el orden A tiene menor tiempo de traslado.";
      detail =
        comparison.guaranteedAdvantageMinutes !== null
          ? `Ventaja garantizada: al menos ${comparison.guaranteedAdvantageMinutes} min, incluso en el peor caso estimado.`
          : null;
      break;
    case "b-clearly-faster":
      headline = "Entre estos dos órdenes, el orden B tiene menor tiempo de traslado.";
      detail =
        comparison.guaranteedAdvantageMinutes !== null
          ? `Ventaja garantizada: al menos ${comparison.guaranteedAdvantageMinutes} min, incluso en el peor caso estimado.`
          : null;
      break;
    case "equivalent":
      headline = "Los traslados conocidos de ambos órdenes son iguales.";
      detail = null;
      break;
    case "overlapping":
      headline = "No hay una diferencia clara con los datos disponibles.";
      detail = "Los rangos de traslado de ambos órdenes se superponen.";
      break;
    case "incomplete": {
      const aIncomplete = !comparison.candidateA.sequence.summary.complete;
      const bIncomplete = !comparison.candidateB.sequence.summary.complete;
      headline = "Comparación incompleta: faltan traslados registrados.";
      if (aIncomplete && bIncomplete) {
        detail = "Ambos órdenes contienen al menos un tramo sin traslado registrado.";
      } else if (aIncomplete) {
        detail = "El orden A contiene al menos un tramo sin traslado registrado.";
      } else {
        detail = "El orden B contiene al menos un tramo sin traslado registrado.";
      }
      break;
    }
    case "invalid":
      headline = "Estos órdenes no se pueden comparar.";
      detail = "No representan exactamente el mismo conjunto de lugares.";
      break;
  }
  return { headline, detail };
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function OrderedSequenceBuilder({ savedPlaces, onClose }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const placeById = useMemo(() => new Map(savedPlaces.map((place) => [place.id, place])), [savedPlaces]);
  const [routeIds, setRouteIds] = useState<string[]>(() => savedPlaces.map((place) => place.id));

  // "builder" is the normal single-route view; "compare" is the nested Phase 3C-B view. Only
  // one is ever rendered — there is exactly one dialog, never a dialog over a dialog.
  const [view, setView] = useState<"builder" | "compare">("builder");
  const [candidateAIds, setCandidateAIds] = useState<string[]>([]);
  const [candidateBIds, setCandidateBIds] = useState<string[]>([]);

  const routePlaces = useMemo(
    () => routeIds.map((id) => placeById.get(id)).filter((place): place is Place => Boolean(place)),
    [routeIds, placeById]
  );
  const removedPlaces = useMemo(
    () => savedPlaces.filter((place) => !routeIds.includes(place.id)),
    [savedPlaces, routeIds]
  );

  const sequence = useMemo(() => buildOrderedSequence(routeIds), [routeIds]);
  const visitSummary = useMemo(() => summarizeSelection(routePlaces), [routePlaces]);

  const candidateAPlaces = useMemo(
    () => candidateAIds.map((id) => placeById.get(id)).filter((place): place is Place => Boolean(place)),
    [candidateAIds, placeById]
  );
  const candidateBPlaces = useMemo(
    () => candidateBIds.map((id) => placeById.get(id)).filter((place): place is Place => Boolean(place)),
    [candidateBIds, placeById]
  );
  const comparison = useMemo(
    () => compareSequences(candidateAIds, candidateBIds),
    [candidateAIds, candidateBIds]
  );

  function moveUp(index: number) {
    setRouteIds((ids) => moveItemUp(ids, index));
  }
  function moveDown(index: number) {
    setRouteIds((ids) => moveItemDown(ids, index));
  }
  function removeFromRoute(id: string) {
    setRouteIds((ids) => ids.filter((existing) => existing !== id));
  }
  function addToRoute(id: string) {
    setRouteIds((ids) => (ids.includes(id) ? ids : [...ids, id]));
  }

  // Candidate A starts as a clone of the current route draft, and Candidate B as a clone of
  // Candidate A — both are then independently reorderable. Neither write-back to `routeIds`:
  // the main draft is untouched while comparing, and closing the comparison discards both
  // candidates rather than committing either as "the" route.
  function openComparison() {
    setCandidateAIds([...routeIds]);
    setCandidateBIds([...routeIds]);
    setView("compare");
  }
  function closeComparison() {
    setView("builder");
  }

  // Same focus-management/backdrop-trap pattern as SelectionAnalysis: focus moves into the
  // dialog on open and returns to whatever opened it on close; Escape closes the whole dialog
  // (from either view — there is only one dialog to close); Tab cycles inside the dialog so
  // the map behind never takes focus.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => {
      const active = document.activeElement;
      if (active && active !== document.body) return;
      if (opener && opener.isConnected) opener.focus();
    };
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const root = dialogRef.current;
      if (!root) return;
      const focusable = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (element) => element.offsetParent !== null
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [onClose]);

  const { legCount, knownLegCount, unknownLegCount, transferMinutes, complete } = sequence.summary;
  const resultText = view === "compare" ? comparisonResultText(comparison) : null;

  return (
    <div className="analysis-overlay">
      <div className="analysis-backdrop" onClick={onClose} role="presentation" aria-hidden="true" />
      <div
        ref={dialogRef}
        className="analysis-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sequence-builder-title"
      >
        <header className="analysis-header">
          <div>
            {view === "compare" && (
              <button type="button" className="link-button sequence-back" onClick={closeComparison}>
                <span aria-hidden="true">←</span> Volver al recorrido
              </button>
            )}
            <h2 id="sequence-builder-title">
              {view === "compare" ? "Comparar órdenes" : "Construir recorrido"}
            </h2>
            <p className="analysis-header__sub">
              {view === "compare"
                ? `Mismos ${candidateAPlaces.length} lugares, solo cambia el orden`
                : `${routePlaces.length} lugar${routePlaces.length === 1 ? "" : "es"} en el recorrido`}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Cerrar el constructor de recorrido"
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <div className="analysis-body">
          {view === "builder" ? (
            <>
              <p className="analysis-disclaimer">
                <span aria-hidden="true">ⓘ</span> Tú eliges el orden con las flechas. Nihon describe
                los traslados de ese orden exacto; <strong>no sugiere ni calcula el mejor orden</strong>.
              </p>

              {routePlaces.length === 0 ? (
                <p className="sequence-empty">
                  El recorrido está vacío. Añade lugares guardados desde la lista de abajo.
                </p>
              ) : (
                <>
                  <ReorderableList
                    places={routePlaces}
                    legs={sequence.legs}
                    labelSuffix=""
                    onMoveUp={moveUp}
                    onMoveDown={moveDown}
                    onRemove={removeFromRoute}
                  />

                  <div className="analysis-totals">
                    <div className="analysis-total">
                      <span className="analysis-total__value">
                        {visitSummary.visitTime ? formatRange(visitSummary.visitTime) : "—"}
                      </span>
                      <span className="analysis-total__label">
                        tiempo de visita
                        {visitSummary.nonQuantified.length > 0 && (
                          <> ({visitSummary.nonQuantified.length} sin estimación numérica)</>
                        )}
                      </span>
                    </div>
                    {legCount > 0 && (
                      <div className="analysis-total">
                        <span className="analysis-total__value">
                          {transferMinutes ? formatRange(transferMinutes) : "—"}
                        </span>
                        <span className="analysis-total__label">
                          {complete ? "traslados totales" : "traslados conocidos"} · {knownLegCount}/
                          {legCount} tramo{legCount === 1 ? "" : "s"} cubierto{legCount === 1 ? "" : "s"}
                        </span>
                      </div>
                    )}
                    {unknownLegCount > 0 && (
                      <div className="analysis-total">
                        <span className="analysis-total__value">{unknownLegCount}</span>
                        <span className="analysis-total__label">
                          tramo{unknownLegCount === 1 ? "" : "s"} sin traslado registrado
                        </span>
                      </div>
                    )}
                    {visitSummary.commitmentCount > 0 && (
                      <div className="analysis-total">
                        <span className="analysis-total__value">{visitSummary.commitmentCount}</span>
                        <span className="analysis-total__label">
                          con compromiso de jornada, fuera de la suma de horas
                        </span>
                      </div>
                    )}
                  </div>

                  <p className="analysis-disclaimer">
                    <span aria-hidden="true">ⓘ</span> Los traslados conocidos usan la misma
                    clasificación que la ficha de cada lugar: rutas validadas, estimaciones
                    geográficas u horarios en vivo. <strong>No incluyen tiempo dentro de cada lugar.</strong>
                  </p>

                  {routePlaces.length >= 2 && (
                    <button
                      type="button"
                      className="button button--secondary sequence-compare-toggle"
                      onClick={openComparison}
                    >
                      <span aria-hidden="true">⇄</span> Comparar otro orden
                    </button>
                  )}
                </>
              )}

              {removedPlaces.length > 0 && (
                <section className="analysis-section">
                  <h3>Guardados fuera del recorrido</h3>
                  <p className="analysis-section__note">
                    Siguen en <strong>Quiero ir</strong>. Añádelos aquí si quieres incluirlos en
                    este recorrido.
                  </p>
                  <ul className="analysis-place-list">
                    {removedPlaces.map((place) => (
                      <li key={place.id}>
                        <button
                          type="button"
                          className="analysis-place"
                          onClick={() => addToRoute(place.id)}
                          aria-label={`Añadir ${place.name} al recorrido`}
                        >
                          <span>{place.name}</span>
                          <span aria-hidden="true">＋</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          ) : (
            <>
              <p className="analysis-disclaimer">
                <span aria-hidden="true">ⓘ</span> Compara exactamente estos dos órdenes de los
                mismos lugares. <strong>No genera ni sugiere un orden</strong>; reordena el orden B
                (y, si quieres, el orden A) con las flechas.
              </p>

              <div className="comparison-candidates">
                <section className="comparison-candidate" aria-labelledby="candidate-a-heading">
                  <h3 id="candidate-a-heading">Orden A</h3>
                  <ReorderableList
                    places={candidateAPlaces}
                    legs={comparison.candidateA.sequence.legs}
                    labelSuffix=" en orden A"
                    onMoveUp={(index) => setCandidateAIds((ids) => moveItemUp(ids, index))}
                    onMoveDown={(index) => setCandidateAIds((ids) => moveItemDown(ids, index))}
                    compact
                  />
                  <CandidateSummary candidate={comparison.candidateA} />
                </section>

                <section className="comparison-candidate" aria-labelledby="candidate-b-heading">
                  <h3 id="candidate-b-heading">Orden B</h3>
                  <ReorderableList
                    places={candidateBPlaces}
                    legs={comparison.candidateB.sequence.legs}
                    labelSuffix=" en orden B"
                    onMoveUp={(index) => setCandidateBIds((ids) => moveItemUp(ids, index))}
                    onMoveDown={(index) => setCandidateBIds((ids) => moveItemDown(ids, index))}
                    compact
                  />
                  <CandidateSummary candidate={comparison.candidateB} />
                </section>
              </div>

              <p className="analysis-disclaimer">
                <span aria-hidden="true">ⓘ</span> El tiempo de visita no cambia entre A y B; solo
                estamos comparando el orden y sus traslados.
              </p>

              <div className="comparison-result" role="status">
                <h3>Resultado</h3>
                <p className="comparison-result__headline">{resultText?.headline}</p>
                {resultText?.detail && <p className="comparison-result__detail">{resultText.detail}</p>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
