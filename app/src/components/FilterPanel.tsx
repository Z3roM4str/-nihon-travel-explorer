import { useId, useState } from "react";
import type { Filters } from "../types";
import type { PlanningBlock } from "../lib/planning-block";
import { planningBlockHint, planningBlockLabel } from "../lib/planning-block";
import { splitCategory } from "../lib/place";
import { interestLevelForGrade } from "../lib/interest-level";
import { Icon } from "../icons/Icon";

type Props = {
  filters: Filters;
  onChange: (filters: Filters) => void;
  categories: string[];
  grades: string[];
  /** Blocks present in the current hub, in taxonomy order. */
  planningBlocks: PlanningBlock[];
  hiddenGemStatuses: string[];
  tourismLevels: string[];
  resultCount: number;
  totalCount: number;
  activeFilterCount: number;
  onReset: () => void;
  /**
   * Whether the filter groups start expanded. False on desktop, where the panel shares the
   * sidebar with the results and an always-open stack of six groups pushes the cards below the
   * fold; true on phones, where the panel only exists because the reader just asked for it.
   */
  defaultGroupsOpen?: boolean;
};

function toggleValue<T extends string>(list: T[], value: T): T[] {
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
  planningBlocks,
  hiddenGemStatuses,
  tourismLevels,
  resultCount,
  totalCount,
  activeFilterCount,
  onReset,
  defaultGroupsOpen = false,
}: Props) {
  const searchId = useId();
  const groupsId = useId();
  const [groupsOpen, setGroupsOpen] = useState(defaultGroupsOpen);
  // Same render-phase sync `HubSelector` uses: crossing the desktop/mobile breakpoint changes
  // what the default should be, without remounting the panel and without an effect.
  const [syncedDefault, setSyncedDefault] = useState(defaultGroupsOpen);
  if (defaultGroupsOpen !== syncedDefault) {
    setSyncedDefault(defaultGroupsOpen);
    setGroupsOpen(defaultGroupsOpen);
  }

  return (
    <section className="filter-panel" aria-label="Búsqueda y filtros">
      <div className="filter-panel__head">
      <div className="filter-panel__search">
        <label htmlFor={searchId} className="visually-hidden">
          Buscar lugares por nombre, barrio o tipo
        </label>
        <div className="search-field">
          <span className="search-field__icon" aria-hidden="true">
            <Icon name="buscar" size={16} />
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

      <button
        type="button"
        className="filter-panel__toggle"
        onClick={() => setGroupsOpen((open) => !open)}
        aria-expanded={groupsOpen}
        aria-controls={groupsId}
      >
        <span className="filter-panel__toggle-caret" aria-hidden="true">
          {groupsOpen ? "▾" : "▸"}
        </span>
        Filtros
        {activeFilterCount > 0 && <span className="filter-panel__toggle-count">{activeFilterCount}</span>}
      </button>
      </div>

      <div className="filter-panel__groups" id={groupsId} hidden={!groupsOpen}>
      <FilterGroup label="Categoría" count={filters.categories.length}>
        {categories.map((category) => {
          const { label } = splitCategory(category);
          return (
            <label key={category} className="filter-chip">
              <input
                type="checkbox"
                checked={filters.categories.includes(category)}
                onChange={() =>
                  onChange({ ...filters, categories: toggleValue(filters.categories, category) })
                }
              />
              {/* Bloque 17 (B1): el emoji de categoría del dataset ya no se renderiza como
                  icono de interfaz (03 §8). */}
              <span>{label}</span>
            </label>
          );
        })}
      </FilterGroup>

      {/* Still the dataset's `grade` filter — only the wording changed. A bare "S/A/B/C/D" row
          asked the reader to know the catalogue's internal vocabulary before they could use it. */}
      <FilterGroup label="Nivel de interés" count={filters.grades.length} defaultOpen>
        {grades.map((grade) => {
          const interest = interestLevelForGrade(grade);
          return (
            <label key={grade} className="filter-chip filter-chip--grade" title={interest.description}>
              <input
                type="checkbox"
                checked={filters.grades.includes(grade)}
                onChange={() => onChange({ ...filters, grades: toggleValue(filters.grades, grade) })}
              />
              <span>
                <span aria-hidden="true">{interest.glyph}</span> {interest.label}
              </span>
            </label>
          );
        })}
      </FilterGroup>

      <FilterGroup label="Duración" count={filters.planningBlocks.length} defaultOpen>
        {planningBlocks.map((block) => {
          const hint = planningBlockHint(block);
          return (
            <label key={block} className="filter-chip">
              <input
                type="checkbox"
                checked={filters.planningBlocks.includes(block)}
                onChange={() =>
                  onChange({
                    ...filters,
                    planningBlocks: toggleValue(filters.planningBlocks, block),
                  })
                }
              />
              <span>
                {planningBlockLabel(block)}
                {hint && <span className="filter-chip__hint"> ({hint})</span>}
              </span>
            </label>
          );
        })}
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
            { value: "recommended", label: "Reserva recomendable" },
            { value: "not-required", label: "No requiere reserva" },
            { value: "optional", label: "Reserva opcional" },
            { value: "role-specific", label: "Depende del rol" },
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
      </div>
    </section>
  );
}
