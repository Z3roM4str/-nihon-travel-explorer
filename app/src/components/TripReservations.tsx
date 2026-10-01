import type { ReactNode } from "react";
import type { TripReservationRow } from "../lib/trip-reservation-presentation";
import { formatCivilDateDisplay } from "../lib/civil-date";
import { describeFebMarStatusForUi, interpretPlaceFebMarStatus } from "../lib/feb-mar-status";
import { reservationMechanismScopeLabel } from "../lib/reservation-mechanism-presentation";
import { EvidenceMark } from "./EvidenceMark";

type Props = {
  rows: readonly TripReservationRow[];
  onSelectPlace?: (id: string) => void;
  renderDetails: (row: TripReservationRow) => ReactNode;
  calendar: ReactNode;
};

export function TripReservations({ rows, onSelectPlace, renderDetails, calendar }: Props) {
  return <section className="trip-reservations" aria-labelledby="trip-reservations-title">
    <h2 id="trip-reservations-title">Reservas</h2>
    <p className="trip-reading-intro">Lo que queda por preparar para vuestro viaje.</p>
    <section aria-labelledby="reservation-prep-heading">
      <h3 id="reservation-prep-heading">Reservas por preparar</h3>
      {rows.length === 0 && <p>No hay reservas por preparar en los lugares del plan. Añadid lugares desde Días.</p>}
      <ol className="trip-reservations__list">
        {rows.map((row) => {
          const { place } = row;
          const febMar = describeFebMarStatusForUi(interpretPlaceFebMarStatus(place));
          return <li key={place.id} className="trip-reservations__item" data-place-id={place.id} data-urgency-date={row.urgencyDate ?? ""}>
            <h4><button type="button" className="link-button" onClick={() => onSelectPlace?.(place.id)}>{place.name}</button></h4>
            <p>Qué hay que reservar: {row.records.length ? [...new Set(row.records.map((record) => reservationMechanismScopeLabel(record.scope)))].join(" / ") : "Mecanismo específico; revisar la ficha"}</p>
            <p>{row.reservation.raw ? <><EvidenceMark level="registrado" /> «{row.reservation.raw}»</> : "Sin estado de reserva registrado"}</p>
            <p>{row.prep?.leadTime.kind === "coarse-magnitude" ? "Anticipación registrada" : "Mecanismo específico; revisar anticipación"}: {row.prep ? <><EvidenceMark level="registrado" /> «{row.prep.leadTime.raw}»</> : "Sin anticipación registrada"}</p>
            {row.urgencyDate ? <p className="trip-reservations__date"><EvidenceMark level="estimado" /> {row.urgencyLabel}: <time dateTime={row.urgencyDate}>{formatCivilDateDisplay(row.urgencyDate)}</time></p> : <p>Sin fecha límite derivable.</p>}
            {row.visitDate && <p>Visita: {formatCivilDateDisplay(row.visitDate)}{row.dayNumber > 0 ? ` · Día ${row.dayNumber}` : ""}</p>}
            {row.records.map((record) => <details key={record.id} className="trip-reservations__source">
              <summary>Mecanismo de reserva según fuente oficial</summary>
              <p><EvidenceMark level="registrado" detail={record.provenance.consultedAt} /> «{record.provenance.evidence}»</p>
              <a href={record.provenance.sourceUrl} target="_blank" rel="noreferrer">Ver fuente oficial</a>
            </details>)}
            {renderDetails(row)}
            <details className="trip-reservations__feb-mar">
              <summary>Febrero–marzo 2027: {febMar.label}</summary>
              {[place.febMar2027.status, place.febMar2027.warning, place.febMar2027.action].filter(Boolean).map((raw, index) => <p key={index}><EvidenceMark level="registrado" /> «{raw}»</p>)}
            </details>
          </li>;
        })}
      </ol>
      <p className="trip-reading-note">Las fechas ordenan la lectura, no el viaje. Una apertura de venta no es un cierre de solicitudes; la anticipación editorial no confirma disponibilidad. La referencia se captura del calendario local del dispositivo al abrir el plan, sin actualización automática ni conversión a la fecha operativa de Japón. La relación compara únicamente fechas: no considera la hora registrada ni la zona horaria de la fuente, ni indica el estado actual de la venta. Nihon no combina ambas fuentes.</p>
    </section>
    {calendar}
  </section>;
}
