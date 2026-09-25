import { useCallback, useEffect, useState } from "react";
import type { TripMember, PlaceInterest, SyncState, InterestAdapter } from "./astra/interestAdapter";
import { getAllPlaces } from "./data/store";

const STORAGE_KEY = "nihon.savedPlaceIds";
const MEMBER_INTERESTS_KEY = "nihon.memberInterests.v1";
const CURRENT_TRIP_ID = "trip-2027";
const RECOGNIZED_MEMBERS = new Set(["fernando", "lorena"]);

const DEFAULT_MEMBERS: TripMember[] = [
  { tripId: CURRENT_TRIP_ID, memberId: "fernando", displayName: "Fernando" },
  { tripId: CURRENT_TRIP_ID, memberId: "lorena", displayName: "Lorena" }
];

function getKnownPlaceIds(): Set<string> {
  try {
    return new Set(getAllPlaces().map(p => p.id));
  } catch {
    return new Set();
  }
}

export function readStorage(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const validPlaces = getKnownPlaceIds();
    const valid = parsed.filter((item): item is string =>
      typeof item === "string" && (validPlaces.size === 0 || validPlaces.has(item))
    );
    return Array.from(new Set(valid));
  } catch {
    return [];
  }
}

export function readOtherTripInterests(): PlaceInterest[] {
  try {
    const raw = localStorage.getItem(MEMBER_INTERESTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(item =>
      item &&
      typeof item === "object" &&
      typeof item.tripId === "string" &&
      item.tripId !== CURRENT_TRIP_ID
    ) as PlaceInterest[];
  } catch {
    return [];
  }
}

export function readMemberInterests(): PlaceInterest[] {
  try {
    const raw = localStorage.getItem(MEMBER_INTERESTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const validPlaces = getKnownPlaceIds();
    const map = new Map<string, PlaceInterest>();
    for (const item of parsed) {
      if (
        item &&
        typeof item === "object" &&
        item.tripId === CURRENT_TRIP_ID &&
        typeof item.memberId === "string" &&
        RECOGNIZED_MEMBERS.has(item.memberId) &&
        typeof item.placeId === "string" &&
        (validPlaces.size === 0 || validPlaces.has(item.placeId)) &&
        typeof item.interested === "boolean" &&
        typeof item.updatedAt === "string" &&
        !isNaN(Date.parse(item.updatedAt))
      ) {
        const key = `${item.memberId}:${item.placeId}`;
        const existing = map.get(key);
        if (!existing || Date.parse(item.updatedAt) >= Date.parse(existing.updatedAt)) {
          map.set(key, {
            tripId: item.tripId,
            memberId: item.memberId,
            placeId: item.placeId,
            interested: item.interested,
            updatedAt: item.updatedAt
          });
        }
      }
    }
    return Array.from(map.values());
  } catch {
    return [];
  }
}

export function useSavedPlaces(): InterestAdapter & {
  savedIds: string[];
  isSaved: (id: string) => boolean;
  toggleSaved: (id: string) => void;
  removeSaved: (id: string) => void;
  memberInterests: PlaceInterest[];
  toggleMemberInterest: (memberId: string, placeId: string) => void;
} {
  const [savedIds, setSavedIds] = useState<string[]>(() => readStorage());
  const [memberInterests, setMemberInterests] = useState<PlaceInterest[]>(() => readMemberInterests());
  const [syncState, setSyncState] = useState<SyncState>("local-only");
  const [saveError, setSaveError] = useState<string | null>(null);

  const persistState = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(savedIds));
      const otherTripRecords = readOtherTripInterests();
      const combined = [...otherTripRecords, ...memberInterests];
      localStorage.setItem(MEMBER_INTERESTS_KEY, JSON.stringify(combined));
      setSyncState("local-only");
      setSaveError(null);
    } catch (err) {
      setSyncState("error");
      setSaveError(err instanceof Error ? err.message : "Error al guardar en almacenamiento local");
    }
  }, [savedIds, memberInterests]);

  useEffect(() => {
    persistState();
  }, [persistState]);

  const retrySave = useCallback(() => {
    persistState();
  }, [persistState]);

  const isSaved = useCallback((id: string) => savedIds.includes(id), [savedIds]);

  const toggleSaved = useCallback((id: string) => {
    setSavedIds((prev) =>
      prev.includes(id) ? prev.filter((existing) => existing !== id) : [...prev, id]
    );
  }, []);

  const removeSaved = useCallback((id: string) => {
    setSavedIds((prev) => prev.filter((existing) => existing !== id));
  }, []);

  const getInterestsForMember = useCallback((memberId: string) => {
    return memberInterests
      .filter(i => i.memberId === memberId && i.interested)
      .map(i => i.placeId);
  }, [memberInterests]);

  const getCoincidences = useCallback(() => {
    const fernandoSet = new Set(getInterestsForMember("fernando"));
    const lorenaSet = new Set(getInterestsForMember("lorena"));
    return Array.from(fernandoSet).filter(id => lorenaSet.has(id));
  }, [getInterestsForMember]);

  const toggleInterest = useCallback((memberId: string, placeId: string) => {
    setMemberInterests(prev => {
      const existing = prev.find(i => i.memberId === memberId && i.placeId === placeId);
      if (existing) {
        return prev.map(i => i.memberId === memberId && i.placeId === placeId ? { ...i, interested: !i.interested, updatedAt: new Date().toISOString() } : i);
      } else {
        return [...prev, { tripId: CURRENT_TRIP_ID, memberId, placeId, interested: true, updatedAt: new Date().toISOString() }];
      }
    });
  }, []);

  return {
    savedIds,
    isSaved,
    toggleSaved,
    removeSaved,
    members: DEFAULT_MEMBERS,
    interests: memberInterests,
    memberInterests,
    syncState,
    saveError,
    getInterestsForMember,
    getCoincidences,
    toggleInterest,
    toggleMemberInterest: toggleInterest,
    retrySave
  };
}
