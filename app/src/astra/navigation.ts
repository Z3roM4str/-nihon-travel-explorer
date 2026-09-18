export type ExploreState = {
  hub: string | null;
  query: string;
  category: string;
  page: number;
  mode: "lista" | "mapa";
};

export type AstraRoute =
  | ({ surface: "explore"; placeId: null } & ExploreState)
  | { surface: "trip"; hub: null; placeId: null }
  | { surface: "regions"; hub: null; placeId: null }
  | { surface: "place"; hub: string | null; placeId: string };

export const EMPTY_EXPLORE_STATE: ExploreState = { hub: null, query: "", category: "", page: 1, mode: "lista" };

export function parseAstraRoute(hash: string): AstraRoute {
  const raw = hash.replace(/^#/, "") || "/explorar";
  const [path, query = ""] = raw.split("?");
  const params = new URLSearchParams(query);
  const hub = params.get("hub");
  if (path === "/viaje" || path.startsWith("/viaje/")) return { surface: "trip", hub: null, placeId: null };
  if (path === "/regiones") return { surface: "regions", hub: null, placeId: null };
  const match = /^\/lugar\/(JP-\d{3})$/.exec(path);
  if (match) return { surface: "place", hub, placeId: match[1] };
  const parsedPage = Number(params.get("page"));
  return {
    surface: "explore", placeId: null, hub,
    query: params.get("q") ?? "", category: params.get("category") ?? "",
    page: Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1,
    mode: params.get("mode") === "mapa" ? "mapa" : "lista",
  };
}

export function exploreHref(state?: Partial<ExploreState> | string | null): string {
  if (typeof state === "string") state = { hub: state };
  const value = { ...EMPTY_EXPLORE_STATE, ...(state ?? {}) };
  const params = new URLSearchParams();
  if (value.hub) params.set("hub", value.hub);
  if (value.query) params.set("q", value.query);
  if (value.category) params.set("category", value.category);
  if (value.page > 1) params.set("page", String(value.page));
  if (value.mode === "mapa") params.set("mode", "mapa");
  const suffix = params.toString();
  return `#/explorar${suffix ? `?${suffix}` : ""}`;
}

export function placeHref(id: string, hub?: string | null): string {
  return `#/lugar/${id}${hub ? `?hub=${encodeURIComponent(hub)}` : ""}`;
}
