import { EvidenceMark } from "./EvidenceMark";
import { timelineDayText, type TripTimelineDay } from "./viajeResumenModel";

/**
 * B31 (B9.5, `05 §10`, DDR-B31-05) — el viaje en una línea de tiempo horizontal comprimida.
 *
 * Una banda con un segmento de ancho igual por día. Sin color por ciudad: sólo tokens neutros, y
 * cada día se identifica por TEXTO («Día N» + ciudad), nunca sólo por color. No es interactiva, no
 * escribe estado y no anima. La banda visual puede truncar el nombre; la alternativa textual
 * (`<ol>` visualmente oculta, «Día N · ciudad») conserva la información completa. Es una lectura
 * derivada por la aplicación (Art. 4), de ahí el marcador ◇.
 */

export function TripTimelineBand({ days }: { days: readonly TripTimelineDay[] }) {
  if (days.length === 0) return null;
  return (
    <section className="trip-timeline" aria-labelledby="trip-timeline-heading">
      <div className="trip-timeline__header">
        <h3 id="trip-timeline-heading">El viaje día a día</h3>
        <EvidenceMark level="estimado" detail="derivado por la aplicación de los lugares de cada día" />
      </div>
      <div
        className="trip-timeline__band"
        role="img"
        aria-label={`Línea de tiempo del viaje: ${days.length} ${days.length === 1 ? "día" : "días"}`}
      >
        {days.map((day) => (
          <span key={day.ordinal} className="trip-timeline__segment" data-timeline-day={day.ordinal}>
            <span className="trip-timeline__ordinal">
              <span className="trip-timeline__ordinal-word">Día </span>
              {day.ordinal}
            </span>
            <span className="trip-timeline__city">{day.isEmpty ? "sin lugares" : (day.cityLabel ?? "")}</span>
          </span>
        ))}
      </div>
      <ol className="visually-hidden" data-timeline-text>
        {days.map((day) => (
          <li key={day.ordinal}>{timelineDayText(day)}</li>
        ))}
      </ol>
    </section>
  );
}
