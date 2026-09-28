import { useMemo, useState } from "react";
import type { Place } from "../types";
import { cardImageUrl, resolvePlaceImages } from "../data/place-images";
import { formatRange, resolveDuration } from "../lib/duration";
import { summarizeSelection } from "../lib/selection";
import type { DivergenceEntry } from "../lib/interest-divergence";
import type { InterestStance, Traveller } from "../lib/travellers";
import { EvidenceMark } from "./EvidenceMark";
import { Icon } from "../icons/Icon";

type Props = {
  savedPlaces: Place[];
  onRemove: (id: string) => void;
  onSelect: (id: string) => void;
  onBuildSequence: () => void;
  onExplore: () => void;
  divergence?: readonly DivergenceEntry[];
  travellers?: readonly Traveller[];
  activeTravellerLabel?: string | null;
  stanceFor: (placeId: string, travellerId: string) => InterestStance | null;
};

type Lens = "together" | string;

function PlaceRows({ places, onSelect, onRemove, activeTravellerLabel }: {
  places: readonly Place[];
  onSelect: (id: string) => void;
  onRemove?: (id: string) => void;
  activeTravellerLabel?: string | null;
}) {
  return (
    <ul className="selection-list">
      {places.map((place) => {
        const image = resolvePlaceImages(place.id, place.images)[0];
        const duration = resolveDuration(place.duration);
        return (
          <li key={place.id} className="selection-list__item">
            <button type="button" className="selection-list__name" onClick={() => onSelect(place.id)}
              aria-label={`Abrir ${place.name}, ${place.hub}`}>
              <span className="selection-list__thumb" aria-hidden="true">
                {image ? <img src={cardImageUrl(image.url) ?? image.url} alt="" width={48} height={48} loading="lazy" decoding="async" /> : <Icon name="imagen" size={20} />}
              </span>
              <span className="selection-list__text">
                <span className="selection-list__place">{place.name}</span>
                <span className="selection-list__meta">{place.hub}<span aria-hidden="true"> · </span>{duration ? formatRange(duration) : place.duration.raw}</span>
              </span>
            </button>
            {onRemove && <button type="button" className="icon-button icon-button--small"
              aria-label={activeTravellerLabel ? `Quitar ${place.name} de Quiero ir de ${activeTravellerLabel}` : `Quitar ${place.name} de Quiero ir`}
              title={activeTravellerLabel ? `Quitar ${place.name} de Quiero ir de ${activeTravellerLabel}` : `Quitar ${place.name} de Quiero ir`}
              onClick={() => onRemove(place.id)}><Icon name="cerrar" size={16} /></button>}
          </li>
        );
      })}
    </ul>
  );
}

