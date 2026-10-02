import { useLayoutEffect, useRef, useState } from "react";
import type { ComponentProps } from "react";
import type { PlaceMap } from "./PlaceMap";
import { useMapModule, useMapMount } from "./map-loader";
import "./PlaceMap.css";
import "./map-loading.css";

type Props = ComponentProps<typeof PlaceMap> & { active: boolean };

export function DeferredPlaceMap({ active, ...props }: Props) {
  const [visited, setVisited] = useState(active);
  if (active && !visited) setVisited(true);
  const loading = useMapModule(active || visited);
  const root = useRef<HTMLDivElement>(null);
  const returnFocus = useRef(false);
  const mounted = useMapMount(loading.status === "ready" && (active || visited), root);
  useLayoutEffect(() => {
    if (loading.status === "ready" && mounted && returnFocus.current) {
      root.current?.querySelector<HTMLElement>(".leaflet-container")?.focus({ preventScroll: true });
      returnFocus.current = false;
    }
  }, [loading.status, mounted]);
  if (!active && !visited) return null;
  return (
    <div className="map-loading-boundary" ref={root} tabIndex={-1}>
      {loading.status === "ready" && mounted ? <loading.module.PlaceMap {...props} /> : (
        <div className="map-loading" role="status" aria-live="polite">
          <p>{loading.status !== "error" ? "Cargando el mapa…" : "No se pudo cargar el mapa. Puedes seguir explorando con la lista de lugares."}</p>
          {loading.status === "error" && (
            <button type="button" className="button button--secondary" onClick={() => {
              returnFocus.current = true;
              root.current?.focus({ preventScroll: true });
              loading.retry();
            }}>Reintentar</button>
          )}
        </div>
      )}
    </div>
  );
}
