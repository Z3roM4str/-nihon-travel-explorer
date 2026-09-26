import type { Filters } from "../types";
import type { PlanningBlock } from "../lib/planning-block";
import { planningBlockHint, planningBlockLabel } from "../lib/planning-block";
import { interestLevelForGrade } from "../lib/interest-level";
import { categoryPresentation } from "../lib/category-presentation";
import { ChipToggle } from "./ChipToggle";
import { Icon } from "../icons/Icon";

/** Una etiqueta de presentación (`03 §8`, hasta 26) más las cadenas fuente que colapsa (1 ó 2 —
 * sólo los tres pares duplicados aportan 2). Ver `App.tsx`'s `categoryGroups`. */
type CategoryGroup = { label: string; values: string[] };

type Props = {
  filters: Filters;
  onChange: (filters: Filters) => void;
  categoryGroups: CategoryGroup[];
  grades: string[];
  /** Blocks present in the current hub, in taxonomy order. */
  planningBlocks: PlanningBlock[];
  hiddenGemStatuses: string[];
  tourismLevels: string[];
  resultCount: number;
  totalCount: number;
  activeFilterCount: number;
  onReset: () => void;
  /** Bloque 19 (B3, `04 §13`): pulsar «Ver {n} lugares» cierra la hoja — mismo efecto que
   * cualquier otro cierre, expuesto aparte porque el pie de esta hoja es quien lo dispara. */
  onApply: () => void;
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
        {/* DD-021 (D-M5): icono del set en vez del glifo `▸` pintado con `::before`. */}
        <Icon name="siguiente" size={16} className="filter-group__chevron" aria-hidden="true" />
      </summary>
      <div role="group" aria-label={label} className="filter-chip-list">
        {children}
      </div>
    </details>
  );
}

/**
 * `FilterSheet` (`04 §13`).
 *
 * Bloque 19 (B3): deja de ser un formulario de casillas y pasa a ser una hoja de grupos
 * plegables de `ChipToggle`, en el orden fijo que exige `04 §13` — Nivel de interés · Categoría ·
 * Duración · Reserva · Afluencia · Joyas —, con cabecera pegajosa (contador de resultados en
 * vivo) y pie fijo (`Limpiar` / `Ver {n} lugares`). La lógica de cada filtro no cambia: sigue
 * siendo exactamente `App.tsx`'s `matchesFilters`, con el mismo vocabulario y los mismos
 * valores — sólo cambia cómo se presentan.
 */
export function FilterPanel({
  filters,
  onChange,
  categoryGroups,
  grades,
  planningBlocks,
  hiddenGemStatuses,
  tourismLevels,
  resultCount,
  totalCount,
  activeFilterCount,
  onReset,
  onApply,
}: Props) {
  return (
    <section className="filter-panel" aria-label="Filtros">
      <div className="filter-panel__head">
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

      </div>

      {/* B24 (P1-01): sin el desplegable «▾ Filtros» que escondía los grupos — `04 §13` no lo
          tiene: la hoja ES los grupos, en su orden fijo, cada uno plegable por sí mismo. */}
      <div className="filter-panel__groups">
        {/* 1. Nivel de interés — sigue siendo el filtro `grade` del dataset; sólo cambió la
            redacción hace bloques, aquí sólo cambia la presentación (chip, no casilla). */}
        <FilterGroup label="Nivel de interés" count={filters.grades.length} defaultOpen>
          {grades.map((grade) => {
            const interest = interestLevelForGrade(grade);
            return (
              <ChipToggle
                key={grade}
                pressed={filters.grades.includes(grade)}
                onClick={() => onChange({ ...filters, grades: toggleValue(filters.grades, grade) })}
              >
                <span aria-hidden="true">{interest.glyph}</span> {interest.label}
              </ChipToggle>
            );
          })}
        </FilterGroup>

        {/* 2. Categoría — un chip por etiqueta de presentación colapsada (03 §8); activa o
            desactiva juntas las cadenas fuente que representa (1 salvo en los tres pares
            duplicados, donde son 2), nunca una selección parcial. */}
        <FilterGroup
          label="Categoría"
          count={categoryGroups.filter((group) => group.values.some((v) => filters.categories.includes(v))).length}
        >
          {categoryGroups.map((group) => {
            const pressed = group.values.every((value) => filters.categories.includes(value));
            const { icon } = categoryPresentation(group.values[0]);
            return (
              <ChipToggle
                key={group.label}
                icon={icon}
                pressed={pressed}
                onClick={() =>
                  onChange({
                    ...filters,
                    categories: pressed
                      ? filters.categories.filter((value) => !group.values.includes(value))
                      : [...new Set([...filters.categories, ...group.values])],
                  })
                }
              >
                {group.label}
              </ChipToggle>
            );
          })}
        </FilterGroup>

        {/* 3. Duración */}
        <FilterGroup label="Duración" count={filters.planningBlocks.length} defaultOpen>
          {planningBlocks.map((block) => {
            const hint = planningBlockHint(block);
            return (
              <ChipToggle
                key={block}
                pressed={filters.planningBlocks.includes(block)}
                onClick={() =>
                  onChange({
                    ...filters,
                    planningBlocks: toggleValue(filters.planningBlocks, block),
                  })
                }
              >
                {planningBlockLabel(block)}
                {hint && <span className="chip-toggle__hint"> ({hint})</span>}
              </ChipToggle>
            );
          })}
        </FilterGroup>

        {/* 4. Reserva — único grupo de selección única (radio); se conservan los seis valores
            del filtro cerrado de `lib/reservation.ts`. */}
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
            <ChipToggle
              key={option.value}
              pressed={filters.reservation === option.value}
              onClick={() => onChange({ ...filters, reservation: option.value })}
            >
              {option.label}
            </ChipToggle>
          ))}
        </FilterGroup>

        {/* 5. Afluencia — antes «Nivel turístico»; mismo campo (`tourismLevel`), mismos cuatro
            valores del dataset (Extremo/Alto/Medio/Bajo), sólo cambia el nombre del grupo para
            adoptar el vocabulario fijo de `04 §13`. */}
        <FilterGroup label="Afluencia" count={filters.tourismLevels.length}>
          {tourismLevels.map((level) => (
            <ChipToggle
              key={level}
              pressed={filters.tourismLevels.includes(level)}
              onClick={() =>
                onChange({ ...filters, tourismLevels: toggleValue(filters.tourismLevels, level) })
              }
            >
              {level}
            </ChipToggle>
          ))}
        </FilterGroup>

        {/* 6. Joyas — antes «Hidden gem»; mismo campo (`hiddenGemStatus`), mismos valores del
            dataset, sólo cambia el nombre del grupo. */}
        <FilterGroup label="Joyas" count={filters.hiddenGemStatuses.length}>
          {hiddenGemStatuses.map((status) => (
            <ChipToggle
              key={status}
              pressed={filters.hiddenGemStatuses.includes(status)}
              onClick={() =>
                onChange({
                  ...filters,
                  hiddenGemStatuses: toggleValue(filters.hiddenGemStatuses, status),
                })
              }
            >
              {status}
            </ChipToggle>
          ))}
        </FilterGroup>
      </div>

      <div className="filter-panel__foot">
        <button type="button" className="button button--quiet" onClick={onReset}>
          Limpiar
        </button>
        <button type="button" className="button button--primary" onClick={onApply}>
          Ver {resultCount} lugar{resultCount === 1 ? "" : "es"}
        </button>
      </div>
    </section>
  );
}
