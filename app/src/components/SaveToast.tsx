import type { SaveFeedback } from "../useSaveFeedback";
import { Icon } from "../icons/Icon";

/**
 * Immediate, non-blocking confirmation that a save landed.
 *
 * The live region is always mounted, even with nothing to say: a region that appears at the
 * same moment as its first message is frequently missed by screen readers, while an empty one
 * that later fills is announced reliably. It never takes focus, so a keyboard user scanning the
 * list is not interrupted.
 */
export function SaveToast({ feedback }: { feedback: SaveFeedback | null }) {
  return (
    <div className="save-toast-region" role="status" aria-live="polite">
      {feedback && (
        <p key={feedback.id} className={`save-toast save-toast--${feedback.tone}`}>
          <span className="save-toast__icon" aria-hidden="true">
            <Icon name={feedback.tone === "saved" ? "corazon-relleno" : "corazon"} size={16} />
          </span>
          {feedback.text}
        </p>
      )}
    </div>
  );
}
