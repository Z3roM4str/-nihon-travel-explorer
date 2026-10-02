import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { Place } from "../types";
import { formatMinutes, formatRange, resolveDuration } from "../lib/duration";
import { summarizeSelection } from "../lib/selection";
import type { OrderedSequenceLeg, OrderedSequenceSummary } from "../lib/ordered-sequence";
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
import { resolveFinalPosition } from "../lib/sequence-drop-position";
import { describeTransferForUi, transferModeIcon } from "../lib/transfer-display";
import { Icon } from "../icons/Icon";
import { addCivilDays, formatCivilDateDisplay, type CivilWeekday } from "../lib/civil-date";
import { buildDayWeekdaySignal, type DayWeekdaySignal } from "../lib/day-weekday-signal";
import {
  assessTripBounds,
  buildTripBoundsSummary,
  type TripBoundsAssessment,
  type TripBoundsSummary,
} from "../lib/trip-bounds";
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
import { buildZoneDayLinks, buildZoneHubLinks } from "../lib/zone-plan-link";
import {
  findZoneChoiceForAnchor,
  type ZoneAccommodationChoice,
} from "../lib/zone-accommodation-choice";
import { ZonePlanSection } from "./ZonePlanSection";
import { usePlanningDraft } from "../usePlanningDraft";
import { CARD_IMAGE_WIDTH, cardImageUrl, resolvePlaceImages } from "../data/place-images";
import { PhotoPlaceholder } from "./PhotoPlaceholder";
import { EvidenceMark } from "./EvidenceMark";
import { TripReservations } from "./TripReservations";
import { TripTimeline } from "./TripTimeline";
import { buildTripReservationRows } from "../lib/trip-reservation-presentation";
import { DayOrderToolPanel, type DayOrderEvidenceAlternative, type DayOrderEvidenceOption } from "./DayOrderToolPanel";
import { hasSamePlaceOrder, isPlaceOrderPermutation } from "../lib/day-order-tool";

import "./OrderedSequenceBuilder.css";
import "./AnalysisDialog.css";
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
  /** Opens the one shared PlaceDetail in the current Viaje navigation stack. */
  onSelectPlace?: (id: string) => void;
  section?: "dias" | "reservas" | "resumen";
  onSectionChange?: (section: "dias" | "dormir") => void;
};

type DayOrderSession = {
  dayId: string;
  /** Exact persisted order captured when this one-day tool opens. */
  baselineDayPlaceIds: string[];
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
 * The "builder" (single-route) and "compare" (the global A/B comparison, Phase 3C-B) views of earlier phases were
 * unreachable since the days view became the entry surface (B27) and were retired as D5-M1 in the
 * release-hardening pass: B29 replaced the global A/B comparison with the per-day «Probar otro orden»
 * tool (`DayOrderToolPanel`, same `sequence-comparison.ts` rules, no A/B and no score). Their candidates were
 * never persisted, so no stored state depended on them. `docs/D5_M1_UNREACHABLE_VIEWS_RETIREMENT.md` has the proof.
 *
 * The days view lives **inside this same dialog** — one focus trap, one Escape-closes-everything behaviour,
 * no stacked dialogs. Composition is fixed there: day buckets can only reorder or move between the fixed
 * set — see `day-assignment.ts` for the guarantees that rest on that.
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
 * rendered route-wide rather than inside a day card: the underlying signal
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
 * Phase 3D-E's route-wide "Horarios registrados" section rendered in the retired route view and was removed with
 * it (D5-M1), together with its now-unused aggregation `lib/hours-planning.ts`; `../lib/recorded-hours.ts` stays (it feeds the day views).
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
    /* Bloque 17 (B1): sin icono "?" — una ausencia conocida no es un error
       (04 §14 "Sin traslado registrado: … nunca en rojo y nunca con ?"). */
    return (
      <p className="sequence-leg sequence-leg--unknown">Sin traslado registrado</p>
    );
  }
  const display = describeTransferForUi(leg.transfer);
  return (
    <p className="sequence-leg">
      <Icon name={transferModeIcon(leg.transfer.mode)} size={16} /> {display.timeText} ·{" "}
      {display.qualityLabel}
    </p>
  );
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

