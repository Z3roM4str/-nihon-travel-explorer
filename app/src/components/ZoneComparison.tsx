import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, Marker, TileLayer, Tooltip, ZoomControl, useMap } from "react-leaflet";
import L from "leaflet";
import type { Place } from "../types";
import {
  EDITORIAL_AXES,
  NEUTRAL_AXES,
  PROXIMITY_BANDS,
  distinctZoneSources,
  editorialContrasts,
  getZonesForHub,
  zoneSavedPlacesFit,
  type AccommodationZone,
  type ZoneEditorial,
} from "../lib/accommodation-zone";
import {
  consultedOnText,
  freshnessAccessibleText,
  recheckNote,
  sourceLinkLabel,
  sourceName,
  tierLabel,
} from "../lib/zone-provenance-presentation";
import { freshnessFor } from "../lib/source-freshness";
import { todayCivilDate } from "../lib/today";
import { Icon } from "../icons/Icon";
import {
  NEUTRAL_AXIS_NOTE,
  axisDirectionHint,
  editorialDisclosure,
  ratingAccessibleText,
} from "../lib/zone-editorial-presentation";
import {
  airportLinkConnection,
  airportLinkDescription,
  airportLinkKey,
} from "../lib/zone-airport-presentation";
import { MAX_COMPARED, useZoneComparison } from "../useZoneComparison";
import { useZonePlanChoice } from "../useZonePlanChoice";
import { deviceStorage } from "../lib/device-storage";
import { loadReconciledDraft } from "../lib/planning-draft-v8";
import { placesForTripHub } from "../lib/zone-journey-context";
import { EvidenceMark } from "./EvidenceMark";
import { ZonePhotoFallback } from "./ZonePhotoFallback";

type Props = {
  hub: string;
  savedPlaces: Place[];
  onClose: () => void;
  onSelectPlace: (id: string) => void;
  /** Block 4: hands the reader straight from the decision to the plan it now affects. The panel
   * closes and the planner opens — deliberately a navigation step rather than a second modal. */
  onOpenPlanner: () => void;
  /** Bloque 18, `02 §D2` / gate 11: la comparación de zonas deja de ser un modal global y pasa
   * a ser contenido navegable bajo «Viaje» (Dónde dormir). `embedded` quita el `role="dialog"`
   * y la trampa de foco/Escape propios de una capa flotante. */
  embedded?: boolean;
};

/**
 * Block 4 — choosing a zone, and what that choice is allowed to mean.
 *
 * Pressing "Usar esta zona en el plan" records ONE thing: that the reader decided to sleep in this
 * zone, for this hub. It seeds an accommodation anchor in the planner from the zone's own station
 * label and coordinate, because those are the exact two fields the anchor contract already needs
 * and the two the reader would otherwise have copied across by hand.
 *
 * It does NOT book anything, does not pick a hotel, does not assign any day's boundary, and does
 * not produce a single minute of travel time — the planner still asks the reader for every manual
 * duration, exactly as it did before. The copy below says all of that out loud, because a button
 * that quietly did more than it claimed is precisely the failure this layer exists to avoid.
 *
 * Choosing is the reader's act, not Nihon's recommendation. Any calculated proximity describes
 * only places already in this trip.
 */

/** The choose / chosen / change control shown on a zone, in both the list and the comparison. */
function ZoneChoiceAction({
  zone,
  chosenZoneId,
  onChoose,
  onClear,
}: {
  zone: AccommodationZone;
  chosenZoneId: string | null;
  onChoose: (zone: AccommodationZone) => void;
  onClear: () => void;
}) {
  const isChosen = chosenZoneId === zone.id;
  const hasOtherChoice = chosenZoneId !== null && !isChosen;

  // Keep the action in the same DOM position when its state changes: keyboard focus
  // belongs to this zone's control, including when another zone becomes chosen.
  return (
    <p className={`zone-choice-action${isChosen ? " zone-choice-action--chosen" : ""}`}>
      {isChosen && (
        <span className="zone-choice-badge">
          <Icon name="confirmado" size={16} /> Zona elegida para el plan
        </span>
      )}
      <button
        key="zone-choice"
        type="button"
        className="button button--secondary zone-choice-action__button"
        onClick={isChosen ? onClear : () => onChoose(zone)}
        aria-label={
          isChosen
            ? `Quitar ${zone.name} del plan`
            : hasOtherChoice
              ? `Cambiar la zona del plan a ${zone.name}`
              : `Dormir en ${zone.name}`
        }
      >
        {isChosen ? "Quitar del plan" : (
          <>
            <Icon name="cama" size={16} />{" "}
            {hasOtherChoice ? "Cambiar a esta zona" : "Dormir aquí"}
          </>
        )}
      </button>
    </p>
  );
}

