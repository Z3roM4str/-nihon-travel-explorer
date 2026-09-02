import type { Filters } from "../types";

type Props = {
  filters: Filters;
  onChange: (filters: Filters) => void;
  categories: string[];
  grades: string[];
  hiddenGemStatuses: string[];
  tourismLevels: string[];
  resultCount: number;
  onReset: () => void;
};

function toggleValue(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function FilterPanel({
  filters,
  onChange,
  categories,
  grades,
  hiddenGemStatuses,
  tourismLevels,
  resultCount,
  onReset,
}: Props) {
  return (
    <section className="filter-panel" aria-label="Filtros de lugares">
      <div className="filter-panel__header">
        <h2>Filtros</h2>
        <button type="button" className="link-button" onClick={onReset}>
          Limpiar
        </button>
      </div>
      <p className="filter-panel__count" role="status">
        {resultCount} lugar{resultCount === 1 ? "" : "es"} en Tokio
      </p>

      <fieldset className="filter-group">
        <legend>Categoría</legend>
        <div className="filter-chip-list">
          {categories.map((category) => (
            <label key={category} className="filter-chip">
              <input
                type="checkbox"
                checked={filters.categories.includes(category)}
                onChange={() =>
                  onChange({ ...filters, categories: toggleValue(filters.categories, category) })
                }
              />
              <span>{category}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="filter-group">
        <legend>Grado</legend>
        <div className="filter-chip-list filter-chip-list--inline">
          {grades.map((grade) => (
            <label key={grade} className="filter-chip filter-chip--grade">
              <input
                type="checkbox"
                checked={filters.grades.includes(grade)}
                onChange={() => onChange({ ...filters, grades: toggleValue(filters.grades, grade) })}
              />
              <span>{grade}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="filter-group">
        <legend>Hidden gem</legend>
        <div className="filter-chip-list">
          {hiddenGemStatuses.map((status) => (
            <label key={status} className="filter-chip">
              <input
                type="checkbox"
                checked={filters.hiddenGemStatuses.includes(status)}
                onChange={() =>
                  onChange({
                    ...filters,
                    hiddenGemStatuses: toggleValue(filters.hiddenGemStatuses, status),
                  })
                }
              />
              <span>{status}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="filter-group">
        <legend>Nivel turístico</legend>
        <div className="filter-chip-list filter-chip-list--inline">
          {tourismLevels.map((level) => (
            <label key={level} className="filter-chip">
              <input
                type="checkbox"
                checked={filters.tourismLevels.includes(level)}
                onChange={() =>
                  onChange({
                    ...filters,
                    tourismLevels: toggleValue(filters.tourismLevels, level),
                  })
                }
              />
              <span>{level}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="filter-group">
        <legend>Reserva</legend>
        <div className="filter-chip-list filter-chip-list--inline" role="radiogroup" aria-label="Reserva">
          {(
            [
              { value: "all", label: "Todas" },
              { value: "required", label: "Requiere reserva" },
              { value: "not-required", label: "Sin reserva" },
            ] as const
          ).map((option) => (
            <label key={option.value} className="filter-chip filter-chip--radio">
              <input
                type="radio"
                name="reservation"
                checked={filters.reservation === option.value}
                onChange={() => onChange({ ...filters, reservation: option.value })}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </section>
  );
}
