import accessPointsData from "../data/logistics/access-points.json";

export type AccessPointRole =
  | "visitor-entrance"
  | "gate"
  | "reception"
  | "trailhead"
  | "road-access"
  | "transit-stop"
  | "general-access";

export type AccessContext =
  | "external-walk"
  | "external-local-transit"
  | "internal-shuttle"
  | "internal-hike";

export type AccessPointConfidence = "official-explicit" | "official-derived";

export type AccessPointProvenance = {
  sourceUrl: string;
  sourceEntity: string;
  consultedAt: string;
  evidence: string;
  confidence: AccessPointConfidence;
};

export type LogisticsAccessPoint = {
  id: string;
  placeId: string;
  label: string;
  role: AccessPointRole;
  coordinates: { lat: number; lng: number };
  applicableContexts: AccessContext[];
  provenance: AccessPointProvenance;
  selection: { defaultForContexts?: AccessContext[] };
  status: "active" | "deprecated";
  notes?: string;
};

export type AccessPointReader = {
  getAllAccessPoints: () => LogisticsAccessPoint[];
  getAccessPointById: (id: string) => LogisticsAccessPoint | undefined;
  getAccessPointsForPlace: (placeId: string) => LogisticsAccessPoint[];
  getAccessPointsForContext: (placeId: string, context: AccessContext) => LogisticsAccessPoint[];
};

/** Builds read-only-by-copy lookups. Input order is preserved and has no priority meaning. */
export function buildAccessPointReader(source: readonly LogisticsAccessPoint[]): AccessPointReader {
  const points = [...source];
  const byId = new Map(points.map((point) => [point.id, point]));

  return {
    getAllAccessPoints: () => [...points],
    getAccessPointById: (id) => byId.get(id),
    getAccessPointsForPlace: (placeId) => points.filter((point) => point.placeId === placeId),
    getAccessPointsForContext: (placeId, context) =>
      points.filter(
        (point) => point.placeId === placeId && point.applicableContexts.includes(context),
      ),
  };
}

const reader = buildAccessPointReader(accessPointsData as LogisticsAccessPoint[]);

export const getAllAccessPoints = reader.getAllAccessPoints;
export const getAccessPointById = reader.getAccessPointById;
export const getAccessPointsForPlace = reader.getAccessPointsForPlace;
export const getAccessPointsForContext = reader.getAccessPointsForContext;