function formatKm(km: number): string {
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}

/** Ordinal 1–5 as five discrete marks. Never a bar chart: this is not a measurement. */
/**
 * One editorial rating, as five marks.
 *
 * Block 9 — the accessible reading used to be the bare string "3 de 5", which to a screen reader
 * has the exact shape of a measurement. It now names the owner, because a judgement that does not
 * say it is one is being presented as a fact.
 */
function Ordinal({ value, neutral }: { value: number; neutral: boolean }) {
  return (
    <span className={`zone-ordinal ${neutral ? "zone-ordinal--neutral" : ""}`}>
      {[1, 2, 3, 4, 5].map((step) => (
        <span
          key={step}
          className={`zone-ordinal__step ${step <= value ? "zone-ordinal__step--on" : ""}`}
          aria-hidden="true"
        />
      ))}
      <span className="visually-hidden">{ratingAccessibleText(value)}</span>
    </span>
  );
}

function ShinkansenFact({ zone }: { zone: AccommodationZone }) {
  const { shinkansen } = zone.facts;
  if (shinkansen.served) {
    return (
      <span className="zone-fact">
        <Icon name="tren" size={16} /> Shinkansen aquí
        {shinkansen.lines && shinkansen.lines.length > 0 && (
          <span className="zone-fact__detail"> · {shinkansen.lines.join(", ")}</span>
        )}
      </span>
    );
  }
  return (
    <span className="zone-fact">
      <Icon name="tren" size={16} /> Shinkansen en {shinkansen.nearestStation}
    </span>
  );
}

/**
 * Block 8 — the airport links, each saying what kind of journey it is.
 *
 * It used to render one word, `directo` or `con enlace`, for every link. Neither said direct *by
 * what*: a limousine bus and a Narita Express carried the same label. The label now names the
 * mode and whether a change is needed, and the full sentence is spelled out for assistive
 * technology, because "directo" is exactly the word a reader can take two ways.
 *
 * A zone may hold two records for the same airport — a direct coach and a rail route with a
 * change are two different answers, and one boolean cannot be true of both — so the key is the
 * airport AND the service.
 *
 * The emphasis on a direct link is about *directness*, which is a fact. It is deliberately not
 * about the mode: nothing here says a train is better than a coach.
 */
function AirportFacts({ zone }: { zone: AccommodationZone }) {
  return (
    <>
      {zone.facts.airportLinks.map((link) => (
        <span
          key={airportLinkKey(link)}
          className="zone-fact"
        >
          <Icon name="avion" size={16} /> {link.airport}
          <span className="zone-fact__detail">
            {" "}
            · {airportLinkConnection(link)}
          </span>
          <span className="visually-hidden">. {airportLinkDescription(link)}</span>
        </span>
      ))}
    </>
  );
}

/**
 * Block 7 — where this zone's checkable claims come from, by name.
 *
 * Until Block 7 this was a single link whose whole text was "Fuente", so an airport operator's own
 * access page and an encyclopedia article looked identical until you opened one. Naming the source
 * and saying how close it is to what it describes is the smallest change that makes provenance
 * legible, and it is the only thing Block 7 alters on this card.
 *
 * The tier is text, never a colour or an icon on its own, and it is deliberately not a rating: it
 * says where a statement comes from, not whether the zone is a good place to stay.
 */
/**
 * Block 10 — `today` is read here, at the presentation boundary, and nowhere else.
 *
 * `lib/source-freshness.ts` takes the date as an argument and never calls a clock, so every rule
 * about ageing is testable at its exact boundary. This is the one place that has to know what day
 * it is, and it is a component, not domain logic.
 */
