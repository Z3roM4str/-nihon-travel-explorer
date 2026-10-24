import { useEffect, useState } from "react";

/**
 * GeoJSON shape of the derived prefecture layer in `public/geography/`. Only the two
 * properties Nihon relies on are typed: `code` is the join key against the prefecture
 * metadata, `nameJa` is carried straight from the MLIT source for traceability.
 */
export type PrefectureFeature = {
  type: "Feature";
  id?: string;
  properties: { code: string; nameJa: string };
  geometry: { type: "Polygon" | "MultiPolygon"; coordinates: number[][][] | number[][][][] };
};

export type PrefectureGeometry = {
  type: "FeatureCollection";
  features: PrefectureFeature[];
};

export type GeometryState =
  | { status: "loading" }
  | { status: "ready"; geometry: PrefectureGeometry }
  | { status: "error" };

/** Derived from MLIT N03 at build time and served from our own origin, so it stays available
 * with no external network and can be cached like any other static asset. */
const GEOMETRY_URL = `${import.meta.env.BASE_URL}geography/japan-prefectures.geojson`;

/** Module-level cache: the file is fetched once per session, not once per mount. */
let cached: PrefectureGeometry | null = null;
let inFlight: Promise<PrefectureGeometry> | null = null;

function loadGeometry(): Promise<PrefectureGeometry> {
  if (cached) return Promise.resolve(cached);
  if (!inFlight) {
    inFlight = fetch(GEOMETRY_URL)
      .then((response) => {
        if (!response.ok) throw new Error(`geometry request failed: ${response.status}`);
        return response.json() as Promise<PrefectureGeometry>;
      })
      .then((geometry) => {
        cached = geometry;
        return geometry;
      })
      .catch((error) => {
        inFlight = null;
        throw error;
      });
  }
  return inFlight;
}

/** Loads the national prefecture polygons asynchronously so they never sit in the JS bundle. */
export function useJapanGeometry(): GeometryState {
  const [state, setState] = useState<GeometryState>(() =>
    cached ? { status: "ready", geometry: cached } : { status: "loading" }
  );

  useEffect(() => {
    if (cached) return;
    let active = true;
    loadGeometry()
      .then((geometry) => {
        if (active) setState({ status: "ready", geometry });
      })
      .catch(() => {
        if (active) setState({ status: "error" });
      });
    return () => {
      active = false;
    };
  }, []);

  return state;
}
