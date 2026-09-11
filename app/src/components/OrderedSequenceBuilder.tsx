import { useEffect, useMemo, useRef, useState } from "react";
import type { Place } from "../types";
import { formatMinutes, formatRange, resolveDuration } from "../lib/duration";
import { summarizeSelection } from "../lib/selection";
import { buildOrderedSequence, type OrderedSequenceLeg, type OrderedSequenceSummary } from "../lib/ordered-sequence";
import {
  compareSequences,
  type ConfidenceCounts,
  type SequenceCandidate,
  type SequenceComparison,
} from "../lib/sequence-comparison";
import {
  applyEvidenceCompleteLocalSwap,
  generateEvidenceCompleteLocalSwaps,
  type EvidenceCompleteLocalSwapAlternative,
} from "../lib/evidence-complete-local-swap";
import {
  applyEvidenceCompleteLocalRelocation,
  generateEvidenceCompleteLocalRelocations,
  type EvidenceCompleteLocalRelocationAlternative,
} from "../lib/evidence-complete-local-relocation";
import { buildDayAssignment, type DayAssignment } from "../lib/day-assignment";
import { describeTransferForUi, transferModeIcon } from "../lib/transfer-display";
import { addCivilDays, formatCivilDateDisplay, type CivilWeekday } from "../lib/civil-date";
import { buildDayWeekdaySignal, type DayWeekdaySignal } from "../lib/day-weekday-signal";
import {
  assessTripBounds,
  buildTripBoundsSummary,
  type TripBoundsAssessment,
  type TripBoundsSummary,
} from "../lib/trip-bounds";
import {
  buildReservationPreparationSummary,
  type ReservationPreparationSummary,
} from "../lib/reservation-planning";
import type { LeadTimeMagnitude } from "../lib/reservation-lead-time";
import type { ReservationCategory } from "../lib/reservation";
import { buildRecordedHoursSummary, type RecordedHoursSummary } from "../lib/hours-planning";
import type { HoursCategory, RecordedHoursFact } from "../lib/recorded-hours";
import {
  buildPresentableDayHoursClosureCompositions,
} from "../lib/hours-closure-composition";
import {
  derivePlaceReservationDateWindow,
  deriveVisitDateForPlace,
  type ReservationDateWindow,
} from "../lib/reservation-deadline";
import {
  captureDeviceLocalCivilDate,
  evaluateReservationWindowReference,
  type ReservationWindowReferenceRelation,
} from "../lib/reservation-window-reference";
import {
  describeReservationWindowReferenceForUi,
  formatDeviceReferenceDateForUi,
} from "../lib/reservation-window-reference-presentation";
import { describeFebMarStatusForUi, interpretPlaceFebMarStatus, type FebMarStatusTone } from "../lib/feb-mar-status";
import {
  buildDayRecordedIntervalFits,
  type RecordedIntervalDurationFit,
} from "../lib/recorded-interval-fit";
import {
  buildDayLogisticsWithAccommodation,
  isValidAccommodationLocation,
  isValidManualAccommodationMinutes,
  type AccommodationAnchor,
  type AccommodationBoundaryChoice,
  type AccommodationBoundaryLegResult,
  type DayAccommodationBoundary,
  type ManualAccommodationLeg,
} from "../lib/accommodation-commute";
import {
  INTER_HUB_MODES,
  assessInterHubSegment,
  deriveEligibleInterHubPairs,
  isInterHubMode,
  isValidInterHubMinutes,
  type EligibleInterHubPair,
  type InterHubMode,
  type InterHubSegmentAssessment,
  type ManualInterHubSegment,
  type NewManualInterHubSegment,
} from "../lib/inter-hub-segment";
import {
  buildWholeTripComposition,
  type WholeTripBoundsComposition,
  type WholeTripComposition,
} from "../lib/whole-trip-composition";
import { usePlanningDraft } from "../usePlanningDraft";

type Props = {
  /** The wishlist, in its saved order — the source the route draft is initialized from and
   * the set a place can be added back from. Never mutated: removing a place from the route
   * here does not unsave it, and this component never calls anything that changes "Quiero ir". */
  savedPlaces: Place[];
  onClose: () => void;
};

/**
 * Phase 3C-A — Ordered Sequence Builder, extended by Phase 3C-B — User-Defined Sequence
 * Comparison, Phase 3C-C — User-Defined Day Assignment, Phase 3C-D — Persisted Manual
 * Planning Draft, and Phase 3C-E — Manual Calendar Anchoring.
 *
 * Phase 3C-E lets the user anchor "Día 1" to a real civil date (`YYYY-MM-DD`, via
 * `usePlanningDraft`'s `startDate`/`setStartDate`); every later day is that date offset by
 * calendar days (`civil-date.ts#addCivilDays`), computed fresh on every render — never stored
 * per day. This is a date the user picks, not one Nihon suggests: there is no reading of
 * `place.bestTime`, `schedule.hours`, or `schedule.closures` anywhere in this phase, and no
 * check of whether anything is open on the chosen date.
 *
 * The user defines an explicit order over (a subset of) their saved places; this component
 * describes the logistics of THAT EXACT ORDER via `buildOrderedSequence`. It never chooses,
 * suggests, or optimises an order itself — see `ordered-sequence.ts` for the guarantees that
 * rests on.
 *
 * The route and the canonical day assignment are the **persisted** manual plan (Phase 3C-D):
 * `usePlanningDraft` is this component's single source of truth for both, backed by
 * `nihon.manualPlanningDraft` in `localStorage` — a separate key from `nihon.savedPlaceIds`
 * ("Quiero ir"), which stays exclusively the saved-place set. Nothing derived (places,
 * durations, transfer edges/results, confidence tallies) is ever persisted — only ids and the
 * user's own ordering/grouping structure; every derived value here is still recomputed on read,
 * exactly as before this phase.
 *
 * Phase 3C-B's comparison candidates ("orden A"/"orden B") are deliberately **not** part of that
 * persisted draft and never will be: `candidateAIds`/`candidateBIds` remain plain component
 * state, cloned fresh from the current route each time the comparison view opens and discarded
 * on close — see `openComparison`/`closeComparison` below.
 *
 * Phase 3C-B and Phase 3C-C each render as a **nested view inside this same dialog** rather than
 * a second modal — one focus trap, one Escape-closes-everything behaviour, no stacked dialogs.
 * Composition is fixed once either nested view opens: neither the comparison candidates nor the
 * day buckets can add or remove a place, only reorder or move between the fixed set — see
 * `sequence-comparison.ts` and `day-assignment.ts` for the guarantees that rest on that.
 *
 * Phase 3D-B adds one narrow, read-only signal to each day card that already has a derived date:
 * whether that date's weekday matches a candidate recurring-weekday closure extracted from a
 * place's `schedule.closures` text (`../lib/day-weekday-signal.ts`,
 * `../lib/temporal-availability.ts`). It is deliberately NOT an opening-hours judgment — see
 * `WeekdayClosureNotice` below for the exact, conservative wording this is allowed to use. It
 * reads no `schedule.hours`, no `bestTime`, and no `febMar2027` field; it is computed fresh on
 * every render from the day's already-derived date and its places' existing raw text, and
 * nothing about it is persisted (no new planning-draft field, no new `localStorage` key).
 *
 * Phase 3D-D adds one route-wide, read-only section — "Reservas por preparar" — built from
 * `../lib/reservation-planning.ts` over the current canonical route (`routePlaces`), deliberately
 * rendered in the "builder" view rather than inside a day card: the underlying signal
 * (`reservation.leadTime`'s coarse magnitude or "needs review" flag) is useful before the route is
 * even split into days, and never depends on `startDate` or any derived date. It composes two
 * independently-derived axes — `../lib/reservation.ts`'s `ReservationFact` and
 * `../lib/reservation-lead-time.ts`'s `ReservationLeadTimeFact` — without merging or overriding
 * either, and never computes a booking deadline, a days-remaining count, or any comparison against
 * a date. See `ReservationPreparationSection` below for the exact, conservative wording this is
 * allowed to use.
 *
 * Phase 3D-H adds one more per-day, read-only signal — a derived "ventana de anticipación
 * registrada" — built from `../lib/reservation-deadline.ts`, rendered in each day card next to
 * `WeekdayClosureNotice`. Unlike every earlier reservation/hours section, this ONE signal does
 * depend on a derived date: it requires a place to have a valid visit date under the design gate's
 * own (deliberately stricter than `dayDate` above) contract — `dayAssignment.valid === true` AND a
 * valid `startDate` — before anything renders for it, and even then only for the narrow "Class A"
 * evidence class (`../lib/reservation-lead-time.ts`'s coarse-magnitude records with an explicit
 * numeric day/week range). It never computes a booking deadline or an availability claim, never
 * reads `Date.now()`, and never reads or is gated by `place.febMar2027` internally — Feb–Mar 2027
 * confidence composes at THIS presentation layer only (`ReservationDeadlineNotice` below), never
 * inside `reservation-deadline.ts` itself, per the design gate's orthogonality rule (§6.2).
 *
 * Phase 3D-O extends that same per-day reservation surface with one secondary relation between the
 * already-derived Phase 3D-H window and one explicitly disclosed device-local civil date captured
 * when this planner instance opens. The relation is recomputed from the current window but the
 * captured reference date is not persisted and does not self-refresh at midnight; the exact date
 * used is rendered alongside the relation. Before/within/after remains neutral planning context —
 * never booking-open/closed, availability, urgency, countdown, or Japan business-date semantics.
 *
 * Phase 3D-E adds one more route-wide, read-only section — "Horarios registrados" — built from
 * `../lib/hours-planning.ts` over the current canonical route (`routePlaces`), rendered next to
 * "Reservas por preparar" for the same reason: the underlying signal (what kind of hours
 * information `place.schedule.hours` records) is useful before the route is split into days, and
 * never depends on `startDate` or any derived date. Unlike the reservation section, no place is
 * ever omitted — every place gets an entry, even an UNKNOWN/OPAQUE one, because "the hours are
 * variable" or "depends on an outside operator" is itself planning-relevant information. This
 * section never answers whether a place is open, never compares against a date or clock time, and
 * never composes with Phase 3D-B's closure signal or `febMar2027` — see `../lib/recorded-hours.ts`
 * for the exact product boundary and `HoursPlanningSection` below for the wording this is allowed
 * to use.
 *
 * **Phase 3D-Q — Manual Accommodation Commute Legs** adds the first surface in this planner that
 * reaches outside a day's own place sequence, and it does so only with decisions the user makes
 * explicitly. An accommodation is a SEPARATE entity (`../lib/accommodation-commute.ts`), never a
 * `Place`: no anchor id ever enters `routeIds`, `days`, an `OrderedSequence`, a day bucket, or any
 * tourism dataset, and no anchor is ever passed to `getBestTransfer` — a manual accommodation leg
 * is not a `TransferEdge` and is composed OUTSIDE `OrderedSequenceSummary`, so the existing
 * place-to-place semantics and provenance are untouched.
 *
 * Two things, and only two, come from the user: which anchor (if any) applies at each side of each
 * ordinal day, and the exact directed accommodation↔place duration they typed. Nothing is derived
 * — no geocoding, no routing, no live transit, no booking lookup, no haversine, no nearest place,
 * no reverse inference (`Hotel A → Place X` never fills in `Place X → Hotel A`), and no default
 * anchor. An anchor's coordinates are geographic identity only and are never read as arithmetic.
 * A missing leg reads as unrecorded and contributes nothing to any subtotal — never zero minutes.
 * See `AccommodationManagerSection`/`AccommodationCommuteSection` below for the exact wording this
 * is allowed to use.
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

function moveItemUp<T>(items: readonly T[], index: number): T[] {
  if (index <= 0) return [...items];
  const next = [...items];
  [next[index - 1], next[index]] = [next[index], next[index - 1]];
  return next;
}

function moveItemDown<T>(items: readonly T[], index: number): T[] {
  if (index >= items.length - 1) return [...items];
  const next = [...items];
  [next[index], next[index + 1]] = [next[index + 1], next[index]];
  return next;
}

// ---------------------------------------------------------------------------------------
// Phase 3D-S removed this file's local day-bucket array helpers (`addEmptyDay`,
// `removeEmptyDay`, `moveWithinDay`, `moveToAdjacentDay`). They rebuilt a whole `string[][]`
// matrix on every edit, which is exactly the shape that cannot say which bucket is which — so
// each of those operations is now an explicit identity-aware mutation on `usePlanningDraft`
// addressed by the day's own stable id (`movePlaceWithinDay`, `movePlaceBetweenDays`,
// `addEmptyDay`, `removeEmptyDay`). The day's ordinal position is still what the UI renders and
// what every temporal/logistics consumer receives; it is simply no longer what identifies it.
// ---------------------------------------------------------------------------------------

/**
 * One reorderable, place-specific list — the main route draft, each comparison candidate, and
 * each day bucket all render through this so the accessible reorder mechanics (move up/down,
 * disabled at the ends, place-specific `aria-label`s) exist in exactly one place. `labelSuffix`
 * disambiguates which list a screen-reader user is moving something within (e.g. " en orden A",
 * " en Día 2"); `onRemove` is only passed by the main route draft. `onMoveToPreviousGroup`/
 * `onMoveToNextGroup` are only passed by the day-assignment view, for moving a place into the
 * adjacent day — omitted entirely (not merely disabled) everywhere else, so the builder and
 * comparison views render exactly as they did before Phase 3C-C.
 */
