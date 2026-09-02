import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "nihon.savedPlaceIds";

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

  return { savedIds, isSaved, toggleSaved, removeSaved };
}
