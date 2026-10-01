import { useCallback, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import type { Place } from "../types";
import { formatRange } from "../lib/duration";
import { groupByHub, summarizeSelection } from "../lib/selection";
import type { InterestStance, PlaceInterestSummary, Traveller } from "../lib/travellers";
import type { DivergenceEntry } from "../lib/interest-divergence";
import {
  divergenceLine,
  emptyFilterSentence,
  filterLabel,
  plannedNote,
} from "../lib/divergence-presentation";
import {
  quieroIrSections,
  travellerYetToMark,
  visibleShortlist,
  type QuieroIrLens,
} from "../lib/quiero-ir";
import { Icon } from "../icons/Icon";
import { PlaceCard } from "./PlaceCard";
import { PersonToken } from "./PersonToken";
import { EvidenceMark } from "./EvidenceMark";
import { EmptyState } from "./EmptyState";
import { SelectionAnalysis } from "./SelectionAnalysis";

import "./SelectionPanel.css";
/**
 * B25 — B7 «Quiero ir» (`05 §6`, `10 §B7`): la pantalla donde el acuerdo es la recompensa.
 *
 * Orden fijo, sin ningún clic para descubrirlo: cabecera + contador, segmentado (lente de vista),
 * resumen de tres datos equivalentes, **«Los dos queréis ir»**, «Sólo {persona}» plegables, lo
 * que Bloque 6 distingue aparte (opiniones distintas, sin reclamar), el reparto por ciudad y zona
 * que antes vivía detrás de un botón, «Descartados» plegado, y la acción anclada «Llevar al viaje».
 *
 * Lo que NO hace: no calcula ninguna coincidencia ni divergencia (las lee de `divergenceEntries`
 * y `summarizeInterest`, Bloques 5 y 6), no suma duraciones de otra forma (`summarizeSelection`),
 * no guarda nada (todo el estado de aquí es de vista) y no cambia la persona activa: el
 * segmentado es un filtro de lo que se ve, nunca una identidad.
 */

type Props = {
  savedPlaces: Place[];
  /** «Descartados»: marcados «no me interesa» por todo el que opinó y queridos por nadie. */
  declinedPlaces: Place[];
  /** The heart: the active traveller's own interest, exactly as on every other card. */
  onToggleHeart: (id: string) => void;
  isWantedByActive: (id: string) => boolean;
  onSelect: (id: string) => void;
  onBuildSequence: () => void;
  onExplore: () => void;
  divergence: readonly DivergenceEntry[];
  travellers: readonly Traveller[];
  activeTravellerId: string | null;
  interestSummary: (placeId: string) => PlaceInterestSummary;
  stanceFor: (placeId: string, travellerId: string) => InterestStance | null;
};

type SectionProps = {
  id: string;
  title: ReactNode;
  count: number;
  open: boolean;
  onToggle: () => void;
  token?: ReactNode;
  tone?: "agreed" | "a" | "b" | "neutral";
  children: ReactNode;
};

/** A section whose heading is also its disclosure control (`aria-expanded`/`aria-controls`). */
function FoldSection({ id, title, count, open, onToggle, token, tone = "neutral", children }: SectionProps) {
  const panelId = `${id}-panel`;
  return (
    <section className={`quiero-ir__section quiero-ir__section--${tone}`} aria-labelledby={`${id}-button`}>
      <h2 className="quiero-ir__section-heading">
        <button
          type="button"
          id={`${id}-button`}
          className="quiero-ir__section-toggle"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
        >
          {token}
          <span className="quiero-ir__section-title">{title}</span>
          <span className="quiero-ir__section-count">({count})</span>
          <Icon name="siguiente" size={16} className={`quiero-ir__chevron ${open ? "quiero-ir__chevron--open" : ""}`.trim()} />
        </button>
      </h2>
      <div id={panelId} className="quiero-ir__section-body" hidden={!open}>
        {children}
      </div>
    </section>
  );
}

export function SelectionPanel({
  savedPlaces,
  declinedPlaces,
  onToggleHeart,
  isWantedByActive,
  onSelect,
  onBuildSequence,
  onExplore,
  divergence,
  travellers,
  activeTravellerId,
  interestSummary,
  stanceFor,
}: Props) {
  const uid = useId();
  /**
   * Estado de vista, y sólo de vista: ni el filtro ni lo plegado se persisten. Este componente
   * sigue montado mientras la ficha se abre encima (DD-015), así que cerrar la ficha devuelve la
   * pantalla con la misma lente, las mismas secciones abiertas y el mismo scroll.
   */
  const [lens, setLens] = useState<QuieroIrLens>("both");
  const [closed, setClosed] = useState<ReadonlySet<string>>(() => new Set());
  const [opened, setOpened] = useState<ReadonlySet<string>>(() => new Set());

  // A lens can only name a traveller who still exists.
  const activeLens =
    lens !== "both" && !travellers.some((traveller) => traveller.id === lens) ? "both" : lens;

  const sections = useMemo(
    () =>
      quieroIrSections({
        savedPlaces,
        declinedPlaces,
        divergence,
        travellers,
        interestSummary,
        stanceFor,
        lens: activeLens,
      }),
    [savedPlaces, declinedPlaces, divergence, travellers, interestSummary, stanceFor, activeLens]
  );
  const visible = useMemo(() => visibleShortlist(sections), [sections]);
  const summary = useMemo(() => summarizeSelection(visible), [visible]);
  const cities = useMemo(() => groupByHub(visible).length, [visible]);
  const entryOf = useMemo(
    () => new Map(divergence.map((entry) => [entry.placeId, entry])),
    [divergence]
  );
  const yetToMark = useMemo(
    () => travellerYetToMark(savedPlaces, travellers, stanceFor),
    [savedPlaces, travellers, stanceFor]
  );

  /** Sections open by default except «Descartados» and the city/zone breakdown (`05 §6` pt. 6). */
  const isOpen = (key: string, byDefault = true) =>
    byDefault ? !closed.has(key) : opened.has(key);
  const toggle = (key: string, byDefault = true) => {
    const update = (set: ReadonlySet<string>) => {
      const next = new Set(set);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    };
    if (byDefault) setClosed(update);
    else setOpened(update);
  };

  const segmentRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const lenses = useMemo<Array<{ value: QuieroIrLens; label: string }>>(
    () => [
      { value: "both", label: filterLabel("agreed") },
      ...travellers.map((traveller) => ({ value: traveller.id, label: traveller.label })),
    ],
    [travellers]
  );
  const onSegmentKey = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
      const last = lenses.length - 1;
      let next: number | null = null;
      if (event.key === "ArrowRight" || event.key === "ArrowDown") next = index === last ? 0 : index + 1;
      else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = index === 0 ? last : index - 1;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = last;
      if (next === null) return;
      event.preventDefault();
      setLens(lenses[next].value);
      segmentRefs.current[next]?.focus();
    },
    [lenses]
  );

  const total = savedPlaces.length;

  function renderRows(places: Place[], showLine: boolean) {
    const groups = groupByHub(places);
    const rows = (list: Place[]) => (
      <ul className="quiero-ir__list">
        {list.map((place) => {
          const entry = entryOf.get(place.id) ?? null;
          const note = entry ? plannedNote(entry) : null;
          return (
            <li key={place.id} className="quiero-ir__row" data-quiero-ir-place={place.id}>
              <PlaceCard
                place={place}
                variant="compact"
                selected={false}
                saved={isWantedByActive(place.id)}
                onSelect={onSelect}
                onToggleSaved={onToggleHeart}
              />
              {((showLine && entry) || note) && (
                <p className="quiero-ir__row-note">
                  {showLine && entry && divergenceLine(entry.group, travellers, activeTravellerId)}
                  {note && <> {note}</>}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    );
    // `05 §6`: agrupación secundaria por ciudad — sólo cuando hay más de una.
    if (groups.length <= 1) return rows(places);
    return groups.map((group) => (
      <div key={group.key} className="quiero-ir__city">
        <h3 className="quiero-ir__city-name">
          {group.label} <span className="quiero-ir__city-count">({group.places.length})</span>
        </h3>
        {rows(group.places)}
      </div>
    ));
  }

  if (total === 0 && declinedPlaces.length === 0) {
    return (
      <section className="quiero-ir quiero-ir--empty" aria-label="Quiero ir">
        <EmptyState
          icon="corazon"
          title="Todavía no habéis marcado nada."
          description="Pulsa el corazón en cualquier lugar que os llame; guardad de más, que luego se recorta."
          action={{ label: "Explorar Tokio", onClick: onExplore }}
        />
      </section>
    );
  }

  const twoPeople = travellers.length === 2;
  const showPending = twoPeople && activeLens === "both" && sections.agreed.length === 0 && yetToMark;

  return (
    <section className="quiero-ir" aria-label="Quiero ir">

      {twoPeople && (
        <div className="quiero-ir__segmented" role="radiogroup" aria-label="Qué lugares ver">
          {lenses.map((option, index) => {
            const checked = option.value === activeLens;
            return (
              <button
                key={option.value}
                ref={(node) => {
                  segmentRefs.current[index] = node;
                }}
                type="button"
                role="radio"
                aria-checked={checked}
                tabIndex={checked ? 0 : -1}
                className={`quiero-ir__segment ${checked ? "quiero-ir__segment--on" : ""}`.trim()}
                onClick={() => setLens(option.value)}
                onKeyDown={(event) => onSegmentKey(event, index)}
                title={option.label}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      )}

      {total > 0 && (
        <div className="quiero-ir__summary">
          <dl className="quiero-ir__facts">
            <div className="quiero-ir__fact">
              <dt className="visually-hidden">Lugares</dt>
              <dd>
                <span className="quiero-ir__fact-value">{visible.length}</span>{" "}
                <span className="quiero-ir__fact-label">{visible.length === 1 ? "lugar" : "lugares"}</span>
              </dd>
            </div>
            <div className="quiero-ir__fact">
              <dt className="visually-hidden">Ciudades</dt>
              <dd>
                <span className="quiero-ir__fact-value">{cities}</span>{" "}
                <span className="quiero-ir__fact-label">{cities === 1 ? "ciudad" : "ciudades"}</span>
              </dd>
            </div>
            <div className="quiero-ir__fact">
              <dt className="visually-hidden">Tiempo estimado de visita</dt>
              <dd>
                <span className="quiero-ir__fact-value">
                  {summary.visitTime ? `≈${formatRange(summary.visitTime)}` : "—"}
                </span>{" "}
                <span className="quiero-ir__fact-label">de visitas</span>{" "}
                <EvidenceMark level="estimado" label={false} detail="sólo tiempo dentro de cada lugar, sin traslados" />
              </dd>
            </div>
          </dl>
          <p className="quiero-ir__note">
            Sólo tiempo dentro de cada lugar.
            {summary.nonQuantified.length > 0 && (
              <> {summary.nonQuantified.length} sin estimación numérica, fuera de la suma.</>
            )}
          </p>
        </div>
      )}

      {twoPeople &&
        (showPending ? (
          <p className="quiero-ir__pending" role="note">
            <PersonToken traveller={null} both size="xs" />
            Cuando {yetToMark.label} marque sus sitios, aquí veréis en qué coincidís.
          </p>
        ) : (
          <section className="quiero-ir__section quiero-ir__section--agreed quiero-ir__agreed" aria-labelledby={`${uid}-agreed`}>
            <h2 id={`${uid}-agreed`} className="quiero-ir__section-heading quiero-ir__section-heading--static">
              <PersonToken traveller={null} both size="xs" />
              <span className="quiero-ir__section-title">Los dos queréis ir</span>
              <span className="quiero-ir__section-count">({sections.agreed.length})</span>
            </h2>
            {sections.agreed.length === 0 ? (
              <p className="quiero-ir__empty-line">{emptyFilterSentence("agreed")}</p>
            ) : (
              renderRows(sections.agreed, false)
            )}
          </section>
        ))}

      {sections.onlyBy.map((section) =>
        section.places.length === 0 ? null : (
          <FoldSection
            key={section.traveller.id}
            id={`${uid}-only-${section.variant}`}
            title={`Sólo ${section.traveller.label}`}
            count={section.places.length}
            open={isOpen(`only-${section.traveller.id}`)}
            onToggle={() => toggle(`only-${section.traveller.id}`)}
            tone={section.variant}
            token={
              <PersonToken
                traveller={section.traveller}
                variant={section.variant}
                size="xs"
                label={`${section.traveller.label} quiere ir`}
              />
            }
          >
            {renderRows(section.places, false)}
          </FoldSection>
        )
      )}

      {sections.differing.length > 0 && (
        <FoldSection
          id={`${uid}-differing`}
          title={filterLabel("differing")}
          count={sections.differing.length}
          open={isOpen("differing")}
          onToggle={() => toggle("differing")}
        >
          {renderRows(sections.differing, true)}
        </FoldSection>
      )}

      {sections.unclaimed.length > 0 && (
        <FoldSection
          id={`${uid}-unclaimed`}
          title={filterLabel("unclaimed")}
          count={sections.unclaimed.length}
          open={isOpen("unclaimed")}
          onToggle={() => toggle("unclaimed")}
        >
          {renderRows(sections.unclaimed, true)}
        </FoldSection>
      )}

      {visible.length > 0 && (
        <FoldSection
          id={`${uid}-cities`}
          title="Por ciudad y zona"
          count={cities}
          open={isOpen("cities", false)}
          onToggle={() => toggle("cities", false)}
        >
          <SelectionAnalysis savedPlaces={visible} onSelectPlace={onSelect} />
        </FoldSection>
      )}

      {sections.declined.length > 0 && (
        <FoldSection
          id={`${uid}-declined`}
          title="Descartados"
          count={sections.declined.length}
          open={isOpen("declined", false)}
          onToggle={() => toggle("declined", false)}
        >
          {renderRows(sections.declined, false)}
        </FoldSection>
      )}

      {total > 0 && (
        <div className="quiero-ir__cta">
          <button type="button" className="button button--primary button--lg" onClick={onBuildSequence}>
            Llevar al viaje
          </button>
        </div>
      )}
    </section>
  );
}
