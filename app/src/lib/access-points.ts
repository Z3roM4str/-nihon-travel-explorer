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

function cloneAccessPoint(point: LogisticsAccessPoint): LogisticsAccessPoint {
  return {
    ...point,
    coordinates: { ...point.coordinates },
    applicableContexts: [...point.applicableContexts],
    provenance: { ...point.provenance },
    selection: {
      ...point.selection,
      ...(point.selection.defaultForContexts
        ? { defaultForContexts: [...point.selection.defaultForContexts] }
        : {}),
    },
  };
}

/** Builds isolated snapshot lookups. Input order is preserved and has no priority meaning. */
export function buildAccessPointReader(source: readonly LogisticsAccessPoint[]): AccessPointReader {
  const points = source.map(cloneAccessPoint);
  const byId = new Map(points.map((point) => [point.id, point]));

  return {
    getAllAccessPoints: () => points.map(cloneAccessPoint),
    getAccessPointById: (id) => {
      const point = byId.get(id);
      return point ? cloneAccessPoint(point) : undefined;
    },
    getAccessPointsForPlace: (placeId) =>
      points.filter((point) => point.placeId === placeId).map(cloneAccessPoint),
    getAccessPointsForContext: (placeId, context) =>
      points.filter(
        (point) =>
          point.status === "active" &&
          point.placeId === placeId &&
          point.applicableContexts.includes(context),
      ).map(cloneAccessPoint),
  };
}

const reader = buildAccessPointReader(accessPointsData as LogisticsAccessPoint[]);

export const getAllAccessPoints = reader.getAllAccessPoints;
export const getAccessPointById = reader.getAccessPointById;
export const getAccessPointsForPlace = reader.getAccessPointsForPlace;
export const getAccessPointsForContext = reader.getAccessPointsForContext;
