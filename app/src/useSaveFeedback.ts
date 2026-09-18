import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Transient confirmation state for saving and unsaving a place.
 *
 * Saving is the one action Nihon asks for repeatedly, and on a phone the control that was
 * pressed is often the only thing that visibly changed. This hook owns the message; `SaveToast`
 * owns how it looks. Nothing here touches storage — `useSavedPlaces` stays the only writer.
 */

const VISIBLE_MS = 2200;

export type SaveFeedback = {
  /** Bumped on every announcement so repeating the same text still re-triggers the toast. */
  id: number;
  text: string;
  tone: "saved" | "removed";
};

export function useSaveFeedback() {
  const [feedback, setFeedback] = useState<SaveFeedback | null>(null);
  const counter = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const announce = useCallback((text: string, tone: SaveFeedback["tone"]) => {
    counter.current += 1;
    setFeedback({ id: counter.current, text, tone });
  }, []);

  useEffect(() => {
    if (!feedback) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setFeedback(null), VISIBLE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [feedback]);

  return { feedback, announce };
}
