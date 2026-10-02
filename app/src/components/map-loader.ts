import { useEffect, useState } from "react";

type MapModule = typeof import("./map-runtime");
type State = { status: "loading" } | { status: "error" } | { status: "ready"; module: MapModule };
let cached: MapModule | null = null;
let pending: Promise<MapModule> | null = null;
let failures = 0;

/** The map graph has a single deferred asset, with only already loaded host dependencies.
 * A fresh URL retries the entire graph after a failed native import (cached by browsers).
 * The manifest is read only after failure; never on the first-paint path. */
async function retryImport(): Promise<MapModule> {
  const response = await fetch(`${import.meta.env.BASE_URL}map-manifest.json`);
  if (!response.ok) throw new Error("Map manifest unavailable");
  const manifest = await response.json() as Record<string, { file: string }>;
  const file = manifest["src/components/map-runtime.ts"]?.file;
  if (!file) throw new Error("Map entry unavailable");
  const url = new URL(`${import.meta.env.BASE_URL}${file}`, window.location.href);
  url.searchParams.set("nihon-map-retry", String(failures));
  return import(/* @vite-ignore */ url.href) as Promise<MapModule>;
}

function loadMap(): Promise<MapModule> {
  if (cached) return Promise.resolve(cached);
  if (!pending) {
    pending = (failures ? retryImport() : import("./map-runtime"))
      .then(module => { cached = module; return module; })
      .catch(error => { failures++; throw error; })
      .finally(() => { pending = null; });
  }
  return pending;
}

/** Keep successful maps mounted while hidden. No map load writes V8. */
export function useMapModule(enabled = true) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<State>(() => cached ? { status: "ready", module: cached } : { status: "loading" });
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    loadMap().then(
      module => { if (active) setState({ status: "ready", module }); },
      () => { if (active) setState({ status: "error" }); },
    );
    return () => { active = false; };
  }, [enabled, attempt]);
  return { ...state, retry: () => { setState({ status: "loading" }); setAttempt(value => value + 1); } };
}
