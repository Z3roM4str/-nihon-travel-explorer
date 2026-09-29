import { useEffect, useRef } from "react";
import type { SaveFeedback } from "../useSaveFeedback";
import { Icon } from "../icons/Icon";

type Props = {
  feedback: SaveFeedback | null;
  /** B25: pauses an action toast's timer while it has the pointer or the focus. */
  onHold?: (held: boolean) => void;
  onDismiss?: () => void;
};

/**
 * Immediate, non-blocking confirmation that a save landed.
 *
 * The live region is always mounted, even with nothing to say: a region that appears at the
 * same moment as its first message is frequently missed by screen readers, while an empty one
 * that later fills is announced reliably. A plain confirmation never takes focus, so a keyboard
 * user scanning the list is not interrupted.
 *
 * B25 (`04 §16`): a toast may carry ONE action («Deshacer»). That only happens after the reader
 * removed something from Quiero ir: the row they were on has just left the list, so focus moves to
 * the action — the one control that still refers to what they just did — and Escape dismisses it.
 */
export function SaveToast({ feedback, onHold, onDismiss }: Props) {
  const actionRef = useRef<HTMLButtonElement>(null);
  const action = feedback?.action;

  useEffect(() => {
    if (action) actionRef.current?.focus({ preventScroll: true });
    else onHold?.(false);
  }, [feedback?.id, action, onHold]);

  return (
    <div
      className="save-toast-region"
      role="status"
      aria-live="polite"
      onPointerEnter={action ? () => onHold?.(true) : undefined}
      onPointerLeave={action ? () => onHold?.(false) : undefined}
      onFocus={action ? () => onHold?.(true) : undefined}
      onBlur={action ? () => onHold?.(false) : undefined}
      onKeyDown={
        action
          ? (event) => {
              if (event.key === "Escape") {
                event.stopPropagation();
                onHold?.(false);
                onDismiss?.();
              }
            }
          : undefined
      }
    >
      {feedback && (
        <p
          key={feedback.id}
          className={`save-toast save-toast--${feedback.tone} ${action ? "save-toast--action" : ""}`.trim()}
        >
          <span className="save-toast__icon" aria-hidden="true">
            <Icon name={feedback.tone === "saved" ? "corazon-relleno" : "corazon"} size={16} />
          </span>
          <span className="save-toast__text">{feedback.text}</span>
          {action && (
            <button
              ref={actionRef}
              type="button"
              className="save-toast__action"
              onClick={() => {
                onHold?.(false);
                action.onAction();
              }}
            >
              {action.label}
            </button>
          )}
        </p>
      )}
    </div>
  );
}
