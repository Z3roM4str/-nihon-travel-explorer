import { useCallback, useEffect, useState } from "react";

/**
 * Which zones the reader has put side by side, per hub, kept in the browser only.
 *
 * Same contract as `useSavedPlaces`: `localStorage`, no backend, no account, no sync. The
 * selection is scoped by hub because comparing a Tokyo zone against a Kyoto one answers no
 * real question — you do not choose between them, you sleep in both.
 */
const STORAGE_KEY = "nihon.zoneComparison.v1";

/** More than four columns stops being a comparison and becomes a table nobody reads. */
export const MAX_COMPARED = 4;

type Selection = Record<string, string[]>;

function readStorage(): Selection {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    // Defensive: a hand-edited or older payload must not crash the screen.
    const clean: Selection = {};
    for (const [hub, ids] of Object.entries(parsed as Record<string, unknown>)) {
      if (Array.isArray(ids)) clean[hub] = ids.filter((id): id is string => typeof id === "string");
    }
    return clean;
  } catch {
    return {};
  }
}

export function useZoneComparison(hub: string | null) {
  const [selection, setSelection] = useState<Selection>(() => readStorage());

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(selection));
    } catch {
      /* storage unavailable — the comparison stays in memory for this session */
    }
  }, [selection]);

  const selected = hub ? selection[hub] ?? [] : [];

  const toggle = useCallback(
    (zoneId: string) => {
      if (!hub) return;
      setSelection((current) => {
        const ids = current[hub] ?? [];
        if (ids.includes(zoneId)) {
          return { ...current, [hub]: ids.filter((id) => id !== zoneId) };
        }
        if (ids.length >= MAX_COMPARED) return current;
        return { ...current, [hub]: [...ids, zoneId] };
      });
    },
    [hub]
  );

  const clear = useCallback(() => {
    if (!hub) return;
    setSelection((current) => ({ ...current, [hub]: [] }));
  }, [hub]);

  return { selected, toggle, clear, isFull: selected.length >= MAX_COMPARED };
}
