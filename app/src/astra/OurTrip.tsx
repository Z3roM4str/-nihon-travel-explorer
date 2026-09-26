import { useMemo, useState } from "react";
import type { Place } from "../types";
import { PlaceCard } from "./PlaceCard";
import { RouteDialog } from "./RouteDialog";
import {
  applyDispositionBatch, groupedTripIds, matchesTripFilter, restoreDispositions,
  snapshotDispositions, sortTripPlaces, stableReviewQueue, tripCounts,
  type DispositionSnapshot, type TripFilter, type TripSort,
} from "./our-trip";
import { reviewPresentation, setDisposition, setPriority, setVote, type Disposition, type ReviewStore } from "./review";

type BatchTransaction = { ids: string[]; action: Disposition; before: DispositionSnapshot };
type Props = {
  places: Place[];
  store: ReviewStore;
  error: string | null;
  onCommit: (store: ReviewStore) => boolean;
  onRetry: () => boolean;
  onToggleInterest: (id: string) => void;
  onResetResponse: (id: string) => boolean;
  onRemoveFromQueue: (id: string) => boolean;
  isAuthored: (id: string) => boolean;
  hasAuthoredPlan: () => boolean;
  onOpen: (id: string) => void;
  onExplore: () => void;
  onAnalysis: () => void;
  onPlanner: () => void;
};
const filters: TripFilter[] = ["Todos", "Ambos", "Fernando", "Ella", "Pendientes", "Descartados"];
const moreFilters: TripFilter[] = ["Ninguno", "Gustos diferentes"];

function ModalPersistenceNotice({ error, onRetry }: { error: string; onRetry: () => void }) {
  return <div className="astra-persistence-notice" role="alert">
    <div><strong>No se pudieron guardar los cambios en este dispositivo.</strong><p>{error}</p></div>
    <button type="button" onClick={onRetry}>Reintentar guardar</button>
  </div>;
}

