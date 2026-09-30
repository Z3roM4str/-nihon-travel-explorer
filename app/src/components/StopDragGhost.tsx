import { createPortal } from "react-dom";
import { clampGhostPoint } from "../lib/stop-reorder";

type Props = {
  name: string;
  /** Pointer position when the drag started; `useStopReorder` then moves the node imperatively. */
  x: number;
  y: number;
  /** «Día 2, posición 1 de 3» — where a release would put the stop right now. */
  where: string;
};

/**
 * B28 (B9.2) — the floating card that follows the pointer while a stop is carried. Decorative
 * (`aria-hidden`): the same information reaches assistive tech through the builder's live region.
 * Portalled to `body` so no ancestor transform/overflow can clip or offset it.
 */
export function StopDragGhost({ name, x, y, where }: Props) {
  const point = clampGhostPoint(x, y);
  return createPortal(
    <div
      className="stop-ghost"
      aria-hidden="true"
      data-stop-ghost
      style={{ transform: `translate(${point.x}px, ${point.y}px)` }}
    >
      <span className="stop-ghost__name">{name}</span>
      <span className="stop-ghost__where">{where}</span>
    </div>,
    document.body
  );
}
