import { formatMinutes, formatRange } from "../lib/duration";
import { formatCivilDateDisplay } from "../lib/civil-date";
import type { WholeTripBoundsComposition, WholeTripComposition } from "../lib/whole-trip-composition";
import { EvidenceMark } from "./EvidenceMark";
import { focusViajeSurfaceHeading, type ViajeNavTarget } from "./viajeSurfaceFocus";
import { CALCULATED_DETAIL, SUMMARY_CARD_TARGETS, wholeTripUnavailableText } from "./viajeResumenModel";

/**
 * B31 (B9.5, `05 §10`) — las cuatro tarjetas de «Resumen»: Visitas · Traslados registrados ·
 * Alojamiento · Rango del viaje. Componente presentacional puro: lee `WholeTripComposition` tal cual,
 * sin cifras ni cálculos nuevos, sin estado de planificación y sin escribir nada (sólo navega).
 *
 * Cada tarjeta lleva su `EvidenceMark` (◇: son cifras que la aplicación calcula, Art. 4), el aviso
 * «incompleto» existente como texto de la propia tarjeta (no un banner) y un control de navegación
 * `<button>` hacia la superficie donde vive el detalle (DDR-B31-07).
 */

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

type CardKey = keyof typeof SUMMARY_CARD_TARGETS;

type Props = {
  composition: WholeTripComposition;
  /** Salto entre sub-pestañas de Viaje. Sin él, las tarjetas se muestran sin control. */
  onNavigate?: (target: ViajeNavTarget) => void;
};

export function TripSummaryCards({ composition, onNavigate }: Props) {
  if (composition.kind === "unavailable") {
    return (
      <section className="trip-summary trip-summary--unavailable" aria-label="Resumen del viaje">
        <p className="trip-summary__unavailable">{wholeTripUnavailableText(composition.reason)}</p>
      </section>
    );
  }

  const totalPlaceCount = composition.visit.quantifiedPlaceCount + composition.visit.nonQuantifiedPlaceCount;
  const missingMovementCount = composition.movement.localMissingCount + composition.movement.interHubMissingCount;
  const registeredTransportIsPartial =
    missingMovementCount > 0 ||
    composition.accommodation.manualLegMissingCount > 0 ||
    composition.accommodation.boundaryUnselectedCount > 0;

  const link = (key: CardKey) => {
    const { target, label } = SUMMARY_CARD_TARGETS[key];
    return (
      <button
        type="button"
        className="trip-summary-card__link"
        data-summary-link={key}
        data-summary-target={target}
        onClick={() => {
          if (!onNavigate) return;
          onNavigate(target);
          focusViajeSurfaceHeading(target);
        }}
      >
        {label}
      </button>
    );
  };

  return (
    <section className="trip-summary" aria-label="Resumen del viaje">
      <article className="trip-summary-card" data-summary-card="visitas">
        <header className="trip-summary-card__header">
          <h3>Visitas</h3>
          <EvidenceMark level="estimado" detail={CALCULATED_DETAIL} />
        </header>
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
          <p className="trip-summary-card__incomplete">Faltan duraciones numéricas: el tiempo de visita está incompleto.</p>
        )}
        {link("visitas")}
      </article>

      <article className="trip-summary-card" data-summary-card="traslados">
        <header className="trip-summary-card__header">
          <h3>Traslados registrados</h3>
          <EvidenceMark level="estimado" detail={CALCULATED_DETAIL} />
        </header>
        <p>
          Traslado registrado: {composition.registeredTransportMinutes
            ? formatRange(composition.registeredTransportMinutes)
            : "sin componentes registrados"}. Incluye solo componentes registrados: movimiento entre
          lugares y minutos manuales de alojamiento. Los desgloses siguientes ya forman parte de esa cifra.
        </p>
        {registeredTransportIsPartial && (
          <p className="trip-summary-card__incomplete">
            Esta cifra es parcial: hay componentes locales, entre ciudades o de alojamiento sin registrar.
          </p>
        )}
        <p>
          Locales con tiempo: {composition.movement.localKnownCount}; locales faltantes: {composition.movement.localMissingCount}.
        </p>
        <p>
          Entre ciudades activos: {composition.movement.interHubActiveCount}; faltantes: {composition.movement.interHubMissingCount}.
        </p>
        <p>Traslados entre lugares contemplados en este resumen: {composition.movement.modeledAdjacencyCount}.</p>
        {missingMovementCount > 0 ? (
          <p className="trip-summary-card__incomplete">
            Incompleto: faltan {composition.movement.localMissingCount} traslado(s) local(es) y {composition.movement.interHubMissingCount} traslado(s) entre ciudades.
          </p>
        ) : composition.movement.adjacencyCoverageComplete && composition.movement.modeledAdjacencyCount > 0 ? (
          <p>Todos los traslados entre lugares que este resumen contempla tienen tiempo registrado.</p>
        ) : (
          <p>No hay traslados entre lugares contemplados en este reparto.</p>
        )}
        {link("traslados")}
      </article>

      <article className="trip-summary-card" data-summary-card="alojamiento">
        <header className="trip-summary-card__header">
          <h3>Alojamiento</h3>
          <EvidenceMark level="estimado" detail={CALCULATED_DETAIL} />
        </header>
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
        {link("alojamiento")}
      </article>

      <article className="trip-summary-card" data-summary-card="rango">
        <header className="trip-summary-card__header">
          <h3>Rango del viaje</h3>
          <EvidenceMark level="estimado" detail={CALCULATED_DETAIL} />
        </header>
        <p>{wholeTripBoundsText(composition.bounds)}</p>
        <p>Días creados: {composition.bounds.dayCount}.</p>
        {composition.bounds.daysAfterTripEnd !== null && composition.bounds.daysAfterTripEnd > 0 && (
          <p className="trip-summary-card__incomplete">
            Días posteriores a la fecha de fin: {composition.bounds.daysAfterTripEnd}. Siguen incluidos en las visitas y traslados registrados de este resumen.
          </p>
        )}
        {link("rango")}
      </article>
    </section>
  );
}
