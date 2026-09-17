export type AstraRoute =
  | { surface: "explore"; hub: string | null; placeId: null }
  | { surface: "trip"; hub: null; placeId: null }
  | { surface: "place"; hub: string | null; placeId: string };

export function parseAstraRoute(hash: string): AstraRoute {
  const raw = hash.replace(/^#/, "") || "/explorar";
  const [path, query = ""] = raw.split("?");
  const params = new URLSearchParams(query);
  const hub = params.get("hub");
  if (path === "/viaje" || path.startsWith("/viaje/")) return { surface: "trip", hub: null, placeId: null };
  const match = /^\/lugar\/(JP-\d{3})$/.exec(path);
  if (match) return { surface: "place", hub, placeId: match[1] };
  return { surface: "explore", hub, placeId: null };
}

export function exploreHref(hub?: string | null): string {
  return hub ? `#/explorar?hub=${encodeURIComponent(hub)}` : "#/explorar";
}

export function placeHref(id: string, hub?: string | null): string {
  return `#/lugar/${id}${hub ? `?hub=${encodeURIComponent(hub)}` : ""}`;
}