export function SelectionPanel({ savedPlaces, onRemove, onSelect, onBuildSequence, onExplore, divergence = [], travellers = [], activeTravellerLabel = null, stanceFor }: Props) {
  const [lens, setLens] = useState<Lens>("together");
  const entryById = useMemo(() => new Map(divergence.map((entry) => [entry.placeId, entry])), [divergence]);
  const agreed = savedPlaces.filter((place) => entryById.get(place.id)?.group === "agreed");
  const differing = savedPlaces.filter((place) => entryById.get(place.id)?.group === "differing");
  const onePerson = travellers.map((traveller) => ({
    traveller,
    places: savedPlaces.filter((place) => {
      const entry = entryById.get(place.id);
      return (entry?.group === "only-you" || entry?.group === "only-them") && stanceFor(place.id, traveller.id) === "interested";
    }),
  }));
  const visiblePlaces = lens === "together" ? savedPlaces : savedPlaces.filter((place) => stanceFor(place.id, lens) === "interested");
  const summary = summarizeSelection(visiblePlaces);
  const cities = new Set(visiblePlaces.map((place) => place.hub)).size;
  const activeName = travellers.find((traveller) => traveller.id === lens)?.label;

  return (
    <section className="selection-panel" aria-labelledby="want-title">
      <header className="selection-panel__header">
        <h1 id="want-title">Quiero ir <span className="selection-panel__count" aria-label={`${savedPlaces.length} lugares`}>{savedPlaces.length}</span></h1>
      </header>

      <div className="selection-segmented" role="group" aria-label="Filtrar lugares por persona">
        <button type="button" aria-pressed={lens === "together"} onClick={() => setLens("together")}>Los dos</button>
        {travellers.map((traveller) => <button key={traveller.id} type="button" aria-pressed={lens === traveller.id} onClick={() => setLens(traveller.id)}>{traveller.label}</button>)}
      </div>

      <div className="selection-panel__summary" aria-label="Resumen de lugares">
        <div className="selection-panel__metric"><span className="selection-panel__metric-value">{summary.savedCount}</span><span className="selection-panel__metric-label">lugares</span></div>
        <div className="selection-panel__metric"><span className="selection-panel__metric-value">{cities}</span><span className="selection-panel__metric-label">ciudades</span></div>
        <div className="selection-panel__metric"><span className="selection-panel__metric-value">{summary.visitTime ? `≈${formatRange(summary.visitTime)}` : "—"}</span><span className="selection-panel__metric-label">de visitas <EvidenceMark level="estimado" label={false} detail="Sólo tiempo dentro de cada lugar" /></span></div>
        <p className="selection-panel__disclaimer">Sólo tiempo dentro de cada lugar</p>
      </div>

      {savedPlaces.length === 0 ? (
        <div className="selection-panel__empty"><Icon name="corazon" size={32} /><h2>Todavía no habéis marcado nada</h2><p>Pulsa el corazón en cualquier lugar que os llame; guardad de más, que luego se recorta.</p><button type="button" className="button button--secondary" onClick={onExplore}>Explorar Tokio</button></div>
      ) : lens !== "together" ? (
        <section className="selection-section"><h2>Lugares de {activeName}</h2>{visiblePlaces.length ? <PlaceRows places={visiblePlaces} onSelect={onSelect} onRemove={onRemove} activeTravellerLabel={activeTravellerLabel} /> : <p className="selection-panel__filter-empty">{activeName} todavía no ha marcado lugares. Podéis seguir explorando y volver aquí cuando quiera.</p>}</section>
      ) : <>
        <section className="selection-section selection-section--agreed"><h2><Icon name="corazon-relleno" size={20} /> Los dos queréis ir <span>({agreed.length})</span></h2>
          {agreed.length ? <PlaceRows places={agreed} onSelect={onSelect} onRemove={onRemove} activeTravellerLabel={activeTravellerLabel} /> : <p className="selection-panel__filter-empty">{onePerson.some((group) => group.places.length) ? `Cuando ${onePerson.find((group) => group.places.length === 0)?.traveller.label ?? "la otra persona"} marque sus sitios, aquí veréis en qué coincidís.` : "Todavía no hay coincidencias. Seguid marcando lugares; aparecerán aquí en cuanto compartáis uno."}</p>}
        </section>
        {onePerson.map(({ traveller, places }) => places.length > 0 && <details className="selection-section selection-section--fold" key={traveller.id}><summary>Sólo {traveller.label} <span>({places.length})</span><Icon name="expandir" size={16} /></summary><PlaceRows places={places} onSelect={onSelect} onRemove={onRemove} activeTravellerLabel={activeTravellerLabel} /></details>)}
        <details className="selection-section selection-section--fold"><summary>Opiniones distintas <span>({differing.length})</span><Icon name="expandir" size={16} /></summary>{differing.length ? <PlaceRows places={differing} onSelect={onSelect} onRemove={onRemove} activeTravellerLabel={activeTravellerLabel} /> : <p className="selection-panel__filter-empty">No hay lugares con opiniones distintas.</p>}</details>
      </>}

      {savedPlaces.length > 0 && <div className="selection-panel__cta"><button type="button" className="button button--primary" onClick={onBuildSequence}><Icon name="calendario" size={20} /> Llevar al viaje</button></div>}
    </section>
  );
}
