import { useMemo, useState } from "react";
import type { Place } from "../types";
import { formatRange } from "../lib/duration";
import {
  blockDistribution,
  concentration,
  groupByCluster,
  groupByHub,
  summarizeSelection,
} from "../lib/selection";
import { planningBlockLabel } from "../lib/planning-block";
import type { DivergenceEntry } from "../lib/interest-divergence";
import type { InterestStance, Traveller } from "../lib/travellers";
import type { OtherPersonMarker } from "../lib/traveller-presentation";
import { EvidenceMark } from "./EvidenceMark";
import { Icon } from "../icons/Icon";
import { PlaceCard } from "./PlaceCard";

type Props = {
  allPlaces: readonly Place[];
  savedPlaces: Place[];
  onRemove: (id: string) => void;
  onSelect: (id: string) => void;
  onBuildSequence: () => void;
  onExplore: () => void;
  divergence?: readonly DivergenceEntry[];
  travellers?: readonly Traveller[];
  activeTravellerId?: string | null;
  stanceFor: (placeId: string, travellerId: string) => InterestStance | null;
  otherPersonMarkerFor: (placeId: string) => OtherPersonMarker | null;
};

type Lens = "together" | string;

function byCity(places: readonly Place[]) {
  const groups = new Map<string, Place[]>();
  for (const place of places) {
    const city = place.municipality || place.hub;
    groups.set(city, [...(groups.get(city) ?? []), place]);
  }
  return [...groups.entries()];
}

function PlaceGroups({ places, onSelect, onRemove, activeTravellerId, stanceFor, otherPersonMarkerFor }: {
  places: readonly Place[];
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  activeTravellerId: string | null;
  stanceFor: Props["stanceFor"];
  otherPersonMarkerFor: Props["otherPersonMarkerFor"];
}) {
  return <div className="selection-cities">{byCity(places).map(([city, cityPlaces]) => (
    <section className="selection-city" key={city}>
      <h3>{city}</h3>
      <div className="selection-list">
        {cityPlaces.map((place) => {
          const activeWantsIt = activeTravellerId !== null && stanceFor(place.id, activeTravellerId) === "interested";
          return <PlaceCard key={place.id} place={place} variant="compact" selected={false}
            saved={activeWantsIt} onSelect={onSelect} onToggleSaved={activeWantsIt ? onRemove : undefined}
            otherPersonMarker={otherPersonMarkerFor(place.id)} />;
        })}
      </div>
    </section>
  ))}</div>;
}

