import { useLayoutEffect, useRef } from "react";
import type { ComponentProps } from "react";
import type { ZoneMap } from "./ZoneMap";
import { useMapModule } from "./map-loader";
import "./map-loading.css";

export function DeferredZoneMap(props: ComponentProps<typeof ZoneMap>) {
  const loading = useMapModule();
  const root = useRef<HTMLDivElement>(null);
  const returnFocus = useRef(false);
  useLayoutEffect(() => {
    if (loading.status === "ready" && returnFocus.current) {
      root.current?.querySelector<HTMLElement>(".leaflet-container")?.focus({ preventScroll: true });
      returnFocus.current = false;
    }
  }, [loading.status]);
  return (
    <div className="map-loading-boundary" ref={root} tabIndex={-1}>
      {loading.status === "ready" ? <loading.module.ZoneMap {...props} /> : (
        <div className="map-loading" role="status" aria-live="polite">
          <p>{loading.status === "loading" ? "Cargando el mapa…" : "No se pudo cargar el mapa. Puedes seguir comparando las zonas."}</p>
          {loading.status === "error" && <button type="button" className="button button--secondary" onClick={() => {
            returnFocus.current = true;
            root.current?.focus({ preventScroll: true });
            loading.retry();
          }}>Reintentar</button>}
        </div>
      )}
    </div>
  );
}
