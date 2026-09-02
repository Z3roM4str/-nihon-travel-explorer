import { useId } from "react";
import type { Filters } from "../types";
import { splitCategory } from "../lib/place";

type Props = {
  filters: Filters;
  onChange: (filters: Filters) => void;
  categories: string[];
  grades: string[];
  hiddenGemStatuses: string[];
  tourismLevels: string[];
  resultCount: number;
  totalCount: number;
  activeFilterCount: number;
  onReset: () => void;
};

function toggleValue(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

type GroupProps = {
  label: string;
  count: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
};

/** Native disclosure: keyboard-operable and screen-reader friendly without extra JS. */
function FilterGroup({ label, count, defaultOpen = false, children }: GroupProps) {
  return (
    <details className="filter-group" open={defaultOpen || count > 0}>
      <summary className="filter-group__summary">
        <span>{label}</span>
        {count > 0 && <span className="filter-group__badge">{count}</span>}
      </summary>
      <div role="group" aria-label={label} className="filter-chip-list">
        {children}
      </div>
    </details>
  );
}

export function FilterPanel({
  filters,
  onChange,
  categories,
  grades,
  hiddenGemStatuses,
  tourismLevels,
  resultCount,
  totalCount,
  activeFilterCount,
  onReset,
}: Props) {
  const searchId = useId();

  return (
    <section className="filter-panel" aria-label="Búsqueda y filtros">
      <div className="filter-panel__search">
        <label htmlFor={searchId} className="visually-hidden">
          Buscar lugares por nombre, barrio o tipo
        </label>
        <div className="search-field">
          <span className="search-field__icon" aria-hidden="true">
            🔍
          </span>
          <input
            id={searchId}
            type="search"
            className="search-field__input"
            placeholder="Buscar por nombre, barrio o tipo…"
            value={filters.query}
            onChange={(event) => onChange({ ...filters, query: event.target.value })}
            autoComplete="off"
          />
          {filters.query && (
            <button
              type="button"
              className="search-field__clear"
              onClick={() => onChange({ ...filters, query: "" })}
              aria-label="Borrar búsqueda"
            >
              ×
            </button>
          )}
        </div>
      </div>

      <div className="filter-panel__status">
        <p role="status">
          <strong>{resultCount}</strong> de {totalCount} lugares
        </p>
        {activeFilterCount > 0 && (
          <button type="button" className="link-button" onClick={onReset}>
            Limpiar ({activeFilterCount})
          </button>
        )}
      </div>

      <FilterGroup label="Categoría" count={filters.categories.length}>
        {categories.map((category) => {
          const { icon, label } = splitCategory(category);
          return (
            <label key={category} className="filter-chip">
              <input
                type="checkbox"
                checked={filters.categories.includes(category)}
                onChange={() =>
                  onChange({ ...filters, categories: toggleValue(filters.categories, category) })
                }
              />
              <span>
                <span aria-hidden="true">{icon}</span> {label}
              </span>
            </label>
          );
        })}
      </FilterGroup>

      <FilterGroup label="Grado" count={filters.grades.length} defaultOpen>
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
      </FilterGroup>

      <FilterGroup label="Hidden gem" count={filters.hiddenGemStatuses.length}>
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
      </FilterGroup>

      <FilterGroup label="Nivel turístico" count={filters.tourismLevels.length}>
        {tourismLevels.map((level) => (
          <label key={level} className="filter-chip">
            <input
              type="checkbox"
              checked={filters.tourismLevels.includes(level)}
              onChange={() =>
                onChange({ ...filters, tourismLevels: toggleValue(filters.tourismLevels, level) })
              }
            />
            <span>{level}</span>
          </label>
        ))}
      </FilterGroup>

      <FilterGroup label="Reserva" count={filters.reservation === "all" ? 0 : 1} defaultOpen>
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
      </FilterGroup>
    </section>
  );
}
