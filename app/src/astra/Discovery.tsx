import { useEffect, useMemo, useRef, useState } from "react";
import type { Place } from "../types";
import { matchesQuery } from "../lib/place";
import { GRADE_ORDER } from "./recommendation";
import { PlaceCard } from "./PlaceCard";

type Props = { places: Place[]; hubs: string[]; initialHub: string | null; savedIds: string[]; onToggle: (id: string) => void };

export function Discovery({ places, hubs, initialHub, savedIds, onToggle }: Props) {
  const validInitialHub = initialHub && hubs.includes(initialHub) ? initialHub : "";
  const [hub, setHub] = useState(validInitialHub);
  const [category, setCategory] = useState("");
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(12);
  const moreRef = useRef<HTMLButtonElement>(null);
  const categories = useMemo(() => [...new Set(places.map(p => p.category))].sort((a,b) => a.localeCompare(b,"es")), [places]);
  const hubOrder = useMemo(() => new Map(hubs.map((value,index) => [value,index])), [hubs]);
  const results = useMemo(() => places.filter(p => (!hub || p.hub === hub) && (!category || p.category === category) && matchesQuery(p, query)).sort((a,b) => (GRADE_ORDER[a.grade] ?? 9) - (GRADE_ORDER[b.grade] ?? 9) || (hub ? a.id.localeCompare(b.id) : (hubOrder.get(a.hub) ?? 9) - (hubOrder.get(b.hub) ?? 9) || a.id.localeCompare(b.id))), [places, hub, category, query, hubOrder]);
  useEffect(() => { const next = hub ? `#/explorar?hub=${encodeURIComponent(hub)}` : "#/explorar"; history.replaceState(null, "", next); }, [hub]);
  return <>
    <section className="astra-intro"><p className="astra-eyebrow">JAPÓN, A SU MANERA</p><h1>{hub ? `Descubre ${hub}` : "¿Qué les gustaría descubrir?"}</h1><p>Marca lo que te gusta. El viaje lo armamos después.</p></section>
    <section className="astra-controls" aria-label="Buscar lugares">
      <label className="astra-search"><span aria-hidden="true">⌕</span><span className="visually-hidden">Busca un lugar o una experiencia</span><input type="search" value={query} onChange={e => { setQuery(e.target.value); setShown(12); }} placeholder="Busca un lugar o una experiencia" /></label>
      <div className="astra-quick"><label><span className="visually-hidden">Hub</span><select value={hub} onChange={e => { setHub(e.target.value); setShown(12); }}><option value="">Todo Japón</option>{hubs.map(h => <option key={h}>{h}</option>)}</select></label><label><span className="visually-hidden">Experiencias</span><select value={category} onChange={e => { setCategory(e.target.value); setShown(12); }}><option value="">Experiencias</option>{categories.map(c => <option key={c}>{c}</option>)}</select></label><a className="astra-region-link" href="#/regiones">Explorar por región</a></div>
    </section>
    <div className="astra-results"><h2>{hub ? `Lugares en ${hub}` : "Lugares para descubrir"}</h2><span role="status" aria-live="polite">{results.length} resultados</span></div>
    {results.length ? <div className="astra-grid">{results.slice(0,shown).map(place => <PlaceCard key={place.id} place={place} saved={savedIds.includes(place.id)} onToggle={onToggle} />)}</div> : <div className="astra-empty"><h2>Ningún lugar coincide</h2><p>Prueba otro término o cambia los filtros.</p></div>}
    {shown < results.length && <button ref={moreRef} className="astra-more" onClick={() => { setShown(v => v + 12); requestAnimationFrame(() => moreRef.current?.focus()); }}>Ver 12 más</button>}
  </>;
}