/** B9.1: a stop is a place-specific, keyboard-operable unit; the day, not a flat route, owns it. */
function TripStop({
  place,
  position,
  dayIndex,
  dayEntities,
  dayPlaceLists,
  onOpen,
  onMove,
  onUnassign,
  onDragStart,
  dragging,
  dragEnabled,
}: {
  place: Place;
  position: number;
  dayIndex: number;
  dayEntities: readonly { id: string }[];
  dayPlaceLists: readonly Place[][];
  onOpen?: (id: string) => void;
  onMove: (targetDayIndex: number, targetPosition: number) => void;
  onUnassign: () => void;
  onDragStart: (event: ReactPointerEvent<HTMLButtonElement>, placeId: string, dayId: string) => void;
  dragging: boolean;
  dragEnabled: boolean;
}) {
  const [moveOpen, setMoveOpen] = useState(false);
  const [targetDay, setTargetDay] = useState(dayIndex);
  const [targetPosition, setTargetPosition] = useState(position);
  const image = resolvePlaceImages(place.id, place.images)[0];
  const src = image ? cardImageUrl(image.url) ?? image.url : null;
  const range = resolveDuration(place.duration);
  const maxPosition = dayPlaceLists[targetDay]?.length ?? 0;

  return (
    <article className={`trip-stop${dragging ? " trip-stop--dragging" : ""}`} aria-label={`Parada ${position + 1}: ${place.name}`}>
      <span className="trip-stop__position" aria-hidden="true">{position + 1}</span>
      <div className="trip-stop__media">
        {src && image ? (
          <img src={src} width={CARD_IMAGE_WIDTH} height={CARD_IMAGE_WIDTH} loading="lazy" alt={image.alt} />
        ) : (
          <PhotoPlaceholder place={place} />
        )}
      </div>
      <div className="trip-stop__body">
        <button type="button" className="trip-stop__handle" data-drag-place-id={place.id}
          aria-label={`Arrastrar ${place.name}`} title={`Arrastrar ${place.name}`} disabled={!dragEnabled} onPointerDown={(event) => onDragStart(event, place.id, dayEntities[dayIndex].id)}>
          <Icon name="arrastrar" size={20} />
        </button>
        <button type="button" className="trip-stop__open" onClick={() => onOpen?.(place.id)}>
          <strong>{place.name}</strong>
          <span>{place.neighborhood || place.municipality} · {range ? formatRange(range) : place.duration.raw}</span>
        </button>
        <button
          type="button"
          className="button button--secondary trip-stop__move"
          aria-expanded={moveOpen}
          onClick={() => setMoveOpen((open) => !open)}
        >
          Mover a…
        </button>
        {moveOpen && (
          <div className="trip-stop__move-panel">
            <label>
              Día
              <select value={targetDay} onChange={(event) => { setTargetDay(Number(event.target.value)); setTargetPosition(0); }}>
                {dayEntities.map((day, index) => <option key={day.id} value={index}>Día {index + 1}</option>)}
              </select>
            </label>
            <label>
              Posición
              <select value={Math.min(targetPosition, maxPosition)} onChange={(event) => setTargetPosition(Number(event.target.value))}>
                {Array.from({ length: Math.max(1, maxPosition + (targetDay === dayIndex ? 0 : 1)) }, (_, index) => (
                  <option key={index} value={index}>{index + 1}</option>
                ))}
              </select>
            </label>
            <button type="button" className="button button--primary" onClick={() => { onMove(targetDay, targetPosition); setMoveOpen(false); }}>
              Mover parada
            </button>
          </div>
        )}
        <button type="button" className="link-button trip-stop__unassign" onClick={onUnassign}>
          Mover a Sin asignar
        </button>
      </div>
    </article>
  );
}

