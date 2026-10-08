"use client";

// Tap-and-hold to drag Kanban cards on phones and tablets. (Mouse dragging uses the
// browser's own drag and drop, which touch screens don't support.)
//
// Hold a card still for a moment and it lifts and follows your finger; moving before
// then is an ordinary scroll. Drop it on a column to move it there. Near the edge of the
// board (or screen) the board scrolls along.

import { useEffect, useRef } from "react";

const HOLD_MS = 450;   // how long to hold before the card lifts
const SLOP_PX = 10;    // finger movement allowed while holding (more = it's a scroll)
const EDGE_PX = 48;    // auto-scroll when the finger is this close to an edge
const SPEED   = 14;    // auto-scroll speed, px per frame

export interface TouchDragHandlers {
  /** The card lifted */
  onStart:  (id: string) => void;
  /** The column under the finger changed (data-kanban-col), or null over none */
  onOver:   (columnId: string | null) => void;
  /** Finger lifted over `columnId` (null when not over a column) */
  onDrop:   (id: string, columnId: string | null) => void;
  /** Drag interrupted (e.g. a call came in) */
  onCancel: () => void;
}

interface DragState {
  id: string;
  el: HTMLElement;
  startX: number; startY: number;
  x: number; y: number;
  offX: number; offY: number;
  timer: ReturnType<typeof setTimeout>;
  active: boolean;
  over: string | null;
  ghost: HTMLElement | null;
  raf: number;
}

export function useTouchDrag(handlers: TouchDragHandlers, board: React.RefObject<HTMLElement | null>) {
  const handlersRef = useRef(handlers);
  useEffect(() => { handlersRef.current = handlers; });

  const drag = useRef<DragState | null>(null);
  /** True just after a drag, so the tap that ends it doesn't also open the card */
  const justDragged = useRef(false);
  /** Lifts the card once the hold completes (set up in the effect below) */
  const activateRef = useRef<((s: DragState) => void) | null>(null);

  useEffect(() => {
    function hitTest(s: DragState) {
      const col = document.elementFromPoint(s.x, s.y)?.closest<HTMLElement>("[data-kanban-col]")?.dataset.kanbanCol ?? null;
      if (col !== s.over) { s.over = col; handlersRef.current.onOver(col); }
    }
    function place(s: DragState) {
      if (s.ghost) s.ghost.style.transform = `translate(${s.x - s.offX}px, ${s.y - s.offY}px) rotate(2deg) scale(1.04)`;
    }
    function tick() {
      const s = drag.current;
      if (!s?.active) return;
      const b = board.current?.getBoundingClientRect();
      if (b && board.current) {
        if (s.x < b.left + EDGE_PX)       board.current.scrollLeft -= SPEED;
        else if (s.x > b.right - EDGE_PX) board.current.scrollLeft += SPEED;
      }
      if (s.y < EDGE_PX)                           window.scrollBy(0, -SPEED);
      else if (s.y > window.innerHeight - EDGE_PX) window.scrollBy(0, SPEED);
      hitTest(s);
      s.raf = requestAnimationFrame(tick);
    }
    function activate(s: DragState) {
      if (drag.current !== s) return;
      s.active = true;
      const r = s.el.getBoundingClientRect();
      s.offX = s.x - r.left;
      s.offY = s.y - r.top;
      // A copy of the card follows the finger; the original stays put, faded
      const g = s.el.cloneNode(true) as HTMLElement;
      Object.assign(g.style, {
        position: "fixed", left: "0", top: "0", width: `${r.width}px`, margin: "0",
        zIndex: "9999", pointerEvents: "none", transition: "none", opacity: "0.95",
        filter: "drop-shadow(0 12px 18px rgb(0 0 0 / 0.35))",
      });
      document.body.appendChild(g);
      s.ghost = g;
      s.el.style.opacity = "0.35";
      navigator.vibrate?.(25); // Android; iPhone browsers don't allow vibration
      handlersRef.current.onStart(s.id);
      place(s);
      hitTest(s);
      s.raf = requestAnimationFrame(tick);
    }
    function finish(s: DragState) {
      clearTimeout(s.timer);
      cancelAnimationFrame(s.raf);
      s.ghost?.remove();
      s.el.style.opacity = "";
      drag.current = null;
    }

    function onMove(e: TouchEvent) {
      const s = drag.current;
      if (!s) return;
      const t = e.touches[0];
      s.x = t.clientX;
      s.y = t.clientY;
      if (!s.active) {
        // Moved before the hold finished: it's a scroll, not a drag
        if (Math.hypot(s.x - s.startX, s.y - s.startY) > SLOP_PX) finish(s);
        return;
      }
      e.preventDefault(); // keep the page still while dragging
      place(s);
      hitTest(s);
    }
    function onEnd(e: TouchEvent) {
      const s = drag.current;
      if (!s) return;
      const wasActive = s.active;
      const over = s.over;
      finish(s);
      if (!wasActive) return; // a plain tap — let it open the card
      e.preventDefault();
      justDragged.current = true;
      setTimeout(() => { justDragged.current = false; }, 400);
      if (e.type === "touchend") handlersRef.current.onDrop(s.id, over);
      else handlersRef.current.onCancel();
    }

    // touchmove must not be passive, or the page can't be held still during a drag
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd, { passive: false });
    document.addEventListener("touchcancel", onEnd);
    activateRef.current = activate;
    return () => {
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
      if (drag.current) finish(drag.current);
    };
  }, [board]);

  /** Start watching for a hold on this card (call from onTouchStart) */
  function begin(id: string, el: HTMLElement, e: React.TouchEvent) {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    const s: DragState = {
      id, el, startX: t.clientX, startY: t.clientY, x: t.clientX, y: t.clientY,
      offX: 0, offY: 0, active: false, over: null, ghost: null, raf: 0,
      timer: setTimeout(() => activateRef.current?.(s), HOLD_MS),
    };
    drag.current = s;
  }

  return { begin, justDragged };
}
