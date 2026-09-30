import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { Place } from "../types";
import { formatMinutes, formatRange } from "../lib/duration";
import { summarizeSelection } from "../lib/selection";
import type { OrderedSequenceLeg, OrderedSequenceSummary } from "../lib/ordered-sequence";
import type { ConfidenceCounts } from "../lib/sequence-comparison";
import {
  generateEvidenceCompleteLocalSwaps,
  type EvidenceCompleteLocalSwapAlternative,
} from "../lib/evidence-complete-local-swap";
import {
  generateEvidenceCompleteLocalRelocations,
  type EvidenceCompleteLocalRelocationAlternative,
} from "../lib/evidence-complete-local-relocation";
import {
  generateEvidenceCompleteInteriorTranspositions,
  type EvidenceCompleteInteriorTranspositionAlternative,
} from "../lib/evidence-complete-interior-transposition";
import {
  generateEvidenceCompleteFourPlaceInteriorReversals,
  type EvidenceCompleteFourPlaceInteriorReversalAlternative,
} from "../lib/evidence-complete-four-place-interior-reversal";
import {
  generateEvidenceCompleteTwoPairBlockSwaps,
  type EvidenceCompleteTwoPairBlockSwapAlternative,
} from "../lib/evidence-complete-two-pair-block-swap";
import { buildDayAssignment, type DayAssignment } from "../lib/day-assignment";
import {
  describeTransferForUi,
  transferEvidenceDetail,
  transferEvidenceLevel,
  transferModeIcon,
} from "../lib/transfer-display";
import { Icon } from "../icons/Icon";
import { DayOrderSheet } from "./DayOrderSheet";
import { planDayOrderMoves } from "./day-order";
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
import { reservationMechanismEvidenceRecords } from "../lib/reservation-mechanism-evidence";
import { deriveReservationMechanismDatesForPlannedPlace } from "../lib/reservation-mechanism-date-derivation";
import {
  buildOfficialReservationDatePresentation,
  type OfficialReservationDatePresentation,
} from "../lib/reservation-mechanism-presentation";
import { evaluateOfficialReservationReferenceDate } from "../lib/reservation-mechanism-reference-date";
import {
  buildOfficialReservationReferenceRelationPresentation,
  type OfficialReservationReferenceRelationPresentation,
} from "../lib/reservation-mechanism-reference-date-presentation";
import {
  buildRouteWideOfficialReservationCalendar,
  type RouteWideOfficialReservationCalendar,
} from "../lib/reservation-mechanism-calendar";
import { OFFICIAL_RESERVATION_CALENDAR_SPAN_ANCHOR_NOTE } from "../lib/reservation-mechanism-calendar-presentation";
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
import { buildWholeTripComposition } from "../lib/whole-trip-composition";
import { buildZoneDayLinks, buildZoneHubLinks } from "../lib/zone-plan-link";
import {
  findZoneChoiceForAnchor,
  type ZoneAccommodationChoice,
} from "../lib/zone-accommodation-choice";
import { ZonePlanSection } from "./ZonePlanSection";
import { DayTimeline } from "./DayTimeline";
import { TripStop } from "./TripStop";
import { TripSummaryCards } from "./TripSummaryCards";
import { TripTimelineBand } from "./TripTimelineBand";
import { RESUMEN_NOTE, type TripTimelineDay } from "./viajeResumenModel";
import type { ViajeNavTarget } from "./viajeSurfaceFocus";
import { UnassignedDrawer } from "./UnassignedDrawer";
import { StopActionsSheet } from "./StopActionsSheet";
import { useStopReorder } from "./useStopReorder";
import { StopDragGhost } from "./StopDragGhost";
import { describeSlot, type StopOrigin, type StopSlot } from "../lib/stop-reorder";
import { EvidenceMark } from "./EvidenceMark";
import {
  dayCityLabel,
  dayHeadline,
  daySleepLine,
  formatCivilDateShort,
  formatTripRangeShort,
  stopCountText,
} from "../lib/day-timeline-presentation";
import { usePlanningDraft } from "../usePlanningDraft";