function DayTimeline({
  places,
  legs,
  dayIndex,
  dayEntities,
  dayPlaceLists,
  onOpen,
  onMove,
  onUnassign,
  onDragStart,
  dragPlaceId,
  dropSlot,
  dragEnabled,
}: {
  places: Place[];
  legs: OrderedSequenceLeg[];
  dayIndex: number;
  dayEntities: readonly { id: string }[];
  dayPlaceLists: readonly Place[][];
  onOpen?: (id: string) => void;
  onMove: (placeIndex: number, targetDayIndex: number, targetPosition: number) => void;
  onUnassign: (placeIndex: number) => void;
  onDragStart: (event: ReactPointerEvent<HTMLButtonElement>, placeId: string, dayId: string) => void;
  dragPlaceId: string | null;
  dropSlot: number | null;
  dragEnabled: boolean;
}) {
  return (
    <ol className="day-timeline" aria-label={`Paradas del Día ${dayIndex + 1}`}>
      {dropSlot === 0 && <li className="day-timeline__drop-indicator" aria-label="Insertar antes de la primera parada" />}
      {places.map((place, index) => (
        <li key={place.id} className="day-timeline__item">
          <TripStop place={place} position={index} dayIndex={dayIndex} dayEntities={dayEntities}
            dayPlaceLists={dayPlaceLists} onOpen={onOpen}
            onDragStart={onDragStart} dragging={dragPlaceId === place.id}
            dragEnabled={dragEnabled}
            onMove={(targetDay, targetPosition) => onMove(index, targetDay, targetPosition)}
            onUnassign={() => onUnassign(index)} />
          {index < legs.length && <LegConnector leg={legs[index]} />}
          {dropSlot === index + 1 && <div className="day-timeline__drop-indicator" aria-label={`Insertar en posición ${index + 2}`} />}
        </li>
      ))}
    </ol>
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
            {complete ? "traslados totales" : "traslados conocidos"} · {knownLegCount}
            {complete ? "" : ` de ${legCount}`} conexi{legCount === 1 ? "ón" : "ones"} con tiempo registrado
          </span>
        </div>
      )}
      {unknownLegCount > 0 && (
        <div className="analysis-total">
          <span className="analysis-total__value">{unknownLegCount}</span>
          <span className="analysis-total__label">
            conexi{unknownLegCount === 1 ? "ón" : "ones"} sin tiempo registrado
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
            <p className="recorded-interval-fit__raw"><EvidenceMark level="registrado" /> «{hours.raw}»</p>
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

/** B31 retains the existing editorial date derivation and reference relation. February–March
 * confidence and recorded literals now live once per row in TripReservations, beside this
 * window and the separate official mechanism surface. Neither evidence domain overrides the other.
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
    relation: ReservationWindowReferenceRelation | null;
  };

  const items: DeadlineItem[] = [];
  for (const place of places) {
    const visitDate = deriveVisitDateForPlace(dayAssignment, startDate, place.id);
    const window = derivePlaceReservationDateWindow(place, visitDate);
    if (window.kind !== "derived-window") continue;
    const relation = referenceDate ? evaluateReservationWindowReference(window, referenceDate) : null;
    items.push({
      place,
      window,
      relation,
    });
  }

  if (items.length === 0) return null;

  return (
    <section className="reservation-deadline" aria-label="Ventana de anticipación registrada">
      {items.map(({ place, window, relation }) => (
        <div key={place.id} className="reservation-deadline__item">
          <span className="reservation-deadline__name">{place.name}</span>
          <span className="reservation-deadline__window">
            <EvidenceMark level="estimado" />
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
          <span className="reservation-deadline__raw"><EvidenceMark level="registrado" /> «{window.signal.raw}»</span>
        </div>
      ))}

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
            <p className="official-reservation-date__fact-heading"><EvidenceMark level="estimado" /> {presentation.heading}</p>
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

    </section>
  );
}

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
      <h3 id="official-reservation-calendar-heading">Fechas oficiales de reserva del viaje</h3>
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
              <EvidenceMark level="estimado" />
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
            <p className="official-reservation-calendar__provenance">{item.presentation.provenanceText}</p>
            <a
              className="official-reservation-calendar__source"
              href={item.presentation.sourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              Ver fuente oficial
            </a>
          </li>
        ))}
      </ul>
      <p className="official-reservation-calendar__disclaimer">
        Estas fechas provienen del registro oficial de cada lugar y están calculadas sobre la fecha de
        visita planificada.{" "}
        <strong>
          El orden cronológico solo ordena fechas de calendario: no indica prioridad, urgencia ni en
          qué orden conviene reservar.
        </strong>{" "}
        No indica disponibilidad ni el estado actual de la venta. Cuando se muestra una relación con
        la fecha de referencia, compara únicamente fechas de calendario: no considera la hora
        registrada ni la zona horaria de la fuente, y esa fecha se toma del calendario local de tu
        dispositivo al abrir este plan sin actualizarse sola.{" "}
        <strong>
          Esta información oficial se muestra por separado de la anticipación editorial registrada;
          Nihon no combina ambas fuentes.
        </strong>
      </p>
    </section>
  );
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
      return "en el viaje actual";
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
      return "Uno de los puntos ya no forma parte del viaje actual.";
    case "from-hub-mismatch":
    case "to-hub-mismatch":
      return "La ciudad o región actual de uno de los puntos ya no coincide con la registrada.";
    case "same-current-hub":
      return "Los dos puntos pertenecen actualmente a la misma ciudad o región.";
    case "not-consecutive-in-route":
      return "Estos lugares ya no son consecutivos en el viaje actual.";
    case "not-consecutive-in-day":
      return "Estos lugares ya no son consecutivos dentro del mismo día.";
    case "not-boundary-of-consecutive-days":
      return "Estos lugares ya no forman un límite entre dos días consecutivos.";
    case "invalid-day-partition":
      return "Este traslado queda inactivo porque el reparto por días no es válido.";
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
        Traslado principal entre estos dos puntos de tu plan; <strong>no es un tiempo puerta a puerta</strong>.
        Las ciudades o regiones corresponden a los lugares elegidos; tú seleccionas el modo y escribes los minutos.
      </p>

      {segments.length === 0 ? (
        <p className="inter-hub-segments__empty">Todavía no has registrado ningún traslado entre ciudades.</p>
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
                    aria-label={`Eliminar traslado ${fromName} a ${toName}`}
                    title={`Eliminar traslado ${fromName} a ${toName}`}
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
                    Duración manual del traslado principal
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
            <option value="">Selecciona dos puntos consecutivos de ciudades o regiones distintas</option>
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
          Duración manual del traslado principal
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
          <span aria-hidden="true">＋</span> Añadir traslado
        </button>
      </div>
      {availablePairs.length === 0 && (
        <p className="inter-hub-segments__hint">
          No hay una pareja consecutiva nueva entre ciudades o regiones distintas en el reparto actual.
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

function wholeTripUnavailableText(reason: Extract<WholeTripComposition, { kind: "unavailable" }>["reason"]): string {
  switch (reason) {
    case "no-day-assignment":
      return "Crea un reparto por días para describir el plan completo sin borrar sus límites.";
    case "invalid-day-partition":
      return "El reparto por días no coincide exactamente con el viaje; no se muestran cálculos parciales.";
    case "unresolved-route-place":
      return "Un lugar del viaje no se puede resolver; no se muestran cálculos parciales.";
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
function WholeTripCompositionSection({ composition, onSectionChange }: { composition: WholeTripComposition; onSectionChange?: Props["onSectionChange"] }) {
  if (composition.kind === "unavailable") {
    return (
      <section className="whole-trip-composition" aria-label="Resumen del plan completo">
        <h3 className="visually-hidden">Resumen del plan completo</h3>
        <p className="whole-trip-composition__unavailable">{wholeTripUnavailableText(composition.reason)}</p>
        {(["Visitas", "Traslados registrados", "Alojamiento", "Rango del viaje"] as const).map((title) => <div className="whole-trip-composition__group" key={title}>
          <h4>{title}</h4><EvidenceMark level="estimado" />
          <p>Sin datos para describir el plan completo.</p>
          <button type="button" className="link-button" onClick={() => onSectionChange?.(title === "Alojamiento" ? "dormir" : "dias")}>{title === "Alojamiento" ? "Ver Dónde dormir" : "Ver Días"}</button>
        </div>)}
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
      <h3 className="visually-hidden">Resumen del plan completo</h3>

      <div className="whole-trip-composition__group">
        <h4>Visitas</h4>
        <EvidenceMark level="estimado" />
        <button type="button" className="link-button" onClick={() => onSectionChange?.("dias")}>Ver visitas en Días</button>
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
          <p className="whole-trip-composition__incomplete">Hay visitas sin duración numérica.</p>
        )}
      </div>

      <div className="whole-trip-composition__group">
        <h4>Traslados registrados</h4>
        <EvidenceMark level="estimado" />
        <button type="button" className="link-button" onClick={() => onSectionChange?.("dias")}>Ver traslados en Días</button>
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
        <p>Conexiones entre lugares: {composition.movement.modeledAdjacencyCount}.</p>
        {missingMovementCount > 0 ? (
          <p className="whole-trip-composition__incomplete">
            Sin traslado registrado: faltan {composition.movement.localMissingCount} traslado(s) local(es) y {composition.movement.interHubMissingCount} traslado(s) entre ciudades.
          </p>
        ) : composition.movement.adjacencyCoverageComplete && composition.movement.modeledAdjacencyCount > 0 ? (
          <p>Todas las conexiones entre lugares incluidas tienen tiempo registrado.</p>
        ) : (
          <p>No hay conexiones entre lugares en estos días.</p>
        )}
      </div>

      <div className="whole-trip-composition__group">
        <h4>Alojamiento</h4>
        <EvidenceMark level="estimado" />
        <button type="button" className="link-button" onClick={() => onSectionChange?.("dormir")}>Ver Dónde dormir</button>
        <p>
          Minutos manuales registrados: {composition.accommodation.registeredMinutes === null
            ? "ninguno"
            : formatMinutes(composition.accommodation.registeredMinutes)}.
        </p>
        <p>
          Traslados manuales: {composition.accommodation.manualLegCount}; faltantes: {composition.accommodation.manualLegMissingCount}; sin seleccionar: {composition.accommodation.boundaryUnselectedCount}.
        </p>
        <p>
          Sin alojamiento explícito: {composition.accommodation.explicitNoAccommodationCount}; límites de días vacíos no aplicables: {composition.accommodation.emptyDayNotApplicableCount}.
        </p>
      </div>

      <div className="whole-trip-composition__group">
        <h4>Rango del viaje</h4>
        <EvidenceMark level="estimado" />
        <button type="button" className="link-button" onClick={() => onSectionChange?.("dias")}>Ver fechas en Días</button>
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

export function OrderedSequenceBuilder({ savedPlaces, onClose, embedded = false, onSelectPlace, section = "dias", onSectionChange }: Props) {
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
    addPlaceToDay,
    relocatePlace,
    insertUnassignedPlace,
    removePlaceFromDay,
    addEmptyDay,
    removeEmptyDay,
    moveDay,
    applyDayPlaceOrder,
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

  const [dayOrderSession, setDayOrderSession] = useState<DayOrderSession | null>(null);
  const dayOrderTriggerRefs = useRef(new Map<string, HTMLButtonElement>());

  // B9.1 promotes the existing persisted day structure to the entry surface. The same explicit
  // first split formerly performed by “Distribuir por días” is now made when no split exists.
  useEffect(() => {
    if (days === null) initializeDays([[...routeIds]]);
  }, [days, initializeDays, routeIds]);

  const routePlaces = useMemo(
    () => routeIds.map((id) => placeById.get(id)).filter((place): place is Place => Boolean(place)),
    [routeIds, placeById]
  );
  const removedPlaces = useMemo(
    () => savedPlaces.filter((place) => !routeIds.includes(place.id)),
    [savedPlaces, routeIds]
  );

  const dayPlaceLists = useMemo(
    () =>
      dayIds.map((ids) => ids.map((id) => placeById.get(id)).filter((place): place is Place => Boolean(place))),
    [dayIds, placeById]
  );
  type DragPayload = { pointerId: number; placeId: string; fromDayId: string | null; x: number; y: number; active: boolean; days: typeof planningDays };
  type DropTarget = { dayId: string; position: number };
  type ScrollSchedule = { kind: "frame"; id: number };
  const dragRef = useRef<DragPayload | null>(null);
  const dropRef = useRef<DropTarget | null>(null);
  const scrollScheduleRef = useRef<ScrollSchedule | null>(null);
  const lastReducedScrollAtRef = useRef(0);
  const pointerRef = useRef({ x: 0, y: 0 });
  const [dragPlaceId, setDragPlaceId] = useState<string | null>(null);
  const [dragPointer, setDragPointer] = useState({ x: 0, y: 0 });
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [dragAnnouncement, setDragAnnouncement] = useState("");

  function stopAutoScroll() {
    const schedule = scrollScheduleRef.current;
    if (schedule?.kind === "frame") cancelAnimationFrame(schedule.id);
    scrollScheduleRef.current = null;
  }

  function scheduleAutoScrollFrame() {
    if (scrollScheduleRef.current !== null) return;
    scrollScheduleRef.current = {
      kind: "frame",
      id: requestAnimationFrame((timestamp) => {
        scrollScheduleRef.current = null;
        scrollNearEdge(timestamp);
      }),
    };
  }

  function cancelDrag(announce = true) {
    const hadActiveDrag = dragRef.current?.active;
    dragRef.current = null;
    dropRef.current = null;
    stopAutoScroll();
    setDragPlaceId(null);
    setDropTarget(null);
    if (announce && hadActiveDrag) setDragAnnouncement("Movimiento cancelado.");
  }

  function hitTest(x: number, y: number) {
    const card = document.elementFromPoint(x, y)?.closest<HTMLElement>(".day-card[data-day-id]");
    const dayId = card?.dataset.dayId;
    if (!card || !dayId || !planningDays?.some((day) => day.id === dayId)) {
      dropRef.current = null;
      setDropTarget(null);
      return;
    }
    const stops = [...card.querySelectorAll<HTMLElement>(".day-timeline__item .trip-stop")];
    const slot = stops.findIndex((stop) => y < stop.getBoundingClientRect().top + stop.getBoundingClientRect().height / 2);
    const drag = dragRef.current;
    if (!drag) return;
    const sourceIndex = drag.fromDayId
      ? drag.days?.find((day) => day.id === drag.fromDayId)?.placeIds.indexOf(drag.placeId) ?? -1
      : -1;
    const target = {
      dayId,
      position: resolveFinalPosition(drag.fromDayId, dayId, sourceIndex, slot < 0 ? stops.length : slot),
    };
    if (dropRef.current?.dayId !== target.dayId || dropRef.current.position !== target.position) {
      dropRef.current = target;
      setDropTarget(target);
      const dayIndex = planningDays.findIndex((day) => day.id === dayId);
      setDragAnnouncement(`Día ${dayIndex + 1}, posición ${target.position + 1}.`);
    }
  }

  function scrollNearEdge(timestamp?: number) {
    if (timestamp === undefined) { scheduleAutoScrollFrame(); return; }
    if (!dragRef.current?.active) { stopAutoScroll(); return; }
    const body = dialogRef.current?.querySelector<HTMLElement>(".analysis-body");
    const panel = dialogRef.current?.closest<HTMLElement>(".destination-panel--scroll");
    const scroller = body && body.scrollHeight > body.clientHeight + 1
      ? body : panel && panel.scrollHeight > panel.clientHeight + 1 ? panel : null;
    if (!scroller) { stopAutoScroll(); return; }
    const rect = scroller.getBoundingClientRect();
    const { x, y } = pointerRef.current;
    const edge = 72;
    const direction = y < rect.top + edge ? -1 : y > rect.bottom - edge ? 1 : 0;
    if (direction && y >= rect.top - 24 && y <= rect.bottom + 24) {
      const reducedMotion = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const step = reducedMotion ? 64 : 12;
      const before = scroller.scrollTop;
      if (!reducedMotion || timestamp - lastReducedScrollAtRef.current >= 160) {
        scroller.scrollTop += direction * step;
        if (scroller.scrollTop === before) { stopAutoScroll(); return; }
        if (reducedMotion) lastReducedScrollAtRef.current = timestamp;
        hitTest(x, y);
      }
      const atEdge = direction < 0 ? scroller.scrollTop <= 0 : scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1;
      if (atEdge) { stopAutoScroll(); return; }
      scheduleAutoScrollFrame();
    } else stopAutoScroll();
  }

  function startDrag(event: ReactPointerEvent<HTMLButtonElement>, placeId: string, fromDayId: string | null) {
    if (dayOrderSession || event.button !== 0 || !placeById.has(placeId) || dragRef.current) return;
    if (fromDayId ? !planningDays?.some((day) => day.id === fromDayId && day.placeIds.includes(placeId)) : routeIds.includes(placeId)) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, placeId, fromDayId, x: event.clientX, y: event.clientY, active: false, days: planningDays };
    lastReducedScrollAtRef.current = Number.NEGATIVE_INFINITY;
    pointerRef.current = { x: event.clientX, y: event.clientY };
    setDragPointer({ x: event.clientX, y: event.clientY });
  }

  function moveDrag(event: ReactPointerEvent) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    pointerRef.current = { x: event.clientX, y: event.clientY };
    setDragPointer(pointerRef.current);
    if (!drag.active && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 6) return;
    if (!drag.active) {
      drag.active = true;
      setDragPlaceId(drag.placeId);
      setDragAnnouncement(`Moviendo ${placeById.get(drag.placeId)?.name ?? "parada"}.`);
    }
    event.preventDefault();
    hitTest(event.clientX, event.clientY);
    if (scrollScheduleRef.current === null) scrollNearEdge();
  }

  function finishDrag(event: ReactPointerEvent) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const target = dropRef.current;
    const validSource = drag.days === planningDays && (drag.fromDayId
      ? planningDays?.some((day) => day.id === drag.fromDayId && day.placeIds.includes(drag.placeId))
      : !routeIds.includes(drag.placeId) && placeById.has(drag.placeId));
    const destination = planningDays?.find((day) => day.id === target?.dayId);
    const valid = drag.active && validSource && target && destination && target.position >= 0 && target.position <= destination.placeIds.length;
    cancelDrag(false);
    if (!valid || !target) { if (drag.active) setDragAnnouncement("Movimiento cancelado."); return; }
    if (drag.fromDayId) {
      const sourceIndex = planningDays?.find((day) => day.id === drag.fromDayId)?.placeIds.indexOf(drag.placeId) ?? -1;
      if (sourceIndex < 0) return;
      relocatePlace(drag.fromDayId, target.dayId, drag.placeId, target.position);
    } else insertUnassignedPlace(drag.placeId, target.dayId, target.position);
    setDragAnnouncement(`Parada movida al Día ${planningDays!.findIndex((day) => day.id === target.dayId) + 1}, posición ${target.position + 1}.`);
    requestAnimationFrame(() => {
      const handle = [...document.querySelectorAll<HTMLButtonElement>("[data-drag-place-id]")]
        .find((element) => element.dataset.dragPlaceId === drag.placeId);
      handle?.focus({ preventScroll: true });
    });
  }

  useEffect(() => {
    if (dragRef.current && dragRef.current.days !== planningDays) cancelDrag();
  }, [planningDays]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape" && dragRef.current) { event.preventDefault(); cancelDrag(); } };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); stopAutoScroll(); };
  }, []);
  const dayAssignment = useMemo(() => buildDayAssignment(routeIds, dayIds), [routeIds, dayIds]);
  const interHubRowsByAfterDay = useMemo(() => {
    const rows = new Map<number, ManualInterHubSegment>();
    const resolvePlace = (placeId: string) => {
      const place = placeById.get(placeId);
      return place ? { hub: place.hub } : null;
    };
    for (const segment of interHubSegments) {
      const assessment = assessInterHubSegment(segment, { routeIds, days, resolvePlace });
      if (
        assessment.kind === "active" &&
        assessment.placement === "between-consecutive-days" &&
        assessment.fromDayOrdinal !== null
      ) rows.set(assessment.fromDayOrdinal, segment);
    }
    return rows;
  }, [interHubSegments, routeIds, days, placeById]);

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

  function openDayOrderTool(dayId: string, placeIds: readonly string[]) {
    if (placeIds.length < 2) return;
    setDayOrderSession({ dayId, baselineDayPlaceIds: [...placeIds] });
  }

  const closeDayOrderTool = useCallback(() => {
    const dayId = dayOrderSession?.dayId;
    setDayOrderSession(null);
    if (dayId) dayOrderTriggerRefs.current.get(dayId)?.focus({ preventScroll: true });
  }, [dayOrderSession]);

  function applyDayOrderProposal(proposalIds: readonly string[]) {
    if (!dayOrderSession) return;
    const currentDay = planningDays?.find((day) => day.id === dayOrderSession.dayId);
    if (
      !currentDay ||
      !hasSamePlaceOrder(currentDay.placeIds, dayOrderSession.baselineDayPlaceIds) ||
      !isPlaceOrderPermutation(dayOrderSession.baselineDayPlaceIds, proposalIds) ||
      hasSamePlaceOrder(dayOrderSession.baselineDayPlaceIds, proposalIds) ||
      proposalIds.some((placeId) => !routeIds.includes(placeId))
    ) return;

    applyDayPlaceOrder(dayOrderSession.dayId, dayOrderSession.baselineDayPlaceIds, proposalIds);
    closeDayOrderTool();
  }

  // The tool is an inline, non-modal panel. Capture Escape at window level so the legacy
  // containing Viaje overlay never receives the same key and closes with it.
  useEffect(() => {
    if (!dayOrderSession) return;
    const onLocalEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      closeDayOrderTool();
    };
    window.addEventListener("keydown", onLocalEscape, true);
    return () => window.removeEventListener("keydown", onLocalEscape, true);
  }, [dayOrderSession, closeDayOrderTool]);

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

  const headerTitle = "Viaje";
  const headerSub = startDate
    ? endDate
      ? `${formatCivilDateDisplay(startDate)} – ${formatCivilDateDisplay(endDate)}`
      : `Desde ${formatCivilDateDisplay(startDate)}`
    : "Organiza el viaje día a día";

  const Outer = embedded ? Fragment : "div";
  const outerProps = embedded ? {} : { className: "analysis-overlay" };

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
        aria-labelledby={section === "reservas" ? "trip-reservations-title" : section === "resumen" ? "trip-summary-title" : "sequence-builder-title"}
        onPointerMove={moveDrag}
        onPointerUp={finishDrag}
        onPointerCancel={() => cancelDrag()}
        onLostPointerCapture={() => { if (dragRef.current) cancelDrag(); }}
      >
        {dragPlaceId && <div className="trip-stop__drag-preview" style={{ left: Math.max(8, Math.min(dragPointer.x + 12, window.innerWidth - 220)), top: Math.max(8, dragPointer.y - 56) }}>
          Moviendo {placeById.get(dragPlaceId)?.name ?? "parada"}
        </div>}
        <div hidden={section !== "dias"}>
        <header className="analysis-header">
          <div>
            <h2 id="sequence-builder-title">
              {headerTitle}
              {/* B10-A3: el `h1` de la pantalla ya dice «Viaje»; el nombre accesible de la sección es «Viaje · Días» (como «Reservas»/«Resumen»). Lo visible no cambia. */}
              <span className="visually-hidden"> · Días</span>
            </h2>
            <p className="analysis-header__sub">{headerSub}</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label={`Cerrar ${headerTitle}`}
            title={`Cerrar ${headerTitle}`}
          >
            <Icon name="cerrar" size={16} />
          </button>
        </header>

        <div className="analysis-body">
            <>
              <p className="days-framing">
                <EvidenceMark level="nihon" label={false} /> Vosotros decidís el orden. Nihon sólo describe lo que ese orden implica.
              </p>

              {!dayAssignment.valid && (
                <p className="analysis-disclaimer sequence-day-invalid" role="alert">
                  <Icon name="aviso" size={16} /> El reparto actual no coincide exactamente con el
                  viaje. Vuelve a los días e inténtalo de nuevo.
                </p>
              )}

              <div className="calendar-anchor">
                <label htmlFor="sequence-start-date" className="calendar-anchor__label">
                  {startDate ? "Fecha de inicio (Día 1)" : "Poner fecha de inicio"}
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

              <details className="days-tools">
                <summary>Herramientas y datos del viaje</summary>
                <TripBoundsNotice summary={tripBoundsSummary} />
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

              <div className="day-list">
                <span className="visually-hidden" role="status" aria-live="polite">{dragAnnouncement}</span>
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
                  const hubs = [...new Set(places.map((place) => place.hub))];
                  const hubLabel = hubs.length === 1 ? hubs[0] : hubs.length > 1 ? "Varias ciudades" : null;
                  const sleepingChoice = dayBoundary?.end;
                  const sleepingLabel = sleepingChoice?.kind === "accommodation"
                    ? accommodations.find((anchor) => anchor.id === sleepingChoice.accommodationId)?.label ?? null
                    : null;
                  const interHubRow = interHubRowsByAfterDay.get(dayIndex);
                  const dayOrderPanelId = `day-order-tool-${dayIndex}`;
                  const dayOrderIsOpen = dayOrderSession?.dayId === dayEntity?.id;
                  const dayOrderOptions: DayOrderEvidenceOption[] = [];
                  const nameOfDayOption = (placeId: string) => placeById.get(placeId)?.name ?? "lugar";
                  function appendDayOptions<T extends DayOrderEvidenceAlternative>(
                    family: string,
                    alternatives: readonly T[],
                    describe: (alternative: T) => string
                  ) {
                    alternatives.forEach((alternative) => dayOrderOptions.push({
                      id: `${family}:${JSON.stringify(alternative.candidateDayPlaceIds)}`,
                      family,
                      description: describe(alternative),
                      alternative,
                    }));
                  }
                  if (dayOrderIsOpen && dayEntity) {
                    appendDayOptions(
                      "Intercambios adyacentes",
                      localSwapsByDayId.get(dayEntity.id) ?? [],
                      (alternative) => `Intercambiar ${nameOfDayOption(alternative.leftPlaceId)} y ${nameOfDayOption(alternative.rightPlaceId)}`
                    );
                    appendDayOptions(
                      "Reubicaciones de un lugar",
                      localRelocationsByDayId.get(dayEntity.id) ?? [],
                      (alternative) => `Mover ${nameOfDayOption(alternative.movedPlaceId)} a la posición ${alternative.toDayIndex + 1}`
                    );
                    appendDayOptions(
                      "Intercambios no adyacentes",
                      interiorTranspositionsByDayId.get(dayEntity.id) ?? [],
                      (alternative) => `Intercambiar ${nameOfDayOption(alternative.leftPlaceId)} y ${nameOfDayOption(alternative.rightPlaceId)}`
                    );
                    appendDayOptions(
                      "Reversiones de cuatro lugares",
                      fourPlaceReversalsByDayId.get(dayEntity.id) ?? [],
                      (alternative) => `Invertir ${alternative.originalWindowPlaceIds.map(nameOfDayOption).join(", ")}`
                    );
                    appendDayOptions(
                      "Intercambios de bloques de dos lugares",
                      twoPairBlockSwapsByDayId.get(dayEntity.id) ?? [],
                      (alternative) => `Intercambiar el par ${alternative.firstPairPlaceIds.map(nameOfDayOption).join(" → ")} y el par ${alternative.secondPairPlaceIds.map(nameOfDayOption).join(" → ")}`
                    );
                  }
                  return (
                    <Fragment key={dayEntity?.id ?? dayIndex}>
                    <section className={`day-card${dropTarget?.dayId === dayEntity?.id ? " day-card--drop-target" : ""}`} data-day-id={dayEntity?.id} aria-labelledby={`day-heading-${dayIndex}`}>
                      <div className="day-card__header">
                        <div>
                          <h3 id={`day-heading-${dayIndex}`}>Día {dayIndex + 1}{dayDate ? ` · ${formatCivilDateDisplay(dayDate)}` : ""}{hubLabel ? ` · ${hubLabel}` : ""}</h3>
                          <p className="day-card__summary">{daySummary.visitTime ? formatRange(daySummary.visitTime) : "Duración sin cuantificar"} · {places.length} parada{places.length === 1 ? "" : "s"}</p>
                          <TripBoundsDayWarning assessment={boundsAssessment} />
                        </div>
                        <div className="day-card__header-actions">
                          <button
                            type="button"
                            className="icon-button icon-button--small"
                            onClick={() => dayEntity && removeEmptyDay(dayEntity.id)}
                            disabled={!isEmpty || dayIds.length <= 1}
                            aria-label={`Eliminar Día ${dayIndex + 1}`}
                            title={`Eliminar Día ${dayIndex + 1}`}
                          >
                            <Icon name="cerrar" size={16} />
                          </button>
                        </div>
                      </div>

                      <div className="day-card__actions" aria-label={`Acciones del Día ${dayIndex + 1}`}>
                        <button
                          type="button"
                          className="button button--secondary day-order-tool__trigger"
                          ref={(element) => {
                            if (!dayEntity) return;
                            if (element) dayOrderTriggerRefs.current.set(dayEntity.id, element);
                            else dayOrderTriggerRefs.current.delete(dayEntity.id);
                          }}
                          aria-label={`Probar otro orden del Día ${dayIndex + 1}`}
                          aria-expanded={dayOrderSession?.dayId === dayEntity?.id}
                          aria-controls={dayOrderIsOpen ? dayOrderPanelId : undefined}
                          aria-describedby={places.length < 2 ? `${dayOrderPanelId}-unavailable` : undefined}
                          title={places.length === 0 ? "Este día no tiene lugares." : places.length === 1 ? "Un solo lugar no tiene otro orden distinto." : `Probar otro orden del Día ${dayIndex + 1}`}
                          disabled={!dayEntity || places.length < 2}
                          onClick={() => dayEntity && openDayOrderTool(dayEntity.id, dayEntity.placeIds)}
                        >
                          Probar otro orden
                        </button>
                        {places.length < 2 && (
                          <span className="visually-hidden" id={`${dayOrderPanelId}-unavailable`}>
                            {places.length === 0 ? "No disponible: este día no tiene lugares." : "Con un lugar no hay otro orden distinto."}
                          </span>
                        )}
                        <label>
                          Mover día…
                          <select
                            aria-label={`Mover Día ${dayIndex + 1} a la posición`}
                            value={dayIndex}
                            disabled={!dayEntity || dayEntities.length < 2}
                            onChange={(event) => {
                              if (!dayEntity) return;
                              const target = Number(event.target.value);
                              const direction: -1 | 1 = target < dayIndex ? -1 : 1;
                              for (let index = dayIndex; index !== target; index += direction) moveDay(dayEntity.id, direction);
                            }}
                          >
                            {dayEntities.map((day, index) => <option key={day.id} value={index}>Posición {index + 1}</option>)}
                          </select>
                        </label>
                        <label>
                          Añadir lugar
                          <select
                            aria-label={`Añadir lugar al Día ${dayIndex + 1}`}
                            value=""
                            disabled={!dayEntity || removedPlaces.length === 0}
                            onChange={(event) => {
                              if (dayEntity && event.target.value) addPlaceToDay(event.target.value, dayEntity.id);
                            }}
                          >
                            <option value="">{removedPlaces.length ? "Elegir de Sin asignar" : "No hay sitios sin asignar"}</option>
                            {removedPlaces.map((place) => <option key={place.id} value={place.id}>{place.name}</option>)}
                          </select>
                        </label>
                      </div>

                      {dayOrderIsOpen && dayEntity && dayOrderSession && (
                        <DayOrderToolPanel
                          panelId={dayOrderPanelId}
                          toolDayId={dayEntity.id}
                          dayNumber={dayIndex + 1}
                          dateLabel={dayDate ? formatCivilDateDisplay(dayDate) : null}
                          hubLabel={hubLabel}
                          baselineDayPlaceIds={dayOrderSession.baselineDayPlaceIds}
                          currentDayPlaceIds={dayEntity.placeIds}
                          routeIds={routeIds}
                          placeById={placeById}
                          options={dayOrderOptions}
                          onClose={closeDayOrderTool}
                          onApply={applyDayOrderProposal}
                        />
                      )}

                      {isEmpty ? (
                        <p className={`sequence-empty${dropTarget?.dayId === dayEntity?.id ? " day-timeline__drop-indicator" : ""}`}>Sin lugares en este día.</p>
                      ) : (
                        <>
                          <DayTimeline
                            places={places}
                            legs={bucket?.sequence.legs ?? []}
                            dayIndex={dayIndex}
                            dayEntities={dayEntities}
                            dayPlaceLists={dayPlaceLists}
                            onOpen={onSelectPlace}
                            onDragStart={startDrag}
                            dragPlaceId={dragPlaceId}
                            dropSlot={dropTarget?.dayId === dayEntity?.id ? dropTarget.position : null}
                            dragEnabled={!dayOrderSession}
                            onUnassign={(placeIndex) => {
                              const placeId = dayIds[dayIndex]?.[placeIndex];
                              if (dayEntity && placeId) removePlaceFromDay(placeId, dayEntity.id);
                            }}
                            onMove={(placeIndex, targetDayIndex, targetPosition) => {
                              const target = dayEntities[targetDayIndex];
                              if (!dayEntity || !target) return;
                              const placeId = dayIds[dayIndex]?.[placeIndex];
                              if (placeId) relocatePlace(dayEntity.id, target.id, placeId, targetPosition);
                            }}
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
                          <footer className="day-card__footer">
                            <Icon name="cama" size={16} /> {sleepingLabel ? `Dormís en ${sleepingLabel}` : "Sin alojamiento elegido"}
                          </footer>
                        </>
                      )}
                    </section>
                    {interHubRow && (
                      <div className="inter-hub-row" role="note" aria-label={`Traslado entre Día ${dayIndex + 1} y Día ${dayIndex + 2}`}>
                        <Icon name="tren" size={16} />
                        <strong>{interHubRow.fromHub} → {interHubRow.toHub}</strong>
                        <span>{INTER_HUB_MODE_LABELS[interHubRow.mode]} · {interHubRow.minutes} min</span>
                      </div>
                    )}
                    </Fragment>
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

              <details className="unassigned-drawer">
                <summary>{removedPlaces.length} sitio{removedPlaces.length === 1 ? "" : "s"} sin día</summary>
                {removedPlaces.length === 0 ? (
                  <p>Todos los sitios del plan están asignados.</p>
                ) : (
                  <ul>
                    {removedPlaces.map((place) => (
                      <li key={place.id}>
                        <span>{place.name}</span>
                        <button type="button" className="trip-stop__handle" data-drag-place-id={place.id}
                          aria-label={`Arrastrar ${place.name}`} title={`Arrastrar ${place.name}`} disabled={Boolean(dayOrderSession)} onPointerDown={(event) => startDrag(event, place.id, null)}>
                          <Icon name="arrastrar" size={20} />
                        </button>
                        <label>
                          Añadir al día…
                          <select defaultValue="" onChange={(event) => {
                            if (event.target.value) addPlaceToDay(place.id, event.target.value);
                          }}>
                            <option value="" disabled>Elegir día</option>
                            {dayEntities.map((day, index) => <option key={day.id} value={day.id}>Día {index + 1}</option>)}
                          </select>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </details>
            </>
        </div>
        </div>
        {section === "reservas" && <TripReservations
          rows={buildTripReservationRows(routePlaces, dayAssignment, startDate)}
          onSelectPlace={onSelectPlace}
          calendar={<OfficialReservationCalendarSection calendar={routeWideReservationCalendar} />}
          renderDetails={(row) => <>
            <ReservationDeadlineNotice places={[row.place]} dayAssignment={dayAssignment} startDate={startDate} referenceDate={reservationReferenceDate} />
            <OfficialReservationDateNotice places={[row.place]} dayAssignment={dayAssignment} startDate={startDate} dayNumber={row.dayNumber} referenceDate={reservationReferenceDate} />
          </>}
        />}
        {section === "resumen" && <section className="trip-summary" aria-label="Resumen">
          <h2 id="trip-summary-title">Resumen</h2>
          <p className="trip-reading-intro">Vuestro viaje, tal como lo habéis preparado.</p>
          <WholeTripCompositionSection composition={wholeTripComposition} onSectionChange={onSectionChange} />
          <TripTimeline days={dayEntities} placeById={placeById} startDate={startDate} onSelectPlace={onSelectPlace} />
        </section>}
      </div>
    </Outer>
  );
}

export { WholeTripCompositionSection };