function ReorderableList({
  places,
  legs,
  labelSuffix,
  onMoveUp,
  onMoveDown,
  onRemove,
  onMoveToPreviousGroup,
  onMoveToNextGroup,
  previousGroupLabel,
  nextGroupLabel,
  canMoveToPreviousGroup,
  canMoveToNextGroup,
  showDuration,
  compact,
}: {
  places: Place[];
  legs: OrderedSequenceLeg[];
  labelSuffix: string;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onRemove?: (id: string) => void;
  onMoveToPreviousGroup?: (index: number) => void;
  onMoveToNextGroup?: (index: number) => void;
  previousGroupLabel?: string;
  nextGroupLabel?: string;
  canMoveToPreviousGroup?: boolean;
  canMoveToNextGroup?: boolean;
  showDuration?: boolean;
  compact?: boolean;
}) {
  return (
    <ol className={`sequence-list ${compact ? "sequence-list--compact" : ""}`}>
      {places.map((place, index) => {
        const range = resolveDuration(place.duration);
        return (
          <li key={place.id} className="sequence-item">
            <div className="sequence-item__row">
              <span className="sequence-item__index" aria-hidden="true">
                {index + 1}
              </span>
              <span className="sequence-item__name">
                {place.name}
                {showDuration && (
                  <span className="sequence-item__duration">
                    {range ? formatRange(range) : place.duration.raw}
                  </span>
                )}
              </span>
              <div className="sequence-item__controls">
                {onMoveToPreviousGroup && (
                  <button
                    type="button"
                    className="icon-button icon-button--small"
                    onClick={() => onMoveToPreviousGroup(index)}
                    disabled={!canMoveToPreviousGroup}
                    aria-label={`Mover ${place.name} ${previousGroupLabel ?? "al grupo anterior"}`}
                  >
                    <span aria-hidden="true">←</span>
                  </button>
                )}
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
                {onMoveToNextGroup && (
                  <button
                    type="button"
                    className="icon-button icon-button--small"
                    onClick={() => onMoveToNextGroup(index)}
                    disabled={!canMoveToNextGroup}
                    aria-label={`Mover ${place.name} ${nextGroupLabel ?? "al grupo siguiente"}`}
                  >
                    <span aria-hidden="true">→</span>
                  </button>
                )}
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
        );
      })}
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
 * The same four factual quantities every ordered-sequence view has shown since Phase 3C-A —
 * visit time, transfer time (labelled "conocidos" unless `summary.complete`), unknown-leg
 * count, day-scale commitments — never merged into one number. Reused as-is for each day
 * bucket in the Phase 3C-C view so a day never gets a second, differently-computed total.
 */
function TransferAndVisitTotals({
  visitSummary,
  sequenceSummary,
}: {
  visitSummary: ReturnType<typeof summarizeSelection>;
  sequenceSummary: OrderedSequenceSummary;
}) {
  const { legCount, knownLegCount, unknownLegCount, transferMinutes, complete } = sequenceSummary;
  return (
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
          <span className="analysis-total__value">{transferMinutes ? formatRange(transferMinutes) : "—"}</span>
          <span className="analysis-total__label">
            {complete ? "traslados totales" : "traslados conocidos"} · {knownLegCount}/{legCount} tramo
            {legCount === 1 ? "" : "s"} cubierto{legCount === 1 ? "" : "s"}
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
          <span className="analysis-total__label">con compromiso de jornada, fuera de la suma de horas</span>
        </div>
      )}
    </div>
  );
}

/** Display-only Spanish labels for `CivilWeekday` — the domain type itself stays a stable,
 * locale-independent identifier (see `civil-date.ts`); this table is the one place that turns it
 * into user-facing text, exactly like `formatCivilDateDisplay` does for the date itself. */
const WEEKDAY_LABEL: Record<CivilWeekday, string> = {
  sunday: "domingo",
  monday: "lunes",
  tuesday: "martes",
  wednesday: "miércoles",
  thursday: "jueves",
  friday: "viernes",
  saturday: "sábado",
};

/**
 * Phase 3D-B's one UI surface. Renders nothing when the day has no derived date yet
 * (`signal.assessed === false`) or has no places — the existing calendar UI (the date input,
 * "Sin lugares en este día") is already sufficient in both cases, per the phase's own scope.
 *
 * Wording is deliberately narrow and conservative throughout: a match reads "posible
 * coincidencia," never "cerrado"; a day with zero matches reads only "sin coincidencias
 * detectadas," never a "day is valid"/"everything compatible" claim; not-evaluable places are
 * named as a limitation, not hidden. See `../lib/temporal-availability.ts`'s own doc for the
 * exact outcome vocabulary this renders from.
 */