type Props = {
  /** The wishlist, in its saved order — the source the route draft is initialized from and
   * the set a place can be added back from. Never mutated: removing a place from the route
   * here does not unsave it, and this component never calls anything that changes "Quiero ir". */
  savedPlaces: Place[];
  onClose: () => void;
  /** Bloque 18, `02 §D2` / gate 11: el planner deja de ser un modal global y pasa a ser
   * contenido navegable bajo «Viaje». `embedded` quita el scrim, el `role="dialog"` y la
   * trampa de foco/Escape propios de una capa flotante; nada del cálculo cambia. */
  embedded?: boolean;
  /**
   * B27 (B9.1): which Viaje sub-surface this instance renders. `dias` (the default and the tab's
   * opening surface) is the day-first view; `reservas` and `resumen` re-host the EXISTING reservation
   * and whole-trip sections unchanged (their redesign is B9.5). Only one instance is ever mounted.
   */
  section?: "dias" | "reservas" | "resumen";
  /** DD-015 (`05 §8` «Apertura de ficha de lugar desde Viaje»): opens the shared `PlaceDetail`
   * stacked inside Viaje, labelled «Días». Without it (legacy dialog use) stops are not openable. */
  onSelectPlace?: (placeId: string) => void;
  /** «Dormís en …» footer link → Viaje › Dónde dormir, for the day's single hub when it has one. */
  onOpenZones?: (hub: string | null) => void;
  /** B31 (DDR-B31-07): the four «Resumen» cards jump to another Viaje sub-tab. Wired in `App.tsx`
   * straight to the existing `viajeSection` setter — navigation only, no state of its own, no history. */
  onNavigateSection?: (target: ViajeNavTarget) => void;
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
 * persisted draft and never will be. Since B29 (B9.3) the comparison is no longer a global view:
 * «Probar otro orden» is a sheet LOCAL to one day (`DayOrderSheet`), whose proposal is plain
 * component state cloned from the day's persisted order each time it opens and discarded on close.
 * Only «Usar este orden» (`applyDayOrder`) writes, and only that one day's order.
 *
 * Composition is fixed while the tool is open: neither the proposal nor the day buckets can add or
 * remove a place, only reorder the fixed set — see `sequence-comparison.ts` and `day-assignment.ts`
 * for the guarantees that rest on that.
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
 * Phase 3F-F adds a separate per-day read-only official-reservation surface from the bundled
 * Phase 3F evidence catalog plus the same strict planned visit-date ownership already used by
 * Phase 3F-D. It renders source-scoped release/application dates, provenance and recorded timezone
 * uncertainty without reading the Phase 3D-O device reference date. The official facts remain a
 * sibling of Phase 3D-H rather than a merged/intersected reservation window and never become a
 * current sale-state, availability, urgency, ranking or purchase instruction.
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
            <Icon name="aviso" size={16} /> {matches.length} posible
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
              <Icon name="aviso" size={16} /> Información con salvedad; conviene revisar el texto registrado
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
            <p className="recorded-interval-fit__raw">
              «{hours.raw}» <EvidenceMark level="registrado" />
            </p>
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
              <Icon name="aviso" size={16} /> Estado Feb–Mar 2027: {febMarLabel}. El calendario/condición
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
          <span className="reservation-deadline__raw">
            «{window.signal.raw}» <EvidenceMark level="registrado" />
          </span>
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

/**
 * Phase 3F-F's one visible official-reservation surface, extended by Phase 3F-H with a civil-date
 * relation. It consumes only Phase 3F-D derivations plus the exact matching evidence record, and
 * therefore cannot replace or reinterpret the separate Phase 3D-H editorial window above. The
 * component receives no visit start time, trip end date, closure/hours fact or
 * reservation-requiredness signal.
 *
 * Phase 3F-H adds exactly one input: the concrete device-local civil date already captured once by
 * the planner. Sharing that environmental value does NOT merge the two evidence domains — Phase 3F
 * evaluates it through its own `evaluateOfficialReservationReferenceDate`, never through the Phase
 * 3D-O evaluator, and the resulting sentence stays a calendar relation rather than a booking state.
 */
function OfficialReservationDateNotice({
  places,
  dayAssignment,
  startDate,
  dayNumber,
  referenceDate,
}: {
  places: readonly Place[];
  dayAssignment: DayAssignment;
  startDate: string | null;
  dayNumber: number;
  referenceDate: string | null;
}) {
  type Item = {
    place: Place;
    presentation: OfficialReservationDatePresentation;
    relationPresentation: OfficialReservationReferenceRelationPresentation | null;
  };

  const items: Item[] = [];
  for (const place of places) {
    const derivations = deriveReservationMechanismDatesForPlannedPlace(
      reservationMechanismEvidenceRecords,
      dayAssignment,
      startDate,
      place.id
    );
    for (const derivation of derivations) {
      const record = reservationMechanismEvidenceRecords.find(
        (candidate) => candidate.id === derivation.recordId
      );
      if (!record) continue;
      const presentation = buildOfficialReservationDatePresentation(record, derivation);
      if (!presentation) continue;
      // The relation is evaluated from the same derivation the presentation was built from, then
      // composed back through an identity check that drops it if record/place/scope disagree.
      const relation = referenceDate
        ? evaluateOfficialReservationReferenceDate(derivation, referenceDate)
        : null;
      const relationPresentation = relation
        ? buildOfficialReservationReferenceRelationPresentation(presentation, relation)
        : null;
      items.push({ place, presentation, relationPresentation });
    }
  }

  if (items.length === 0) return null;

  return (
    <section
      className="official-reservation-date"
      aria-label={`Fechas de reserva según fuente oficial · Día ${dayNumber}`}
    >
      <h4 className="official-reservation-date__heading">Fechas de reserva según fuente oficial</h4>
      <div className="official-reservation-date__list">
        {items.map(({ place, presentation, relationPresentation }) => (
          <article key={presentation.recordId} className="official-reservation-date__item">
            <span className="official-reservation-date__name">{place.name}</span>
            <span className="official-reservation-date__scope">{presentation.scopeLabel}</span>
            <p className="official-reservation-date__fact-heading">{presentation.heading}</p>
            {presentation.detailLines.map((line, index) => (
              <p
                key={`${presentation.recordId}:detail:${index}`}
                className="official-reservation-date__detail"
              >
                {line}
              </p>
            ))}
            {presentation.allocationText && (
              <p className="official-reservation-date__allocation">{presentation.allocationText}</p>
            )}
            {presentation.purchaseResidenceContextText && (
              <p className="official-reservation-date__purchase-residence-context">
                {presentation.purchaseResidenceContextText}
              </p>
            )}
            {relationPresentation && (
              <>
                <p className="official-reservation-date__reference-relation">
                  {relationPresentation.relationText}
                </p>
                <p className="official-reservation-date__reference-date">
                  {relationPresentation.referenceDateText}
                </p>
              </>
            )}
            <p className="official-reservation-date__provenance">{presentation.provenanceText}</p>
            <a
              className="official-reservation-date__source"
              href={presentation.sourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              Ver fuente oficial
            </a>
          </article>
        ))}
      </div>
      <p className="official-reservation-date__disclaimer">
        Estas fechas son hechos de calendario derivados del registro oficial para la fecha de visita
        asignada. Cuando se muestra, la relación con la fecha de referencia compara únicamente fechas
        de calendario: no considera la hora registrada ni la zona horaria de la fuente, y no indica el
        estado actual de la venta. La fecha de referencia se toma del calendario local de tu
        dispositivo al abrir este plan, no representa la fecha operativa en Japón y no se actualiza
        automáticamente mientras esta vista siga abierta.{" "}
        <strong>
          Esta información oficial se muestra por separado de la anticipación editorial registrada;
          Nihon no combina ambas fuentes.
        </strong>
      </p>
    </section>
  );
}

/**
 * B31 (DDR-B31-04): the per-block disclaimers of Reservas are gone; the sentences that do not belong
 * in the surface's single framing note live in the `detail` of the EvidenceMark of the list they
 * qualified (recoverable by screen reader through aria-label/title). The trace «descargo → destino»
 * is in `docs/BLOCK_31_HANDOFF.md`.
 */
const OFFICIAL_CALENDAR_MARK_DETAIL =
  "Estas fechas provienen del registro oficial de cada lugar y están calculadas sobre la fecha de visita planificada. El orden cronológico solo ordena fechas de calendario: no indica prioridad, urgencia ni en qué orden conviene reservar. Cuando se muestra una relación con la fecha de referencia, compara únicamente fechas de calendario: no considera la hora registrada ni la zona horaria de la fuente.";
const RESERVATION_PREP_MARK_DETAIL =
  "Esta lista solo describe la anticipación registrada en el dato original de cada lugar; no compara esa anticipación con tu calendario.";
const HOURS_PLANNING_MARK_DETAIL =
  "Esta lista solo describe qué horario está registrado en el dato original de cada lugar. No determina si el lugar abre o cierra en tu fecha, no revisa festivos ni cierres, y no se compara con la hora del día.";
/** The ONE framing note of Viaje › Reservas (Art. 3, DDR-B31-04): composed only of sentences the
 * three removed disclaimers already carried. */
const RESERVAS_NOTE =
  "La información oficial se muestra por separado de la anticipación editorial registrada; Nihon no combina ambas fuentes. No indica disponibilidad ni el estado actual de la venta, y no calcula fechas límite de reserva. La fecha de referencia se toma del calendario local de tu dispositivo al abrir este plan, no representa la fecha operativa en Japón y no se actualiza automáticamente mientras esta vista siga abierta.";

/**
 * Phase 3F-J's one route-wide official-reservation surface, rendered once per planner in the dated
 * "Distribuir por días" view. It is a SECOND VIEW of facts the day cards already show — the per-day
 * `OfficialReservationDateNotice` above is unchanged and remains the primary, per-visit surface.
 *
 * Chronology-only: every row here has a real recorded civil date. A Phase 3F result with no
 * applicable official date (outside the recorded event period, not derivable, or a span whose
 * recorded edges are invalid or inverted) produces no row at all — no neutral row, no placeholder,
 * no substitute date. Those facts stay visible in their own day card.
 *
 * The order is a reading order over recorded civil dates and nothing else. It is not a priority, a
 * recommended sequence, a workload or a measure of urgency or scarcity, which is why no row carries
 * a state, a badge, a count, a checkbox or any styling derived from its date or its relation. The
 * Phase 3D-H editorial "Reservas por preparar" surface lives in a different view entirely and is
 * never merged, ranked against or suppressed by this one.
 */
function OfficialReservationCalendarSection({
  calendar,
}: {
  calendar: RouteWideOfficialReservationCalendar;
}) {
  if (calendar.chronological.length === 0) return null;

  // The one device civil date is disclosed once for the whole section. `calendar.referenceDate` is
  // non-null exactly when at least one row carries a relation evaluated from it, so an unusable
  // date is never shown, and the concrete date shown is the one Phase 3F-H itself rendered.
  const referenceDateText = calendar.referenceDate
    ? calendar.chronological.find((item) => item.relation !== null)?.relation?.referenceDateText ?? null
    : null;

  return (
    <section
      className="official-reservation-calendar"
      aria-labelledby="official-reservation-calendar-heading"
    >
      <div className="reservas__heading">
        <h3 id="official-reservation-calendar-heading">Fechas oficiales</h3>
        <EvidenceMark level="verificado" label={false} detail={OFFICIAL_CALENDAR_MARK_DETAIL} />
      </div>
      {referenceDateText && (
        <p className="official-reservation-calendar__reference-date">
          {referenceDateText} · Esta misma fecha de referencia se usa en todas las relaciones de esta
          sección.
        </p>
      )}
      <ul className="official-reservation-calendar__list">
        {calendar.chronological.map((item) => (
          <li
            key={`${item.recordId}:${item.placeId}:${item.scope}`}
            className="official-reservation-calendar__item"
          >
            <span className="official-reservation-calendar__anchor">
              {formatCivilDateDisplay(item.anchorDate)}
            </span>
            <span className="official-reservation-calendar__context">
              {item.placeName} · Día {item.dayNumber} · visita {formatCivilDateDisplay(item.visitDate)}
            </span>
            <span className="official-reservation-calendar__scope">{item.presentation.scopeLabel}</span>
            <p className="official-reservation-calendar__fact-heading">{item.presentation.heading}</p>
            {item.fact.kind === "application-date-span" ? (
              <>
                <p className="official-reservation-calendar__detail">{item.fact.spanText}</p>
                <p className="official-reservation-calendar__anchor-note">
                  {OFFICIAL_RESERVATION_CALENDAR_SPAN_ANCHOR_NOTE}
                </p>
              </>
            ) : (
              item.presentation.detailLines.map((line, index) => (
                <p
                  key={`${item.recordId}:calendar-detail:${index}`}
                  className="official-reservation-calendar__detail"
                >
                  {line}
                </p>
              ))
            )}
            {item.presentation.allocationText && (
              <p className="official-reservation-calendar__allocation">
                {item.presentation.allocationText}
              </p>
            )}
            {item.presentation.purchaseResidenceContextText && (
              <p className="official-reservation-calendar__purchase-residence-context">
                {item.presentation.purchaseResidenceContextText}
              </p>
            )}
            {item.relation && (
              <p className="official-reservation-calendar__relation">{item.relation.relationText}</p>
            )}
            <p className="official-reservation-calendar__provenance">
              <EvidenceMark level="verificado" detail={item.presentation.provenanceText} />
            </p>
            <a
              className="official-reservation-calendar__source"
              href={item.presentation.sourceUrl}
              target="_blank"
              rel="noreferrer"
              aria-label={`Ver fuente oficial de ${item.placeName}`}
            >
              Ver fuente oficial
            </a>
          </li>
        ))}
      </ul>
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
      <div className="reservas__heading">
        <h3 id="reservation-prep-heading">Reservas por preparar</h3>
        <EvidenceMark level="registrado" label={false} detail={RESERVATION_PREP_MARK_DETAIL} />
      </div>
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
            <span className="reservation-prep__raw">
              «{item.leadTime.raw}» <EvidenceMark level="registrado" />
            </span>
          </li>
        ))}
      </ul>
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
      <div className="reservas__heading">
        <h3 id="hours-planning-heading">Horarios registrados</h3>
        <EvidenceMark level="registrado" label={false} detail={HOURS_PLANNING_MARK_DETAIL} />
      </div>
      <p className="hours-planning__summary">{parts.join(" · ")}</p>
      <ul className="hours-planning__list">
        {summary.items.map((item) => (
          <li key={item.placeId} className={`hours-planning__item hours-planning__item--${item.hours.tier}`}>
            <span className="hours-planning__name">{item.placeName}</span>
            <span className="hours-planning__signal">{hoursSignalText(item.hours)}</span>
            <span className="hours-planning__raw">
              «{item.hours.raw}» <EvidenceMark level="registrado" />
            </span>
          </li>
        ))}
      </ul>
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
  zoneChoices,
  onAdd,
  onRemove,
}: {
  accommodations: readonly AccommodationAnchor[];
  /** Block 4: which anchors came from a chosen zone, so the list can say so. A seeded anchor is an
   * ORDINARY anchor in every other respect — it is offered to every day, it carries no priority,
   * and it needs the reader's own typed minutes exactly as a hand-made one does. */
  zoneChoices: readonly ZoneAccommodationChoice[];
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
      {zoneChoices.length > 0 && (
        <p className="accommodation-manager__intro">
          Los marcados <em>de la zona elegida</em> los creó una zona que elegisteis al comparar.
          Funcionan igual que los demás. Si borráis uno aquí, se quita también esa zona elegida.
        </p>
      )}

      {accommodations.length === 0 ? (
        <p className="accommodation-manager__empty">Todavía no has creado ningún alojamiento.</p>
      ) : (
        <ul className="accommodation-manager__list">
          {accommodations.map((anchor) => {
            const seeding = findZoneChoiceForAnchor(zoneChoices, anchor.id);
            return (
              <li key={anchor.id} className="accommodation-manager__item">
                <span className="accommodation-manager__label">
                  {anchor.label}
                  {seeding && (
                    <span className="accommodation-manager__origin">
                      {" "}
                      · de la zona elegida en {seeding.hub}
                    </span>
                  )}
                </span>
                <span className="accommodation-manager__coords">
                  {anchor.location.lat}, {anchor.location.lng}
                </span>
                <button
                  type="button"
                  className="icon-button icon-button--small"
                  onClick={() => onRemove(anchor.id)}
                  aria-label={
                    seeding
                      ? `Eliminar alojamiento ${anchor.label} y la zona elegida en ${seeding.hub}`
                      : `Eliminar alojamiento ${anchor.label}`
                  }
                  title={
                    seeding
                      ? `Eliminar alojamiento ${anchor.label} y la zona elegida en ${seeding.hub}`
                      : `Eliminar alojamiento ${anchor.label}`
                  }
                >
                  <Icon name="cerrar" size={16} />
                </button>
              </li>
            );
          })}
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
                    title={`Eliminar tramo ${fromName} a ${toName}`}
                  >
                    <Icon name="cerrar" size={16} />
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
          <Icon name="aviso" size={16} /> La fecha de fin es anterior a la de inicio. Nihon no
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
      <Icon name="aviso" size={16} /> Este día es posterior a la fecha de fin de tu viaje.
    </p>
  );
}

/** The existing Phase 3C-B evidence vocabulary, reused verbatim so one order is never described
 * in a different language than another. Returns "" when there is nothing to disclose. */
/**
 * B27 (B9.1, `04 §14`) — the connector between two `TripStop`s.
 *
 * A registered transfer is shown with the SAME text and evidence the planner already computed
 * (`describeTransferForUi`, `transferEvidenceLevel`); the absence of one is «Traslado sin datos» —
 * `--ink-500`, never red, never `?`: a known absence, not an error. When the two stops are the exact
 * pair of a stored manual inter-hub segment, that segment is the connector (registered by the reader,
 * `◧`), because it IS the recorded transfer between those two places.
 */
function TripConnector({
  leg,
  interHub,
}: {
  leg: OrderedSequenceLeg | undefined;
  interHub: ManualInterHubSegment | null;
}) {
  if (interHub) {
    return (
      <div className="trip-connector trip-connector--inter-hub">
        <Icon name="tren" size={16} />
        <span className="trip-connector__time">
          {INTER_HUB_MODE_LABELS[interHub.mode]} · {interHub.minutes} min
        </span>
        <EvidenceMark level="registrado" detail="anotado por vosotros" label={false} />
      </div>
    );
  }
  if (!leg || !leg.transfer) {
    return (
      <div className="trip-connector trip-connector--none">
        <span className="trip-connector__time">Traslado sin datos</span>
      </div>
    );
  }
  const display = describeTransferForUi(leg.transfer);
  return (
    <div className="trip-connector">
      <Icon name={transferModeIcon(leg.transfer.mode)} size={16} />
      <span className="trip-connector__time">{display.timeText}</span>
      <span className="trip-connector__quality">{display.qualityLabel}</span>
      <EvidenceMark
        level={transferEvidenceLevel(leg.transfer)}
        detail={transferEvidenceDetail(leg.transfer)}
        label={false}
      />
    </div>
  );
}

type InterHubBoundaryRow = {
  fromHub: string;
  toHub: string;
  /** The reader's stored segment for exactly this day boundary, or `null` when none is recorded. */
  segment: ManualInterHubSegment | null;
};

/**
 * B27 — READS the existing inter-hub model to place «traslado entre ciudades» rows between days.
 * `assessInterHubSegment` / `deriveEligibleInterHubPairs` are called exactly as
 * `InterHubSegmentsSection` calls them; nothing is recomputed, stored or changed. Keyed by the
 * ordinal of the day the boundary FOLLOWS.
 */
function buildInterHubBoundaryRows(input: {
  routeIds: readonly string[];
  days: readonly (readonly string[])[] | null;
  placeById: ReadonlyMap<string, Place>;
  segments: readonly ManualInterHubSegment[];
}): { boundaries: Map<number, InterHubBoundaryRow>; sameDay: Map<string, ManualInterHubSegment> } {
  const { routeIds, days, placeById, segments } = input;
  const resolvePlace = (placeId: string) => {
    const place = placeById.get(placeId);
    return place ? { hub: place.hub } : null;
  };
  const boundaries = new Map<number, InterHubBoundaryRow>();
  const sameDay = new Map<string, ManualInterHubSegment>();
  for (const segment of segments) {
    const assessment = assessInterHubSegment(segment, { routeIds, days, resolvePlace });
    if (assessment.kind !== "active") continue;
    if (assessment.placement === "same-day") sameDay.set(interHubPairKey(segment), segment);
    if (assessment.placement === "between-consecutive-days" && assessment.fromDayOrdinal !== null) {
      boundaries.set(assessment.fromDayOrdinal, { fromHub: segment.fromHub, toHub: segment.toHub, segment });
    }
  }
  for (const pair of deriveEligibleInterHubPairs({ routeIds, days, resolvePlace })) {
    if (pair.placement !== "between-consecutive-days" || pair.fromDayOrdinal === null) continue;
    if (boundaries.has(pair.fromDayOrdinal)) continue;
    boundaries.set(pair.fromDayOrdinal, { fromHub: pair.fromHub, toHub: pair.toHub, segment: null });
  }
  return { boundaries, sameDay };
}

/** B27 (`04 §14`: «Traslado entre ciudades … ocupa el ancho completo entre dos días»). */
function InterHubBoundary({ row, onEdit }: { row: InterHubBoundaryRow; onEdit: () => void }) {
  return (
    <div
      className="inter-hub-row"
      role="group"
      aria-label={`Traslado entre ciudades: ${row.fromHub} a ${row.toHub}`}
      data-inter-hub-row
    >
      <Icon name="tren" size={20} />
      <div className="inter-hub-row__text">
        <span className="inter-hub-row__route">
          {row.fromHub} → {row.toHub}
        </span>
        {row.segment ? (
          <span className="inter-hub-row__detail">
            {INTER_HUB_MODE_LABELS[row.segment.mode]} · {row.segment.minutes} min{" "}
            <EvidenceMark level="registrado" detail="anotado por vosotros" label={false} />
          </span>
        ) : (
          <span className="inter-hub-row__detail inter-hub-row__detail--none">
            Traslado entre ciudades sin datos
          </span>
        )}
      </div>
      <button type="button" className="link-button inter-hub-row__action" onClick={onEdit}>
        {row.segment ? "Editar traslado" : "Registrar traslado"}
      </button>
    </div>
  );
}

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
  transpositionAlternatives,
  reversalAlternatives,
  pairBlockSwapAlternatives,
  placeById,
  proposalIds,
  onLoad,
}: {
  dayNumber: number;
  alternatives: EvidenceCompleteLocalSwapAlternative[];
  relocationAlternatives: EvidenceCompleteLocalRelocationAlternative[];
  transpositionAlternatives: EvidenceCompleteInteriorTranspositionAlternative[];
  reversalAlternatives: EvidenceCompleteFourPlaceInteriorReversalAlternative[];
  pairBlockSwapAlternatives: EvidenceCompleteTwoPairBlockSwapAlternative[];
  placeById: Map<string, Place>;
  /** The order currently loaded in the sheet's «Otro orden»; only used to mark the loaded option. */
  proposalIds: readonly string[];
  /** Copies the option's order into the sheet's proposal. Never writes the draft. */
  onLoad: (candidateDayPlaceIds: readonly string[]) => void;
}) {
  const headingId = `local-swap-heading-${dayNumber}`;
  const nameOf = (placeId: string) => placeById.get(placeId)?.name ?? placeId;
  const isLoaded = (alternative: { candidateDayPlaceIds: readonly string[] }) =>
    alternative.candidateDayPlaceIds.length === proposalIds.length &&
    alternative.candidateDayPlaceIds.every((id, index) => id === proposalIds[index]);
  const hasAlternatives =
    alternatives.length > 0 ||
    relocationAlternatives.length > 0 ||
    transpositionAlternatives.length > 0 ||
    reversalAlternatives.length > 0 ||
    pairBlockSwapAlternatives.length > 0;

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
                      <p className="local-swap__badge">Comprobado con datos completos</p>
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
                        aria-pressed={isLoaded(alternative)}
                        onClick={() => onLoad(alternative.candidateDayPlaceIds)}
                      >
                        Probar este intercambio
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
                      <p className="local-swap__badge">Comprobado con datos completos</p>
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
                        aria-pressed={isLoaded(alternative)}
                        onClick={() => onLoad(alternative.candidateDayPlaceIds)}
                      >
                        Probar esta reubicación
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {transpositionAlternatives.length > 0 && (
            <div className="local-swap__group local-transposition">
              <h5>Intercambios no adyacentes</h5>
              <ul className="local-swap__list">
                {transpositionAlternatives.map((alternative) => {
                  const baselineMix = confidenceMixText(alternative.baselineConfidenceCounts);
                  const candidateMix = confidenceMixText(alternative.candidateConfidenceCounts);
                  return (
                    <li
                      key={`${alternative.dayId}:${alternative.leftDayIndex}:${alternative.rightDayIndex}`}
                      className="local-swap__item local-transposition__item"
                    >
                      <p className="local-swap__badge">Comprobado con datos completos</p>
                      <p className="local-swap__pair local-transposition__exchange">
                        Intercambiar <strong>{nameOf(alternative.leftPlaceId)}</strong> y{" "}
                        <strong>{nameOf(alternative.rightPlaceId)}</strong> dentro del bloque de{" "}
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
                          <dt>Traslados registrados de este intercambio</dt>
                          <dd>
                            {formatRange(alternative.candidateTransferMinutes)}
                            {candidateMix && <span className="local-swap__evidence"> · {candidateMix}</span>}
                          </dd>
                        </div>
                      </dl>
                      <p className="local-swap__advantage">
                        Este intercambio no adyacente reduce de forma demostrable el rango de traslado
                        local registrado de este bloque. Ventaja mínima entre los rangos registrados:{" "}
                        {formatMinutes(alternative.guaranteedAdvantageMinutes)}.
                      </p>
                      <p className="local-swap__disclaimer">
                        Esta comparación usa únicamente los traslados locales registrados de este bloque.
                        No evalúa horarios, reservas, alojamiento, puerta a puerta ni el viaje completo.
                      </p>
                      <button
                        type="button"
                        className="button button--secondary local-swap__apply"
                        aria-pressed={isLoaded(alternative)}
                        onClick={() => onLoad(alternative.candidateDayPlaceIds)}
                      >
                        Probar este intercambio no adyacente
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {reversalAlternatives.length > 0 && (
            <div className="local-swap__group local-reversal">
              <h5>Reversiones de cuatro lugares</h5>
              <ul className="local-swap__list">
                {reversalAlternatives.map((alternative) => {
                  const baselineMix = confidenceMixText(alternative.baselineConfidenceCounts);
                  const candidateMix = confidenceMixText(alternative.candidateConfidenceCounts);
                  const [first, second, third, fourth] = alternative.originalWindowPlaceIds;
                  return (
                    <li
                      key={`${alternative.dayId}:${alternative.windowStartDayIndex}`}
                      className="local-swap__item local-reversal__item"
                    >
                      <p className="local-swap__badge">Comprobado con datos completos</p>
                      <p className="local-swap__pair local-reversal__window">
                        Revertir el orden de <strong>{nameOf(first)}</strong>,{" "}
                        <strong>{nameOf(second)}</strong>, <strong>{nameOf(third)}</strong> y{" "}
                        <strong>{nameOf(fourth)}</strong> dentro del bloque de {alternative.hub}.
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
                          <dt>Traslados registrados de esta reversión</dt>
                          <dd>
                            {formatRange(alternative.candidateTransferMinutes)}
                            {candidateMix && <span className="local-swap__evidence"> · {candidateMix}</span>}
                          </dd>
                        </div>
                      </dl>
                      <p className="local-swap__advantage">
                        Esta reversión de cuatro lugares reduce de forma demostrable el rango de
                        traslado local registrado de este bloque. Ventaja mínima entre los rangos
                        registrados: {formatMinutes(alternative.guaranteedAdvantageMinutes)}.
                      </p>
                      <p className="local-swap__disclaimer">
                        Esta comparación usa únicamente los traslados locales registrados de este bloque.
                        No evalúa horarios, reservas, alojamiento, puerta a puerta ni el viaje completo.
                      </p>
                      <button
                        type="button"
                        className="button button--secondary local-swap__apply"
                        aria-pressed={isLoaded(alternative)}
                        onClick={() => onLoad(alternative.candidateDayPlaceIds)}
                      >
                        Probar esta reversión de cuatro lugares
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {pairBlockSwapAlternatives.length > 0 && (
            <div className="local-swap__group local-pair-block-swap">
              <h5>Intercambios de bloques de dos lugares</h5>
              <ul className="local-swap__list">
                {pairBlockSwapAlternatives.map((alternative) => {
                  const baselineMix = confidenceMixText(alternative.baselineConfidenceCounts);
                  const candidateMix = confidenceMixText(alternative.candidateConfidenceCounts);
                  const [firstPairStart, firstPairEnd] = alternative.firstPairPlaceIds;
                  const [secondPairStart, secondPairEnd] = alternative.secondPairPlaceIds;
                  return (
                    <li
                      key={`${alternative.dayId}:${alternative.windowStartDayIndex}`}
                      className="local-swap__item local-pair-block-swap__item"
                    >
                      <p className="local-swap__badge">Comprobado con datos completos</p>
                      <p className="local-swap__pair local-pair-block-swap__blocks">
                        Intercambiar los bloques de dos lugares{" "}
                        <strong>{nameOf(firstPairStart)}</strong> →{" "}
                        <strong>{nameOf(firstPairEnd)}</strong> y{" "}
                        <strong>{nameOf(secondPairStart)}</strong> →{" "}
                        <strong>{nameOf(secondPairEnd)}</strong> dentro del bloque de{" "}
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
                          <dt>Traslados registrados de este intercambio de bloques</dt>
                          <dd>
                            {formatRange(alternative.candidateTransferMinutes)}
                            {candidateMix && <span className="local-swap__evidence"> · {candidateMix}</span>}
                          </dd>
                        </div>
                      </dl>
                      <p className="local-swap__advantage">
                        Este intercambio de bloques reduce de forma demostrable el rango de traslado
                        local registrado de este bloque. Ventaja mínima entre los rangos registrados:{" "}
                        {formatMinutes(alternative.guaranteedAdvantageMinutes)}.
                      </p>
                      <p className="local-swap__disclaimer">
                        Esta comparación usa únicamente los traslados locales registrados de este bloque.
                        No evalúa horarios, reservas, alojamiento, puerta a puerta ni el viaje completo.
                      </p>
                      <button
                        type="button"
                        className="button button--secondary local-swap__apply"
                        aria-pressed={isLoaded(alternative)}
                        onClick={() => onLoad(alternative.candidateDayPlaceIds)}
                      >
                        Probar este intercambio de bloques
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


export function OrderedSequenceBuilder({
  savedPlaces,
  onClose,
  embedded = false,
  section = "dias",
  onSelectPlace,
  onOpenZones,
  onNavigateSection,
}: Props) {
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
    zoneAccommodationChoices,
    initializeDays,
    movePlaceToPosition,
    addPlaceToDay,
    removePlaceFromDay,
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
    clearZoneAccommodation,
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

  /**
   * Block 4 — the zone decision, projected onto the days that already exist.
   *
   * Both memos are PURE READS. Nothing here writes to the draft, assigns a boundary, creates a leg
   * or produces a duration: `buildZoneDayLinks` reports which hub each day is in (a catalogue fact),
   * which anchor each boundary side was pointed at (the reader's own choice), and the straight-line
   * geometry between the zone's station and the day's places. `placeById` covers the route because
   * every route place is a saved place; a place it cannot resolve is simply left out of the hub
   * agreement rather than guessed at.
   */
  const zoneDayLinks = useMemo(
    () =>
      buildZoneDayLinks(dayEntities, zoneAccommodationChoices, accommodations, {
        resolvePlace: (placeId) => placeById.get(placeId) ?? null,
      }),
    [dayEntities, zoneAccommodationChoices, accommodations, placeById]
  );
  const zoneHubLinks = useMemo(
    () => buildZoneHubLinks(zoneDayLinks, zoneAccommodationChoices, accommodations),
    [zoneDayLinks, zoneAccommodationChoices, accommodations]
  );
  /** Anchor labels for the zone section's boundary lines — the same anchors the per-day selects
   * already offer, named rather than shown as opaque ids. */
  const anchorLabelById = useMemo(
    () => new Map(accommodations.map((anchor) => [anchor.id, anchor.label])),
    [accommodations]
  );

  const routePlaces = useMemo(
    () => routeIds.map((id) => placeById.get(id)).filter((place): place is Place => Boolean(place)),
    [routeIds, placeById]
  );
  const removedPlaces = useMemo(
    () => savedPlaces.filter((place) => !routeIds.includes(place.id)),
    [savedPlaces, routeIds]
  );

  const reservationPreparation = useMemo(
    () => buildReservationPreparationSummary(routePlaces),
    [routePlaces]
  );
  const recordedHours = useMemo(() => buildRecordedHoursSummary(routePlaces), [routePlaces]);

  const dayPlaceLists = useMemo(
    () =>
      dayIds.map((ids) => ids.map((id) => placeById.get(id)).filter((place): place is Place => Boolean(place))),
    [dayIds, placeById]
  );
  const dayAssignment = useMemo(() => buildDayAssignment(routeIds, dayIds), [routeIds, dayIds]);

  // Phase 3F-J: one route-wide aggregation of the Phase 3F facts already derived for this plan.
  // Purely derived on every render from the current plan plus the one reference date captured at
  // planner open — nothing is cached beyond this memo and nothing is persisted, so moving a place,
  // reordering a day, changing the start date or clearing it recomputes the whole list by
  // construction. `dayEntities` supplies the stable day id only where it exists; it is never
  // invented, and `dayPlaceLists` is index-aligned with `dayAssignment.days` by construction.
  const routeWideReservationCalendar = useMemo(
    () =>
      buildRouteWideOfficialReservationCalendar(
        reservationMechanismEvidenceRecords,
        dayPlaceLists.map((places, dayIndex) => ({
          id: dayEntities[dayIndex]?.id ?? null,
          places,
        })),
        dayAssignment,
        startDate,
        reservationReferenceDate
      ),
    [dayPlaceLists, dayEntities, dayAssignment, startDate, reservationReferenceDate]
  );

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

  /** Phase 3E-G transpositions are independently baseline-derived, then grouped without ranking. */
  const interiorTranspositionGeneration = useMemo(
    () =>
      generateEvidenceCompleteInteriorTranspositions(
        { routeIds, days: planningDays, visitStartTimes },
        { resolvePlace: (placeId) => placeById.get(placeId) ?? null }
      ),
    [routeIds, planningDays, visitStartTimes, placeById]
  );
  /**
   * A genuine non-adjacent transposition cannot equal one adjacent swap or one single-place
   * relocation under the current unique-id route model, so this only ever drops a duplicate a
   * future schema change could introduce. It never reorders or ranks what survives.
   */
  const interiorTranspositionsByDayId = useMemo(() => {
    const byDayId = new Map<string, EvidenceCompleteInteriorTranspositionAlternative[]>();
    if (interiorTranspositionGeneration.kind !== "available") return byDayId;
    for (const alternative of interiorTranspositionGeneration.alternatives) {
      const shownOrders = [
        ...(localSwapsByDayId.get(alternative.dayId) ?? []),
        ...(localRelocationsByDayId.get(alternative.dayId) ?? []),
      ];
      const alreadyShown = shownOrders.some(
        (shown) =>
          JSON.stringify(shown.candidateDayPlaceIds) ===
          JSON.stringify(alternative.candidateDayPlaceIds)
      );
      if (alreadyShown) continue;
      const existing = byDayId.get(alternative.dayId);
      if (existing) existing.push(alternative);
      else byDayId.set(alternative.dayId, [alternative]);
    }
    return byDayId;
  }, [interiorTranspositionGeneration, localSwapsByDayId, localRelocationsByDayId]);

  /** Phase 3E-I reversals are independently baseline-derived, then grouped without ranking. */
  const fourPlaceReversalGeneration = useMemo(
    () =>
      generateEvidenceCompleteFourPlaceInteriorReversals(
        { routeIds, days: planningDays, visitStartTimes },
        { resolvePlace: (placeId) => placeById.get(placeId) ?? null }
      ),
    [routeIds, planningDays, visitStartTimes, placeById]
  );
  /**
   * A four-place reversal is not generated by any earlier neighbourhood, so this only ever drops a
   * duplicate a future schema change could introduce. It never reorders or ranks what survives, and
   * it never suppresses an earlier group because a later one has a larger gap.
   */
  const fourPlaceReversalsByDayId = useMemo(() => {
    const byDayId = new Map<string, EvidenceCompleteFourPlaceInteriorReversalAlternative[]>();
    if (fourPlaceReversalGeneration.kind !== "available") return byDayId;
    for (const alternative of fourPlaceReversalGeneration.alternatives) {
      const shownOrders = [
        ...(localSwapsByDayId.get(alternative.dayId) ?? []),
        ...(localRelocationsByDayId.get(alternative.dayId) ?? []),
        ...(interiorTranspositionsByDayId.get(alternative.dayId) ?? []),
      ];
      const alreadyShown = shownOrders.some(
        (shown) =>
          JSON.stringify(shown.candidateDayPlaceIds) ===
          JSON.stringify(alternative.candidateDayPlaceIds)
      );
      if (alreadyShown) continue;
      const existing = byDayId.get(alternative.dayId);
      if (existing) existing.push(alternative);
      else byDayId.set(alternative.dayId, [alternative]);
    }
    return byDayId;
  }, [
    fourPlaceReversalGeneration,
    localSwapsByDayId,
    localRelocationsByDayId,
    interiorTranspositionsByDayId,
  ]);

  /** Phase 3E-K pair-block swaps are independently baseline-derived, then grouped without ranking. */
  const twoPairBlockSwapGeneration = useMemo(
    () =>
      generateEvidenceCompleteTwoPairBlockSwaps(
        { routeIds, days: planningDays, visitStartTimes },
        { resolvePlace: (placeId) => placeById.get(placeId) ?? null }
      ),
    [routeIds, planningDays, visitStartTimes, placeById]
  );
  /**
   * An exact 2+2 block swap is not generated by any earlier neighbourhood, so this only ever drops
   * a duplicate a future schema change could introduce. It never reorders or ranks what survives,
   * and it never suppresses an earlier group because this one has a larger gap: ownership runs
   * C → E → G → I → K in that fixed order.
   */
  const twoPairBlockSwapsByDayId = useMemo(() => {
    const byDayId = new Map<string, EvidenceCompleteTwoPairBlockSwapAlternative[]>();
    if (twoPairBlockSwapGeneration.kind !== "available") return byDayId;
    for (const alternative of twoPairBlockSwapGeneration.alternatives) {
      const shownOrders = [
        ...(localSwapsByDayId.get(alternative.dayId) ?? []),
        ...(localRelocationsByDayId.get(alternative.dayId) ?? []),
        ...(interiorTranspositionsByDayId.get(alternative.dayId) ?? []),
        ...(fourPlaceReversalsByDayId.get(alternative.dayId) ?? []),
      ];
      const alreadyShown = shownOrders.some(
        (shown) =>
          JSON.stringify(shown.candidateDayPlaceIds) ===
          JSON.stringify(alternative.candidateDayPlaceIds)
      );
      if (alreadyShown) continue;
      const existing = byDayId.get(alternative.dayId);
      if (existing) existing.push(alternative);
      else byDayId.set(alternative.dayId, [alternative]);
    }
    return byDayId;
  }, [
    twoPairBlockSwapGeneration,
    localSwapsByDayId,
    localRelocationsByDayId,
    interiorTranspositionsByDayId,
    fourPlaceReversalsByDayId,
  ]);

  // ---------------------------------------------------------------------------------------
  // B27 (B9.1) — the day-first surface. Everything below is a projection of the state above plus
  // the existing identity-aware mutations; nothing new is stored and no mutation is invented.
  // ---------------------------------------------------------------------------------------

  const interHubRows = useMemo(
    () => buildInterHubBoundaryRows({ routeIds, days, placeById, segments: interHubSegments }),
    [routeIds, days, placeById, interHubSegments]
  );

  const [datesOpen, setDatesOpen] = useState(false);
  const [logisticsOpen, setLogisticsOpen] = useState(false);
  const logisticsRef = useRef<HTMLDetailsElement>(null);
  // `dayIndex/placeIndex === null` = a «Sin asignar» place («Añadir al día…»).
  const [actionsFor, setActionsFor] = useState<{
    placeId: string;
    dayIndex: number | null;
    placeIndex: number | null;
  } | null>(null);
  const [announcement, setAnnouncement] = useState("");
  // A ref, not state: the id to focus once the mutation that removed the old origin has rendered.
  const focusTargetRef = useRef<string | null>(null);
  const setFocusTarget = (id: string | null) => {
    focusTargetRef.current = id;
  };

  // The tab opens on days, never on a flat route: the very first split is the route exactly as it
  // stands (not a recommendation), created once through the existing `initializeDays`. It runs again
  // only when a route change (or a saved-list reconcile) invalidated the split.
  useEffect(() => {
    if (section !== "dias") return;
    if (days === null && routeIds.length > 0) initializeDays([[...routeIds]]);
  }, [section, days, routeIds, initializeDays]);

  // Focus moves to a stable, logical target after a mutation re-rendered its origin away.
  useEffect(() => {
    const id = focusTargetRef.current;
    if (!id) return;
    const target = document.getElementById(id);
    if (!target) return;
    focusTargetRef.current = null;
    target.focus();
  });

  function openStopActions(placeId: string, dayIndex: number | null, placeIndex: number | null) {
    setActionsFor({ placeId, dayIndex, placeIndex });
  }

  function stopDayLabel(dayIndex: number): string {
    const date = startDate ? addCivilDays(startDate, dayIndex) : null;
    return dayHeadline(
      dayIndex + 1,
      date ? formatCivilDateShort(date) : null,
      dayCityLabel(zoneDayLinks[dayIndex]?.hubs ?? [])
    );
  }

  /**
   * The one place every reordering path ends: «Mover a…», «Añadir al día…», the pointer/touch handle
   * and the keyboard-grab mode all call this with an ORIGIN and a TARGET slot (final coordinates,
   * see `lib/stop-reorder.ts`) and it maps them onto the draft mutations — a single pure update per
   * commit, addressed by stable day ids. Nothing here keeps a second copy of the order.
   * Returns whether something was actually committed.
   */
  function commitStopMove(
    placeId: string,
    origin: StopOrigin,
    target: StopSlot,
    focusOn: "handle" | "actions"
  ): boolean {
    // Focus goes back to the control the reader used: the row's actions button after «Mover a…» (B27
    // contract), the row's handle after a drag or a keyboard grab.
    const rowFocus = `stop-${focusOn === "actions" ? "actions" : "handle"}-${placeId}`;
    const place = placeById.get(placeId);
    if (!place || days === null) return false;
    const counts = dayIds.map((ids) => ids.length);
    if (origin.kind === "day" && target.kind === "day") {
      const fromDay = dayEntities[origin.dayIndex];
      const toDay = dayEntities[target.dayIndex];
      if (!fromDay || !toDay || fromDay.placeIds[origin.index] !== placeId) return false;
      movePlaceToPosition(fromDay.id, toDay.id, origin.index, target.index);
      setAnnouncement(`${place.name} movido al ${describeSlot(counts, origin, target)}.`);
      setFocusTarget(rowFocus);
      return true;
    }
    if (origin.kind === "day" && target.kind === "unassigned") {
      removePlaceFromDay(placeId);
      setAnnouncement(`${place.name} quitado del día; ahora está en Sin asignar. Los demás días no cambian.`);
      setFocusTarget("unassigned-title");
      return true;
    }
    if (origin.kind === "unassigned" && target.kind === "day") {
      const toDay = dayEntities[target.dayIndex];
      if (!toDay) return false;
      addPlaceToDay(toDay.id, placeId, target.index);
      setAnnouncement(
        `${place.name} añadido al ${describeSlot(counts, origin, target)}. Los demás días no cambian.`
      );
      setFocusTarget(rowFocus);
      return true;
    }
    return false;
  }

  /** «Mover a…» / «Añadir al día…» — the sheet's day + position feed the same commit as a drop. */
  function applyMove(toDayIndex: number, toPositionIndex: number) {
    if (!actionsFor) return;
    const origin: StopOrigin =
      actionsFor.dayIndex === null || actionsFor.placeIndex === null
        ? { kind: "unassigned" }
        : { kind: "day", dayIndex: actionsFor.dayIndex, index: actionsFor.placeIndex };
    commitStopMove(actionsFor.placeId, origin, { kind: "day", dayIndex: toDayIndex, index: toPositionIndex }, "actions");
    setActionsFor(null);
  }

  function applyRemoveFromRoute() {
    if (!actionsFor || actionsFor.dayIndex === null || actionsFor.placeIndex === null) return;
    commitStopMove(
      actionsFor.placeId,
      { kind: "day", dayIndex: actionsFor.dayIndex, index: actionsFor.placeIndex },
      { kind: "unassigned" },
      "actions"
    );
    setActionsFor(null);
  }

  const reorder = useStopReorder({
    getCounts: () => dayIds.map((ids) => ids.length),
    commit: (placeId, origin, target) => {
      commitStopMove(placeId, origin, target, "handle");
    },
    announce: setAnnouncement,
    dayLabel: (dayIndex) => `Día ${dayIndex + 1}`,
  });
  const dragTarget = reorder.drag?.target ?? null;

  // B29 (B9.3): «Probar otro orden» is a tool LOCAL to one day, addressed by the day's stable id (never
  // its ordinal). The proposal lives inside `DayOrderSheet` and is never persisted; this component
  // only knows which day is open and, on «Usar este orden», writes that one day's order.
  const [dayOrderFor, setDayOrderFor] = useState<string | null>(null);
  const dayOrderIndex = dayOrderFor === null ? -1 : dayEntities.findIndex((day) => day.id === dayOrderFor);
  const dayOrderEntity = dayOrderIndex === -1 ? null : dayEntities[dayOrderIndex];

  function closeDayOrder() {
    if (dayOrderFor !== null) setFocusTarget(`day-order-open-${dayOrderFor}`);
    setDayOrderFor(null);
  }

  /**
   * The ONE write of the tool. It replays the difference through the existing B28
   * `movePlaceToPosition` (same-day, final coordinates) — each call is a functional `setDraft`, batched
   * by React into a single draft and a single storage write, so no intermediate order is ever
   * persisted. Nothing but the order of this day's own stops can change: ids, dates, boundaries,
   * hours, legs, segments, zone choices and every other day travel through untouched.
   */
  function applyDayOrder(proposalIds: readonly string[]) {
    const entity = dayOrderEntity;
    if (!entity) return;
    const moves = planDayOrderMoves(entity.placeIds, proposalIds);
    for (const move of moves) movePlaceToPosition(entity.id, entity.id, move.from, move.to);
    setAnnouncement(
      moves.length > 0
        ? `Nuevo orden del Día ${dayOrderIndex + 1} aplicado. Los demás días no cambian.`
        : `El orden del Día ${dayOrderIndex + 1} no ha cambiado.`
    );
    closeDayOrder();
  }

  function addDay() {
    const nextOrdinal = (days === null ? 0 : dayIds.length) + 1;
    if (days === null) initializeDays([[...routeIds]]);
    else addEmptyDay();
    setAnnouncement(`Día ${nextOrdinal} añadido, vacío.`);
    setFocusTarget(`day-heading-${nextOrdinal - 1}`);
  }

  function deleteDay(dayId: string, dayIndex: number) {
    removeEmptyDay(dayId);
    setAnnouncement(`Día ${dayIndex + 1} eliminado.`);
    setFocusTarget(`day-heading-${Math.max(0, dayIndex - 1)}`);
  }

  function shiftDay(dayId: string, dayIndex: number, direction: -1 | 1) {
    moveDay(dayId, direction);
    setAnnouncement(`Día movido a la posición ${dayIndex + direction + 1}.`);
    const nextIndex = dayIndex + direction;
    const canRepeat = nextIndex + direction >= 0 && nextIndex + direction < dayIds.length;
    setFocusTarget(
      `day-move-${canRepeat ? (direction === -1 ? "up" : "down") : direction === -1 ? "down" : "up"}-${dayId}`
    );
  }

  function openLogistics() {
    setLogisticsOpen(true);
    const node = logisticsRef.current;
    if (node) {
      node.open = true;
      node.querySelector<HTMLElement>("summary")?.focus();
      node.scrollIntoView?.({ block: "nearest" });
    }
  }

  // Same focus-management/backdrop-trap pattern as SelectionAnalysis — only for the legacy floating
  // dialog. The embedded Viaje surface is ordinary page content: it never steals focus on open.
  useEffect(() => {
    if (embedded) return;
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => {
      const active = document.activeElement;
      if (active && active !== document.body) return;
      if (opener && opener.isConnected) opener.focus();
    };
  }, [embedded]);

  useEffect(() => {
    if (embedded) return;
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
  }, [onClose, embedded]);

  const surfaceTitle = section === "reservas" ? "Reservas" : section === "resumen" ? "Resumen" : "Viaje";

  const Outer = embedded ? Fragment : "div";
  const outerProps = embedded ? {} : { className: "analysis-overlay" };
  const tripRange = formatTripRangeShort(startDate, endDate);
  // The neutral range facts (`TripBoundsNotice`) are shown once: inside the dates panel while it is
  // open, and otherwise right under the header as soon as an END date exists — the moment the range
  // (and any mismatch or inversion, which are `role="status"` facts) actually has something to say.
  // With only a start date the notice would merely restate what the header already shows.
  const tripBoundsNotice = <TripBoundsNotice summary={tripBoundsSummary} />;
  const hasReservasContent =
    routeWideReservationCalendar.chronological.length > 0 ||
    reservationPreparation.items.length > 0 ||
    recordedHours.items.length > 0;
  // B31 (DDR-B31-05): one label per day for the compressed band — the hubs of the day's own places
  // (the same `zoneDayLinks` the day headline reads), never invented; an empty day says so.
  const timelineDays: TripTimelineDay[] = dayPlaceLists.map((places, dayIndex) => ({
    ordinal: dayIndex + 1,
    cityLabel: dayCityLabel(zoneDayLinks[dayIndex]?.hubs ?? []),
    isEmpty: places.length === 0,
  }));
  const awaitingFirstSplit = section === "dias" && days === null && routeIds.length > 0;

  return (
    <Outer {...outerProps}>
      {!embedded && (
        <div className="analysis-backdrop" onClick={onClose} role="presentation" aria-hidden="true" />
      )}
      <div
        ref={dialogRef}
        className={`analysis-dialog ${embedded ? "analysis-dialog--embedded" : ""}`.trim()}
        role={embedded ? undefined : "dialog"}
        aria-modal={embedded ? undefined : true}
        aria-labelledby="sequence-builder-title"
      >
        {!embedded && (
          <header className="analysis-header">
            <div>
              <h2 id="sequence-builder-title">{surfaceTitle}</h2>
              <p className="analysis-header__sub">
                {`${routePlaces.length} lugar${routePlaces.length === 1 ? "" : "es"} en ${dayIds.length} día${
                  dayIds.length === 1 ? "" : "s"
                }`}
              </p>
            </div>
            <button
              ref={closeRef}
              type="button"
              className="icon-button"
              onClick={onClose}
              aria-label="Cerrar el constructor de recorrido"
              title="Cerrar el constructor de recorrido"
            >
              <Icon name="cerrar" size={16} />
            </button>
          </header>
        )}

        <div className="analysis-body">
          <p className="visually-hidden" role="status" aria-live="polite" data-day-announcer>
            {announcement}
          </p>
          <p id="reorder-instructions" className="visually-hidden">
            Para reordenar con el teclado: Espacio o Intro coge la parada, flechas arriba y abajo la mueven,
            Espacio o Intro la sueltan y Escape cancela. «Mover a…» permite elegir día y posición sin arrastrar.
          </p>

          {section === "reservas" && (
            <div className="viaje-surface" data-viaje-surface="reservas">
              {embedded && (
                <header className="viaje-surface__header">
                  <h2 id="sequence-builder-title" tabIndex={-1}>
                    Reservas
                  </h2>
                </header>
              )}
              {hasReservasContent && <p className="viaje-surface__note">{RESERVAS_NOTE}</p>}
              <OfficialReservationCalendarSection calendar={routeWideReservationCalendar} />
              <ReservationPreparationSection summary={reservationPreparation} />
              <HoursPlanningSection summary={recordedHours} />
            </div>
          )}

          {section === "resumen" && (
            <div className="viaje-surface" data-viaje-surface="resumen">
              {embedded && (
                <header className="viaje-surface__header">
                  <h2 id="sequence-builder-title" tabIndex={-1}>
                    Resumen
                  </h2>
                </header>
              )}
              {wholeTripComposition.kind === "available" && (
                <>
                  <p className="viaje-surface__note">{RESUMEN_NOTE}</p>
                  <TripTimelineBand days={timelineDays} />
                </>
              )}
              <TripSummaryCards composition={wholeTripComposition} onNavigate={onNavigateSection} />
            </div>
          )}

          {section === "dias" && (
            <div className="dias" data-viaje-surface="dias">
              <header className="dias__header">
                {embedded ? (
                  <h2 id="sequence-builder-title" className="dias__title" tabIndex={-1}>
                    Viaje
                  </h2>
                ) : (
                  <p className="dias__title">Viaje</p>
                )}
                <div className="dias__dates">
                  {tripRange && <p className="dias__range">{tripRange}</p>}
                  <button
                    type="button"
                    className="link-button dias__dates-toggle"
                    aria-expanded={datesOpen}
                    aria-controls="dias-dates-panel"
                    onClick={() => setDatesOpen((value) => !value)}
                  >
                    <Icon name="calendario" size={16} />{" "}
                    {startDate || endDate ? "Cambiar fechas" : "Poner fecha de inicio"}
                  </button>
                </div>
              </header>

              <p className="dias__framing" data-framing-line>
                <EvidenceMark level="nihon" label={false} />{" "}
                <span>Vosotros decidís el orden. Nihon sólo describe lo que ese orden implica.</span>
              </p>

              {datesOpen && (
                <div id="dias-dates-panel" className="dias__dates-panel">
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
                        control above. The two dates are two independent decisions: setting or
                        clearing either one never touches the other, and never creates, deletes,
                        reorders or repairs a day bucket. */}
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
                  <p className="analysis-section__note">
                    La fecha es una decisión vuestra. Nihon solo desplaza el calendario a partir del Día 1;{" "}
                    <strong>no elige ni sugiere qué fecha conviene</strong>, y no comprueba horarios ni cierres.
                  </p>
                  {tripBoundsNotice}
                </div>
              )}

              {!datesOpen && endDate !== null && tripBoundsNotice}

              {!dayAssignment.valid && dayIds.length > 0 && (
                <p className="analysis-disclaimer sequence-day-invalid" role="alert">
                  <Icon name="aviso" size={16} /> El reparto actual no coincide exactamente con el
                  recorrido. Vuelve a los días e inténtalo de nuevo.
                </p>
              )}

              <div className="dias__layout">
                <div className="dias__main">
                  {awaitingFirstSplit ? null : dayIds.length === 0 ? (
                    <p className="sequence-empty dias__empty" data-empty-trip>
                      Todavía no hay paradas. Añade sitios desde «Sin asignar», o guárdalos en Quiero ir.
                    </p>
                  ) : null}

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
                      // written back to the draft, and no existing signal is suppressed or altered by
                      // the verdict; it only adds a warning to the day's presentation.
                      const boundsAssessment = assessTripBounds({ startDate, endDate }, dayIndex);
                      // Phase 3D-S: the day entity at this ordinal position. Its `id` is what every
                      // mutation below is addressed by, and its `accommodationBoundary` is structurally
                      // its own. The id is deliberately invisible to the user: the heading is still
                      // "Día N" from the array position, and the date is still `startDate + dayIndex`.
                      const dayEntity = dayEntities[dayIndex] ?? null;
                      const dayBoundary = dayEntity?.accommodationBoundary ?? null;
                      const dayLink = zoneDayLinks[dayIndex] ?? null;
                      const sleep = daySleepLine(dayBoundary, dayLink, accommodations);
                      const visitText = daySummary.visitTime ? `${formatRange(daySummary.visitTime)} de visitas` : null;
                      const boundaryRow = interHubRows.boundaries.get(dayIndex - 1) ?? null;
                      return (
                        <Fragment key={dayEntity?.id ?? dayIndex}>
                          {boundaryRow && (
                            <InterHubBoundary row={boundaryRow} onEdit={openLogistics} />
                          )}
                          <DayTimeline
                            isDropTarget={dragTarget?.kind === "day" && dragTarget.dayIndex === dayIndex}
                            emptyDropActive={isEmpty && dragTarget?.kind === "day" && dragTarget.dayIndex === dayIndex}
                            headingId={`day-heading-${dayIndex}`}
                            headline={dayHeadline(
                              dayIndex + 1,
                              dayDate ? formatCivilDateShort(dayDate) : null,
                              dayCityLabel(dayLink?.hubs ?? [])
                            )}
                            meta={[visitText, stopCountText(places.length)].filter(Boolean).join(" · ")}
                            headerNote={<TripBoundsDayWarning assessment={boundsAssessment} />}
                            headerActions={
                              <>
                                <button
                                  type="button"
                                  id={dayEntity ? `day-move-up-${dayEntity.id}` : undefined}
                                  className="icon-button icon-button--small"
                                  onClick={() => dayEntity && shiftDay(dayEntity.id, dayIndex, -1)}
                                  disabled={!dayEntity || dayIndex === 0}
                                  aria-label={`Mover Día ${dayIndex + 1} hacia arriba`}
                                  title={`Mover Día ${dayIndex + 1} hacia arriba`}
                                >
                                  <Icon name="arriba" size={16} />
                                </button>
                                <button
                                  type="button"
                                  id={dayEntity ? `day-move-down-${dayEntity.id}` : undefined}
                                  className="icon-button icon-button--small"
                                  onClick={() => dayEntity && shiftDay(dayEntity.id, dayIndex, 1)}
                                  disabled={!dayEntity || dayIndex === dayIds.length - 1}
                                  aria-label={`Mover Día ${dayIndex + 1} hacia abajo`}
                                  title={`Mover Día ${dayIndex + 1} hacia abajo`}
                                >
                                  <Icon name="abajo" size={16} />
                                </button>
                                <button
                                  type="button"
                                  className="icon-button icon-button--small"
                                  onClick={() => dayEntity && deleteDay(dayEntity.id, dayIndex)}
                                  disabled={!isEmpty || dayIds.length <= 1}
                                  aria-label={`Eliminar Día ${dayIndex + 1}`}
                                  title={`Eliminar Día ${dayIndex + 1}`}
                                >
                                  <Icon name="cerrar" size={16} />
                                </button>
                              </>
                            }
                            isEmpty={isEmpty}
                            emptyText="Sin lugares en este día."
                            stops={places.map((place, placeIndex) => {
                              const next = places[placeIndex + 1];
                              // Insertion bar: relative to the OTHER stops of this day (the carried one
                              // is excluded, so the index is the final one the drop would commit).
                              let dropIndicator: "before" | "after" | null = null;
                              if (dragTarget?.kind === "day" && dragTarget.dayIndex === dayIndex) {
                                const others = places.filter((other) => other.id !== reorder.drag?.placeId);
                                if (others[dragTarget.index]?.id === place.id) dropIndicator = "before";
                                else if (dragTarget.index >= others.length && others[others.length - 1]?.id === place.id) {
                                  dropIndicator = "after";
                                }
                              }
                              return (
                                <TripStop
                                  key={place.id}
                                  place={place}
                                  position={placeIndex + 1}
                                  total={places.length}
                                  handleProps={reorder.handleProps(place.id, place.name, {
                                    kind: "day",
                                    dayIndex,
                                    index: placeIndex,
                                  })}
                                  dragging={reorder.drag?.placeId === place.id}
                                  grabbed={reorder.drag?.mode === "keyboard" && reorder.drag.placeId === place.id}
                                  dropIndicator={dropIndicator}
                                  onOpenPlace={(placeId) => onSelectPlace?.(placeId)}
                                  onOpenActions={(placeId) => openStopActions(placeId, dayIndex, placeIndex)}
                                  connector={
                                    next ? (
                                      <TripConnector
                                        leg={bucket?.sequence.legs[placeIndex]}
                                        interHub={
                                          interHubRows.sameDay.get(
                                            interHubPairKey({ fromPlaceId: place.id, toPlaceId: next.id })
                                          ) ?? null
                                        }
                                      />
                                    ) : null
                                  }
                                />
                              );
                            })}
                            tools={
                              places.length >= 2 && dayEntity ? (
                                <button
                                  type="button"
                                  id={`day-order-open-${dayEntity.id}`}
                                  className="button button--secondary day-timeline__tool"
                                  onClick={() => setDayOrderFor(dayEntity.id)}
                                  aria-label={`Probar otro orden en el Día ${dayIndex + 1}`}
                                  aria-haspopup="dialog"
                                >
                                  <Icon name="comparar" size={16} /> Probar otro orden
                                </button>
                              ) : null
                            }
                            details={
                              isEmpty ? null : (
                                <>
                                  <details className="day-tools">
                                    <summary>Horarios, reservas y herramientas del Día {dayIndex + 1}</summary>
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
                                    <OfficialReservationDateNotice
                                      places={places}
                                      dayAssignment={dayAssignment}
                                      startDate={startDate}
                                      dayNumber={dayIndex + 1}
                                      referenceDate={reservationReferenceDate}
                                    />
                                    {bucket && (
                                      <TransferAndVisitTotals visitSummary={daySummary} sequenceSummary={bucket.sequence.summary} />
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
                                  </details>
                                </>
                              )
                            }
                            footer={
                              <>
                                <p className="day-timeline__sleep" data-day-sleep={sleep.kind}>
                                  <Icon name="cama" size={16} />{" "}
                                  {sleep.kind === "chosen" ? `Dormís en ${sleep.zoneOrPlace}` : "Sin alojamiento elegido"}
                                </p>
                                {onOpenZones && (
                                  <button
                                    type="button"
                                    className="link-button day-timeline__sleep-link"
                                    onClick={() => onOpenZones(dayLink?.singleHub ?? null)}
                                    aria-label={`Dónde dormir, desde el Día ${dayIndex + 1}`}
                                  >
                                    Dónde dormir
                                  </button>
                                )}
                              </>
                            }
                          />
                        </Fragment>
                      );
                    })}
                  </div>

                  <div className="dias__actions">
                    <button
                      type="button"
                      className="button button--secondary sequence-add-day"
                      onClick={addDay}
                    >
                      <span aria-hidden="true">＋</span> Añadir día
                    </button>
                  </div>

                  <details
                    ref={logisticsRef}
                    className="dias__logistics"
                    open={logisticsOpen}
                    onToggle={(event) => setLogisticsOpen(event.currentTarget.open)}
                  >
                    <summary>Alojamientos y traslados entre ciudades</summary>
                    <InterHubSegmentsSection
                      routeIds={routeIds}
                      days={days}
                      placeById={placeById}
                      segments={interHubSegments}
                      onAdd={addInterHubSegment}
                      onUpdate={updateInterHubSegment}
                      onRemove={removeInterHubSegment}
                    />
                    <ZonePlanSection
                      choices={zoneAccommodationChoices}
                      dayLinks={zoneDayLinks}
                      hubLinks={zoneHubLinks}
                      anchorLabelById={anchorLabelById}
                      onClear={clearZoneAccommodation}
                    />
                    <AccommodationManagerSection
                      accommodations={accommodations}
                      zoneChoices={zoneAccommodationChoices}
                      onAdd={addAccommodation}
                      onRemove={removeAccommodation}
                    />
                  </details>

                  <button type="button" className="link-button sequence-reset" onClick={resetRoute}>
                    Restablecer recorrido
                  </button>
                </div>

                <UnassignedDrawer
                  places={removedPlaces}
                  onOpenPlace={(placeId) => onSelectPlace?.(placeId)}
                  onAddToDay={(placeId) => openStopActions(placeId, null, null)}
                  handleProps={(placeId, name) => reorder.handleProps(placeId, name, { kind: "unassigned" })}
                  isDropTarget={dragTarget?.kind === "unassigned" && reorder.drag?.origin.kind === "day"}
                  draggingId={reorder.drag?.origin.kind === "unassigned" ? reorder.drag.placeId : null}
                  grabbedId={
                    reorder.drag?.mode === "keyboard" && reorder.drag.origin.kind === "unassigned"
                      ? reorder.drag.placeId
                      : null
                  }
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {actionsFor && placeById.get(actionsFor.placeId) && (
        <StopActionsSheet
          place={placeById.get(actionsFor.placeId) as Place}
          dayIndex={actionsFor.dayIndex}
          placeIndex={actionsFor.placeIndex}
          days={dayIds.map((ids, index) => ({ label: stopDayLabel(index), placeCount: ids.length }))}
          confirmRemoveNote="Las demás paradas y los demás días se quedan como están."
          onMove={applyMove}
          onRemove={applyRemoveFromRoute}
          onClose={() => {
            setFocusTarget(
              actionsFor.dayIndex === null ? `unassigned-add-${actionsFor.placeId}` : `stop-actions-${actionsFor.placeId}`
            );
            setActionsFor(null);
          }}
        />
      )}

      {dayOrderEntity && dayOrderEntity.placeIds.length >= 2 && (
        <DayOrderSheet
          key={dayOrderEntity.id}
          headline={stopDayLabel(dayOrderIndex)}
          dayNumber={dayOrderIndex + 1}
          currentIds={dayOrderEntity.placeIds}
          placeById={placeById}
          renderAlternatives={(proposalIds, load) =>
            localSwapGeneration.kind === "available" &&
            localRelocationGeneration.kind === "available" &&
            interiorTranspositionGeneration.kind === "available" &&
            fourPlaceReversalGeneration.kind === "available" &&
            twoPairBlockSwapGeneration.kind === "available" ? (
              <LocalSwapAlternativesSection
                dayNumber={dayOrderIndex + 1}
                alternatives={localSwapsByDayId.get(dayOrderEntity.id) ?? []}
                relocationAlternatives={localRelocationsByDayId.get(dayOrderEntity.id) ?? []}
                transpositionAlternatives={interiorTranspositionsByDayId.get(dayOrderEntity.id) ?? []}
                reversalAlternatives={fourPlaceReversalsByDayId.get(dayOrderEntity.id) ?? []}
                pairBlockSwapAlternatives={twoPairBlockSwapsByDayId.get(dayOrderEntity.id) ?? []}
                placeById={placeById}
                proposalIds={proposalIds}
                onLoad={load}
              />
            ) : null
          }
          onApply={applyDayOrder}
          onClose={closeDayOrder}
        />
      )}

      {reorder.drag?.mode === "pointer" && (
        <StopDragGhost
          name={reorder.drag.name}
          x={reorder.drag.x}
          y={reorder.drag.y}
          where={
            dragTarget
              ? describeSlot(
                  dayIds.map((ids) => ids.length),
                  reorder.drag.origin,
                  dragTarget,
                  stopDayLabel
                )
              : "Suelta dentro de un día"
          }
        />
      )}
    </Outer>
  );
}
