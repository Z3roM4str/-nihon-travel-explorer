import { useCallback, useMemo } from "react";
import type { AccommodationZone } from "./lib/accommodation-zone";
import { findZoneChoiceForHub } from "./lib/planning-draft-v8";
import { usePlanningDraft } from "./usePlanningDraft";

/** La comparación y el planificador usan el mismo diario y el adaptador deviceStorage. */
export type ZonePlanChoiceSnapshot = { zoneId: string | null; anchorLabel: string | null; anchorInUse: boolean };

export function useZonePlanChoice(hub: string | null, savedIds: readonly string[]) {
  const planning = usePlanningDraft(savedIds);
  const { zoneAccommodationChoices, accommodations, anchorIsInUse, chooseZoneAccommodation, clearZoneAccommodation } = planning;
  const snapshot = useMemo<ZonePlanChoiceSnapshot>(() => {
    const choice = hub ? findZoneChoiceForHub(zoneAccommodationChoices, hub) : null;
    const anchor = choice ? accommodations.find((entry) => entry.id === choice.accommodationId) : null;
    return {
      zoneId: choice?.zoneId ?? null,
      anchorLabel: anchor?.label ?? null,
      anchorInUse: choice ? anchorIsInUse(choice.accommodationId) : false,
    };
  }, [hub, zoneAccommodationChoices, accommodations, anchorIsInUse]);
  const chooseZone = useCallback((zone: AccommodationZone) => {
    chooseZoneAccommodation({
      hub: zone.hub, zoneId: zone.id, label: zone.anchor.label,
      location: { lat: zone.anchor.lat, lng: zone.anchor.lng },
    });
  }, [chooseZoneAccommodation]);
  const clearZone = useCallback(() => { if (hub) clearZoneAccommodation(hub); }, [hub, clearZoneAccommodation]);
  return { ...snapshot, chooseZone, clearZone };
}
