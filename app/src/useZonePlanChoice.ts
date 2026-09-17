import { useCallback, useState } from "react";
import type { AccommodationZone } from "./lib/accommodation-zone";
import {
  findZoneChoiceForHub,
  isAccommodationAnchorInUse,
  loadReconciledDraft,
  withZoneAccommodationChoice,
  withoutZoneAccommodationChoice,
  writeDraft,
  type DraftStorage,
  type ManualPlanningDraftV8,
} from "./lib/planning-draft-v8";

/**
 * Block 4 — the zone comparison panel's write access to the ONE planning draft.
 *
 * ## Why this is not a second copy of the draft
 *
 * The chosen zone lives in `nihon.manualPlanningDraft` (see `planning-draft-v8.ts`), because the
 * anchor it seeds lives there and the two must never be able to disagree. But the comparison panel
 * is opened from the hub bar, long before the planner exists on screen, so it needs to write that
 * draft without `OrderedSequenceBuilder` being mounted.
 *
 * This hook therefore holds **no authoritative state at all**. Every mutation is a full
 * read-modify-write against storage — load the canonical draft, apply one pure V8 function, write
 * it back — and the only thing kept in React state is a small read-only *snapshot* used to render
 * the button labels, re-derived from the draft that was just written. Nothing here can drift,
 * because nothing here is a source of truth.
 *
 * ## One writer at a time
 *
 * `App.tsx` keeps the comparison panel and the planner mutually exclusive: opening either closes
 * the other. That makes the single-writer property structural rather than incidental — the planner
 * reads the draft when it mounts, which is always after this panel has closed, and this panel
 * re-reads on mount, which is always after the planner has closed. The builder's own long-standing
 * "a fresh mount is exactly the builder opening" lifecycle is what makes that work, and it is now
 * relied on deliberately rather than by accident.
 *
 * ## What it never does
 *
 * No travel time, no route, no distance used as a decision, no automatic day boundary, no "best
 * zone", no hotel, and no write to any storage key other than the planning draft.
 */

const browserStorage: DraftStorage = {
  getItem: (key) => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
};

/** Everything the comparison panel needs to render the choice, and nothing it could mutate. */
export type ZonePlanChoiceSnapshot = {
  /** The zone chosen for the hub this panel is showing, or null. */
  zoneId: string | null;
  /** The label of the anchor that choice seeded, so the panel can name what the planner gained. */
  anchorLabel: string | null;
  /** True when a day boundary selects that anchor, or a manual duration was typed for it. Removing
   * the zone then KEEPS the anchor, and the panel says so rather than implying a clean undo. */
  anchorInUse: boolean;
};

const EMPTY_SNAPSHOT: ZonePlanChoiceSnapshot = {
  zoneId: null,
  anchorLabel: null,
  anchorInUse: false,
};

function snapshotFor(draft: ManualPlanningDraftV8, hub: string | null): ZonePlanChoiceSnapshot {
  if (!hub) return EMPTY_SNAPSHOT;
  const choice = findZoneChoiceForHub(draft.zoneAccommodationChoices, hub);
  if (!choice) return EMPTY_SNAPSHOT;
  const anchor = draft.accommodations.find((entry) => entry.id === choice.accommodationId) ?? null;
  return {
    zoneId: choice.zoneId,
    anchorLabel: anchor ? anchor.label : null,
    anchorInUse: isAccommodationAnchorInUse(draft, choice.accommodationId),
  };
}

function readDraft(savedIds: readonly string[]): ManualPlanningDraftV8 {
  return loadReconciledDraft(browserStorage, savedIds);
}

export function useZonePlanChoice(hub: string | null, savedIds: readonly string[]) {
  const [snapshot, setSnapshot] = useState<ZonePlanChoiceSnapshot>(() =>
    snapshotFor(readDraft(savedIds), hub)
  );

  /**
   * Records the user's decision and seeds the anchor, in one write.
   *
   * The label and coordinate handed to the draft are the zone's own anchor station and its
   * coordinate, straight from the registry record — a fact the catalogue already asserts, copied
   * rather than invented, and exactly the two fields the user would otherwise have retyped into
   * the planner by hand. No duration, boundary or route is created alongside it.
   */
  const chooseZone = useCallback(
    (zone: AccommodationZone) => {
      const next = withZoneAccommodationChoice(
        readDraft(savedIds),
        {
          hub: zone.hub,
          zoneId: zone.id,
          label: zone.anchor.label,
          location: { lat: zone.anchor.lat, lng: zone.anchor.lng },
        },
        randomAccommodationId
      );
      writeDraft(browserStorage, next);
      setSnapshot(snapshotFor(next, hub));
    },
    [hub, savedIds]
  );

  /** Forgets the decision for this hub. The seeded anchor survives when it carries user work —
   * `snapshot.anchorInUse` is what lets the panel say which of the two happened. */
  const clearZone = useCallback(() => {
    if (!hub) return;
    const next = withoutZoneAccommodationChoice(readDraft(savedIds), hub);
    writeDraft(browserStorage, next);
    setSnapshot(snapshotFor(next, hub));
  }, [hub, savedIds]);

  return { ...snapshot, chooseZone, clearZone };
}

/**
 * The same opaque anchor id `usePlanningDraft` mints, on the same terms: it encodes no location,
 * hotel, quality, priority, ordering or booking reference, and being seeded by a zone gives it no
 * special form — a zone-seeded anchor is an ordinary anchor and its id says nothing about the zone.
 */
function randomAccommodationId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `acc-${crypto.randomUUID()}`;
  }
  return `acc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
