import type { Place } from "../types";

type Props = {
  savedPlaces: Place[];
  onRemove: (id: string) => void;
  onSelect: (id: string) => void;
  open: boolean;
  onToggle: () => void;
};

function sumDuration(places: Place[]) {
  return places.reduce(
    (acc, place) => {
      const min = place.duration.minMinutes;
      const max = place.duration.maxMinutes;
      if (min != null && max != null) {
        acc.min += min;
        acc.max += max;
        acc.known += 1;
      } else {
        acc.unknown += 1;
      }
      return acc;
    },
    { min: 0, max: 0, known: 0, unknown: 0 }
  );
}

function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins} min`;
  if (mins === 0) return `${hours} h`;
  return `${hours} h ${mins} min`;
}

export function SelectionPanel({ savedPlaces, onRemove, onSelect, open, onToggle }: Props) {
  const totals = sumDuration(savedPlaces);

  return (
    <section className={`selection-panel ${open ? "selection-panel--open" : ""}`} aria-label="Selección guardada">
      <button
        type="button"
        className="selection-panel__toggle"
        onClick={onToggle}
        aria-expanded={open}
      >
        <span>
          Quiero ir <strong>({savedPlaces.length})</strong>
        </span>
        <span aria-hidden="true">{open ? "▾" : "▴"}</span>
      </button>

      {open && (
        <div className="selection-panel__content">
          {savedPlaces.length === 0 ? (
            <p className="selection-panel__empty">
              Aún no has guardado lugares. Usa “Quiero ir” en una ficha para añadirla aquí.
            </p>
          ) : (
            <>
              <div className="selection-panel__summary">
                <p>
                  <strong>{savedPlaces.length}</strong> lugar{savedPlaces.length === 1 ? "" : "es"} guardado
                  {savedPlaces.length === 1 ? "" : "s"}
                </p>
                {totals.known > 0 ? (
                  <p className="selection-panel__time">
                    Tiempo estimado de visita: <strong>{formatMinutes(totals.min)}–{formatMinutes(totals.max)}</strong>
                    {totals.unknown > 0 && (
                      <span className="selection-panel__note">
                        {" "}
                        ({totals.unknown} lugar{totals.unknown === 1 ? "" : "es"} sin duración estimada)
                      </span>
                    )}
                  </p>
                ) : (
                  <p className="selection-panel__note">Sin datos de duración disponibles para calcular un total.</p>
                )}
                <p className="selection-panel__disclaimer">
                  Este total suma únicamente tiempo de visita en cada lugar. No incluye traslados entre lugares —
                  esa estimación llegará en la Fase 2.
                </p>
              </div>
              <ul className="selection-list">
                {savedPlaces.map((place) => (
                  <li key={place.id} className="selection-list__item">
                    <button
                      type="button"
                      className="selection-list__name"
                      onClick={() => onSelect(place.id)}
                    >
                      {place.name}
                      <span className="selection-list__duration">{place.duration.raw}</span>
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Quitar ${place.name} de la selección`}
                      onClick={() => onRemove(place.id)}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </section>
  );
}
