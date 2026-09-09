import { useEffect, useMemo, useRef, useState } from "react";
import type { Place } from "../types";
import { formatMinutes, formatRange, resolveDuration } from "../lib/duration";
import { summarizeSelection } from "../lib/selection";
import { buildOrderedSequence, type OrderedSequenceLeg, type OrderedSequenceSummary } from "../lib/ordered-sequence";
import { compareSequences, type SequenceCandidate, type SequenceComparison } from "../lib/sequence-comparison";
import { buildDayAssignment, type DayAssignment } from "../lib/day-assignment";
import { describeTransferForUi, transferModeIcon } from "../lib/transfer-display";
import { addCivilDays, formatCivilDateDisplay, type CivilWeekday } from "../lib/civil-date";
import { buildDayWeekdaySignal, type DayWeekdaySignal } from "../lib/day-weekday-signal";
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
// Phase 3C-C day-bucket array helpers. Pure, component-local — the same precedent as
// moveItemUp/moveItemDown above: this file already keeps ordering mechanics as small local
// helpers rather than exporting them from a lib module, since they are UI-state shape, not
// domain logic. `day-assignment.ts` only ever describes a partition it is given; it never
// decides how one is edited.
// ---------------------------------------------------------------------------------------

function addEmptyDay(days: readonly string[][]): string[][] {
  return [...days.map((day) => [...day]), []];
}

/** A day can only be removed empty, and at least one day must always remain — both guards the
 * domain module's own `"no-days"`/partition invariants exist to catch if this ever failed. */
function removeEmptyDay(days: readonly string[][], dayIndex: number): string[][] {
  if (days.length <= 1) return days.map((day) => [...day]);
  if ((days[dayIndex]?.length ?? 0) > 0) return days.map((day) => [...day]);
  return days.filter((_, index) => index !== dayIndex).map((day) => [...day]);
}

function moveWithinDay(
  days: readonly string[][],
  dayIndex: number,
  placeIndex: number,
  direction: -1 | 1
): string[][] {
  const next = days.map((day) => [...day]);
  next[dayIndex] = direction === -1 ? moveItemUp(next[dayIndex], placeIndex) : moveItemDown(next[dayIndex], placeIndex);
  return next;
}

/** Removes the place at `placeIndex` in `dayIndex` and appends it to the end of the adjacent
 * day's explicit order — never reordering anything else already in either day. A no-op when
 * there is no adjacent day in that direction. */
function moveToAdjacentDay(
  days: readonly string[][],
  dayIndex: number,
  placeIndex: number,
  direction: -1 | 1
): string[][] {
  const targetIndex = dayIndex + direction;
  if (targetIndex < 0 || targetIndex >= days.length) return days.map((day) => [...day]);
  const placeId = days[dayIndex]?.[placeIndex];
  if (placeId === undefined) return days.map((day) => [...day]);
  const next = days.map((day) => [...day]);
  next[dayIndex].splice(placeIndex, 1);
  next[targetIndex].push(placeId);
  return next;
}

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

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

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
    days,
    startDate,
    visitStartTimes,
    accommodations,
    dayAccommodationBoundaries,
    accommodationLegs,
    setRoute: setRouteIds,
    setDays: setDayIds,
    setStartDate,
    setVisitStartTime,
    addAccommodation,
    removeAccommodation,
    setDayAccommodationChoice,
    setAccommodationLeg,
    resetRoute,
  } = usePlanningDraft(savedIds);
  const dayIds = useMemo(() => days ?? [], [days]);

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
      setDayIds([[...routeIds]]);
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
              </div>
              <p className="analysis-disclaimer">
                <span aria-hidden="true">ⓘ</span> La fecha es una decisión tuya. Nihon solo
                desplaza el calendario a partir del Día 1; <strong>no elige ni sugiere qué fecha
                conviene</strong>, y no comprueba horarios ni cierres.
              </p>

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
                  // Positional, exactly like the day bucket itself: the boundary vector always has
                  // the same length as `days` (V4's parse/update invariant), so index `dayIndex` is
                  // this day's own choice and never another day's shifted into place.
                  const dayBoundary = dayAccommodationBoundaries?.[dayIndex] ?? null;
                  return (
                    <section key={dayIndex} className="day-card" aria-labelledby={`day-heading-${dayIndex}`}>
                      <div className="day-card__header">
                        <div>
                          <h3 id={`day-heading-${dayIndex}`}>Día {dayIndex + 1}</h3>
                          {dayDate && <p className="day-card__date">{formatCivilDateDisplay(dayDate)}</p>}
                        </div>
                        <button
                          type="button"
                          className="icon-button icon-button--small"
                          onClick={() => setDayIds((days) => removeEmptyDay(days, dayIndex))}
                          disabled={!isEmpty || dayIds.length <= 1}
                          aria-label={`Eliminar Día ${dayIndex + 1}`}
                        >
                          <span aria-hidden="true">×</span>
                        </button>
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
                              setDayIds((days) => moveWithinDay(days, dayIndex, placeIndex, -1))
                            }
                            onMoveDown={(placeIndex) =>
                              setDayIds((days) => moveWithinDay(days, dayIndex, placeIndex, 1))
                            }
                            onMoveToPreviousGroup={(placeIndex) =>
                              setDayIds((days) => moveToAdjacentDay(days, dayIndex, placeIndex, -1))
                            }
                            onMoveToNextGroup={(placeIndex) =>
                              setDayIds((days) => moveToAdjacentDay(days, dayIndex, placeIndex, 1))
                            }
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
                          {bucket && dayBoundary && (
                            <AccommodationCommuteSection
                              dayNumber={dayIndex + 1}
                              dayPlaceIds={dayIds[dayIndex] ?? []}
                              places={places}
                              intraDay={bucket.sequence.summary}
                              boundary={dayBoundary}
                              accommodations={accommodations}
                              accommodationLegs={accommodationLegs}
                              onChoiceChange={(side, choice) =>
                                setDayAccommodationChoice(dayIndex, side, choice)
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
                onClick={() => setDayIds((days) => addEmptyDay(days))}
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