function ZoneSources({ zone }: { zone: AccommodationZone }) {
  const sources = distinctZoneSources(zone);
  const today = useMemo(() => todayCivilDate(), []);
  if (sources.length === 0) return null;
  return (
    <p className="zone-column__provenance">
      <span className="zone-column__provenance-label">
        {sources.length === 1 ? "Fuente:" : "Fuentes:"}
      </span>{" "}
      {sources.map((source, index) => {
        const freshness = freshnessFor(source, today);
        const note = recheckNote(source, today);
        return (
          <span key={source.sourceUrl} className="zone-source">
            {index > 0 && <span aria-hidden="true"> · </span>}
            <a
              className="zone-source__link"
              href={source.sourceUrl}
              target="_blank"
              rel="noreferrer"
              aria-label={sourceLinkLabel(source, zone.name, freshnessAccessibleText(freshness.state))}
              /* Defence in depth, not a fix for a live bug: the column is a plain <section> with
                 no click handler today. Stopping here means that if one is ever added, reading a
                 source cannot quietly become choosing a zone. */
              onClick={(event) => event.stopPropagation()}
            >
              {sourceName(source)}
            </a>
            <span className="zone-source__tier"> ({tierLabel(source.tier)})</span>
            {/*
              Renders only when a source is past the horizon its claims deserve, which with today's
              dataset is never — every check is under a fortnight old. It is a note about OUR
              checking, never about the claim, so it is muted rather than an alarm: an unrepeated
              check has not been contradicted.
            */}
            {note && (
              <span className="zone-source__recheck">
                {" "}
                · {note}
                <span className="visually-hidden">. {consultedOnText(source)}.</span>
              </span>
            )}
          </span>
        );
      })}
    </p>
  );
}

/** Fits the map to whatever is on it; re-runs when the selection changes. */
function FitToMarkers({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 13, { animate: false });
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [36, 36], maxZoom: 14, animate: false });
  }, [map, points]);
  return null;
}

function InvalidateOnResize() {
  const map = useMap();
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize({ animate: false }));
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);
  return null;
}