export function SelectionPanel({ allPlaces, savedPlaces, onRemove, onSelect, onBuildSequence,
  onExplore, divergence = [], travellers = [], activeTravellerId = null, stanceFor,
  otherPersonMarkerFor }: Props) {
  const [lens, setLens] = useState<Lens>("together");
  const entryById = useMemo(() => new Map(divergence.map((entry) => [entry.placeId, entry])), [divergence]);
  const agreed = savedPlaces.filter((place) => entryById.get(place.id)?.group === "agreed");
  const differing = savedPlaces.filter((place) => entryById.get(place.id)?.group === "differing");
  const onePerson = travellers.map((traveller) => ({
    traveller,
    places: savedPlaces.filter((place) => {
      const group = entryById.get(place.id)?.group;
      return (group === "only-you" || group === "only-them") && stanceFor(place.id, traveller.id) === "interested";
    }),
  }));
  const visiblePlaces = lens === "together" ? savedPlaces : savedPlaces.filter((place) => stanceFor(place.id, lens) === "interested");
  // An absent stance is deliberately excluded. In the joint lens, split opinions already have
  // their own section; Descartados contains places with an explicit “no” and no “sí”.
  const discarded = allPlaces.filter((place) => lens === "together"
    ? travellers.some((person) => stanceFor(place.id, person.id) === "not-interested") &&
      travellers.every((person) => stanceFor(place.id, person.id) !== "interested")
    : stanceFor(place.id, lens) === "not-interested");
  const summary = summarizeSelection(visiblePlaces);
  const cities = new Set(visiblePlaces.map((place) => place.municipality || place.hub)).size;
  const activeName = travellers.find((traveller) => traveller.id === lens)?.label;
  const hubs = groupByHub(visiblePlaces);
  const distribution = blockDistribution(visiblePlaces);
  const groupProps = { onSelect, onRemove, activeTravellerId, stanceFor, otherPersonMarkerFor };

  return (
    <section className="selection-panel" aria-labelledby="want-title">
      <header className="selection-panel__header"><h1 id="want-title">Quiero ir <span className="selection-panel__count" aria-label={`${savedPlaces.length} lugares`}>{savedPlaces.length}</span></h1></header>
      <div className="selection-segmented" role="group" aria-label="Filtrar lugares por persona">
        <button type="button" aria-pressed={lens === "together"} onClick={() => setLens("together")}>Los dos</button>
        {travellers.map((traveller) => <button key={traveller.id} type="button" aria-pressed={lens === traveller.id} onClick={() => setLens(traveller.id)}>{traveller.label}</button>)}
      </div>
      <div className="selection-panel__summary" aria-label="Resumen de lugares">
        <div className="selection-panel__metric"><span className="selection-panel__metric-value">{summary.savedCount}</span><span className="selection-panel__metric-label">lugares</span></div>
        <div className="selection-panel__metric"><span className="selection-panel__metric-value">{cities}</span><span className="selection-panel__metric-label">ciudades</span></div>
        <div className="selection-panel__metric"><span className="selection-panel__metric-value">{summary.visitTime ? `≈${formatRange(summary.visitTime)}` : "—"}</span><span className="selection-panel__metric-label">de visitas <EvidenceMark level="estimado" label={false} detail="Sólo tiempo dentro de cada lugar" /></span></div>
        <p className="selection-panel__disclaimer">Sólo tiempo dentro de cada lugar. No incluye traslados.</p>
      </div>

      {savedPlaces.length === 0 && discarded.length === 0 ? (
        <div className="selection-panel__empty"><Icon name="corazon" size={32} /><h2>Todavía no hay nada guardado</h2><p>Pulsa el corazón de una tarjeta o «Quiero ir» dentro de una ficha; guardad de más, que luego se recorta.</p><button type="button" className="button button--secondary" onClick={onExplore}>Explorar Tokio</button></div>
      ) : lens !== "together" ? (
        <section className="selection-section"><h2>Lugares de {activeName}</h2>{visiblePlaces.length ? <PlaceGroups places={visiblePlaces} {...groupProps} /> : <p className="selection-panel__filter-empty">{activeName} todavía no ha marcado lugares.</p>}</section>
      ) : <>
        <section className="selection-section selection-section--agreed"><h2><Icon name="corazon-relleno" size={20} /> Los dos queréis ir <span>({agreed.length})</span></h2>
          {agreed.length ? <PlaceGroups places={agreed} {...groupProps} /> : <p className="selection-panel__filter-empty">Todavía no hay coincidencias. Seguid marcando lugares.</p>}
        </section>
        {onePerson.map(({ traveller, places }) => places.length > 0 && <details className="selection-section selection-section--fold" key={traveller.id}><summary>Sólo {traveller.label} <span>({places.length})</span><Icon name="expandir" size={16} /></summary><PlaceGroups places={places} {...groupProps} /></details>)}
        <details className="selection-section selection-section--fold"><summary>Opiniones distintas <span>({differing.length})</span><Icon name="expandir" size={16} /></summary>{differing.length ? <PlaceGroups places={differing} {...groupProps} /> : <p className="selection-panel__filter-empty">No hay lugares con opiniones distintas.</p>}</details>
      </>}

      <details className="selection-section selection-section--fold selection-section--discarded">
        <summary>Descartados <span>({discarded.length})</span><Icon name="expandir" size={16} /></summary>
        {discarded.length ? <PlaceGroups places={discarded} {...groupProps} /> : <p className="selection-panel__filter-empty">No habéis descartado ningún lugar.</p>}
      </details>

      {visiblePlaces.length > 0 && <section className="selection-insights" aria-labelledby="selection-insights-title">
        <h2 id="selection-insights-title">Cómo se reparte vuestra selección</h2>
        {summary.commitmentCount > 0 && <p><strong>{summary.commitmentCount}</strong> con compromiso de jornada: {summary.commitments.map(({ block, count }) => `${count} ${planningBlockLabel(block).toLowerCase()}`).join(" · ")}.</p>}
        {summary.nonQuantified.length > 0 && <p><strong>{summary.nonQuantified.length}</strong> sin estimación numérica: {summary.nonQuantified.map((place) => place.name).join(", ")}.</p>}
        {hubs.map((hub) => { const report = concentration(hub.key, hub.places); return <section className="selection-insights__hub" key={hub.key}><h3>{hub.label} <span>({hub.places.length})</span></h3>
          <p>{groupByCluster(hub.places).map((cluster) => `${cluster.label} (${cluster.places.length})`).join(" · ")}</p>
          {report.hasConcentration && <p>Concentración: {report.topClusters.map((cluster) => cluster.label).join(", ")} reúne {Math.round(report.topShare * 100)} %.</p>}
          {report.hasDispersion && <p>Dispersión: {report.distinctClusters} zonas distintas.</p>}
        </section>; })}
        <section className="selection-insights__duration"><h3>Distribución por duración</h3><ul>{distribution.map(({ block, count }) => <li key={block}>{planningBlockLabel(block)} <span>{count}</span></li>)}</ul></section>
      </section>}

      {savedPlaces.length > 0 && <div className="selection-panel__cta"><button type="button" className="button button--primary button--lg" onClick={onBuildSequence}><Icon name="calendario" size={20} /> Llevar al viaje</button></div>}
    </section>
  );
}
