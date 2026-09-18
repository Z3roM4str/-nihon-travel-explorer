import { PLANNING_BLOCKS, type PlanningBlock } from "../lib/planning-block";
import type { ReservationFilterValue } from "../lib/reservation";

const GRADES = ["S", "A", "B", "C", "D"] as const;
const TOURISM_LEVELS = ["Extremo", "Alto", "Medio", "Bajo"] as const;
const RESERVATIONS: ReservationFilterValue[] = ["all", "required", "recommended", "not-required", "optional", "role-specific"];
const unique = (values: string[]) => [...new Set(values)];

export type ExploreState = {
  hub: string | null;
  query: string;
  categories: string[];
  grades: string[];
  planningBlocks: PlanningBlock[];
  hiddenGemStatuses: string[];
  tourismLevels: string[];
  reservation: ReservationFilterValue;
  page: number;
  mode: "lista" | "mapa";
};

export type AstraRoute =
  | ({ surface: "explore"; placeId: null } & ExploreState)
  | { surface: "trip"; hub: null; placeId: null }
  | { surface: "regions"; hub: null; placeId: null }
  | { surface: "place"; hub: string | null; placeId: string };

export const EMPTY_EXPLORE_STATE: ExploreState = { hub:null, query:"", categories:[], grades:[], planningBlocks:[], hiddenGemStatuses:[], tourismLevels:[], reservation:"all", page:1, mode:"lista" };

export function parseAstraRoute(hash: string): AstraRoute {
  const raw = hash.replace(/^#/, "") || "/explorar";
  const [path, query = ""] = raw.split("?");
  const params = new URLSearchParams(query);
  const hub = params.get("hub");
  if (path === "/viaje" || path.startsWith("/viaje/")) return { surface:"trip", hub:null, placeId:null };
  if (path === "/regiones") return { surface:"regions", hub:null, placeId:null };
  const match = /^\/lugar\/(JP-\d{3})$/.exec(path);
  if (match) return { surface:"place", hub, placeId:match[1] };
  const parsedPage = Number(params.get("page"));
  const reservation = params.get("reservation") as ReservationFilterValue | null;
  return {
    surface:"explore", placeId:null, hub, query:params.get("q") ?? "",
    categories:unique(params.getAll("category")),
    grades:unique(params.getAll("grade")).filter(value => GRADES.includes(value as typeof GRADES[number])),
    planningBlocks:unique(params.getAll("duration")).filter((value): value is PlanningBlock => PLANNING_BLOCKS.includes(value as PlanningBlock)),
    hiddenGemStatuses:unique(params.getAll("hidden")),
    tourismLevels:unique(params.getAll("tourism")).filter(value => TOURISM_LEVELS.includes(value as typeof TOURISM_LEVELS[number])),
    reservation:reservation && RESERVATIONS.includes(reservation) ? reservation : "all",
    page:Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1,
    mode:params.get("mode") === "mapa" ? "mapa" : "lista",
  };
}

export function exploreHref(state?: Partial<ExploreState> | string | null): string {
  if (typeof state === "string") state = { hub:state };
  const value = { ...EMPTY_EXPLORE_STATE, ...(state ?? {}) };
  const params = new URLSearchParams();
  if (value.hub) params.set("hub", value.hub);
  if (value.query) params.set("q", value.query);
  for (const category of value.categories) params.append("category", category);
  for (const grade of value.grades) params.append("grade", grade);
  for (const block of value.planningBlocks) params.append("duration", block);
  for (const status of value.hiddenGemStatuses) params.append("hidden", status);
  for (const level of value.tourismLevels) params.append("tourism", level);
  if (value.reservation !== "all") params.set("reservation", value.reservation);
  if (value.page > 1) params.set("page", String(value.page));
  if (value.mode === "mapa") params.set("mode", "mapa");
  const suffix = params.toString();
  return `#/explorar${suffix ? `?${suffix}` : ""}`;
}

export function placeHref(id: string, hub?: string | null): string {
  return `#/lugar/${id}${hub ? `?hub=${encodeURIComponent(hub)}` : ""}`;
}
