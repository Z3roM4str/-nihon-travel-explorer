import { useEffect, useMemo, useRef, useState } from "react";
import type { Place } from "../types";
import { formatRange } from "../lib/duration";
import { planningBlockLabel } from "../lib/planning-block";
import type { ConcentrationReport, SelectionGroup, SelectionSummary } from "../lib/selection";
import {
  blockDistribution,
  concentration,
  groupByCluster,
  groupByHub,
  groupByPrefecture,
  groupPrefectureName,
  summarizeSelection,
} from "../lib/selection";

type Props = {
  savedPlaces: Place[];
  onSelectPlace: (id: string) => void;
  onClose: () => void;
};

/**
 * A descriptive read of the saved selection: how much of it there is, where it sits, and
 * what kind of time commitment it represents. Every number is derived from the saved places
 * on render — nothing is stored, and nothing here suggests an order, a day or a route.
 */

function commitmentSentence(summary: SelectionSummary): string | null {
  if (summary.commitmentCount === 0) return null;
  return summary.commitments
    .map(({ block, count }) => `${count} · ${planningBlockLabel(block).toLowerCase()}`)
    .join(" · ");
}

/** count + quantified range + day-scale commitments + gaps, always in that order. */
function GroupSummary({ summary }: { summary: SelectionSummary }) {
  return (
    <p className="analysis-summary">
      <span className="analysis-summary__count">
        {summary.savedCount} guardado{summary.savedCount === 1 ? "" : "s"}
      </span>
      {summary.visitTime && (
        <span className="analysis-summary__time">{formatRange(summary.visitTime)} de visita</span>
      )}
      {summary.commitments.map(({ block, count }) => (
        <span key={block} className="analysis-summary__commitment">
          {count} · {planningBlockLabel(block)}
        </span>
      ))}
      {summary.withoutEstimate.length > 0 && (
        <span className="analysis-summary__gap">
          {summary.withoutEstimate.length} sin clasificar
        </span>
      )}
    </p>
  );
}

function ClusterRow({
  group,
  hubPrefecture,
  onSelectPlace,
}: {
  group: SelectionGroup<string>;
  hubPrefecture: string | null;
  onSelectPlace: (id: string) => void;
}) {
  // Shown only when the cluster sits outside the hub's dominant prefecture — the excursion
  // case Phase 2C established, surfaced without turning prefecture into a nesting level.
  const prefecture = groupPrefectureName(group);
  const showPrefecture = prefecture !== null && prefecture !== hubPrefecture;

  return (
    <li className="analysis-cluster">
      <h4 className="analysis-cluster__name">
        {group.label}
        {showPrefecture && (
          <span className="analysis-cluster__prefecture"> · {prefecture}</span>
        )}
      </h4>
      <GroupSummary summary={group.summary} />
      <ul className="analysis-place-list">
        {group.places.map((place) => (
          <li key={place.id}>
            <button
              type="button"
              className="analysis-place"
              onClick={() => onSelectPlace(place.id)}
            >
              <span>{place.name}</span>
              <span className="analysis-place__duration">{place.duration.raw}</span>
            </button>
          </li>
        ))}
      </ul>
    </li>
  );
}

/** Counts of what the user picked. No distance, no travel time, no advice. */
function HubStatements({ report }: { report: ConcentrationReport }) {
  if (!report.hasConcentration && !report.hasDispersion) return null;

  return (
    <div className="analysis-statements">
      {report.hasConcentration && (
        <p>
          {report.topClusters.reduce((total, group) => total + group.places.length, 0)} de tus{" "}
          {report.savedCount} guardados en {report.hub} están en {report.topClusters.length}{" "}
          zona{report.topClusters.length === 1 ? "" : "s"}:{" "}
          {report.topClusters
            .map((group) => `${group.label} (${group.places.length})`)
            .join(", ")}
          .
        </p>
      )}
      {report.hasDispersion && (
        <p>
          Tus {report.savedCount} guardados en {report.hub} están en {report.distinctClusters} zonas
          distintas.
        </p>
      )}
    </div>
  );
}

