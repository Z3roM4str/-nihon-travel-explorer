import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import {
  clampGhostPoint,
  clampSlot,
  describeSlot,
  insertionIndex,
  isSameSlot,
  stepSlot,
  type StopOrigin,
  type StopSlot,
} from "../lib/stop-reorder";

/**
 * B28 (B9.2) — one controller for BOTH ways of carrying a stop: pointer/touch (a dedicated handle,
 * `touch-action: none` only on the handle so the rest of the card keeps scrolling) and keyboard
 * (Espacio/Intro coge, ↑/↓ mueve, Espacio/Intro suelta, Escape cancela). Both end in the same
 * `commit(placeId, origin, target)`, which the builder maps onto the existing draft mutations —
 * this hook holds only the transient «being carried» state and never touches the plan.
 *
 * DOM contract (read here, written by `DayTimeline`/`TripStop`/`UnassignedDrawer`):
 *  - `[data-day-drop]`          one per day section (hit area);
 *  - `[data-place-id]` in it    the day's stops (`li.trip-stop`), used for insertion midpoints;
 *  - `[data-unassigned]`        the «Sin asignar» aside (a drop target for a placed stop).
 */

export type StopDrag = {
  placeId: string;
  name: string;
  origin: StopOrigin;
  /** `null` = the pointer is over nothing droppable (releasing there cancels). */
  target: StopSlot | null;
  mode: "pointer" | "keyboard";
  /** Pointer coordinates at the start; later moves update the ghost imperatively via `ghostRef`. */
  x: number;
  y: number;
};

type Options = {
  /** Current number of stops per day, in day order. Read through a ref so listeners never go stale. */
  getCounts: () => readonly number[];
  commit: (placeId: string, origin: StopOrigin, target: StopSlot) => void;
  announce: (message: string) => void;
  dayLabel: (dayIndex: number) => string;
};

const MOVE_THRESHOLD_PX = 4;
const EDGE_PX = 72;
const MAX_SCROLL_STEP = 18;

function findScrollParent(node: Element | null): Element | null {
  let current = node?.parentElement ?? null;
  while (current) {
    const overflowY = getComputedStyle(current).overflowY;
    if ((overflowY === "auto" || overflowY === "scroll") && current.scrollHeight > current.clientHeight) return current;
    current = current.parentElement;
  }
  return document.scrollingElement;
}

/** Which slot is under the pointer? `null` when it is over nothing a stop may be dropped on. */
function slotAtPoint(x: number, y: number, draggedId: string, origin: StopOrigin): StopSlot | null {
  const aside = document.querySelector<HTMLElement>("[data-unassigned]");
  if (aside) {
    const box = aside.getBoundingClientRect();
    if (x >= box.left && x <= box.right && y >= box.top && y <= box.bottom) {
      return origin.kind === "unassigned" ? origin : { kind: "unassigned" };
    }
  }
  const days = [...document.querySelectorAll<HTMLElement>("[data-day-drop]")];
  if (days.length === 0) return null;
  const list = days[0].parentElement?.getBoundingClientRect();
  if (!list || x < list.left - 24 || x > list.right + 24) return null;
  let best = -1;
  let bestDistance = Infinity;
  days.forEach((section, dayIndex) => {
    const box = section.getBoundingClientRect();
    const distance = y < box.top ? box.top - y : y > box.bottom ? y - box.bottom : 0;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = dayIndex;
    }
  });
  // Between/around days snaps to the nearest one, but well outside the list it is «nowhere».
  if (best === -1 || bestDistance > 56) return null;
  const mids = [...days[best].querySelectorAll<HTMLElement>("[data-place-id]")]
    .filter((item) => item.dataset.placeId !== draggedId)
    .map((item) => {
      const box = item.getBoundingClientRect();
      return box.top + box.height / 2;
    });
  return { kind: "day", dayIndex: best, index: insertionIndex(mids, y) };
}

