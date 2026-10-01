import type { Place } from "../types";
import { addCivilDays, formatCivilDateDisplay } from "../lib/civil-date";
import { EvidenceMark } from "./EvidenceMark";

type Props = {
  days: readonly { id: string; placeIds: readonly string[] }[];
  placeById: ReadonlyMap<string, Place>;
  startDate: string | null;
  onSelectPlace?: (id: string) => void;
};

/** Reads the actual stable day buckets. Equal-width bands encode no invented duration. */
export function TripTimeline({ days, placeById, startDate, onSelectPlace }: Props) {
  return <section className="trip-timeline" aria-labelledby="trip-timeline-title">
    <h3 id="trip-timeline-title">El viaje día a día</h3>
    <EvidenceMark level="registrado" />
    {days.length === 0 ? <p>Sin días creados. Cread un día desde Días para ver el reparto del viaje.</p> :
      <div className="trip-timeline__scroll" role="region" aria-label="Línea de tiempo del viaje por días" tabIndex={0}>
        <ol className="trip-timeline__bands">
          {days.map((day, index) => {
            const places = day.placeIds.map((id) => placeById.get(id));
            const hubs = [...new Set(places.flatMap((place) => place ? [place.hub] : []))];
            const date = startDate ? addCivilDays(startDate, index) : null;
            return <li key={day.id} data-day-id={day.id} className="trip-timeline__day">
              <h4>Día {index + 1}</h4>
              {date && <p><EvidenceMark level="estimado" label={false} /> <time dateTime={date}>{formatCivilDateDisplay(date)}</time></p>}
              <p className="trip-timeline__cities">{hubs.length ? hubs.join(" / ") : "Sin ciudad asignada"}</p>
              {places.length === 0 ? <p>Día vacío</p> : <details><summary>{places.length} visita{places.length === 1 ? "" : "s"}</summary><ul>{places.map((place, position) => <li key={day.placeIds[position]}>{place ?
                <button type="button" className="link-button" onClick={() => onSelectPlace?.(place.id)}>{place.name}</button> : "Lugar no disponible"}</li>)}</ul></details>}
            </li>;
          })}
        </ol>
      </div>}
  </section>;
}