function HubSection({
  group,
  expanded,
  onToggle,
  onSelectPlace,
}: {
  group: SelectionGroup;
  expanded: boolean;
  onToggle: () => void;
  onSelectPlace: (id: string) => void;
}) {
  const panelId = `analysis-hub-panel-${group.key}`;
  const buttonId = `analysis-hub-button-${group.key}`;
  const clusters = useMemo(() => groupByCluster(group.places), [group.places]);
  const report = useMemo(() => concentration(group.key, group.places), [group.key, group.places]);

  // The hub's dominant prefecture, so only the outliers get a prefecture badge.
  const hubPrefecture = useMemo(() => {
    const byPrefecture = groupByPrefecture(group.places);
    return byPrefecture.length > 0 ? byPrefecture[0].label : null;
  }, [group.places]);

  return (
    <section className="analysis-hub">
      <h3 className="analysis-hub__heading">
        <button
          type="button"
          id={buttonId}
          className="analysis-hub__toggle"
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={onToggle}
        >
          <span className="analysis-hub__name">{group.label}</span>
          <span className="analysis-hub__count">
            {group.places.length} guardado{group.places.length === 1 ? "" : "s"}
          </span>
          <span aria-hidden="true" className="analysis-hub__chevron">
            {expanded ? "▾" : "▸"}
          </span>
        </button>
      </h3>

      <div id={panelId} role="region" aria-labelledby={buttonId} hidden={!expanded}>
        <GroupSummary summary={group.summary} />
        <ul className="analysis-cluster-list">
          {clusters.map((cluster) => (
            <ClusterRow
              key={cluster.key}
              group={cluster}
              hubPrefecture={hubPrefecture}
              onSelectPlace={onSelectPlace}
            />
          ))}
        </ul>
        <HubStatements report={report} />
      </div>
    </section>
  );
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function SelectionAnalysis({ savedPlaces, onSelectPlace, onClose }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const summary = useMemo(() => summarizeSelection(savedPlaces), [savedPlaces]);
  const hubs = useMemo(() => groupByHub(savedPlaces), [savedPlaces]);
  const prefectures = useMemo(() => groupByPrefecture(savedPlaces), [savedPlaces]);
  const distribution = useMemo(() => blockDistribution(savedPlaces), [savedPlaces]);

  // Ephemeral: which hubs are open is view state, never persisted.
  const [expandedHubs, setExpandedHubs] = useState<string[]>(() =>
    hubs.length > 0 ? [hubs[0].key] : []
  );

  // Focus moves into the dialog on open and returns to whatever opened it on close — unless
  // something else has deliberately taken focus meanwhile, which is what happens when a place
  // is opened from here and the detail drawer focuses its own control.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => {
      const active = document.activeElement;
      if (active && active !== document.body) return;
      if (opener && opener.isConnected) opener.focus();
    };
  }, []);

  // Escape closes; Tab cycles inside the dialog so the map behind never takes focus.
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

  const commitments = commitmentSentence(summary);

  return (
    <div className="analysis-overlay">
      <div
        className="analysis-backdrop"
        onClick={onClose}
        role="presentation"
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        className="analysis-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="analysis-title"
      >
        <header className="analysis-header">
          <div>
            <h2 id="analysis-title">Tu selección</h2>
            <p className="analysis-header__sub">
              {summary.savedCount} lugar{summary.savedCount === 1 ? "" : "es"} guardado
              {summary.savedCount === 1 ? "" : "s"} en {hubs.length} hub
              {hubs.length === 1 ? "" : "s"} y {prefectures.length} prefectura
              {prefectures.length === 1 ? "" : "s"}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Cerrar el análisis de la selección"
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <div className="analysis-body">
          <div className="analysis-totals">
            <div className="analysis-total">
              <span className="analysis-total__value">
                {summary.visitTime ? formatRange(summary.visitTime) : "—"}
              </span>
              <span className="analysis-total__label">
                tiempo de visita cuantificable ({summary.quantifiedCount} lugar
                {summary.quantifiedCount === 1 ? "" : "es"})
              </span>
            </div>
            {summary.commitmentCount > 0 && (
              <div className="analysis-total">
                <span className="analysis-total__value">{summary.commitmentCount}</span>
                <span className="analysis-total__label">
                  con compromiso de jornada, no sumados a las horas
                  {commitments && <span className="analysis-total__detail"> — {commitments}</span>}
                </span>
              </div>
            )}
            {summary.nonQuantified.length > 0 && (
              <div className="analysis-total">
                <span className="analysis-total__value">{summary.nonQuantified.length}</span>
                <span className="analysis-total__label">sin estimación numérica en horas</span>
              </div>
            )}
          </div>

          <p className="analysis-disclaimer">
            <span aria-hidden="true">ⓘ</span> Todos los totales cuentan solo el tiempo dentro de
            cada lugar. <strong>No incluyen traslados.</strong>
          </p>

          {hubs.map((hub) => (
            <HubSection
              key={hub.key}
              group={hub}
              expanded={expandedHubs.includes(hub.key)}
              onToggle={() =>
                setExpandedHubs((open) =>
                  open.includes(hub.key)
                    ? open.filter((key) => key !== hub.key)
                    : [...open, hub.key]
                )
              }
              onSelectPlace={onSelectPlace}
            />
          ))}

          <section className="analysis-section">
            <h3>Distribución por duración</h3>
            <ul className="analysis-distribution">
              {distribution.map(({ block, count }) => (
                <li key={block}>
                  <span className="analysis-distribution__label">{planningBlockLabel(block)}</span>
                  <span className="analysis-distribution__count">{count}</span>
                </li>
              ))}
            </ul>
          </section>

          {summary.nonQuantified.length > 0 && (
            <section className="analysis-section">
              <h3>Sin estimación numérica</h3>
              <p className="analysis-section__note">
                Su duración es un compromiso editorial de jornada, no un número de horas, así que
                queda fuera de la suma.
              </p>
              <ul className="analysis-place-list">
                {summary.nonQuantified.map((place) => (
                  <li key={place.id}>
                    <button
                      type="button"
                      className="analysis-place"
                      onClick={() => onSelectPlace(place.id)}
                    >
                      <span>{place.name}</span>
                      <span className="analysis-place__duration">{place.duration.raw}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