export function useStopReorder({ getCounts, commit, announce, dayLabel }: Options): {
  drag: StopDrag | null;
  handleProps: (placeId: string, name: string, origin: StopOrigin) => {
    onPointerDown: (event: PointerEvent<HTMLElement>) => void;
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
    onBlur: () => void;
  };
  cancel: () => void;
} {
  const [drag, setDrag] = useState<StopDrag | null>(null);
  const dragRef = useRef<StopDrag | null>(null);
  const latest = useRef({ getCounts, commit, announce, dayLabel });
  useEffect(() => {
    latest.current = { getCounts, commit, announce, dayLabel };
  });

  const pointerCleanup = useRef<(() => void) | null>(null);

  const setBoth = useCallback((next: StopDrag | null) => {
    dragRef.current = next;
    setDrag(next);
  }, []);

  const cancel = useCallback(() => {
    pointerCleanup.current?.();
    pointerCleanup.current = null;
    const current = dragRef.current;
    if (!current) return;
    setBoth(null);
    latest.current.announce(`Movimiento cancelado. ${current.name} sigue donde estaba.`);
  }, [setBoth]);

  useEffect(() => () => pointerCleanup.current?.(), []);

  function finish(current: StopDrag) {
    const { commit: doCommit, announce: say, getCounts: counts } = latest.current;
    setBoth(null);
    if (!current.target) {
      say(`Movimiento cancelado. ${current.name} sigue donde estaba.`);
      return;
    }
    const target = clampSlot(counts(), current.origin, current.target);
    if (isSameSlot(current.origin, target)) {
      say(`${current.name} sigue en la misma posición.`);
      return;
    }
    doCommit(current.placeId, current.origin, target);
  }

  function startPointer(event: PointerEvent<HTMLElement>, placeId: string, name: string, origin: StopOrigin) {
    if (dragRef.current) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const handle = event.currentTarget;
    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startY = event.clientY;
    let active = false;
    let scrollFrame = 0;
    let lastX = startX;
    let lastY = startY;
    const scroller = findScrollParent(document.querySelector("[data-day-drop]"));
    try {
      handle.setPointerCapture(pointerId);
    } catch {
      /* the pointer may already be gone; window listeners still work */
    }

    const move = (moveEvent: globalThis.PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      lastX = moveEvent.clientX;
      lastY = moveEvent.clientY;
      if (!active) {
        if (Math.hypot(lastX - startX, lastY - startY) < MOVE_THRESHOLD_PX) return;
        active = true;
        document.body.classList.add("is-reordering");
        const started: StopDrag = { placeId, name, origin, target: origin, mode: "pointer", x: lastX, y: lastY };
        setBoth(started);
        latest.current.announce(`Arrastrando ${name}. Suelta sobre un día para moverlo; fuera se cancela.`);
        loop();
      }
      // The ghost follows the pointer imperatively (`[data-stop-ghost]`): no re-render per move.
      const ghost = document.querySelector<HTMLElement>("[data-stop-ghost]");
      if (ghost) {
        const point = clampGhostPoint(lastX, lastY);
        ghost.style.transform = `translate(${point.x}px, ${point.y}px)`;
      }
      retarget();
    };

    const retarget = () => {
      const current = dragRef.current;
      if (!current) return;
      const slot = slotAtPoint(lastX, lastY, placeId, origin);
      const same =
        slot === null || current.target === null ? slot === current.target : isSameSlot(slot, current.target);
      if (same) return;
      const next: StopDrag = { ...current, target: slot };
      setBoth(next);
      if (slot) {
        latest.current.announce(
          `Soltar en ${describeSlot(latest.current.getCounts(), origin, clampSlot(latest.current.getCounts(), origin, slot), latest.current.dayLabel)}.`
        );
      }
    };

    // Edge auto-scroll so a stop can be carried to a day that is not on screen. It does not run over
    // «Sin asignar» (sticky at the bottom on phones): there the pointer is already at its target.
    const loop = () => {
      scrollFrame = requestAnimationFrame(() => {
        if (!dragRef.current) return;
        const aside = document.querySelector<HTMLElement>("[data-unassigned]")?.getBoundingClientRect();
        const overAside = aside && lastY >= aside.top && lastX >= aside.left && lastX <= aside.right;
        if (scroller && !overAside) {
          const top = 0;
          const bottom = window.innerHeight;
          let step = 0;
          if (lastY < top + EDGE_PX) step = -Math.ceil(((top + EDGE_PX - lastY) / EDGE_PX) * MAX_SCROLL_STEP);
          else if (lastY > bottom - EDGE_PX) step = Math.ceil(((lastY - (bottom - EDGE_PX)) / EDGE_PX) * MAX_SCROLL_STEP);
          if (step !== 0) {
            scroller.scrollTop += step;
            retarget();
          }
        }
        loop();
      });
    };

    const end = (endEvent: globalThis.PointerEvent) => {
      if (endEvent.pointerId !== pointerId) return;
      const current = dragRef.current;
      cleanup();
      if (active && current) {
        if (endEvent.type === "pointercancel") {
          setBoth(null);
          latest.current.announce(`Movimiento cancelado. ${current.name} sigue donde estaba.`);
        } else finish(current);
      }
    };

    const onKey = (keyEvent: globalThis.KeyboardEvent) => {
      if (keyEvent.key === "Escape" && dragRef.current) {
        keyEvent.preventDefault();
        cancel();
      }
    };

    const cleanup = () => {
      cancelAnimationFrame(scrollFrame);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      window.removeEventListener("keydown", onKey, true);
      document.body.classList.remove("is-reordering");
      try {
        handle.releasePointerCapture(pointerId);
      } catch {
        /* already released */
      }
      pointerCleanup.current = null;
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    window.addEventListener("keydown", onKey, true);
    pointerCleanup.current = cleanup;
  }

  function onKeyDown(event: KeyboardEvent<HTMLElement>, placeId: string, name: string, origin: StopOrigin) {
    const { getCounts: counts, announce: say, dayLabel: label } = latest.current;
    const current = dragRef.current;
    const isCommitKey = event.key === "Enter" || event.key === " ";
    if (!current || current.mode !== "keyboard" || current.placeId !== placeId) {
      if (isCommitKey && !current) {
        event.preventDefault();
        setBoth({ placeId, name, origin, target: origin, mode: "keyboard", x: 0, y: 0 });
        say(
          `${name} cogido en ${describeSlot(counts(), origin, origin, label)}. Flechas arriba y abajo para moverlo, ` +
            `Espacio o Intro para soltarlo, Escape para cancelar.`
        );
      }
      return;
    }
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      const from = current.target ?? current.origin;
      const next = stepSlot(counts(), current.origin, from, event.key === "ArrowUp" ? -1 : 1);
      if (isSameSlot(next, from)) return;
      setBoth({ ...current, target: next });
      say(`${describeSlot(counts(), current.origin, next, label)}.`);
      return;
    }
    if (isCommitKey) {
      event.preventDefault();
      finish(current);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      cancel();
    }
  }

  const handleProps = (placeId: string, name: string, origin: StopOrigin) => ({
    onPointerDown: (event: PointerEvent<HTMLElement>) => startPointer(event, placeId, name, origin),
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => onKeyDown(event, placeId, name, origin),
    // Leaving the handle while carrying with the keyboard drops nothing: it cancels, never commits.
    onBlur: () => {
      if (dragRef.current?.mode === "keyboard" && dragRef.current.placeId === placeId) cancel();
    },
  });

  return { drag, handleProps, cancel };
}
