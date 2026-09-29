import { useCallback, useEffect, useMemo, useState } from "react";
import {
  findInterest,
  findTraveller,
  interestSnapshot,
  loadTravellersDocument,
  shortlistPlaceIds,
  stanceOf,
  summarizeInterest,
  tallyShortlist,
  withActiveTraveller,
  withNewTraveller,
  withStance,
  withToggledInterest,
  withTravellerLabel,
  withRestoredInterest,
  withTravellerReset,
  withoutTraveller,
  writeTravellersDocument,
  type InterestSnapshot,
  type InterestStance,
  type PlaceInterestSummary,
  type Storage,
  type TravellersDocumentV1,
} from "./lib/travellers";
import { divergenceEntries, type DivergenceEntry } from "./lib/interest-divergence";
import { deviceStorage } from "./lib/device-storage";

/**
 * Block 5 — the React integration over `lib/travellers.ts`.
 *
 * It replaces `useSavedPlaces` and keeps that hook's exact surface — `savedIds`, `isSaved`,
 * `toggleSaved`, `removeSaved` — so every existing consumer, including `usePlanningDraft`, works
 * unchanged. What changes underneath is only *whose* list it is: `savedIds` is now DERIVED from
 * the travellers document (a place is in play when at least one traveller wants it) rather than
 * being a stored array of its own.
 *
 * That derivation is the single point of contact between the two-person layer and the shared plan.
 * The planning draft is not versioned, not duplicated per person, and not read here.
 *
 * One `useState`, holding the whole document, exactly as the rest of the app persists state: the
 * pure module owns every transition, this owns the effect that writes it back.
 */

/* DDR-03: el adaptador compartido de `lib/device-storage.ts`. Misma forma estructural que el
   `browserStorage` local que sustituye —así que nada de este módulo cambia—, con una diferencia:
   registra el resultado de cada escritura en la única fuente de verdad del estado de persistencia
   y vuelve a lanzar el error, de modo que el `try/catch` de abajo sigue atrapando lo mismo. */
const browserStorage: Storage = deviceStorage;

/**
 * Opaque traveller id, on the same terms as every other id this app mints: it encodes no slot, no
 * ordinal, no name, no device and no clock. Injected into the pure module rather than called
 * inside it, so a collision fails safely instead of overwriting somebody.
 */