export function OurTrip(props: Props) {
  const { places, store } = props;
  const [view, setView] = useState<"Intereses"|"Planificar"|"Dónde alojarnos">("Intereses");
  const [filter, setFilter] = useState<TripFilter>("Todos");
  const [sort, setSort] = useState<TripSort>("recommendation");
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<BatchTransaction | null>(null);
  const [pendingBatch, setPendingBatch] = useState<BatchTransaction | null>(null);
  const [undo, setUndo] = useState<DispositionSnapshot | null>(null);
  const [queue, setQueue] = useState<string[] | null>(null);
  const [queueIndex, setQueueIndex] = useState(0);
  const [queueOpener, setQueueOpener] = useState<HTMLElement | null>(null);
  const [batchOpener, setBatchOpener] = useState<HTMLElement | null>(null);
  const byId = useMemo(() => new Map(places.map(place => [place.id, place])), [places]);
  const counts = tripCounts(store);
  const filtered = useMemo(() => sortTripPlaces(places.filter(place => store.places[place.id] && matchesTripFilter(store.places[place.id], filter)), store, sort), [places, store, filter, sort]);
  const groups = useMemo(() => groupedTripIds(places, store, sort), [places, store, sort]);
  const groupedCount = groups.reduce((total, group) => total + group.ids.length, 0);
  const shortlist = useMemo(() => sortTripPlaces(places.filter(place => store.places[place.id]?.disposition === "shortlisted"), store, sort), [places, store, sort]);

  const openQueue = (opener: HTMLElement) => { setQueueOpener(opener); setQueue(stableReviewQueue(store)); setQueueIndex(0); };
  const beginBatch = (action: Disposition, opener: HTMLElement) => {
    const ids = [...selected];
    setBatchOpener(opener);
    setConfirm({ ids, action, before: snapshotDispositions(store, ids) });
  };
  const commitBatch = () => {
    if (!confirm) return;
    if (props.onCommit(applyDispositionBatch(store, confirm.ids, confirm.action))) {
      setUndo(confirm.before); setConfirm(null); setSelected(new Set()); setSelecting(false);
    } else setPendingBatch(confirm);
  };
  const retryModal = () => {
    const succeeded = props.onRetry();
    if (succeeded && pendingBatch) {
      setUndo(pendingBatch.before); setPendingBatch(null); setConfirm(null); setSelected(new Set()); setSelecting(false);
    }
  };
  const toggleSelected = (id: string) => setSelected(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  const renderCard = (place: Place) => {
    const record = store.places[place.id];
    const presentation = reviewPresentation(record.votes.fernando, record.votes.ella, record.inReviewQueue);
    const status = record.legacy && record.votes.fernando === "unreviewed" && record.votes.ella === "unreviewed" ? "Guardado anterior · Sin asignar" : presentation.label;
    const activeVote = store.activeReviewer ? record.votes[store.activeReviewer] : "unreviewed";
    const removable = record.inReviewQueue && record.votes.fernando === "unreviewed" && record.votes.ella === "unreviewed" && !record.legacy && !props.isAuthored(place.id);
    return <div className="astra-trip-card" key={place.id} data-place-id={place.id}>
      {selecting && <label className="astra-batch-check"><input type="checkbox" checked={selected.has(place.id)} onChange={() => toggleSelected(place.id)} /> Seleccionar {place.name}</label>}
      <PlaceCard place={place} saved={activeVote === "yes"} status={status} together={presentation.hearts === 2} reviewerName={store.activeReviewer === "fernando" ? "Fernando" : store.activeReviewer === "ella" ? "Ella" : undefined} onToggle={props.onToggleInterest} onOpen={props.onOpen} />
      <details className="astra-trip-card__menu" open><summary>Más acciones</summary><div>
        {store.activeReviewer && <button onClick={() => props.onCommit((awaitVote(store, place.id, store.activeReviewer!, "no")))}>Ahora no</button>}
        {store.activeReviewer && activeVote !== "unreviewed" && <button onClick={() => props.onResetResponse(place.id)}>Restablecer mi respuesta</button>}
        {removable && <button onClick={() => props.onRemoveFromQueue(place.id)}>Quitar de pendientes</button>}
        <label>Prioridad del viaje<select value={record.priority ?? "Por decidir"} onChange={event => props.onCommit(setPriority(store, place.id, event.target.value as "Por decidir"|"Alta"|"Media"|"Baja"))}><option>Por decidir</option><option>Alta</option><option>Media</option><option>Baja</option></select></label>
        <button onClick={() => props.onCommit(setDisposition(store, place.id, "shortlisted"))}>Añadir a preselección</button>
        <button onClick={() => props.onCommit(setDisposition(store, place.id, "discarded"))}>Descartar del viaje</button>
      </div></details>
    </div>;
  };

  const empty = filter === "Todos"
    ? <div className="astra-empty"><h2>Su viaje empieza con un lugar</h2><button onClick={props.onExplore}>Explorar Japón</button></div>
    : filter === "Ambos" && Object.values(store.places).some(record => record.votes.fernando === "yes" || record.votes.ella === "yes")
      ? <div className="astra-empty"><h2>Todavía no hay coincidencias. Revisen lo que le gusta al otro.</h2><button onClick={event => openQueue(event.currentTarget)}>Ver pendientes</button></div>
      : filter === "Descartados" ? <div className="astra-empty"><h2>No han descartado lugares.</h2></div>
        : <div className="astra-empty"><h2>Sin lugares en {filter}</h2><button onClick={() => setFilter("Todos")}>Quitar filtros</button></div>;

  return <section className="astra-trip">
    <h1>Nuestro viaje</h1><p className="astra-trip__note">Primero elegimos lugares. Después armamos el recorrido.</p>
    <div className="astra-trip__counts"><div><strong>{counts.both}</strong><span>Ambos</span></div><div><strong>{counts.pending}</strong><span>Por comparar</span></div></div>
    <nav className="astra-trip__tabs" aria-label="Secciones de Nuestro viaje">{(["Intereses", "Planificar", "Dónde alojarnos"] as const).map(item => <button key={item} aria-pressed={view === item} onClick={() => setView(item)}>{item}</button>)}</nav>
    {view === "Intereses" && <>
      <div className="astra-trip__toolbar"><div className="astra-trip__filters">{filters.map(item => <button key={item} aria-pressed={filter === item} onClick={() => setFilter(item)}>{item}</button>)}<label>Más<select value={moreFilters.includes(filter) ? filter : ""} onChange={event => event.target.value && setFilter(event.target.value as TripFilter)}><option value="">Elegir</option>{moreFilters.map(item => <option key={item}>{item}</option>)}</select></label></div><label>Ordenar<select value={sort} onChange={event => setSort(event.target.value as TripSort)}><option value="priority">Prioridad del viaje</option><option value="recommendation">Recomendación</option><option value="name">Nombre</option><option value="hub">Hub</option></select></label><button onClick={() => { setSelecting(value => !value); setSelected(new Set()); }}> {selecting ? "Salir de selección" : "Seleccionar"}</button><button onClick={event => openQueue(event.currentTarget)}>Revisar pendientes</button></div>
      {selecting && <div className="astra-batch-bar"><strong>{selected.size} seleccionados</strong><button disabled={!selected.size} onClick={event => beginBatch("shortlisted", event.currentTarget)}>Preseleccionar</button><button disabled={!selected.size} onClick={event => beginBatch("discarded", event.currentTarget)}>Descartar</button></div>}
      {filter === "Todos" ? (groupedCount ? groups.map(group => group.ids.length ? <section key={group.label} className="astra-trip__group"><h2>{group.label}</h2><div className="astra-trip__grid">{group.ids.map(id => byId.get(id)).filter((place): place is Place => !!place).map(renderCard)}</div></section> : null) : empty) : filtered.length ? <div className="astra-trip__grid">{filtered.map(renderCard)}</div> : empty}
    </>}
    {view === "Planificar" && <section className="astra-planning-bridge"><h2>Preselección</h2>{shortlist.length ? <ul>{shortlist.map(place => <li key={place.id}>{place.name}</li>)}</ul> : <p>Preseleccionen lugares antes de ordenar el recorrido. El plan anterior, si existe, se conserva.</p>}<button onClick={props.onAnalysis}>Ver distribución y tiempos</button><p className="astra-trip__help">Los rangos corresponden a la visita. No incluye traslados.</p><button className="astra-trip__planner-action astra-trip__planner-action--primary" onClick={props.onPlanner}>{props.hasAuthoredPlan() ? "Continuar recorrido" : "Construir recorrido"}</button></section>}
    {view === "Dónde alojarnos" && <div className="astra-empty"><h2>Dónde alojarnos</h2><p>Esta entrada conserva el acceso al alojamiento del constructor actual. La comparación de zonas llegará en una fase posterior.</p><button onClick={props.onPlanner}>{props.hasAuthoredPlan() ? "Continuar recorrido" : "Construir recorrido"}</button></div>}
    {queue && <RouteDialog labelledBy="queue-title" onClose={() => setQueue(null)} returnFocus={queueOpener} overlayClassName="astra-confirm" panelClassName="astra-confirm__panel"><h2 id="queue-title">Revisar pendientes</h2>{props.error && <ModalPersistenceNotice error={props.error} onRetry={retryModal} />}{queue.length ? (() => { const id = queue[queueIndex]; return <><p>{queueIndex + 1} de {queue.length}</p><h3>{byId.get(id)?.name ?? id}</h3><p>Elige explícitamente una respuesta. Navegar no guarda votos.</p>{store.activeReviewer && <><button onClick={() => props.onCommit(awaitVote(store, id, store.activeReviewer!, "yes"))}>Quiero ir</button><button onClick={() => props.onCommit(awaitVote(store, id, store.activeReviewer!, "no"))}>Ahora no</button></>}<button disabled={queueIndex === 0} onClick={() => setQueueIndex(index => index - 1)}>Anterior</button><button disabled={queueIndex === queue.length - 1} onClick={() => setQueueIndex(index => index + 1)}>Siguiente</button></>; })() : <p>No hay pendientes.</p>}</RouteDialog>}
    {confirm && <RouteDialog labelledBy="batch-title" onClose={() => { if (!pendingBatch) setConfirm(null); }} returnFocus={batchOpener} overlayClassName="astra-confirm" panelClassName="astra-confirm__panel"><h2 id="batch-title">Confirmar {confirm.action === "shortlisted" ? "preselección" : "descarte"}</h2>{props.error && <ModalPersistenceNotice error={props.error} onRetry={retryModal} />}<p>{confirm.ids.length} lugares</p><details><summary>Revisar nombres</summary><ul>{confirm.ids.map(id => <li key={id}>{byId.get(id)?.name ?? id}</li>)}</ul></details><button disabled={!!pendingBatch} onClick={() => setConfirm(null)}>Cancelar</button><button disabled={!!pendingBatch} onClick={commitBatch}>Confirmar</button></RouteDialog>}
    {undo && <div className="astra-toast" role="status">Cambios guardados <button onClick={() => { if (props.onCommit(restoreDispositions(store, undo))) setUndo(null); }}>Deshacer</button></div>}
  </section>;
}

// Keeps every vote mutation on SOL-4's existing transition instead of creating a parallel record shape.
const awaitVote = (store: ReviewStore, id: string, reviewer: "fernando"|"ella", vote: "yes"|"no"|"unreviewed") => setVote(store, id, reviewer, vote);
