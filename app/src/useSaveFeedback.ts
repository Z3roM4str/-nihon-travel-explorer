import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Transient confirmation state for saving and unsaving a place.
 *
 * Saving is the one action Nihon asks for repeatedly, and on a phone the control that was
 * pressed is often the only thing that visibly changed. This hook owns the message; `SaveToast`
 * owns how it looks. Nothing here touches storage — `useSavedPlaces` stays the only writer.
 */

const VISIBLE_MS = 2200;
/**
 * B25 (`04 §16`): a toast may carry one action («Deshacer»). A toast with an action stays long
 * enough to be reached, and its timer is PAUSED while the pointer or the keyboard focus is on it
 * (WCAG 2.2.1, timing adjustable) — an undo that expires while it is being reached is no undo.
 */
const ACTION_VISIBLE_MS = 6000;

export type SaveFeedbackAction = { label: string; onAction: () => void };

export type SaveFeedback = {
  /** Bumped on every announcement so repeating the same text still re-triggers the toast. */
  id: number;
  text: string;
  tone: "saved" | "removed";
  action?: SaveFeedbackAction;
};

export function useSaveFeedback() {
  const [feedback, setFeedback] = useState<SaveFeedback | null>(null);
  const [held, setHeld] = useState(false);
  const counter = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const announce = useCallback(
    (text: string, tone: SaveFeedback["tone"], action?: SaveFeedbackAction) => {
      counter.current += 1;
      setFeedback({ id: counter.current, text, tone, action });
    },
    []
  );

  const dismiss = useCallback(() => setFeedback(null), []);

  useEffect(() => {
    if (!feedback) return;
    if (timer.current) clearTimeout(timer.current);
    if (held && feedback.action) return;
    timer.current = setTimeout(
      () => setFeedback(null),
      feedback.action ? ACTION_VISIBLE_MS : VISIBLE_MS
    );
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [feedback, held]);

  return { feedback, announce, dismiss, hold: setHeld };
}
