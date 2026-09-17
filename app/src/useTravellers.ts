import { useCallback, useEffect, useMemo, useState } from "react";
import {
  findInterest,
  findTraveller,
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
  withTravellerReset,
  withoutTraveller,
  writeTravellersDocument,
  type InterestStance,
  type PlaceInterestSummary,
  type Storage,
  type TravellersDocumentV1,
} from "./lib/travellers";

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

const browserStorage: Storage = {
  getItem: (key) => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
};

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

  const resetTraveller = useCallback((travellerId: string) => {
    setDocument((current) => withTravellerReset(current, travellerId));
  }, []);

  const removeTraveller = useCallback((travellerId: string) => {
    setDocument((current) => withoutTraveller(current, travellerId));
  }, []);

  const addTraveller = useCallback((label: string) => {
    setDocument((current) => withNewTraveller(current, label, randomTravellerId));
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
  };
}