function randomTravellerId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `trv-${crypto.randomUUID()}`;
  }
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return `trv-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  }
  return `trv-${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`;
}

export function useTravellers() {
  const [document, setDocument] = useState<TravellersDocumentV1>(() =>
    loadTravellersDocument(browserStorage, randomTravellerId)
  );

  useEffect(() => {
    writeTravellersDocument(browserStorage, document);
  }, [document]);

  /** The shared shortlist the planner reconciles against. Derived on read — never a second copy. */
  const savedIds = useMemo(() => shortlistPlaceIds(document), [document]);

  /**
   * The places the ACTIVE traveller personally wants — which is what the heart on a card or in the
   * detail shows, and it is deliberately NOT the same list as `savedIds`.
   *
   * If it were, a place only the other person had saved would appear to the reader as already
   * hearted, while the marker beside it said "Sólo Beto". The shared shortlist is the trip's list;
   * the heart is the reader's own answer to "do I want to go here".
   */
  const activeInterestedIds = useMemo(() => {
    const activeId = document.activeTravellerId;
    if (activeId === null) return [];
    return document.interests
      .filter((interest) =>
        interest.stances.some(
          (entry) => entry.travellerId === activeId && entry.stance === "interested"
        )
      )
      .map((interest) => interest.placeId);
  }, [document]);

  const activeTraveller = useMemo(
    () => findTraveller(document, document.activeTravellerId),
    [document]
  );

  /** Shared-shortlist membership: what the planner and the saved list mean by "saved". */
  const isSaved = useCallback((id: string) => savedIds.includes(id), [savedIds]);

  /** The active reader's own interest: what the heart means. */
  const isWantedByActive = useCallback(
    (id: string) => activeInterestedIds.includes(id),
    [activeInterestedIds]
  );

  /**
   * The one-tap "❤️ Quiero ir", now attributed to whoever is holding the device.
   *
   * Deliberately still ONE tap with no person picker in the way: the active traveller is chosen
   * once, in the header, not per card. With no active traveller the press is refused rather than
   * being recorded as nobody's opinion.
   */
  const toggleSaved = useCallback((id: string) => {
    setDocument((current) =>
      current.activeTravellerId === null
        ? current
        : withToggledInterest(current, id, current.activeTravellerId)
    );
  }, []);

  /**
   * "Quitar de Quiero ir", from the saved list.
   *
   * It withdraws the ACTIVE traveller's interest only. It never speaks for the other person, and
   * never turns their interest into a refusal — if they still want the place, it stays in the
   * shortlist and the list says why.
   */
  const removeSaved = useCallback((id: string) => {
    setDocument((current) =>
      current.activeTravellerId === null
        ? current
        : withStance(current, id, current.activeTravellerId, null)
    );
  }, []);

  /** Records one explicit stance for the active traveller. `null` returns them to no opinion. */
  const setStance = useCallback((placeId: string, stance: InterestStance | null) => {
    setDocument((current) =>
      current.activeTravellerId === null
        ? current
        : withStance(current, placeId, current.activeTravellerId, stance)
    );
  }, []);

  const stanceFor = useCallback(
    (placeId: string, travellerId: string): InterestStance | null =>
      stanceOf(findInterest(document, placeId), travellerId),
    [document]
  );

  const activeStance = useCallback(
    (placeId: string): InterestStance | null =>
      document.activeTravellerId === null ? null : stanceFor(placeId, document.activeTravellerId),
    [document, stanceFor]
  );

  const interestSummary = useCallback(
    (placeId: string): PlaceInterestSummary => summarizeInterest(document, placeId),
    [document]
  );

  const tally = useMemo(() => tallyShortlist(document), [document]);

  const setActiveTraveller = useCallback((travellerId: string) => {
    setDocument((current) => withActiveTraveller(current, travellerId));
  }, []);

  const renameTraveller = useCallback((travellerId: string, label: string) => {
    setDocument((current) => withTravellerLabel(current, travellerId, label));
  }, []);

  /**
   * B26 (`05 §1`, paso «¿Quiénes sois?»): escribe nombres y persona activa en ESTE mismo
   * documento, en una sola actualización. Sólo compone `withTravellerLabel` y
   * `withActiveTraveller`: no crea personas, no toca posturas, ids ni preferencias, y una
   * etiqueta en blanco se ignora igual que al renombrar desde Nosotros.
   */
  const saveIdentity = useCallback(
    (labels: Readonly<Record<string, string>>, activeId: string | null) => {
      setDocument((current) => {
        let next = current;
        for (const [id, label] of Object.entries(labels)) {
          next = withTravellerLabel(next, id, label);
        }
        return activeId === null ? next : withActiveTraveller(next, activeId);
      });
    },
    []
  );

  const resetTraveller = useCallback((travellerId: string) => {
    setDocument((current) => withTravellerReset(current, travellerId));
  }, []);

  const removeTraveller = useCallback((travellerId: string) => {
    setDocument((current) => withoutTraveller(current, travellerId));
  }, []);

  const addTraveller = useCallback((label: string) => {
    setDocument((current) => withNewTraveller(current, label, randomTravellerId));
  }, []);

  /**
   * Block 6 — the derived "dónde no coincidimos" view over the document this hook already owns.
   *
   * It is a function of `(document, plannedPlaceIds)` and stores nothing. It lives here because
   * the document lives here, which keeps `TravellersDocumentV1` from having to leak out of the
   * hook just so a component can group it. The planner ids are passed IN: this layer still never
   * reads the planning draft.
   */
  const divergenceFor = useCallback(
    (plannedPlaceIds: readonly string[]): DivergenceEntry[] =>
      divergenceEntries(document, plannedPlaceIds),
    [document]
  );

  /**
   * B25 (B7 «Quiero ir», `05 §6`): «Descartados» — places everyone who spoke marked «no me
   * interesa» and nobody wants. A READ of `summarizeInterest`; it is not in the shortlist and
   * nothing here changes that.
   */
  const declinedIds = useMemo(
    () =>
      document.interests
        .filter((interest) => summarizeInterest(document, interest.placeId).kind === "declined")
        .map((interest) => interest.placeId),
    [document]
  );

  /**
   * B25: the snapshot «Deshacer» needs, taken before `removeSaved` runs. Reading only — the
   * withdrawal itself is still `removeSaved`, unchanged.
   */
  const snapshotActiveInterest = useCallback(
    (placeId: string): InterestSnapshot | null =>
      document.activeTravellerId === null
        ? null
        : interestSnapshot(document, placeId, document.activeTravellerId),
    [document]
  );

  /** B25: «Deshacer» — puts back exactly the stance the snapshot recorded, and nobody else's. */
  const restoreInterest = useCallback((snapshot: InterestSnapshot) => {
    setDocument((current) => withRestoredInterest(current, snapshot));
  }, []);

  /** How many shortlisted places would leave the list if this traveller were reset or removed.
   * The UI states the number BEFORE acting, so a destructive step is never a surprise. */
  const placesOnlyWantedBy = useCallback(
    (travellerId: string): number =>
      document.interests.filter((interest) => {
        const interested = interest.stances.filter((entry) => entry.stance === "interested");
        return interested.length === 1 && interested[0].travellerId === travellerId;
      }).length,
    [document]
  );

  /**
   * B26 (`05 §11`): «marcados: N lugares» — los lugares que esta persona quiere visitar. Es una
   * LECTURA del documento (postura «interested»); no cuenta «no me interesa» ni lugares sin
   * opinión, y no es una puntuación.
   */
  const placesMarkedBy = useCallback(
    (travellerId: string): number =>
      document.interests.filter((interest) =>
        interest.stances.some(
          (entry) => entry.travellerId === travellerId && entry.stance === "interested"
        )
      ).length,
    [document]
  );

  return {
    travellers: document.travellers,
    activeTraveller,
    savedIds,
    activeInterestedIds,
    isSaved,
    isWantedByActive,
    toggleSaved,
    removeSaved,
    setStance,
    stanceFor,
    activeStance,
    interestSummary,
    tally,
    setActiveTraveller,
    renameTraveller,
    resetTraveller,
    removeTraveller,
    addTraveller,
    placesOnlyWantedBy,
    placesMarkedBy,
    saveIdentity,
    divergenceFor,
    declinedIds,
    snapshotActiveInterest,
    restoreInterest,
  };
}
