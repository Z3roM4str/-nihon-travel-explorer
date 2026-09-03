import { useCallback, useEffect, useMemo, useRef } from "react";
import { GeoJSON, MapContainer, useMap } from "react-leaflet";
import L from "leaflet";
import type { NavigationRegion } from "../data/geography";
import { countPlacesInPrefecture, getPrefectureByCode, getPrefecturesByRegion } from "../data/geography";
import type { PrefectureFeature, PrefectureGeometry } from "../data/useJapanGeometry";

/**
 * The geographic map of Japan. Deliberately a separate component from PlaceMap: PlaceMap
 * renders the places of one hub, this one renders administrative polygons and never shows
 * place markers. They share the Leaflet/react-leaflet infrastructure and nothing else.
 *
 * No tile layer is used on purpose. The polygons come from our own origin, so the national
 * view keeps working with no external network — and a plain background reads as a map of
 * the country rather than a street map zoomed out.
 */

/** Bounds of the whole country, wide enough to include Okinawa and the far north. */
const JAPAN_BOUNDS = L.latLngBounds([23.5, 122.0], [46.2, 149.5]);
const FALLBACK_CENTER: [number, number] = [37.5, 137.5];
const FALLBACK_ZOOM = 4;
const BOUNDS_PADDING: [number, number] = [24, 24];

/** Mirrors the palette tokens in App.css; Leaflet needs literal colours, not CSS variables. */
const NEUTRAL_FILL = "#e3ded6";
const NEUTRAL_STROKE = "#c0b8ab";
const ACCENT = "#b7282e";
const ACCENT_DARK = "#8d1f24";

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

type StyleContext = {
  activeRegion: NavigationRegion | null;
  selectedCode: string | null;
  hoveredCode: string | null;
};

function styleFor(code: string, context: StyleContext): L.PathOptions {
  const prefecture = getPrefectureByCode(code);
  const covered = countPlacesInPrefecture(code) > 0;
  const inActiveRegion =
    !context.activeRegion || prefecture?.region === context.activeRegion;
  const isSelected = context.selectedCode === code;
  const isHovered = context.hoveredCode === code;

  if (isSelected) {
    return {
      color: ACCENT_DARK,
      weight: 2.2,
      opacity: 1,
      fillColor: covered ? ACCENT_DARK : "#6b6257",
      fillOpacity: covered ? 0.82 : 0.45,
    };
  }

  const base: L.PathOptions = covered
    ? { color: ACCENT_DARK, fillColor: ACCENT, fillOpacity: isHovered ? 0.62 : 0.4 }
    : { color: NEUTRAL_STROKE, fillColor: NEUTRAL_FILL, fillOpacity: isHovered ? 0.95 : 0.72 };

  return {
    ...base,
    weight: isHovered ? 1.8 : 0.9,
    // Prefectures outside the region being browsed stay visible but recede.
    opacity: inActiveRegion ? 0.9 : 0.3,
    fillOpacity: inActiveRegion ? (base.fillOpacity as number) : 0.12,
  };
}

/** Fits the viewport to the active region, or back to the whole country. */
function FitViewport({
  activeRegion,
  boundsByCode,
}: {
  activeRegion: NavigationRegion | null;
  boundsByCode: Map<string, L.LatLngBounds>;
}) {
  const map = useMap();

  useEffect(() => {
    let target = JAPAN_BOUNDS;
    if (activeRegion) {
      const regionBounds = L.latLngBounds([]);
      for (const pref of getPrefecturesByRegion(activeRegion)) {
        const bounds = boundsByCode.get(pref.code);
        if (bounds) regionBounds.extend(bounds);
      }
      if (regionBounds.isValid()) target = regionBounds;
    }

    if (prefersReducedMotion()) {
      map.fitBounds(target, { padding: BOUNDS_PADDING, animate: false });
    } else {
      map.flyToBounds(target, { padding: BOUNDS_PADDING, duration: 0.7 });
    }
  }, [activeRegion, boundsByCode, map]);

  return null;
}

/** Leaflet caches container size; recompute whenever the surrounding layout changes. */
function InvalidateOnResize() {
  const map = useMap();
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize({ animate: false }));
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);
  return null;
}

type Props = {
  geometry: PrefectureGeometry;
  activeRegion: NavigationRegion | null;
  selectedCode: string | null;
  onSelectPrefecture: (code: string) => void;
};

export function NationalMap({ geometry, activeRegion, selectedCode, onSelectPrefecture }: Props) {
  const layerRef = useRef<L.GeoJSON | null>(null);
  const hoveredRef = useRef<string | null>(null);
  // onEachFeature and the Leaflet event handlers run once per layer creation, so they read
  // the latest props through refs instead of capturing stale ones.
  const selectRef = useRef(onSelectPrefecture);
  useEffect(() => {
    selectRef.current = onSelectPrefecture;
  }, [onSelectPrefecture]);

  const context = useMemo<StyleContext>(
    () => ({ activeRegion, selectedCode, hoveredCode: null }),
    [activeRegion, selectedCode]
  );
  const contextRef = useRef(context);

  const restyle = useCallback((hoveredCode: string | null) => {
    const layer = layerRef.current;
    if (!layer) return;
    layer.setStyle((feature) =>
      styleFor(
        ((feature as PrefectureFeature | undefined)?.properties.code) ?? "",
        { ...contextRef.current, hoveredCode }
      )
    );
  }, []);

  // Region/selection changes restyle the existing layers rather than rebuilding 47 polygons.
  useEffect(() => {
    contextRef.current = context;
    restyle(hoveredRef.current);
  }, [context, restyle]);

  const boundsByCode = useMemo(() => {
    const map = new Map<string, L.LatLngBounds>();
    for (const feature of geometry.features) {
      map.set(feature.properties.code, L.geoJSON(feature as never).getBounds());
    }
    return map;
  }, [geometry]);

  const onEachFeature = useCallback(
    (feature: PrefectureFeature, layer: L.Layer) => {
      const code = feature.properties.code;
      const prefecture = getPrefectureByCode(code);
      const count = countPlacesInPrefecture(code);
      const label = prefecture?.displayName ?? feature.properties.nameJa;
      layer.bindTooltip(
        count > 0
          ? `${label} — ${count} lugar${count === 1 ? "" : "es"}`
          : `${label} — sin lugares aún`,
        { sticky: true, direction: "top", className: "national-map__tooltip" }
      );
      layer.on({
        click: () => selectRef.current(code),
        mouseover: () => {
          hoveredRef.current = code;
          restyle(code);
        },
        mouseout: () => {
          hoveredRef.current = null;
          restyle(null);
        },
      });
    },
    [restyle]
  );

  return (
    <MapContainer
      center={FALLBACK_CENTER}
      zoom={FALLBACK_ZOOM}
      minZoom={3}
      maxZoom={10}
      className="national-map"
      zoomControl={false}
      attributionControl={false}
      // The national view is a browsing surface, not a pannable street map: scroll stays
      // with the page so the map never traps a mobile scroll gesture.
      scrollWheelZoom={false}
    >
      <GeoJSON
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data={geometry as any}
        ref={(instance) => {
          layerRef.current = instance;
          if (instance) restyle(hoveredRef.current);
        }}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onEachFeature={onEachFeature as any}
      />
      <FitViewport activeRegion={activeRegion} boundsByCode={boundsByCode} />
      <InvalidateOnResize />
    </MapContainer>
  );
}
