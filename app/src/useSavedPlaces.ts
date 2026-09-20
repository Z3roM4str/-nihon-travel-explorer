import { useCallback, useEffect, useState } from "react";
import type { TripMember, PlaceInterest, SyncState } from "./astra/interestAdapter";

const STORAGE_KEY = "nihon.savedPlaceIds";
const MEMBER_INTERESTS_KEY = "nihon.memberInterests.v1";

const DEFAULT_MEMBERS: TripMember[] = [
  { tripId: "trip-2027", memberId: "fernando", displayName: "Fernando" },
  { tripId: "trip-2027", memberId: "lorena", displayName: "Lorena" }
];

function readMemberInterests(): PlaceInterest[] {
  try {
    const raw = localStorage.getItem(MEMBER_INTERESTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readStorage(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function useSavedPlaces() {
  const [savedIds, setSavedIds] = useState<string[]>(() => readStorage());

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(savedIds));
    } catch {
      /* storage unavailable — saved state stays in-memory only */
    }
  }, [savedIds]);

  const isSaved = useCallback((id: string) => savedIds.includes(id), [savedIds]);

  const toggleSaved = useCallback((id: string) => {
    setSavedIds((prev) =>
      prev.includes(id) ? prev.filter((existing) => existing !== id) : [...prev, id]
    );
  }, []);

  const removeSaved = useCallback((id: string) => {
    setSavedIds((prev) => prev.filter((existing) => existing !== id));
  }, []);

  const [memberInterests, setMemberInterests] = useState<PlaceInterest[]>(() => readMemberInterests());

  useEffect(() => {
    try {
      localStorage.setItem(MEMBER_INTERESTS_KEY, JSON.stringify(memberInterests));
    } catch {
      /* storage unavailable */
    }
  }, [memberInterests]);

  const getInterestsForMember = useCallback((memberId: string) => {
    return memberInterests
      .filter(i => i.memberId === memberId && i.interested)
      .map(i => i.placeId);
  }, [memberInterests]);

  const getCoincidences = useCallback(() => {
    const fernandoSet = new Set(getInterestsForMember("fernando"));
    const lorenaSet = new Set(getInterestsForMember("lorena"));
    return [...fernandoSet].filter(id => lorenaSet.has(id));
  }, [getInterestsForMember]);

  const toggleMemberInterest = useCallback((memberId: string, placeId: string) => {
    setMemberInterests(prev => {
      const existing = prev.find(i => i.memberId === memberId && i.placeId === placeId);
      if (existing) {
        return prev.map(i => i.memberId === memberId && i.placeId === placeId ? { ...i, interested: !i.interested, updatedAt: new Date().toISOString() } : i);
      } else {
        return [...prev, { tripId: "trip-2027", memberId, placeId, interested: true, updatedAt: new Date().toISOString() }];
      }
    });
  }, []);

  return {
    savedIds,
    isSaved,
    toggleSaved,
    removeSaved,
    // Adapter properties
    members: DEFAULT_MEMBERS,
    memberInterests,
    syncState: "synced" as SyncState,
    getInterestsForMember,
    getCoincidences,
    toggleMemberInterest
  };
}