const zoneIcon = (selected: boolean) =>
  L.divIcon({
    className: "zone-marker",
    html: `<i class="zone-marker__pin ${selected ? "zone-marker__pin--on" : ""}" aria-hidden="true">●</i>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });

const savedIcon = L.divIcon({
  className: "zone-marker",
  html: '<i class="zone-marker__saved"></i>',
  iconSize: [10, 10],
  iconAnchor: [5, 5],
});

export function ZoneComparison({
  hub,
  savedPlaces,
  onClose,
  onSelectPlace,
  onOpenPlanner,
  embedded = false,
}: Props) {
  const zones = useMemo(() => getZonesForHub(hub), [hub]);
  const { selected, toggle, clear, isFull } = useZoneComparison(hub);
  const savedIds = useMemo(() => savedPlaces.map((place) => place.id), [savedPlaces]);
  // The proximity context is the canonical V8 trip route, not the separate «Quiero ir» list.
  // Loading/reconciling here is read-only; the comparison never writes the planning draft.
  const tripRouteIds = useMemo(
    () => loadReconciledDraft(deviceStorage, savedIds).routeIds,
    [savedIds]
  );
  const {
    zoneId: chosenZoneId,
    anchorLabel: chosenAnchorLabel,
    anchorInUse: chosenAnchorInUse,
    chooseZone,
    clearZone,
  } = useZonePlanChoice(hub, savedIds);
  const chosenZone = useMemo(
    () => (chosenZoneId ? zones.find((zone) => zone.id === chosenZoneId) ?? null : null),
    [chosenZoneId, zones]
  );
  const [mode, setMode] = useState<"browse" | "compare">("browse");
  const closeRef = useRef<HTMLButtonElement>(null);

  const hubTripPlaces = useMemo(() => placesForTripHub(tripRouteIds, hub), [tripRouteIds, hub]);

  // Preserve the catalogue order so proximity remains a fact shown on each alternative, not an
  // implicit ranking of the zones by this one calculation.
  const zoneFits = useMemo(
    () => zones.map((zone) => ({ zone, fit: zoneSavedPlacesFit(zone, hubTripPlaces) })),
    [zones, hubTripPlaces]
  );
  const selectedZones = useMemo(
    () => selected.map((id) => zones.find((zone) => zone.id === id)).filter((z): z is AccommodationZone => Boolean(z)),
    [selected, zones]
  );
  const contrasts = useMemo(() => editorialContrasts(selectedZones), [selectedZones]);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    if (embedded) return;
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      if (mode === "compare") setMode("browse");
      else onClose();
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [mode, onClose, embedded]);

  const canCompare = selectedZones.length >= 2;
  const openCompare = useCallback(() => {
    if (canCompare) setMode("compare");
  }, [canCompare]);

  const mapPoints = useMemo<[number, number][]>(() => {
    const shown = selectedZones.length > 0 ? selectedZones : zones;
    return [
      ...shown.map((zone) => [zone.anchor.lat, zone.anchor.lng] as [number, number]),
      ...hubTripPlaces.map((place) => [place.coordinates.lat, place.coordinates.lng] as [number, number]),
    ];
  }, [selectedZones, zones, hubTripPlaces]);

  return (
    <div
      className={`zone-panel ${embedded ? "zone-panel--embedded" : ""}`.trim()}
      role={embedded ? undefined : "dialog"}
      aria-modal={embedded ? undefined : true}
      aria-labelledby="zone-panel-title"
    >
      <header className="zone-panel__bar">
        <div>
          <h2 id="zone-panel-title">
            <Icon name="cama" size={20} /> Dónde dormir en {hub}
          </h2>
          <p className="zone-panel__sub">
            {mode === "compare"
              ? `Comparando ${selectedZones.length} zonas`
              : `${zones.length} zonas con perfiles distintos.`}
          </p>
        </div>
        <button
          type="button"
          className="icon-button"
          onClick={onClose}
          ref={closeRef}
          aria-label="Cerrar dónde dormir"
          title="Cerrar dónde dormir"
        >
          <span aria-hidden="true">×</span>
        </button>
      </header>

      <div className="zone-panel__scroll">
        {/*
          The one place the panel states what the decision did and — just as importantly — what it
          did not do. It is a `status` region so the change is announced the moment it happens
          rather than only being visible.
        */}
        <div className="zone-choice-banner" role="status">
          {chosenZone ? (
            <>
              <p className="zone-choice-banner__line">
                <Icon name="cama" size={16} /> Para dormir en {hub} habéis elegido{" "}
                <strong>{chosenZone.name}</strong>
                {chosenAnchorLabel && (
                  <>
                    . En el planificador hay un alojamiento de referencia llamado{" "}
                    <strong>{chosenAnchorLabel}</strong>
                  </>
                )}
                .
              </p>
              <p className="zone-choice-banner__caveat">
                No es un hotel reservado y <strong>Nihon no ha calculado ningún tiempo</strong>: los
                minutos de cada trayecto los seguís escribiendo vosotros en el planificador.
                {chosenAnchorInUse &&
                  " Ese alojamiento ya se usa en algún día, así que si quitáis la zona el alojamiento se queda (no se borra nada de lo que hayáis escrito)."}
              </p>
              <span className="zone-choice-banner__actions">
                {/* Bloque 17 (B1): sin flecha final (00 "Patrones explícitamente prohibidos"
                    "→ al final de un botón o enlace"). */}
                <button type="button" className="button button--secondary" onClick={onOpenPlanner}>
                  Abrir el planificador
                </button>
                {/* A distinct accessible name from the per-zone "Quitar del plan" control below:
                    two buttons that do the same thing may share a purpose, but sharing a name
                    leaves a screen-reader user unable to tell which one they are on. */}
                <button
                  type="button"
                  className="link-button"
                  onClick={clearZone}
                  aria-label={`Quitar la zona elegida para ${hub}`}
                >
                  Quitar la zona elegida
                </button>
              </span>
            </>
          ) : (
            <p className="zone-choice-banner__line zone-choice-banner__line--empty">
              <Icon name="cama" size={16} /> Aún no habéis elegido zona para {hub}. Cuando
              elijáis una, el planificador recibirá su estación como alojamiento de referencia —
              nada más.
            </p>
          )}
        </div>

        {hubTripPlaces.length > 0 ? (
          <p className="zone-panel__note" role="status">
            <EvidenceMark level="estimado" detail="línea recta" /> Las distancias se calculan desde
            la estación de cada zona a los{" "}
            <strong>
              {hubTripPlaces.length} lugar{hubTripPlaces.length === 1 ? "" : "es"} de este viaje
            </strong>{" "}
            en {hub}. La cercanía se muestra por zona; las alternativas conservan el orden del
            catálogo, sin ranking ni tiempos.
          </p>
        ) : (
          <p className="zone-panel__note zone-panel__note--muted" role="status">
            <Icon name="ubicacion" size={16} /> Aún no hay lugares de {hub} en este viaje;
            mostramos las zonas sin calcular proximidad.
          </p>
        )}

        {mode === "browse" ? (
          <>
            <ul className="zone-list">
              {zoneFits.map(({ zone, fit }) => {
                const checked = selected.includes(zone.id);
                return (
                  <li key={zone.id}>
                    <article
                      className={`zone-card ${checked ? "zone-card--selected" : ""}`}
                      data-zone-id={zone.id}
                    >
                      <div className="zone-card__head">
                        <div className="zone-card__title">
                          <h3>{zone.name}</h3>
                          <p lang="ja" className="zone-card__ja">
                            {zone.japaneseName}
                          </p>
                        </div>
                        <label className={`zone-card__compare ${isFull && !checked ? "zone-card__compare--full" : ""}`}>
                          <input
                            type="checkbox"
                            aria-label={`Comparar ${zone.name}`}
                            checked={checked}
                            disabled={isFull && !checked}
                            onChange={() => toggle(zone.id)}
                          />
                          <span>Comparar</span>
                        </label>
                      </div>

                      <div className="zone-card__photo">
                        <ZonePhotoFallback zoneName={zone.name} />
                      </div>

                      <section className="zone-card__evidence" aria-label={`Hechos registrados de ${zone.name}`}>
                        <h4 className="zone-card__evidence-heading">
                          Hechos <EvidenceMark level="registrado" />
                        </h4>
                        <div className="zone-facts">
                          <ShinkansenFact zone={zone} />
                          <AirportFacts zone={zone} />
                          <span className="zone-fact">
                            <Icon name="tren" size={16} /> {zone.facts.railLines.length} líneas
                          </span>
                        </div>
                        <ZoneSources zone={zone} />
                      </section>

                      {fit.consideredCount > 0 && fit.medianKm !== null ? (
                        <section className="zone-card__evidence zone-card__evidence--calculated" aria-label={`Cálculo para ${zone.name}`}>
                          <h4 className="zone-card__evidence-heading">
                            Cálculo de cercanía a este viaje{" "}
                            <EvidenceMark level="estimado" detail="línea recta" />
                          </h4>
                          <p className="zone-card__fit">
                            Mediana de <strong>{formatKm(fit.medianKm)}</strong> a{" "}
                            {fit.consideredCount} lugar{fit.consideredCount === 1 ? "" : "es"} de {hub}.
                            {fit.byBand.doorstep > 0 && <> {fit.byBand.doorstep} quedan en la banda «a pie».</>}
                          </p>
                          <ul className="zone-nearest" aria-label={`Lugares más cercanos a ${zone.name}`}>
                            {fit.nearest.slice(0, 2).map((entry) => (
                              <li key={entry.placeId}>
                                <button type="button" onClick={() => onSelectPlace(entry.placeId)}>
                                  <span>{entry.name}</span>
                                  <span className="zone-nearest__km">{formatKm(entry.km)}</span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        </section>
                      ) : null}

                      <section className="zone-card__evidence zone-card__evidence--opinion" aria-label={`Opinión de Nihon sobre ${zone.name}`}>
                        <h4 className="zone-card__evidence-heading">
                          Opinión · Nihon dice <EvidenceMark level="nihon" label={false} />
                        </h4>
                        <p className="zone-card__opinion">{zone.summary}</p>
                        <ul className="zone-tradeoffs">
                          {zone.tradeoffs.map((tradeoff) => (
                            <li key={tradeoff}>{tradeoff}</li>
                          ))}
                        </ul>
                      </section>

                      <ZoneChoiceAction
                        zone={zone}
                        chosenZoneId={chosenZoneId}
                        onChoose={chooseZone}
                        onClear={clearZone}
                      />
                    </article>
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <div className="zone-compare">
            <div className="zone-compare__map">
              <MapContainer
                center={[selectedZones[0]?.anchor.lat ?? 35.68, selectedZones[0]?.anchor.lng ?? 139.76]}
                zoom={12}
                className="zone-map"
                zoomControl={false}
                scrollWheelZoom={false}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  maxZoom={19}
                />
                <ZoomControl position="bottomright" />
                <FitToMarkers points={mapPoints} />
                <InvalidateOnResize />
                {hubTripPlaces.map((place) => (
                  <Marker
                    key={place.id}
                    position={[place.coordinates.lat, place.coordinates.lng]}
                    icon={savedIcon}
                    title={place.name}
                    eventHandlers={{ click: () => onSelectPlace(place.id) }}
                  >
                    <Tooltip direction="top">{place.name}</Tooltip>
                  </Marker>
                ))}
                {selectedZones.map((zone) => (
                  <Marker
                    key={zone.id}
                    position={[zone.anchor.lat, zone.anchor.lng]}
                    icon={zoneIcon(true)}
                    title={zone.name}
                  >
                    <Tooltip direction="top">{zone.anchor.label}</Tooltip>
                  </Marker>
                ))}
              </MapContainer>
            </div>

            {/*
              One block per zone rather than one wide table. A table with a column per zone is
              unreadable on a phone and forces horizontal scrolling, which this panel never does.
            */}
            <div className="zone-compare__columns">
              {selectedZones.map((zone) => {
                const fit = zoneSavedPlacesFit(zone, hubTripPlaces);
                return (
                  <section key={zone.id} className="zone-column" aria-label={`Zona ${zone.name}`}>
                    <header className="zone-column__head">
                      <div>
                        <h3>{zone.name}</h3>
                        <p className="zone-column__anchor">{zone.anchor.label}</p>
                      </div>
                    </header>

                    <div className="zone-card__photo zone-column__photo">
                      <ZonePhotoFallback zoneName={zone.name} />
                    </div>

                    <h4 className="zone-column__heading">
                      Hechos <EvidenceMark level="registrado" />
                    </h4>
                    <div className="zone-facts">
                      <ShinkansenFact zone={zone} />
                      <AirportFacts zone={zone} />
                    </div>
                    <p className="zone-column__lines">
                      <strong>Líneas:</strong> {zone.facts.railLines.join(" · ")}
                    </p>
                    <ZoneSources zone={zone} />

                    {fit.consideredCount > 0 && fit.medianKm !== null && (
                      <>
                        <h4 className="zone-column__heading">
                          Cálculo de cercanía a este viaje{" "}
                          <EvidenceMark level="estimado" detail="línea recta" />
                        </h4>
                        <p className="zone-column__fit">
                          Mediana de <strong>{formatKm(fit.medianKm)}</strong> a{" "}
                          {fit.consideredCount} lugar{fit.consideredCount === 1 ? "" : "es"} de {hub}.
                        </p>
                        <ul className="zone-nearest">
                          {fit.nearest.map((entry) => (
                            <li key={entry.placeId}>
                              <button type="button" onClick={() => onSelectPlace(entry.placeId)}>
                                <span>{entry.name}</span>
                                <span className="zone-nearest__km">
                                  {PROXIMITY_BANDS[entry.band].label} · {formatKm(entry.km)}
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}

                    <h4 className="zone-column__heading">
                      Opinión · Nihon dice <EvidenceMark level="nihon" label={false} />
                    </h4>
                    <p className="zone-column__summary">{zone.summary}</p>
                    <ul className="zone-tradeoffs">
                      {zone.tradeoffs.map((tradeoff) => (
                        <li key={tradeoff}>{tradeoff}</li>
                      ))}
                    </ul>

                    <ZoneChoiceAction
                      zone={zone}
                      chosenZoneId={chosenZoneId}
                      onChoose={chooseZone}
                      onClear={clearZone}
                    />
                  </section>
                );
              })}
            </div>

            <section className="zone-contrasts" aria-label="Diferencias entre las zonas elegidas">
              <h3>
                Dónde se diferencian de verdad{" "}
                <EvidenceMark level="nihon" label={false} />
              </h3>
              {contrasts.length === 0 ? (
                <p className="zone-contrasts__empty">
                  En lo editorial estas zonas se parecen mucho. La diferencia está arriba: en los
                  hechos registrados y en la cercanía a los lugares de este viaje.
                </p>
              ) : (
                <ul className="zone-contrast-list">
                  {contrasts.map((axis) => (
                    <li key={axis.key} className="zone-contrast">
                      <p className="zone-contrast__label">
                        {axis.label}
                        {NEUTRAL_AXES.has(axis.key as keyof ZoneEditorial) && (
                          <span className="zone-contrast__neutral"> · {NEUTRAL_AXIS_NOTE}</span>
                        )}
                      </p>
                      <ul className="zone-contrast__rows">
                        {selectedZones.map((zone) => (
                          <li key={zone.id}>
                            <span className="zone-contrast__zone">{zone.name}</span>
                            <Ordinal
                              value={zone.editorial[axis.key as keyof ZoneEditorial]}
                              neutral={NEUTRAL_AXES.has(axis.key as keyof ZoneEditorial)}
                            />
                          </li>
                        ))}
                      </ul>
                      <p className="zone-contrast__hint">{axisDirectionHint(axis.high)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/*
              Block 9 — the surface that shows every rating used to say the least about them: ten
              rows of marks with no direction, no owner, and neutrality carried by a muted colour
              alone. It stays a closed disclosure, and it now states what a rating is, who decides
              it, and which way the marks run.
            */}
            <details className="zone-axes">
              <summary>
                Ver las diez valoraciones completas{" "}
                <EvidenceMark level="nihon" label={false} />
              </summary>
              <p className="zone-axes__disclosure">{editorialDisclosure()}</p>
              <ul className="zone-axes__list">
                {EDITORIAL_AXES.map((axis) => (
                  <li key={axis.key}>
                    <p className="zone-contrast__label">
                      {axis.label}
                      {NEUTRAL_AXES.has(axis.key) && (
                        <span className="zone-contrast__neutral"> · {NEUTRAL_AXIS_NOTE}</span>
                      )}
                    </p>
                    <ul className="zone-contrast__rows">
                        {selectedZones.map((zone) => (
                          <li key={zone.id}>
                            <span className="zone-contrast__zone">{zone.name}</span>
                          <Ordinal
                            value={zone.editorial[axis.key]}
                            neutral={NEUTRAL_AXES.has(axis.key)}
                          />
                        </li>
                      ))}
                    </ul>
                    <p className="zone-contrast__hint">{axisDirectionHint(axis.high)}</p>
                  </li>
                ))}
              </ul>
            </details>
          </div>
        )}
      </div>

      <footer className="zone-panel__foot">
        {mode === "compare" ? (
          <button type="button" className="button button--secondary" onClick={() => setMode("browse")}>
            <Icon name="atras" size={16} /> Volver a las zonas
          </button>
        ) : (
          <>
            <span className="zone-panel__count" role="status">
              {selectedZones.length === 0
                ? `Marca 2 o más para comparar (máx. ${MAX_COMPARED})`
                : `${selectedZones.length} de ${MAX_COMPARED} seleccionadas`}
            </span>
            <span className="zone-panel__foot-actions">
              {selectedZones.length > 0 && (
                <button type="button" className="link-button" onClick={clear} aria-label="Quitar las zonas marcadas para comparar">
                  Quitar
                </button>
              )}
              <button
                type="button"
                className="button button--primary"
                onClick={openCompare}
                disabled={!canCompare}
              >
                Comparar
              </button>
            </span>
          </>
        )}
      </footer>
    </div>
  );
}