function WeekdayClosureNotice({ signal }: { signal: DayWeekdaySignal }) {
  if (!signal.assessed || signal.perPlace.length === 0) return null;

  const matches = signal.perPlace.filter(
    (
      p
    ): p is typeof p & {
      assessment: Extract<(typeof p)["assessment"], { outcome: "possible-weekday-closure-match" }>;
    } => p.assessment.outcome === "possible-weekday-closure-match"
  );

  return (
    <section className="weekday-signal" aria-label="Posibles coincidencias de cierre semanal">
      {matches.length > 0 ? (
        <>
          <p className="weekday-signal__summary weekday-signal__summary--warn">
            <span aria-hidden="true">⚠</span> {matches.length} posible
            {matches.length === 1 ? "" : "s"} coincidencia{matches.length === 1 ? "" : "s"} con cierre semanal
          </p>
          <ul className="weekday-signal__list">
            {matches.map(({ placeId, placeName, assessment }) => (
              <li key={placeId}>
                <strong>{placeName}</strong> — el registro indica «{assessment.closure.raw}». La fecha elegida
                cae en {WEEKDAY_LABEL[assessment.weekday]}; confirma el horario/cierre oficial.
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="weekday-signal__summary">
          <span aria-hidden="true">ⓘ</span> Sin coincidencias de cierre semanal detectadas.
        </p>
      )}
      {signal.notEvaluableCount > 0 && (
        <p className="weekday-signal__note">
          {signal.notEvaluableCount} lugar{signal.notEvaluableCount === 1 ? "" : "es"} no puede
          {signal.notEvaluableCount === 1 ? "" : "n"} evaluarse con los datos de cierre actuales.
        </p>
      )}
      <p className="weekday-signal__disclaimer">
        Esta comprobación solo revisa un posible patrón de cierre semanal ya registrado. No verifica horarios,
        días festivos, cierres temporales, clima, reservas ni el estado real vigente.
      </p>
    </section>
  );
}

/**
 * Phase 3D-J's per-day presentation of composable recorded hours and closure evidence. The pure
 * domain owns date gating and class selection; this view only admits the two presentation classes
 * approved by the design gate. Both raw facts remain complete and equally visible, while a
 * PARTIAL side receives its own prominent review treatment.
 */
function HoursClosureCompositionNotice({
  places,
  dayAssignment,
  startDate,
  dayNumber,
}: {
  places: readonly Place[];
  dayAssignment: DayAssignment;
  startDate: string | null;
  dayNumber: number;
}) {
  const items = buildPresentableDayHoursClosureCompositions(places, dayAssignment, startDate);

  if (items.length === 0) return null;

  return (
    <section
      className="hours-closure-composition"
      aria-label={`Horario e información de cierres registrados · Día ${dayNumber}`}
    >
      {items.map(({ placeId, placeName, signal }) => (
        <div
          key={placeId}
          className={`hours-closure-composition__item hours-closure-composition__item--${signal.compositionClass}`}
        >
          <span className="hours-closure-composition__name">{placeName}</span>
          {signal.compositionClass === "present-with-caveat" && (
            <p className="hours-closure-composition__caveat">
              <span aria-hidden="true">⚠</span> Información con salvedad; conviene revisar el texto registrado
              completo.
            </p>
          )}
          <p
            className={`hours-closure-composition__fact${
              signal.hours.tier === "partial" ? " hours-closure-composition__fact--caveat" : ""
            }`}
          >
            <span>Horario registrado</span>
            {signal.hours.tier === "partial" && <span>Con salvedad; conviene revisar</span>}
            <strong>«{signal.hours.raw}»</strong>
          </p>
          <p
            className={`hours-closure-composition__fact${
              signal.closure.tier === "partial" ? " hours-closure-composition__fact--caveat" : ""
            }`}
          >
            <span>Información registrada de cierres</span>
            {signal.closure.tier === "partial" && <span>Con salvedad; conviene revisar</span>}
            <strong>«{signal.closure.raw}»</strong>
          </p>
        </div>
      ))}
      <p className="hours-closure-composition__disclaimer">
        Esta vista reúne únicamente los dos registros originales para la fecha asignada. Contrasta cualquier
        decisión con la fuente oficial.
      </p>
    </section>
  );
}

/**
 * Phase 3D-L's one user-facing sentence per outcome. Every evaluated phrase names the RECORDED
 * interval, never the place: the wording is `docs/VISIT_TIME_FEASIBILITY_DESIGN.md` §16's permitted
 * vocabulary verbatim. That section's forbidden list is deliberately NOT reproduced here, not even
 * as an example: `OrderedSequenceBuilder.test.ts` scans this file's notice sources for those exact
 * phrases, so a comment quoting any of them would blunt that check for every neighbouring notice as
 * well as this one. Read §16 for the list itself.
 *
 * `visit-date-not-evaluable` and the `hours-not-a-recorded-interval` reason have no sentence
 * because they never reach this view: `buildDayRecordedIntervalFits` omits those places entirely,
 * so no control and no line is rendered for them at all.
 */
function recordedIntervalFitText(fit: RecordedIntervalDurationFit): string {
  switch (fit.kind) {
    case "recorded-duration-fits-interval":
      return "La duración registrada cabe dentro del intervalo horario registrado.";
    case "only-minimum-duration-fits-interval":
      return "Solo la duración mínima registrada cabe dentro del intervalo registrado.";
    case "recorded-duration-exceeds-interval":
      return "La duración registrada excede este intervalo horario registrado.";
    case "start-time-outside-recorded-interval":
      return "La hora que has indicado queda fuera del intervalo horario registrado.";
    case "duration-not-evaluable":
      return "No hay una duración numérica registrada para evaluar.";
    case "no-start-time-chosen":
      return "Introduce una hora de inicio para comparar con el intervalo registrado.";
    default:
      return "No hay información horaria estructurada suficiente para evaluar este intervalo.";
  }
}

/**
 * Phase 3D-L's one UI surface — a manual visit start time per eligible place, and the comparison
 * of the recorded duration against the time remaining inside the RECORDED interval.
 *
 * **What this section is not.** It makes no claim that a place is open, that a visit is possible,
 * that a day works, or that the user should go at the time they typed. `duration fits recorded
 * interval` ≠ `place is visitable`, and every sentence, class name, and accessible label here is
 * chosen to keep those apart. It reads no `bestTime`, no closures, no composition class, and no
 * transfer data, and it never derives an arrival time for the next place — that would be
 * scheduling (design §19).
 *
 * **Which places get a control.** Only those whose hours fact is `recorded-interval` AND which have
 * a valid assigned day under Phase 3D-H/3D-J's strict date contract; `buildDayRecordedIntervalFits`
 * owns both gates. The other places get no control at all — deliberately, not as an oversight: a
 * disabled input on a PARTIAL or OPAQUE place would invite the reading "this place has no hours",
 * which is false for every one of them. `recorded-24h` places are among those excluded, so no
 * 24-hour record is ever turned into a 00:00–24:00 interval here.
 *
 * **No default, ever.** The input starts empty and stays empty until the user types a time. It is
 * never prefilled with `09:00`, the recorded opening time, the current clock, or anything derived
 * from another field. Clearing it returns the place to exactly that state.
 *
 * The original recorded hours text is always shown beside the result, because the parsed token is
 * derivative evidence: 61 of the 65 real records carry editorial qualification ("aprox.",
 * "Tiendas…", "según anuncio") that the token alone would silently drop.
 */
function RecordedIntervalFitSection({
  places,
  dayAssignment,
  startDate,
  dayNumber,
  visitStartTimes,
  onVisitStartTimeChange,
}: {
  places: readonly Place[];
  dayAssignment: DayAssignment;
  startDate: string | null;
  dayNumber: number;
  visitStartTimes: Readonly<Record<string, string>>;
  onVisitStartTimeChange: (placeId: string, time: string | null) => void;
}) {
  const items = buildDayRecordedIntervalFits(places, dayAssignment, startDate, visitStartTimes);

  if (items.length === 0) return null;

  return (
    <section
      className="recorded-interval-fit"
      aria-label={`Hora de inicio e intervalo horario registrado · Día ${dayNumber}`}
    >
      {items.map(({ placeId, placeName, hours, visitStartTime, fit }) => {
        const inputId = `visit-start-time-${dayNumber}-${placeId}`;
        return (
          <div key={placeId} className="recorded-interval-fit__item">
            <label className="recorded-interval-fit__label" htmlFor={inputId}>
              {`Hora de inicio para ${placeName} en Día ${dayNumber}`}
            </label>
            <input
              id={inputId}
              className="recorded-interval-fit__input"
              type="time"
              value={visitStartTime ?? ""}
              onChange={(event) => onVisitStartTimeChange(placeId, event.target.value || null)}
            />
            <p className="recorded-interval-fit__result">{recordedIntervalFitText(fit)}</p>
            <p className="recorded-interval-fit__raw">Dato: «{hours.raw}»</p>
          </div>
        );
      })}
      <p className="recorded-interval-fit__disclaimer">
        Esta comparación solo usa el intervalo horario registrado y la duración registrada del lugar.{" "}
        <strong>
          No indica si el lugar abre, no revisa cierres ni festivos, y no calcula a qué hora llegarías a
          ningún otro lugar.
        </strong>
      </p>
    </section>
  );
}

/**
 * Phase 3D-H's one UI surface. Rendered per day, next to `WeekdayClosureNotice`. Renders nothing
 * when no place in this day bucket has both a valid visit date (design §5's stricter contract,
 * via `deriveVisitDateForPlace`) and an eligible Class A signal (`derivePlaceReservationDateWindow`)
 * — a place with an inapplicable/non-computable lead time, or no visit date yet, is simply absent
 * from this list; the existing "Reservas por preparar" section above already shows its coarse
 * signal, and this component never repeats or replaces that.
 *
 * **Full non-`confirmed` Feb–Mar composition (design §6.2 Rule 2, §12.1 row 3 — corrective audit
 * finding MAJOR-1).** `describeFebMarStatusForUi`'s three-value `tone` is reused as-is — never a
 * second classifier, never category-specific wording — and every non-`confirmed` tone renders its
 * own status callout FIRST, above the derived range, so it always reads before it and is never
 * hidden, replaced, or visually outranked by it:
 *  - `tone === "pending"` (tier `unknown`) → the existing reconfirmation callout: the calendar/
 *    condition for the user's dates is not yet confirmed at all.
 *  - `tone === "attention"` (tiers `partial`/`opaque`) → a neutral caveat callout, using
 *    `describeFebMarStatusForUi(...).label` (e.g. "Requiere atención") rather than inventing
 *    category-specific copy, telling the reader the recorded Feb–Mar status carries a condition
 *    worth reviewing before treating the range as planning guidance.
 *  - `tone === "confirmed"` → no extra callout; the range renders normally.
 * The underlying range is still shown in full in every case — Feb–Mar confidence never suppresses
 * the domain computation (Rule 3), it only changes how the result is composed for the reader.
 *
 * Wording is deliberately conservative throughout — "ventana de anticipación registrada," never a
 * booking deadline or an availability claim; see this file's own forbidden-phrase test coverage.
 * The recorded raw text is always shown alongside, exactly like `ReservationPreparationSection`.
 */
function ReservationDeadlineNotice({
  places,
  dayAssignment,
  startDate,
  referenceDate,
}: {
  places: readonly Place[];
  dayAssignment: DayAssignment;
  startDate: string | null;
  referenceDate: string | null;
}) {
  type DeadlineItem = {
    place: Place;
    window: Extract<ReservationDateWindow, { kind: "derived-window" }>;
    febMarTone: FebMarStatusTone;
    febMarLabel: string;
    relation: ReservationWindowReferenceRelation | null;
  };

  const items: DeadlineItem[] = [];
  for (const place of places) {
    const visitDate = deriveVisitDateForPlace(dayAssignment, startDate, place.id);
    const window = derivePlaceReservationDateWindow(place, visitDate);
    if (window.kind !== "derived-window") continue;
    const febMarDisplay = describeFebMarStatusForUi(interpretPlaceFebMarStatus(place));
    const relation = referenceDate ? evaluateReservationWindowReference(window, referenceDate) : null;
    items.push({
      place,
      window,
      febMarTone: febMarDisplay.tone,
      febMarLabel: febMarDisplay.label,
      relation,
    });
  }

  if (items.length === 0) return null;

  return (
    <section className="reservation-deadline" aria-label="Ventana de anticipación registrada">
      {items.map(({ place, window, febMarTone, febMarLabel, relation }) => (
        <div key={place.id} className="reservation-deadline__item">
          <span className="reservation-deadline__name">{place.name}</span>
          {febMarTone === "pending" && (
            <p className="reservation-deadline__status-callout reservation-deadline__status-callout--pending">
              <span aria-hidden="true">ⓘ</span> Calendario/condición para tus fechas todavía pendiente de
              confirmar. Reconfirma en la fuente oficial al fijar fechas.
            </p>
          )}
          {febMarTone === "attention" && (
            <p className="reservation-deadline__status-callout reservation-deadline__status-callout--attention">
              <span aria-hidden="true">⚠</span> Estado Feb–Mar 2027: {febMarLabel}. El calendario/condición
              registrado para este lugar tiene una salvedad que conviene revisar antes de tomar esta ventana
              como referencia de planificación.
            </p>
          )}
          <span className="reservation-deadline__window">
            Ventana de anticipación registrada: {formatCivilDateDisplay(window.farAdvanceDate)} –{" "}
            {formatCivilDateDisplay(window.nearAdvanceDate)}
          </span>
          {referenceDate && relation && relation.kind !== "not-assessed" && (
            <>
              <span className="reservation-deadline__reference-date">
                {formatDeviceReferenceDateForUi(referenceDate)}
              </span>
              <span className="reservation-deadline__reference-relation">
                {describeReservationWindowReferenceForUi(relation)}
              </span>
            </>
          )}
          <span className="reservation-deadline__raw">Dato: «{window.signal.raw}»</span>
        </div>
      ))}
      <p className="reservation-deadline__disclaimer">
        Esta ventana proyecta la anticipación registrada en el dato original sobre la fecha asignada a
        cada lugar.{" "}
        <strong>
          No confirma disponibilidad ni indica cuándo puedes reservar; reservar antes o después de estas
          fechas también puede ser posible.
        </strong>{" "}
        La fecha de referencia mostrada se captura del calendario local de tu dispositivo al abrir este plan;
        no representa la fecha operativa en Japón y no se actualiza automáticamente mientras esta vista siga abierta.
      </p>
    </section>
  );
}

/** Display-only Spanish labels for `ReservationCategory` — mirrors the tag vocabulary
 * `describeReservationForUi` already established in `lib/reservation.ts`, restated here as a
 * short label (no lead-time suffix, since this section shows lead time in its own line) rather
 * than imported, because this section also needs the two categories that render no tag there
 * (`not-required`, `not-required-role-specific`) to still show a short factual label here. */
const RESERVATION_PREP_LABEL: Record<ReservationCategory, string> = {
  required: "Requiere reserva",
  "recommended-not-required": "Reserva recomendable",
  "optional-not-required": "Reserva opcional",
  "not-required": "No requiere reserva",
  "not-required-role-specific": "No para espectador",
  missing: "Estado de reserva por verificar",
  "unrecognized-value": "Estado de reserva por verificar",
};

/** Display-only Spanish labels for `LeadTimeMagnitude` — the domain type stays a stable,
 * locale-independent identifier (see `lib/reservation-lead-time.ts`); this is the one place that
 * turns it into user-facing text, exactly like `WEEKDAY_LABEL` does for `CivilWeekday` above. */
const LEAD_TIME_MAGNITUDE_LABEL: Record<LeadTimeMagnitude, string> = {
  days: "días",
  weeks: "semanas",
  months: "meses",
  "days-to-weeks": "días o semanas",
  "weeks-to-months": "semanas o meses",
};

/**
 * Phase 3D-D's one UI surface. Renders nothing when `summary.items` is empty — a route with no
 * applicable lead-time signal shows no section at all, exactly like `WeekdayClosureNotice` renders
 * nothing when unassessed.
 *
 * Wording is deliberately narrow and conservative throughout: "anticipación registrada" (a
 * recorded fact about the editorial text), never a booking deadline; "mecanismo específico;
 * revisar" (a call to look closer), never an interpretation of what the mechanism actually
 * requires. The original raw text is always shown alongside — it is the only detailed information
 * Nihon may safely surface for an opaque record, and the authoritative source even for a coarse
 * magnitude. Nothing here reads `startDate`, a derived day date, or the current date.
 */
function ReservationPreparationSection({ summary }: { summary: ReservationPreparationSummary }) {
  if (summary.items.length === 0) return null;

  const parts: string[] = [];
  if (summary.coarseMagnitudeCount > 0) {
    // "anticipación" agrees with "registrada" and both stay singular regardless of N — only the
    // count varies, never the adjective's grammatical number (a prior version wrongly appended an
    // "s" onto the adjective whenever the count was greater than one).
    parts.push(`${summary.coarseMagnitudeCount} con anticipación registrada`);
  }
  if (summary.specificMechanismCount > 0) {
    parts.push(`${summary.specificMechanismCount} con mecanismo específico para revisar`);
  }

  return (
    <section className="reservation-prep" aria-labelledby="reservation-prep-heading">
      <h3 id="reservation-prep-heading">Reservas por preparar</h3>
      <p className="reservation-prep__summary">{parts.join(" · ")}</p>
      <ul className="reservation-prep__list">
        {summary.items.map((item) => (
          <li key={item.placeId} className="reservation-prep__item">
            <span className="reservation-prep__name">{item.placeName}</span>
            <span className="reservation-prep__reservation">{RESERVATION_PREP_LABEL[item.reservation.category]}</span>
            {item.leadTime.kind === "coarse-magnitude" ? (
              <span className="reservation-prep__leadtime">
                Anticipación registrada: {LEAD_TIME_MAGNITUDE_LABEL[item.leadTime.magnitude]}
              </span>
            ) : (
              <span className="reservation-prep__leadtime reservation-prep__leadtime--opaque">
                Mecanismo específico; revisar
              </span>
            )}
            <span className="reservation-prep__raw">Dato: «{item.leadTime.raw}»</span>
          </li>
        ))}
      </ul>
      <p className="reservation-prep__disclaimer">
        Esta sección solo describe la anticipación registrada en el dato original de cada lugar.{" "}
        <strong>No calcula fechas límite de reserva ni las compara con tu calendario.</strong>
      </p>
    </section>
  );
}

/**
 * Phase 3D-E's one UI surface — "Horarios registrados". A route-wide, read-only section built from
 * `../lib/hours-planning.ts` over the current canonical route (`routePlaces`). Renders nothing
 * when `summary.items` is empty, exactly like `ReservationPreparationSection`.
 *
 * Unlike that section, every route place appears here exactly once — nothing is omitted by tier.
 * Wording is deliberately narrow throughout: "Horario registrado: 09:00–17:00" states a recorded
 * fact, never that the place is open at those hours on any date; every PARTIAL/OPAQUE/UNKNOWN
 * phrase ends in "revisar" (a call to double-check), never "closed," "incompatible," or "bad." The
 * original raw text is always shown alongside — the only detailed information Nihon may safely
 * surface once a caveat, external dependency, or genuine unknown is present. Nothing here reads the
 * chosen calendar anchor, any date derived from it, `place.schedule.closures`, `place.bestTime`, or
 * `place.febMar2027`.
 */
function HoursPlanningSection({ summary }: { summary: RecordedHoursSummary }) {
  if (summary.items.length === 0) return null;

  const parts: string[] = [];
  if (summary.safeCount > 0) parts.push(`${summary.safeCount} claro${summary.safeCount === 1 ? "" : "s"}`);
  if (summary.conditionalCount > 0) parts.push(`${summary.conditionalCount} con condiciones`);
  if (summary.externalDependencyCount > 0) {
    // "con dependencia externa" is deliberately neutral over BOTH OPAQUE categories this count
    // combines (weather-or-tide-dependent and third-party-operator-dependent) — "depende de un
    // tercero" was semantically false for a weather/tide-dependent place (there is no third party
    // involved), so this summary phrase must never name a specific dependency kind. The
    // per-item labels below stay category-specific (`HOURS_CATEGORY_LABEL`) precisely because they
    // describe one place's own category, not a combined count spanning both.
    parts.push(`${summary.externalDependencyCount} con dependencia externa`);
  }
  if (summary.unknownCount > 0) parts.push(`${summary.unknownCount} por revisar`);

  return (
    <section className="hours-planning" aria-labelledby="hours-planning-heading">
      <h3 id="hours-planning-heading">Horarios registrados</h3>
      <p className="hours-planning__summary">{parts.join(" · ")}</p>
      <ul className="hours-planning__list">
        {summary.items.map((item) => (
          <li key={item.placeId} className={`hours-planning__item hours-planning__item--${item.hours.tier}`}>
            <span className="hours-planning__name">{item.placeName}</span>
            <span className="hours-planning__signal">{hoursSignalText(item.hours)}</span>
            <span className="hours-planning__raw">Dato: «{item.hours.raw}»</span>
          </li>
        ))}
      </ul>
      <p className="hours-planning__disclaimer">
        Esta sección solo describe qué horario está registrado en el dato original de cada lugar.{" "}
        <strong>
          No determina si el lugar abre o cierra en tu fecha, no revisa festivos ni cierres, y no se compara con la
          hora del día.
        </strong>
      </p>
    </section>
  );
}

/** Display-only Spanish labels for each `HoursCategory`'s recorded-hours signal — the domain type
 * stays a stable, locale-independent identifier (see `lib/recorded-hours.ts`); this is the one
 * place that turns it into user-facing text, exactly like `RESERVATION_PREP_LABEL` and
 * `LEAD_TIME_MAGNITUDE_LABEL` do above. Every phrase describes what the raw editorial text
 * records, never whether the place is open — no "abierto"/"cerrado" wording anywhere here.
 * `"fixed-interval-clean"` is handled specially by `hoursSignalText` below (it needs the actual
 * interval token, not a fixed phrase), so its entry here is unused but kept for exhaustiveness. */
const HOURS_CATEGORY_LABEL: Record<HoursCategory, string> = {
  missing: "Sin horario registrado; revisar",
  "known-24h": "Acceso registrado: 24 h",
  "known-24h-with-caveat": "Acceso 24 h registrado con condiciones; revisar",
  "weather-or-tide-dependent": "Horario depende de clima o marea; revisar",
  "third-party-operator-dependent": "Horario depende de un operador externo; revisar",
  "seasonal-variable": "Horario estacional; revisar",
  "solar-relative": "Horario relativo a la luz solar; revisar",
  "daytime-qualitative": "Horario diurno registrado; revisar",
  "partial-single-bound": "Horario parcialmente registrado; revisar",
  "ambiguous-alternative-interval": "Horario con alternativas registradas; revisar",
  "fixed-interval-with-caveat": "Horario registrado con condiciones; revisar",
  "fixed-interval-clean": "Horario registrado",
  "explicit-unknown-variable": "Horario variable; revisar dato original",
  "qualitative-uncategorized": "Horario no estructurado; revisar",
};

function hoursSignalText(fact: RecordedHoursFact): string {
  if (fact.kind === "recorded-interval") return `Horario registrado: ${fact.intervalRaw}`;
  return HOURS_CATEGORY_LABEL[fact.category];
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

/**
 * Phase 3D-Q — Manual Accommodation Commute Legs: the anchor manager.
 *
 * The user creates an accommodation by typing a label and its coordinate. NOTHING is looked up:
 * there is no geocoding, no address parsing, no hotel search, no booking inventory, no chain or
 * quality semantics, and no map provider call. The coordinate is planning context and geographic
 * identity only — it is never read to produce minutes, distance, a nearest place, or a route.
 *
 * A direct pin-on-the-map picker would need a second interactive map inside this dialog, which is
 * a larger architectural change than this phase is allowed to make, so the coordinate is entered
 * as two plain numeric fields for now (design §3.3 requires a real machine-readable location, not
 * a specific input widget).
 *
 * Two anchors with the same label and/or the same coordinates stay two anchors — the list order
 * means nothing, and nothing here merges, ranks, sorts, or recommends one.
 */
function AccommodationManagerSection({
  accommodations,
  onAdd,
  onRemove,
}: {
  accommodations: readonly AccommodationAnchor[];
  onAdd: (label: string, location: { lat: number; lng: number }) => void;
  onRemove: (accommodationId: string) => void;
}) {
  const [label, setLabel] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");

  const parsedLat = parseCoordinateInput(lat);
  const parsedLng = parseCoordinateInput(lng);
  const location = parsedLat !== null && parsedLng !== null ? { lat: parsedLat, lng: parsedLng } : null;
  const canAdd = label.trim().length > 0 && location !== null && isValidAccommodationLocation(location);

  function add() {
    if (!canAdd || !location) return;
    onAdd(label, location);
    setLabel("");
    setLat("");
    setLng("");
  }

  return (
    <section className="accommodation-manager" aria-label="Alojamientos">
      <h3>Alojamientos</h3>
      <p className="accommodation-manager__intro">
        Tú creas cada alojamiento y escribes sus coordenadas. Nihon no busca hoteles, no interpreta
        direcciones y <strong>no usa estas coordenadas para calcular tiempos ni rutas</strong>.
      </p>

      {accommodations.length === 0 ? (
        <p className="accommodation-manager__empty">Todavía no has creado ningún alojamiento.</p>
      ) : (
        <ul className="accommodation-manager__list">
          {accommodations.map((anchor) => (
            <li key={anchor.id} className="accommodation-manager__item">
              <span className="accommodation-manager__label">{anchor.label}</span>
              <span className="accommodation-manager__coords">
                {anchor.location.lat}, {anchor.location.lng}
              </span>
              <button
                type="button"
                className="icon-button icon-button--small"
                onClick={() => onRemove(anchor.id)}
                aria-label={`Eliminar alojamiento ${anchor.label}`}
              >
                <span aria-hidden="true">×</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="accommodation-manager__form">
        <label className="accommodation-manager__field" htmlFor="accommodation-new-label">
          Nombre del alojamiento
          <input
            id="accommodation-new-label"
            className="accommodation-manager__input"
            type="text"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
          />
        </label>
        <label className="accommodation-manager__field" htmlFor="accommodation-new-lat">
          Latitud
          <input
            id="accommodation-new-lat"
            className="accommodation-manager__input"
            type="number"
            inputMode="decimal"
            step="any"
            value={lat}
            onChange={(event) => setLat(event.target.value)}
          />
        </label>
        <label className="accommodation-manager__field" htmlFor="accommodation-new-lng">
          Longitud
          <input
            id="accommodation-new-lng"
            className="accommodation-manager__input"
            type="number"
            inputMode="decimal"
            step="any"
            value={lng}
            onChange={(event) => setLng(event.target.value)}
          />
        </label>
        <button type="button" className="button button--secondary" onClick={add} disabled={!canAdd}>
          <span aria-hidden="true">＋</span> Añadir alojamiento
        </button>
      </div>
      {!canAdd && (label.trim().length > 0 || lat.trim().length > 0 || lng.trim().length > 0) && (
        <p className="accommodation-manager__hint">
          Escribe un nombre y unas coordenadas dentro de rango (latitud −90 a 90, longitud −180 a
          180).
        </p>
      )}
    </section>
  );
}

/** Reads one coordinate field exactly as typed. A blank field is `null` — never `0`, which
 * `Number("")` would otherwise produce and which is a perfectly valid coordinate. */
function parseCoordinateInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

/** The `<select>` value for one boundary choice. The accommodation id is carried after a fixed
 * prefix and recovered by slicing that prefix, so an id containing the separator is impossible to
 * misread. */
const ACCOMMODATION_OPTION_PREFIX = "accommodation:";

function boundaryChoiceToOptionValue(choice: AccommodationBoundaryChoice): string {
  return choice.kind === "accommodation"
    ? `${ACCOMMODATION_OPTION_PREFIX}${choice.accommodationId}`
    : choice.kind;
}

function optionValueToBoundaryChoice(value: string): AccommodationBoundaryChoice | null {
  if (value === "unselected" || value === "no-accommodation") return { kind: value };
  if (value.startsWith(ACCOMMODATION_OPTION_PREFIX)) {
    const accommodationId = value.slice(ACCOMMODATION_OPTION_PREFIX.length);
    if (accommodationId.length > 0) return { kind: "accommodation", accommodationId };
  }
  return null;
}

/**
 * The exact, neutral sentence for one evaluated boundary side (design §7.3's approved copy).
 *
 * Every state is spelled out and none of them is arithmetic: `boundary-unselected` says the user
 * has not chosen yet, `explicit-no-accommodation` says the accommodation model does not apply on
 * that side, and `manual-leg-missing` says the exact directed duration is unrecorded. NONE of them
 * means "0 min", and none of them is ever presented as a real-world transfer time.
 *
 * A recorded duration is always labelled `dato manual`. It is never described as a route, a
 * real-time result, a timetable, a traffic condition, or a provider's answer, and no ± range is
 * invented around it.
 */
function accommodationBoundaryText(result: AccommodationBoundaryLegResult): string {
  const isStart = result.side === "start";
  switch (result.kind) {
    case "manual-leg":
      return isStart
        ? `Salida desde alojamiento: ${formatMinutes(result.minutes)} · dato manual`
        : `Regreso al alojamiento: ${formatMinutes(result.minutes)} · dato manual`;
    case "manual-leg-missing":
      return isStart ? "Traslado desde alojamiento sin registrar" : "Regreso al alojamiento sin registrar";
    case "not-applicable":
      return isStart
        ? "Salida desde alojamiento: no aplica en este día"
        : "Regreso al alojamiento: no aplica en este día";
    case "boundary-unselected":
      return isStart
        ? "Salida desde alojamiento: sin seleccionar"
        : "Regreso al alojamiento: sin seleccionar";
  }
}

/**
 * One side of one day's accommodation boundary: the explicit choice, and — only when an
 * accommodation is chosen — the EXACT directed endpoint pair and its user-entered duration.
 *
 * The endpoint shown is exactly the one the domain evaluated: this day's current first place for
 * the start side, its current last place for the end side. Editing minutes writes only that exact
 * `(direction, accommodationId, placeId)` key: the reverse direction, another anchor, and another
 * place are all untouched, and a blank field clears that one key rather than storing zero.
 *
 * A value that is not a positive whole number of minutes is rejected outright — never rounded and
 * never coerced — exactly as `withAccommodationLeg` rejects it in the persisted draft.
 */
function AccommodationBoundarySide({
  side,
  dayNumber,
  result,
  choice,
  accommodations,
  placeNameById,
  onChoiceChange,
  onLegChange,
}: {
  side: "start" | "end";
  dayNumber: number;
  result: AccommodationBoundaryLegResult;
  choice: AccommodationBoundaryChoice;
  accommodations: readonly AccommodationAnchor[];
  placeNameById: ReadonlyMap<string, string>;
  onChoiceChange: (choice: AccommodationBoundaryChoice) => void;
  onLegChange: (accommodationId: string, placeId: string, minutes: number | null) => void;
}) {
  const selectId = `accommodation-boundary-${side}-${dayNumber}`;
  const sideLabel = side === "start" ? "Inicio del día" : "Fin del día";
  const anchorLabel =
    choice.kind === "accommodation"
      ? accommodations.find((anchor) => anchor.id === choice.accommodationId)?.label ?? null
      : null;
  const endpoint =
    result.kind === "manual-leg" || result.kind === "manual-leg-missing"
      ? { accommodationId: result.accommodationId, placeId: result.placeId }
      : null;
  const placeName = endpoint ? placeNameById.get(endpoint.placeId) ?? endpoint.placeId : null;
  const minutes = result.kind === "manual-leg" ? result.minutes : null;

  function changeMinutes(raw: string) {
    if (!endpoint) return;
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      onLegChange(endpoint.accommodationId, endpoint.placeId, null);
      return;
    }
    const value = Number(trimmed);
    // Rejected, never repaired: a fraction, a zero, a negative or a non-number simply does not
    // become a stored duration.
    if (!isValidManualAccommodationMinutes(value)) return;
    onLegChange(endpoint.accommodationId, endpoint.placeId, value);
  }

  return (
    <div className="accommodation-boundary__side">
      <label className="accommodation-boundary__label" htmlFor={selectId}>
        {`${sideLabel} · Día ${dayNumber}`}
      </label>
      <select
        id={selectId}
        className="accommodation-boundary__select"
        value={boundaryChoiceToOptionValue(choice)}
        onChange={(event) => {
          const next = optionValueToBoundaryChoice(event.target.value);
          if (next) onChoiceChange(next);
        }}
      >
        <option value="unselected">Sin seleccionar</option>
        <option value="no-accommodation">No aplica</option>
        {accommodations.map((anchor) => (
          <option key={anchor.id} value={`${ACCOMMODATION_OPTION_PREFIX}${anchor.id}`}>
            {anchor.label}
          </option>
        ))}
      </select>

      {endpoint && placeName && (
        <p className="accommodation-boundary__endpoint">
          {side === "start" ? `${anchorLabel ?? ""} → ${placeName}` : `${placeName} → ${anchorLabel ?? ""}`}
        </p>
      )}

      <p className="accommodation-boundary__result">{accommodationBoundaryText(result)}</p>

      {endpoint && (
        <div className="accommodation-boundary__minutes">
          <label
            className="accommodation-boundary__minutes-label"
            htmlFor={`${selectId}-minutes`}
          >
            Minutos de este trayecto (dato manual)
          </label>
          <input
            id={`${selectId}-minutes`}
            className="accommodation-boundary__input"
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            value={minutes ?? ""}
            onChange={(event) => changeMinutes(event.target.value)}
          />
          {minutes !== null && (
            <button
              type="button"
              className="link-button"
              onClick={() => onLegChange(endpoint.accommodationId, endpoint.placeId, null)}
            >
              Quitar minutos
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Phase 3D-Q's one per-day surface, rendered only for a NON-EMPTY day bucket. An empty day has no
 * first or last place, so it has no accommodation boundary to choose and shows no control at all.
 *
 * The two sides are independent: the same day may start at one anchor and end at another, and
 * nothing here infers a leg between them, copies one side onto the other, or reuses yesterday's
 * choice. The composition happens OUTSIDE `OrderedSequenceSummary` — this section reads the
 * existing intra-day summary but never modifies it, and the place-to-place transfer evidence
 * rendered above keeps its own provenance and confidence untouched.
 *
 * The registered subtotal adds only minutes that are actually known: unknown intra-day legs,
 * unselected boundaries, missing manual legs and explicit `no-accommodation` sides contribute
 * NOTHING to it — never zero. It is labelled `completo` only under
 * `DayLogisticsWithAccommodation.completeDoorToDoor` (non-empty day, complete intra-day sequence,
 * and both boundary sides resolved to a recorded manual leg), and even then only as a statement
 * about the registered components — never as a real, optimal, or verified route.
 */
function AccommodationCommuteSection({
  dayNumber,
  dayPlaceIds,
  places,
  intraDay,
  boundary,
  accommodations,
  accommodationLegs,
  onChoiceChange,
  onLegChange,
}: {
  dayNumber: number;
  dayPlaceIds: readonly string[];
  places: readonly Place[];
  intraDay: OrderedSequenceSummary;
  boundary: DayAccommodationBoundary;
  accommodations: readonly AccommodationAnchor[];
  accommodationLegs: readonly ManualAccommodationLeg[];
  onChoiceChange: (side: "start" | "end", choice: AccommodationBoundaryChoice) => void;
  onLegChange: (
    direction: ManualAccommodationLeg["direction"],
    accommodationId: string,
    placeId: string,
    minutes: number | null
  ) => void;
}) {
  const placeNameById = useMemo(
    () => new Map(places.map((place) => [place.id, place.name])),
    [places]
  );
  const logistics = useMemo(
    () => buildDayLogisticsWithAccommodation(dayPlaceIds, intraDay, boundary, accommodationLegs),
    [dayPlaceIds, intraDay, boundary, accommodationLegs]
  );

  if (dayPlaceIds.length === 0) return null;

  const totalText = logistics.registeredTransferMinutes
    ? `Total de traslados registrado: ${formatRange(logistics.registeredTransferMinutes)} · ${
        logistics.completeDoorToDoor
          ? "completo según los componentes registrados"
          : "incompleto"
      }`
    : "Total de traslados registrado: sin datos · incompleto";

  return (
    <section
      className="accommodation-boundary"
      aria-label={`Alojamiento y traslados manuales · Día ${dayNumber}`}
    >
      <h4 className="accommodation-boundary__heading">Alojamiento en este día</h4>
      {accommodations.length === 0 && (
        <p className="accommodation-boundary__hint">
          Crea un alojamiento arriba para poder elegirlo en este día.
        </p>
      )}

      <AccommodationBoundarySide
        side="start"
        dayNumber={dayNumber}
        result={logistics.outbound}
        choice={boundary.start}
        accommodations={accommodations}
        placeNameById={placeNameById}
        onChoiceChange={(choice) => onChoiceChange("start", choice)}
        onLegChange={(accommodationId, placeId, minutes) =>
          onLegChange("accommodation-to-place", accommodationId, placeId, minutes)
        }
      />
      <AccommodationBoundarySide
        side="end"
        dayNumber={dayNumber}
        result={logistics.returnLeg}
        choice={boundary.end}
        accommodations={accommodations}
        placeNameById={placeNameById}
        onChoiceChange={(choice) => onChoiceChange("end", choice)}
        onLegChange={(accommodationId, placeId, minutes) =>
          onLegChange("place-to-accommodation", accommodationId, placeId, minutes)
        }
      />

      <p className="accommodation-boundary__total">{totalText}</p>
      <p className="accommodation-boundary__disclaimer">
        Los minutos de alojamiento son un <strong>dato manual</strong> que tú introduces para ese
        trayecto exacto y en ese sentido exacto. Nihon no los calcula, no consulta transporte, no
        deduce el trayecto contrario y no rellena con cero lo que falta.
      </p>
    </section>
  );
}

const INTER_HUB_MODE_LABELS: Record<InterHubMode, string> = {
  shinkansen: "Shinkansen",
  "limited-express": "Limited Express / tren expreso",
  "domestic-flight": "Vuelo doméstico",
  ferry: "Ferry",
  "highway-bus": "Autobús interurbano",
  other: "Otro",
};

function interHubPairKey(pair: Pick<ManualInterHubSegment, "fromPlaceId" | "toPlaceId">): string {
  return JSON.stringify([pair.fromPlaceId, pair.toPlaceId]);
}

function interHubPlacementText(assessment: Extract<InterHubSegmentAssessment, { kind: "active" }>): string {
  switch (assessment.placement) {
    case "route-only":
      return "en el recorrido actual";
    case "same-day":
      return `dentro del Día ${(assessment.fromDayOrdinal ?? 0) + 1}`;
    case "between-consecutive-days":
      return `entre Día ${(assessment.fromDayOrdinal ?? 0) + 1} y Día ${(assessment.toDayOrdinal ?? 0) + 1}`;
  }
}

function interHubInactiveText(reason: Extract<InterHubSegmentAssessment, { kind: "inactive" }>["reason"]): string {
  switch (reason) {
    case "missing-from-place":
    case "missing-to-place":
      return "Uno de los puntos ya no forma parte del recorrido actual.";
    case "from-hub-mismatch":
    case "to-hub-mismatch":
      return "El hub actual de uno de los puntos ya no coincide con el registrado.";
    case "same-current-hub":
      return "Los dos puntos pertenecen actualmente al mismo hub.";
    case "not-consecutive-in-route":
      return "Estos lugares ya no son consecutivos en el recorrido actual.";
    case "not-consecutive-in-day":
      return "Estos lugares ya no son consecutivos dentro del mismo día.";
    case "not-boundary-of-consecutive-days":
      return "Estos lugares ya no forman un límite entre dos días consecutivos.";
    case "invalid-day-partition":
      return "El reparto por días no es estructuralmente válido; el tramo no se aplica.";
  }
}

/**
 * Phase 3D-Y's single manual inter-hub surface. Eligible anchor pairs are derived only from the
 * current explicit route/day order. Hub snapshots are copied directly from those resolved places;
 * mode and minutes remain blank until the user supplies them. Stored inactive segments stay visible
 * and neutral, and their minutes are never merged into any existing subtotal.
 */
function InterHubSegmentsSection({
  routeIds,
  days,
  placeById,
  segments,
  onAdd,
  onUpdate,
  onRemove,
}: {
  routeIds: readonly string[];
  days: readonly (readonly string[])[] | null;
  placeById: ReadonlyMap<string, Place>;
  segments: readonly ManualInterHubSegment[];
  onAdd: (input: NewManualInterHubSegment) => void;
  onUpdate: (segmentId: string, mode: InterHubMode, minutes: number) => void;
  onRemove: (segmentId: string) => void;
}) {
  const [selectedPairKey, setSelectedPairKey] = useState("");
  const [mode, setMode] = useState<InterHubMode | "">("");
  const [minutes, setMinutes] = useState("");
  const resolvePlace = (placeId: string) => {
    const place = placeById.get(placeId);
    return place ? { hub: place.hub } : null;
  };
  const eligiblePairs = deriveEligibleInterHubPairs({ routeIds, days, resolvePlace });
  const storedPairKeys = new Set(segments.map(interHubPairKey));
  const availablePairs = eligiblePairs.filter((pair) => !storedPairKeys.has(interHubPairKey(pair)));
  const selectedPair = availablePairs.find((pair) => interHubPairKey(pair) === selectedPairKey) ?? null;
  const parsedMinutes = Number(minutes);
  const canAdd = selectedPair !== null && mode !== "" && isValidInterHubMinutes(parsedMinutes);

  function pairLabel(pair: EligibleInterHubPair): string {
    const fromName = placeById.get(pair.fromPlaceId)?.name ?? pair.fromPlaceId;
    const toName = placeById.get(pair.toPlaceId)?.name ?? pair.toPlaceId;
    return `${fromName} → ${toName} · ${pair.fromHub} → ${pair.toHub}`;
  }

  function add() {
    if (!selectedPair || mode === "" || !isValidInterHubMinutes(parsedMinutes)) return;
    onAdd({
      fromPlaceId: selectedPair.fromPlaceId,
      toPlaceId: selectedPair.toPlaceId,
      fromHub: selectedPair.fromHub,
      toHub: selectedPair.toHub,
      mode,
      minutes: parsedMinutes,
    });
    setSelectedPairKey("");
    setMode("");
    setMinutes("");
  }

  return (
    <section className="inter-hub-segments" aria-label="Traslados entre ciudades">
      <h3>Traslados entre ciudades</h3>
      <p className="inter-hub-segments__intro">
        Tramo principal entre estos dos puntos de tu plan; <strong>no es un tiempo puerta a puerta</strong>.
        Los hubs vienen de los lugares elegidos; tú seleccionas el modo y escribes los minutos.
      </p>

      {segments.length === 0 ? (
        <p className="inter-hub-segments__empty">Todavía no has registrado ningún tramo entre ciudades.</p>
      ) : (
        <ul className="inter-hub-segments__list">
          {segments.map((segment) => {
            const assessment = assessInterHubSegment(segment, { routeIds, days, resolvePlace });
            const fromName = placeById.get(segment.fromPlaceId)?.name ?? segment.fromPlaceId;
            const toName = placeById.get(segment.toPlaceId)?.name ?? segment.toPlaceId;
            return (
              <li key={segment.id} className="inter-hub-segments__item">
                <div className="inter-hub-segments__item-header">
                  <div>
                    <strong>{fromName} → {toName}</strong>
                    <p className="inter-hub-segments__hubs">{segment.fromHub} → {segment.toHub}</p>
                  </div>
                  <button
                    type="button"
                    className="icon-button icon-button--small"
                    onClick={() => onRemove(segment.id)}
                    aria-label={`Eliminar tramo ${fromName} a ${toName}`}
                  >
                    <span aria-hidden="true">×</span>
                  </button>
                </div>
                <p className="inter-hub-segments__status">
                  {assessment.kind === "active"
                    ? `Activo · ${interHubPlacementText(assessment)}`
                    : `Inactivo · ${interHubInactiveText(assessment.reason)}`}
                </p>
                <div className="inter-hub-segments__edit">
                  <label>
                    Modo
                    <select
                      value={segment.mode}
                      onChange={(event) => {
                        if (isInterHubMode(event.target.value)) {
                          onUpdate(segment.id, event.target.value, segment.minutes);
                        }
                      }}
                    >
                      {INTER_HUB_MODES.map((value) => (
                        <option key={value} value={value}>{INTER_HUB_MODE_LABELS[value]}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Duración manual del tramo principal
                    <input
                      type="number"
                      min={1}
                      step={1}
                      inputMode="numeric"
                      defaultValue={segment.minutes}
                      onBlur={(event) => {
                        const value = Number(event.currentTarget.value);
                        if (isValidInterHubMinutes(value)) onUpdate(segment.id, segment.mode, value);
                        else event.currentTarget.value = String(segment.minutes);
                      }}
                    />
                  </label>
                </div>
                <p className="inter-hub-segments__minutes">{segment.minutes} min registrados manualmente</p>
              </li>
            );
          })}
        </ul>
      )}

      <div className="inter-hub-segments__form">
        <label>
          Posición en el plan
          <select value={selectedPairKey} onChange={(event) => setSelectedPairKey(event.target.value)}>
            <option value="">Selecciona dos puntos consecutivos de hubs distintos</option>
            {availablePairs.map((pair) => (
              <option key={interHubPairKey(pair)} value={interHubPairKey(pair)}>{pairLabel(pair)}</option>
            ))}
          </select>
        </label>
        <label>
          Modo
          <select
            value={mode}
            onChange={(event) => setMode(isInterHubMode(event.target.value) ? event.target.value : "")}
          >
            <option value="">Selecciona modo</option>
            {INTER_HUB_MODES.map((value) => (
              <option key={value} value={value}>{INTER_HUB_MODE_LABELS[value]}</option>
            ))}
          </select>
        </label>
        <label>
          Duración manual del tramo principal
          <input
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            value={minutes}
            onChange={(event) => setMinutes(event.target.value)}
          />
        </label>
        <button type="button" className="button button--secondary" disabled={!canAdd} onClick={add}>
          <span aria-hidden="true">＋</span> Añadir tramo
        </button>
      </div>
      {availablePairs.length === 0 && (
        <p className="inter-hub-segments__hint">
          No hay una pareja consecutiva nueva entre hubs distintos en el reparto actual.
        </p>
      )}
    </section>
  );
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Phase 3D-W — Trip Bounds Runtime: the neutral summary of the trip's civil range, rendered inside
 * the EXISTING `.calendar-anchor` block. No modal, no wizard, no new page, panel or product surface.
 *
 * It renders up to three DISTINCT facts and never conflates them (design §9.1):
 *
 *   A. the civil range the user chose, with its inclusive calendar-day count;
 *   B. how many day buckets currently exist;
 *   C. when both are known and they disagree, how many buckets fall after the end date.
 *
 * Every one of them is a statement about what the user chose or what exists. Nihon does not have an
 * opinion here: the "fewer buckets than calendar days" and "exactly as many" cases are deliberately
 * worded IDENTICALLY, so neither is endorsed as correct, and the mismatch line is a count and
 * nothing more. Forbidden in any form (design §9.2): a duration recommendation, a suggestion to add
 * or remove a day, a claim that days are missing or left over, a night count, and any check-in /
 * check-out / flight / airport / arrival-time language.
 *
 * The inverted-range notice is a `role="status"` element of its own, deliberately separate from the
 * builder's existing invalid-partition `role="alert"` banner: they are unrelated signals and §9.3
 * requires that they never be merged. Nothing here repairs anything — both dates stay exactly as the
 * user entered them.
 */
function TripBoundsNotice({ summary }: { summary: TripBoundsSummary }) {
  const { startDate, endDate, tripCalendarDays, dayCount, unavailableReason, daysAfterTripEnd } = summary;

  return (
    <div className="trip-bounds-notice">
      {tripCalendarDays !== null && startDate !== null && endDate !== null && (
        <p className="trip-bounds-notice__range">
          {`Rango elegido: ${formatCivilDateDisplay(startDate)} – ${formatCivilDateDisplay(endDate)} (${tripCalendarDays} días de calendario).`}
        </p>
      )}

      {unavailableReason === "no-end-date" && startDate !== null && (
        <p className="trip-bounds-notice__partial">
          Has fijado la fecha de inicio. Añade la fecha de fin si quieres registrar el rango completo.
        </p>
      )}

      {unavailableReason === "no-start-date" && endDate !== null && (
        <p className="trip-bounds-notice__partial">
          Has fijado la fecha de fin. Nihon necesita también la fecha de inicio para situar los días.
        </p>
      )}

      {unavailableReason === "inverted-range" && (
        <p className="trip-bounds-notice__inverted" role="status">
          <span aria-hidden="true">⚠</span> La fecha de fin es anterior a la de inicio. Nihon no
          modifica ninguna de las dos ni tus días; revisa las fechas.
        </p>
      )}

      {dayCount !== null && <p className="trip-bounds-notice__buckets">{`Días creados: ${dayCount}.`}</p>}

      {dayCount !== null && unavailableReason === "no-end-date" && (
        <p className="trip-bounds-notice__partial">No has registrado una fecha de fin.</p>
      )}

      {daysAfterTripEnd !== null && daysAfterTripEnd > 0 && (
        <p className="trip-bounds-notice__mismatch">
          {`Hay ${daysAfterTripEnd} día(s) posteriores a la fecha de fin.`}
        </p>
      )}
    </div>
  );
}

/**
 * Phase 3D-W: the ONE thing a day card gains when its ordinal falls past the end of the trip.
 *
 * The card keeps everything it already had — its `Día N` heading, its derived civil date, its
 * places, its transfers, its weekday/closure and recorded-hours signals, its reservation signals,
 * its accommodation controls, its move buttons and its delete button. It is never hidden, disabled,
 * greyed into uselessness, collapsed, reordered, relocated or auto-deleted, and no place inside it
 * is moved anywhere (design §9.3, §11).
 *
 * That is the whole frontier this phase draws: **derivation is unconditional, presentation is
 * conditional.** Every existing pure evaluator still computes exactly what it computed before for
 * this day's date — the arithmetic date is real and correct, and a weekday does not stop being a
 * fact about a date because the user is not travelling that day. The only thing that was ever false
 * is the implicit claim that this is a day OF the trip, and that is corrected by saying so, not by
 * withholding data the user could otherwise see.
 */
function TripBoundsDayWarning({ assessment }: { assessment: TripBoundsAssessment }) {
  if (assessment.kind !== "after-trip-end") return null;
  return (
    <p className="day-card__bounds-warning" role="status">
      <span aria-hidden="true">⚠</span> Este día es posterior a la fecha de fin de tu viaje.
    </p>
  );
}

/** The existing Phase 3C-B evidence vocabulary, reused verbatim so one order is never described
 * in a different language than another. Returns "" when there is nothing to disclose. */
function confidenceMixText(counts: ConfidenceCounts): string {
  const parts: string[] = [];
  if (counts.validatedStatic > 0) {
    parts.push(`${counts.validatedStatic} validado${counts.validatedStatic === 1 ? "" : "s"}`);
  }
  if (counts.estimated > 0) parts.push(`${counts.estimated} estimado${counts.estimated === 1 ? "" : "s"}`);
  if (counts.scheduleAware > 0) parts.push(`${counts.scheduleAware} en vivo`);
  return parts.join(" · ");
}

/**
 * Phase 3E-C — the generated local alternatives for ONE day card.
 *
 * This is the first place in Nihon that shows the user an order they did not type. Everything
 * about how it is worded is load-bearing (`docs/EVIDENCE_COMPLETE_LOCAL_SWAP_DESIGN.md` §24):
 *
 *   - the claim is about **recorded local transfers inside one same-hub block**, never about the
 *     day, the trip, the schedule, the hotel, or the real world;
 *   - `guaranteedAdvantageMinutes` is presented as the *minimum gap between two recorded ranges*,
 *     never as "ahorras X minutos" — the inputs may be estimated, and the word "garantizada"
 *     alone would overstate that;
 *   - both orders' evidence quality is shown side by side, so a comparison resting on estimated
 *     edges is never silently dressed up as validated;
 *   - the alternatives are listed in positional order with no "mejor"/"recomendado"/rank marker,
 *     and nothing is applied until the user clicks.
 *
 * The empty state is deliberately absent rather than reassuring: "no proved swap" is a statement
 * about the recorded evidence, not a verdict that the current order is optimal, so the neutral
 * sentence below is the strongest thing that may be said (§13).
 */
function LocalSwapAlternativesSection({
  dayNumber,
  alternatives,
  relocationAlternatives,
  placeById,
  onApply,
  onApplyRelocation,
}: {
  dayNumber: number;
  alternatives: EvidenceCompleteLocalSwapAlternative[];
  relocationAlternatives: EvidenceCompleteLocalRelocationAlternative[];
  placeById: Map<string, Place>;
  onApply: (alternative: EvidenceCompleteLocalSwapAlternative) => void;
  onApplyRelocation: (alternative: EvidenceCompleteLocalRelocationAlternative) => void;
}) {
  const headingId = `local-swap-heading-${dayNumber}`;
  const nameOf = (placeId: string) => placeById.get(placeId)?.name ?? placeId;
  const hasAlternatives = alternatives.length > 0 || relocationAlternatives.length > 0;

  return (
    <section className="local-swap" aria-labelledby={headingId}>
      <h4 id={headingId} className="local-swap__heading">
        Alternativas locales con evidencia completa
      </h4>
      {!hasAlternatives ? (
        <p className="local-swap__empty">
          No hay una alternativa local con mejora demostrable usando todos los traslados registrados
          necesarios para esta comparación.
        </p>
      ) : (
        <>
          {alternatives.length > 0 && (
            <div className="local-swap__group">
              <h5>Intercambios adyacentes</h5>
              <ul className="local-swap__list">
                {alternatives.map((alternative) => {
                  const baselineMix = confidenceMixText(alternative.baselineConfidenceCounts);
                  const candidateMix = confidenceMixText(alternative.candidateConfidenceCounts);
                  return (
                    <li
                      key={`${alternative.dayId}:${alternative.leftDayIndex}`}
                      className="local-swap__item"
                    >
                      <p className="local-swap__pair">
                        Intercambiar <strong>{nameOf(alternative.leftPlaceId)}</strong> y{" "}
                        <strong>{nameOf(alternative.rightPlaceId)}</strong> dentro del bloque de{" "}
                        {alternative.hub}, entre {nameOf(alternative.blockStartPlaceId)} y{" "}
                        {nameOf(alternative.blockEndPlaceId)}.
                      </p>
                      <dl className="local-swap__ranges">
                        <div>
                          <dt>Traslados registrados del bloque actual</dt>
                          <dd>
                            {formatRange(alternative.baselineTransferMinutes)}
                            {baselineMix && <span className="local-swap__evidence"> · {baselineMix}</span>}
                          </dd>
                        </div>
                        <div>
                          <dt>Traslados registrados de esta alternativa</dt>
                          <dd>
                            {formatRange(alternative.candidateTransferMinutes)}
                            {candidateMix && <span className="local-swap__evidence"> · {candidateMix}</span>}
                          </dd>
                        </div>
                      </dl>
                      <p className="local-swap__advantage">
                        Ventaja mínima entre los rangos registrados:{" "}
                        {formatMinutes(alternative.guaranteedAdvantageMinutes)}. El rango registrado de
                        esta alternativa queda al menos esa diferencia por debajo del rango registrado
                        actual.
                      </p>
                      <p className="local-swap__disclaimer">
                        Esta comparación usa únicamente los traslados locales registrados de este bloque.
                        No evalúa horarios, reservas, alojamiento, puerta a puerta ni el viaje completo.
                      </p>
                      <button
                        type="button"
                        className="button button--secondary local-swap__apply"
                        onClick={() => onApply(alternative)}
                      >
                        Aplicar este intercambio
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {relocationAlternatives.length > 0 && (
            <div className="local-swap__group local-relocation">
              <h5>Reubicaciones de un lugar</h5>
              <ul className="local-swap__list">
                {relocationAlternatives.map((alternative) => {
                  const baselineMix = confidenceMixText(alternative.baselineConfidenceCounts);
                  const candidateMix = confidenceMixText(alternative.candidateConfidenceCounts);
                  const destinationPlaceId =
                    alternative.candidateDayPlaceIds[alternative.toDayIndex + 1] ??
                    alternative.blockEndPlaceId;
                  return (
                    <li
                      key={`${alternative.dayId}:${alternative.fromDayIndex}:${alternative.toDayIndex}`}
                      className="local-swap__item local-relocation__item"
                    >
                      <p className="local-swap__pair local-relocation__move">
                        Mover <strong>{nameOf(alternative.movedPlaceId)}</strong> antes de{" "}
                        <strong>{nameOf(destinationPlaceId)}</strong> dentro del bloque de{" "}
                        {alternative.hub}.
                      </p>
                      <dl className="local-swap__ranges">
                        <div>
                          <dt>Traslados registrados del bloque actual</dt>
                          <dd>
                            {formatRange(alternative.baselineTransferMinutes)}
                            {baselineMix && <span className="local-swap__evidence"> · {baselineMix}</span>}
                          </dd>
                        </div>
                        <div>
                          <dt>Traslados registrados de esta reubicación</dt>
                          <dd>
                            {formatRange(alternative.candidateTransferMinutes)}
                            {candidateMix && <span className="local-swap__evidence"> · {candidateMix}</span>}
                          </dd>
                        </div>
                      </dl>
                      <p className="local-swap__advantage">
                        Esta reubicación reduce el rango de traslado local registrado de este bloque
                        según la evidencia disponible. Ventaja mínima entre los rangos registrados:{" "}
                        {formatMinutes(alternative.guaranteedAdvantageMinutes)}.
                      </p>
                      <p className="local-swap__disclaimer">
                        Esta comparación usa únicamente los traslados locales registrados de este bloque.
                        No evalúa horarios, reservas, alojamiento, puerta a puerta ni el viaje completo.
                      </p>
                      <button
                        type="button"
                        className="button button--secondary local-swap__apply"
                        onClick={() => onApplyRelocation(alternative)}
                      >
                        Aplicar esta reubicación
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function wholeTripUnavailableText(reason: Extract<WholeTripComposition, { kind: "unavailable" }>["reason"]): string {
  switch (reason) {
    case "no-day-assignment":
      return "Crea un reparto por días para describir el plan completo sin borrar sus límites.";
    case "invalid-day-partition":
      return "El reparto por días no coincide exactamente con el recorrido; no se muestran cálculos parciales.";
    case "unresolved-route-place":
      return "Un lugar del recorrido no se puede resolver; no se muestran cálculos parciales.";
  }
}

function wholeTripBoundsText(bounds: WholeTripBoundsComposition): string {
  if (bounds.tripCalendarDays !== null && bounds.startDate !== null && bounds.endDate !== null) {
    return `${formatCivilDateDisplay(bounds.startDate)} – ${formatCivilDateDisplay(bounds.endDate)} · ${bounds.tripCalendarDays} días de calendario.`;
  }
  switch (bounds.unavailableReason) {
    case "no-start-date":
      return "Sin fecha de inicio registrada.";
    case "no-end-date":
      return "Sin fecha de fin registrada.";
    case "invalid-date":
      return "El rango contiene una fecha no válida.";
    case "inverted-range":
      return "La fecha de fin es anterior a la fecha de inicio; ambos valores permanecen sin reparar.";
    case null:
      return "Sin rango civil cuantificable.";
  }
}

/** Read-only Phase 3E-A projection. No value rendered here is written back to the V7 draft. */
function WholeTripCompositionSection({ composition }: { composition: WholeTripComposition }) {
  if (composition.kind === "unavailable") {
    return (
      <section className="whole-trip-composition" aria-label="Resumen del plan completo">
        <h3>Resumen del plan completo</h3>
        <p className="whole-trip-composition__unavailable">{wholeTripUnavailableText(composition.reason)}</p>
      </section>
    );
  }

  const totalPlaceCount = composition.visit.quantifiedPlaceCount + composition.visit.nonQuantifiedPlaceCount;
  const missingMovementCount =
    composition.movement.localMissingCount + composition.movement.interHubMissingCount;
  const registeredTransportIsPartial =
    missingMovementCount > 0 ||
    composition.accommodation.manualLegMissingCount > 0 ||
    composition.accommodation.boundaryUnselectedCount > 0;

  return (
    <section className="whole-trip-composition" aria-label="Resumen del plan completo">
      <h3>Resumen del plan completo</h3>
      <p className="whole-trip-composition__intro">
        Describe únicamente los datos registrados para este reparto; no puntúa ni recomienda cambios.
      </p>

      <div className="whole-trip-composition__group">
        <h4>Visitas</h4>
        <p>
          Tiempo de visita cuantificado: {composition.visit.quantifiedMinutes
            ? formatRange(composition.visit.quantifiedMinutes)
            : "sin duración numérica registrada"}.
        </p>
        <p>{composition.visit.quantifiedPlaceCount} de {totalPlaceCount} lugares con duración numérica.</p>
        <p>
          No cuantificados: {composition.visit.nonQuantifiedPlaceCount}; compromisos de escala día: {composition.visit.dayScaleCommitmentCount}; sin clasificación: {composition.visit.unclassifiedPlaceCount}.
        </p>
        {!composition.visit.completeNumericCoverage && (
          <p className="whole-trip-composition__incomplete">La cobertura numérica de visitas está incompleta.</p>
        )}
      </div>

      <div className="whole-trip-composition__group">
        <h4>Traslados registrados</h4>
        <p>
          Traslado registrado: {composition.registeredTransportMinutes
            ? formatRange(composition.registeredTransportMinutes)
            : "sin componentes registrados"}. Incluye solo componentes registrados: movimiento entre
          lugares y minutos manuales de alojamiento. Los desgloses siguientes ya forman parte de esa cifra.
        </p>
        {registeredTransportIsPartial && (
          <p className="whole-trip-composition__incomplete">
            Esta cifra es parcial: hay componentes locales, entre ciudades o de alojamiento sin registrar.
          </p>
        )}
        <p>
          Locales con tiempo: {composition.movement.localKnownCount}; locales faltantes: {composition.movement.localMissingCount}.
        </p>
        <p>
          Entre ciudades activos: {composition.movement.interHubActiveCount}; faltantes: {composition.movement.interHubMissingCount}.
        </p>
        <p>Posiciones de movimiento modeladas: {composition.movement.modeledAdjacencyCount}.</p>
        {missingMovementCount > 0 ? (
          <p className="whole-trip-composition__incomplete">
            Cobertura incompleta: faltan {composition.movement.localMissingCount} tramo(s) local(es) y {composition.movement.interHubMissingCount} tramo(s) entre ciudades.
          </p>
        ) : composition.movement.adjacencyCoverageComplete && composition.movement.modeledAdjacencyCount > 0 ? (
          <p>Todos los tramos entre lugares que este resumen modela tienen tiempo registrado.</p>
        ) : (
          <p>No hay posiciones de movimiento entre lugares modeladas en este reparto.</p>
        )}
      </div>

      <div className="whole-trip-composition__group">
        <h4>Alojamiento</h4>
        <p>
          Minutos manuales registrados: {composition.accommodation.registeredMinutes === null
            ? "ninguno"
            : formatMinutes(composition.accommodation.registeredMinutes)}.
        </p>
        <p>
          Tramos manuales: {composition.accommodation.manualLegCount}; faltantes: {composition.accommodation.manualLegMissingCount}; sin seleccionar: {composition.accommodation.boundaryUnselectedCount}.
        </p>
        <p>
          Sin alojamiento explícito: {composition.accommodation.explicitNoAccommodationCount}; límites de días vacíos no aplicables: {composition.accommodation.emptyDayNotApplicableCount}.
        </p>
      </div>

      <div className="whole-trip-composition__group">
        <h4>Rango del viaje</h4>
        <p>{wholeTripBoundsText(composition.bounds)}</p>
        <p>Días creados: {composition.bounds.dayCount}.</p>
        {composition.bounds.daysAfterTripEnd !== null && composition.bounds.daysAfterTripEnd > 0 && (
          <p className="whole-trip-composition__incomplete">
            Días posteriores a la fecha de fin: {composition.bounds.daysAfterTripEnd}. Siguen incluidos en las visitas y traslados registrados de este resumen.
          </p>
        )}
      </div>
    </section>
  );
}

export function OrderedSequenceBuilder({ savedPlaces, onClose }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [reservationReferenceDate] = useState<string | null>(() => captureDeviceLocalCivilDate());

  const placeById = useMemo(() => new Map(savedPlaces.map((place) => [place.id, place])), [savedPlaces]);
  const savedIds = useMemo(() => savedPlaces.map((place) => place.id), [savedPlaces]);

  // The persisted manual plan (Phase 3C-D) — the single source of truth for the route and the
  // canonical day assignment. `days` is `null` exactly when no valid day split exists yet.
  const {
    routeIds,
    planningDays,
    days,
    startDate,
    endDate,
    visitStartTimes,
    accommodations,
    accommodationLegs,
    interHubSegments,
    setRoute: setRouteIds,
    initializeDays,
    movePlaceWithinDay,
    relocatePlaceWithinDay,
    movePlaceBetweenDays,
    addEmptyDay,
    removeEmptyDay,
    moveDay,
    setStartDate,
    setEndDate,
    setVisitStartTime,
    addAccommodation,
    removeAccommodation,
    setDayAccommodationChoice,
    setAccommodationLeg,
    addInterHubSegment,
    updateInterHubSegment,
    removeInterHubSegment,
    resetRoute,
  } = usePlanningDraft(savedIds);
  // Phase 3D-S: `dayIds` stays the ordinal `string[][]` projection every domain module below is
  // given — `buildDayAssignment`, the calendar, weekday signals, reservation evaluation, hours
  // composition and intra-day transfers all still see only this. `dayEntities` is the parallel
  // identity view, used solely to address a mutation at the day the user is looking at and to read
  // that same day's own accommodation boundary; no day id is ever passed into a domain module.
  const dayIds = useMemo(() => days ?? [], [days]);
  const dayEntities = useMemo(() => planningDays ?? [], [planningDays]);

  // "builder" is the normal single-route view; "compare" is Phase 3C-B; "days" is Phase 3C-C.
  // Only one is ever rendered — there is exactly one dialog, never a dialog over a dialog.
  const [view, setView] = useState<"builder" | "compare" | "days">("builder");
  // Phase 3C-B's candidates are intentionally NOT part of the persisted draft — see the module
  // doc above. They stay plain, ephemeral component state.
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
  const reservationPreparation = useMemo(
    () => buildReservationPreparationSummary(routePlaces),
    [routePlaces]
  );
  const recordedHours = useMemo(() => buildRecordedHoursSummary(routePlaces), [routePlaces]);

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

  const dayPlaceLists = useMemo(
    () =>
      dayIds.map((ids) => ids.map((id) => placeById.get(id)).filter((place): place is Place => Boolean(place))),
    [dayIds, placeById]
  );
  const dayAssignment = useMemo(() => buildDayAssignment(routeIds, dayIds), [routeIds, dayIds]);

  // Phase 3D-W: the three neutral facts about the trip's civil range, derived on read and never
  // persisted. The bucket count comes from `days` — `null` when no day assignment exists at all, so
  // "0 días creados" is never invented for a draft that was simply never split. Nothing here feeds
  // back into the draft: the range and the buckets stay two independent user decisions, and a
  // disagreement between them is a fact to be shown, not a defect to be corrected.
  const tripBoundsSummary = useMemo(
    () => buildTripBoundsSummary({ startDate, endDate }, days === null ? null : days.length),
    [startDate, endDate, days]
  );
  const wholeTripComposition = useMemo(
    () =>
      buildWholeTripComposition(
        {
          routeIds,
          days: planningDays,
          interHubSegments,
          accommodationLegs,
          bounds: { startDate, endDate },
        },
        { resolvePlace: (placeId) => placeById.get(placeId) ?? null }
      ),
    [routeIds, planningDays, interHubSegments, accommodationLegs, startDate, endDate, placeById]
  );

  /**
   * Phase 3E-C: the generated local alternatives, derived fresh on every render from the current
   * draft exactly like every other value in this component — never persisted, never cached across
   * an edit, never carried over an Apply. Recomputing from `planningDays`/`visitStartTimes` is what
   * makes "after Apply, fresh alternatives from the new baseline" (design §26) automatic rather
   * than something a hand-written invalidation has to remember.
   */
  const localSwapGeneration = useMemo(
    () =>
      generateEvidenceCompleteLocalSwaps(
        { routeIds, days: planningDays, visitStartTimes },
        { resolvePlace: (placeId) => placeById.get(placeId) ?? null }
      ),
    [routeIds, planningDays, visitStartTimes, placeById]
  );
  /** Positional emission order is preserved inside each day; grouping never re-sorts or ranks. */
  const localSwapsByDayId = useMemo(() => {
    const byDayId = new Map<string, EvidenceCompleteLocalSwapAlternative[]>();
    if (localSwapGeneration.kind !== "available") return byDayId;
    for (const alternative of localSwapGeneration.alternatives) {
      const existing = byDayId.get(alternative.dayId);
      if (existing) existing.push(alternative);
      else byDayId.set(alternative.dayId, [alternative]);
    }
    return byDayId;
  }, [localSwapGeneration]);

  /** Phase 3E-E relocations are independently baseline-derived, then grouped without ranking. */
  const localRelocationGeneration = useMemo(
    () =>
      generateEvidenceCompleteLocalRelocations(
        { routeIds, days: planningDays, visitStartTimes },
        { resolvePlace: (placeId) => placeById.get(placeId) ?? null }
      ),
    [routeIds, planningDays, visitStartTimes, placeById]
  );
  const localRelocationsByDayId = useMemo(() => {
    const byDayId = new Map<string, EvidenceCompleteLocalRelocationAlternative[]>();
    if (localRelocationGeneration.kind !== "available") return byDayId;
    for (const alternative of localRelocationGeneration.alternatives) {
      const swapOrders = localSwapsByDayId.get(alternative.dayId) ?? [];
      const duplicatesSwap = swapOrders.some(
        (swap) =>
          JSON.stringify(swap.candidateDayPlaceIds) ===
          JSON.stringify(alternative.candidateDayPlaceIds)
      );
      if (duplicatesSwap) continue;
      const existing = byDayId.get(alternative.dayId);
      if (existing) existing.push(alternative);
      else byDayId.set(alternative.dayId, [alternative]);
    }
    return byDayId;
  }, [localRelocationGeneration, localSwapsByDayId]);

  /**
   * The one explicit user action that may change a day's order from a generated candidate.
   *
   * The candidate is re-verified against the plan as it is *now* before anything moves — the draft
   * may have changed since the alternative was derived — and the mutation itself is the ordinary
   * `movePlaceWithinDay` every manual reorder already goes through, so the day id, its
   * accommodation boundary, every other day, `routeIds`, the dates, the visit times, the
   * accommodations, the manual legs and every stored inter-hub segment travel through untouched.
   * A stale candidate is a silent no-op: the next render simply regenerates from the real plan.
   */
  function applyLocalSwap(alternative: EvidenceCompleteLocalSwapAlternative) {
    applyEvidenceCompleteLocalSwap(
      alternative,
      { routeIds, days: planningDays, visitStartTimes },
      { resolvePlace: (placeId) => placeById.get(placeId) ?? null },
      (dayId, placeIndex, direction) => movePlaceWithinDay(dayId, placeIndex, direction)
    );
  }

  function applyLocalRelocation(alternative: EvidenceCompleteLocalRelocationAlternative) {
    applyEvidenceCompleteLocalRelocation(
      alternative,
      { routeIds, days: planningDays, visitStartTimes },
      { resolvePlace: (placeId) => placeById.get(placeId) ?? null },
      (dayId, fromIndex, toIndex) => relocatePlaceWithinDay(dayId, fromIndex, toIndex)
    );
  }

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

  // A canonical day assignment already restored from storage (Phase 3C-D) is shown as-is — it
  // is a prior user decision, not something to discard on reopen. Only when none exists yet
  // (`days === null`: never split, or invalidated by a route composition change) does opening
  // start from a single day holding the exact current route order — not a recommendation,
  // simply the route as it stands before any day boundary exists. Either way this never writes
  // back into the route itself.
  function openDayAssignment() {
    if (days === null) {
      initializeDays([[...routeIds]]);
    }
    setView("days");
  }
  function closeDayAssignment() {
    setView("builder");
  }

  // Same focus-management/backdrop-trap pattern as SelectionAnalysis: focus moves into the
  // dialog on open and returns to whatever opened it on close; Escape closes the whole dialog
  // (from any view — there is only one dialog to close); Tab cycles inside the dialog so the
  // map behind never takes focus.
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

  const resultText = view === "compare" ? comparisonResultText(comparison) : null;

  const headerTitle =
    view === "compare" ? "Comparar órdenes" : view === "days" ? "Distribuir por días" : "Construir recorrido";
  const headerSub =
    view === "compare"
      ? `Mismos ${candidateAPlaces.length} lugares, solo cambia el orden`
      : view === "days"
        ? `${routePlaces.length} lugar${routePlaces.length === 1 ? "" : "es"} en ${dayIds.length} día${
            dayIds.length === 1 ? "" : "s"
          }`
        : `${routePlaces.length} lugar${routePlaces.length === 1 ? "" : "es"} en el recorrido`;

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
            {view === "days" && (
              <button type="button" className="link-button sequence-back" onClick={closeDayAssignment}>
                <span aria-hidden="true">←</span> Volver al recorrido
              </button>
            )}
            <h2 id="sequence-builder-title">{headerTitle}</h2>
            <p className="analysis-header__sub">{headerSub}</p>
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
          {view === "builder" && (
            <>
              <p className="analysis-disclaimer">
                <span aria-hidden="true">ⓘ</span> Tú eliges el orden con las flechas. Nihon describe
                los traslados de ese orden exacto; <strong>no sugiere ni calcula el mejor orden</strong>.
              </p>
              <p className="analysis-disclaimer">
                <span aria-hidden="true">💾</span> Este recorrido se guarda automáticamente en este
                navegador, junto con el reparto por días si lo creas.
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

                  <TransferAndVisitTotals visitSummary={visitSummary} sequenceSummary={sequence.summary} />

                  <p className="analysis-disclaimer">
                    <span aria-hidden="true">ⓘ</span> Los traslados conocidos usan la misma
                    clasificación que la ficha de cada lugar: rutas validadas, estimaciones
                    geográficas u horarios en vivo. <strong>No incluyen tiempo dentro de cada lugar.</strong>
                  </p>

                  <ReservationPreparationSection summary={reservationPreparation} />

                  <HoursPlanningSection summary={recordedHours} />

                  <InterHubSegmentsSection
                    routeIds={routeIds}
                    days={days}
                    placeById={placeById}
                    segments={interHubSegments}
                    onAdd={addInterHubSegment}
                    onUpdate={updateInterHubSegment}
                    onRemove={removeInterHubSegment}
                  />

                  {routePlaces.length >= 2 && (
                    <div className="sequence-secondary-actions">
                      <button
                        type="button"
                        className="button button--secondary sequence-compare-toggle"
                        onClick={openComparison}
                      >
                        <span aria-hidden="true">⇄</span> Comparar otro orden
                      </button>
                      <button
                        type="button"
                        className="button button--secondary sequence-compare-toggle"
                        onClick={openDayAssignment}
                      >
                        <span aria-hidden="true">📅</span> Distribuir por días
                      </button>
                    </div>
                  )}
                </>
              )}

              <WholeTripCompositionSection composition={wholeTripComposition} />

              <button type="button" className="link-button sequence-reset" onClick={resetRoute}>
                Restablecer recorrido
              </button>

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
          )}

          {view === "compare" && (
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

          {view === "days" && (
            <>
              <p className="analysis-disclaimer">
                <span aria-hidden="true">ⓘ</span> Tú decides cuántos días hay y qué lugares van en
                cada uno. <strong>Nihon no reparte, equilibra ni recomienda un reparto</strong>; solo
                describe los traslados dentro de cada día.
              </p>

              {!dayAssignment.valid && (
                <p className="analysis-disclaimer sequence-day-invalid" role="alert">
                  <span aria-hidden="true">⚠</span> El reparto actual no coincide exactamente con el
                  recorrido. Vuelve al recorrido e inténtalo de nuevo.
                </p>
              )}

              <div className="calendar-anchor">
                <label htmlFor="sequence-start-date" className="calendar-anchor__label">
                  Fecha de inicio (Día 1)
                </label>
                <input
                  id="sequence-start-date"
                  type="date"
                  className="calendar-anchor__input"
                  value={startDate ?? ""}
                  onChange={(event) => setStartDate(event.target.value || null)}
                />
                {startDate && (
                  <button
                    type="button"
                    className="link-button calendar-anchor__clear"
                    onClick={() => setStartDate(null)}
                  >
                    Quitar fecha
                  </button>
                )}

                {/* Phase 3D-W: the trip's upper civil bound, structurally identical to the Día 1
                    control above and living in the same existing block. The two dates are two
                    independent decisions: setting or clearing either one never touches the other,
                    and never creates, deletes, reorders or repairs a day bucket. */}
                <label htmlFor="sequence-end-date" className="calendar-anchor__label">
                  Fecha de fin (último día del viaje)
                </label>
                <input
                  id="sequence-end-date"
                  type="date"
                  className="calendar-anchor__input"
                  value={endDate ?? ""}
                  onChange={(event) => setEndDate(event.target.value || null)}
                />
                {endDate && (
                  <button
                    type="button"
                    className="link-button calendar-anchor__clear"
                    onClick={() => setEndDate(null)}
                  >
                    Quitar fecha
                  </button>
                )}
              </div>

              <TripBoundsNotice summary={tripBoundsSummary} />
              <p className="analysis-disclaimer">
                <span aria-hidden="true">ⓘ</span> La fecha es una decisión tuya. Nihon solo
                desplaza el calendario a partir del Día 1; <strong>no elige ni sugiere qué fecha
                conviene</strong>, y no comprueba horarios ni cierres.
              </p>

              <InterHubSegmentsSection
                routeIds={routeIds}
                days={days}
                placeById={placeById}
                segments={interHubSegments}
                onAdd={addInterHubSegment}
                onUpdate={updateInterHubSegment}
                onRemove={removeInterHubSegment}
              />

              <WholeTripCompositionSection composition={wholeTripComposition} />

              <AccommodationManagerSection
                accommodations={accommodations}
                onAdd={addAccommodation}
                onRemove={removeAccommodation}
              />

              <div className="day-list">
                {dayPlaceLists.map((places, dayIndex) => {
                  const bucket = dayAssignment.days[dayIndex];
                  const daySummary = summarizeSelection(places);
                  const isEmpty = places.length === 0;
                  const dayDate = startDate ? addCivilDays(startDate, dayIndex) : null;
                  const weekdaySignal = buildDayWeekdaySignal(places, dayDate);
                  // Phase 3D-W: a purely derived read from the two civil bounds and this bucket's
                  // ORDINAL POSITION — the same ordinal `dayDate` above is already derived from. No
                  // day id crosses this line (`assessTripBounds` cannot accept one), nothing is
                  // written back to the draft, and no existing signal above or below is suppressed
                  // or altered by the verdict; it only adds a warning to the card's presentation.
                  const boundsAssessment = assessTripBounds({ startDate, endDate }, dayIndex);
                  // Phase 3D-S: the day entity at this ordinal position. Its `id` is what every
                  // mutation below is addressed by, and its `accommodationBoundary` is structurally
                  // its own — it cannot be another day's choice shifted into place by a splice,
                  // because there is no separate positional boundary vector left to shift. The id
                  // is deliberately invisible to the user: the heading below is still "Día N" from
                  // the array position, and the date is still `startDate + dayIndex`.
                  const dayEntity = dayEntities[dayIndex] ?? null;
                  const dayBoundary = dayEntity?.accommodationBoundary ?? null;
                  return (
                    <section key={dayEntity?.id ?? dayIndex} className="day-card" aria-labelledby={`day-heading-${dayIndex}`}>
                      <div className="day-card__header">
                        <div>
                          <h3 id={`day-heading-${dayIndex}`}>Día {dayIndex + 1}</h3>
                          {dayDate && <p className="day-card__date">{formatCivilDateDisplay(dayDate)}</p>}
                          <TripBoundsDayWarning assessment={boundsAssessment} />
                        </div>
                        <div className="day-card__header-actions">
                          <button
                            type="button"
                            className="icon-button icon-button--small"
                            onClick={() => dayEntity && moveDay(dayEntity.id, -1)}
                            disabled={!dayEntity || dayIndex === 0}
                            aria-label={`Mover Día ${dayIndex + 1} hacia arriba`}
                          >
                            <span aria-hidden="true">⇧</span>
                          </button>
                          <button
                            type="button"
                            className="icon-button icon-button--small"
                            onClick={() => dayEntity && moveDay(dayEntity.id, 1)}
                            disabled={!dayEntity || dayIndex === dayIds.length - 1}
                            aria-label={`Mover Día ${dayIndex + 1} hacia abajo`}
                          >
                            <span aria-hidden="true">⇩</span>
                          </button>
                          <button
                            type="button"
                            className="icon-button icon-button--small"
                            onClick={() => dayEntity && removeEmptyDay(dayEntity.id)}
                            disabled={!isEmpty || dayIds.length <= 1}
                            aria-label={`Eliminar Día ${dayIndex + 1}`}
                          >
                            <span aria-hidden="true">×</span>
                          </button>
                        </div>
                      </div>

                      {isEmpty ? (
                        <p className="sequence-empty">Sin lugares en este día.</p>
                      ) : (
                        <>
                          <ReorderableList
                            places={places}
                            legs={bucket?.sequence.legs ?? []}
                            labelSuffix={` en Día ${dayIndex + 1}`}
                            onMoveUp={(placeIndex) =>
                              dayEntity && movePlaceWithinDay(dayEntity.id, placeIndex, -1)
                            }
                            onMoveDown={(placeIndex) =>
                              dayEntity && movePlaceWithinDay(dayEntity.id, placeIndex, 1)
                            }
                            onMoveToPreviousGroup={(placeIndex) => {
                              const target = dayEntities[dayIndex - 1];
                              if (dayEntity && target) movePlaceBetweenDays(dayEntity.id, target.id, placeIndex);
                            }}
                            onMoveToNextGroup={(placeIndex) => {
                              const target = dayEntities[dayIndex + 1];
                              if (dayEntity && target) movePlaceBetweenDays(dayEntity.id, target.id, placeIndex);
                            }}
                            previousGroupLabel="al día anterior"
                            nextGroupLabel="al día siguiente"
                            canMoveToPreviousGroup={dayIndex > 0}
                            canMoveToNextGroup={dayIndex < dayIds.length - 1}
                            showDuration
                            compact
                          />
                          <WeekdayClosureNotice signal={weekdaySignal} />
                          <HoursClosureCompositionNotice
                            places={places}
                            dayAssignment={dayAssignment}
                            startDate={startDate}
                            dayNumber={dayIndex + 1}
                          />
                          <RecordedIntervalFitSection
                            places={places}
                            dayAssignment={dayAssignment}
                            startDate={startDate}
                            dayNumber={dayIndex + 1}
                            visitStartTimes={visitStartTimes}
                            onVisitStartTimeChange={setVisitStartTime}
                          />
                          <ReservationDeadlineNotice
                            places={places}
                            dayAssignment={dayAssignment}
                            startDate={startDate}
                            referenceDate={reservationReferenceDate}
                          />
                          {bucket && (
                            <TransferAndVisitTotals visitSummary={daySummary} sequenceSummary={bucket.sequence.summary} />
                          )}
                          {dayEntity &&
                            localSwapGeneration.kind === "available" &&
                            localRelocationGeneration.kind === "available" && (
                            <LocalSwapAlternativesSection
                              dayNumber={dayIndex + 1}
                              alternatives={localSwapsByDayId.get(dayEntity.id) ?? []}
                              relocationAlternatives={localRelocationsByDayId.get(dayEntity.id) ?? []}
                              placeById={placeById}
                              onApply={applyLocalSwap}
                              onApplyRelocation={applyLocalRelocation}
                            />
                          )}
                          {bucket && dayEntity && dayBoundary && (
                            <AccommodationCommuteSection
                              dayNumber={dayIndex + 1}
                              dayPlaceIds={dayIds[dayIndex] ?? []}
                              places={places}
                              intraDay={bucket.sequence.summary}
                              boundary={dayBoundary}
                              accommodations={accommodations}
                              accommodationLegs={accommodationLegs}
                              onChoiceChange={(side, choice) =>
                                setDayAccommodationChoice(dayEntity.id, side, choice)
                              }
                              onLegChange={(direction, accommodationId, placeId, minutes) =>
                                setAccommodationLeg(direction, accommodationId, placeId, minutes)
                              }
                            />
                          )}
                        </>
                      )}
                    </section>
                  );
                })}
              </div>

              <button
                type="button"
                className="button button--secondary sequence-add-day"
                onClick={() => addEmptyDay()}
              >
                <span aria-hidden="true">＋</span> Añadir día
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
