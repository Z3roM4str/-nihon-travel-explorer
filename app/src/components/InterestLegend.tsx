import { Icon } from "../icons/Icon";

type LegendItem = {
  id: string;
  label: string;
  description: string;
  colorClass: string;
  colorHex: string;
};

const LEGEND_ITEMS: LegendItem[] = [
  {
    id: "both",
    label: "Los dos",
    description: "Las dos personas habéis guardado este lugar",
    colorClass: "interest-legend__swatch--both",
    colorHex: "var(--shu-600)",
  },
  {
    id: "person-a",
    label: "Persona A",
    description: "Interés de la primera persona",
    colorClass: "interest-legend__swatch--a",
    colorHex: "var(--person-a)",
  },
  {
    id: "person-b",
    label: "Persona B",
    description: "Interés de la segunda persona",
    colorClass: "interest-legend__swatch--b",
    colorHex: "var(--person-b)",
  },
  {
    id: "none",
    label: "Nadie",
    description: "Todavía nadie ha marcado este lugar",
    colorClass: "interest-legend__swatch--none",
    colorHex: "var(--ink-500)",
  },
];

export function InterestLegend() {
  return (
    <details className="interest-legend" data-map-chrome>
      <summary className="interest-legend__summary">
        <Icon name="info" size={16} /> ¿Qué significan los colores?
      </summary>
      <ul className="interest-legend__list">
        {LEGEND_ITEMS.map((item) => (
          <li key={item.id} className="interest-legend__item">
            <span
              className={`interest-legend__swatch ${item.colorClass}`}
              style={{ background: item.colorHex }}
              aria-hidden="true"
            />
            <span className="interest-legend__text">
              <span className="interest-legend__label">{item.label}</span>
              <span className="interest-legend__description">{item.description}</span>
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}
