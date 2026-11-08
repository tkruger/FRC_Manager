"use client";

// Tap-and-hold to drag Kanban cards on phones and tablets. (Mouse dragging uses the
// browser's own drag and drop, which touch screens don't support.)
//
// Hold a card still for a moment and it lifts and follows your finger; moving before
// then is an ordinary scroll. Drop it on a column to move it there. Near the edge of the
// board (or screen) the board scrolls along.

import { useEffect, useRef, useSyncExternalStore } from "react";

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
  /** Where the finger went down — its touch events keep going there even if it leaves the page */
  src: EventTarget | null;
  /** Timings for the debug readout (performance.now) */
  t: { down: number; queued: number; fired?: number; ghost?: number; started?: number };
}

// ── Debug readout ──────────────────────────────────────────────────────────
// Open any page with ?debugdrag=1 (and ?debugdrag=0 to turn it off). After each hold, a strip at the
// top shows where the time went: the hold itself, how late the timer fired (a busy phone), the app's
// work when the card lifts, and when the lifted card reached the screen. Kept on this device.

const DEBUG_KEY = "frc-debug-drag";
function debugOn(): boolean {
  try {
    const p = new URLSearchParams(window.location.search).get("debugdrag");
    if (p === "1") localStorage.setItem(DEBUG_KEY, "1");
    if (p === "0") localStorage.removeItem(DEBUG_KEY);
    return localStorage.getItem(DEBUG_KEY) === "1";
  } catch { return false; }
}
function debugShow(text: string) {
  console.info("[drag]", text);
  let el = document.getElementById("frc-drag-debug");
  if (!el) {
    el = document.createElement("div");
    el.id = "frc-drag-debug";
    Object.assign(el.style, {
      position: "fixed", left: "8px", right: "8px", top: "calc(env(safe-area-inset-top) + 8px)", zIndex: "2147483647",
      background: "rgba(0,0,0,.85)", color: "#7CFC9A", font: "12px/1.4 ui-monospace,monospace", padding: "6px 8px",
      borderRadius: "8px", whiteSpace: "pre-wrap", pointerEvents: "none",
    });
    document.body.appendChild(el);
  }
  el.textContent = text;
}
const ms = (n: number) => `${Math.round(n)}ms`;

/** `target` names the drop targets' attribute: data-kanban-col by default (the Kanban columns) */
export function useTouchDrag(handlers: TouchDragHandlers, board: React.RefObject<HTMLElement | null>, target = "kanban-col") {
  const handlersRef = useRef(handlers);
  useEffect(() => { handlersRef.current = handlers; });

  const drag = useRef<DragState | null>(null);
  /** True just after a drag, so the tap that ends it doesn't also open the card */
  const justDragged = useRef(false);
  /** Lifts the card once the hold completes, and ends a drag (set up in the effect below) */
  const activateRef = useRef<((s: DragState) => void) | null>(null);
  const finishRef = useRef<((s: DragState) => void) | null>(null);
  const listenRef = useRef<{ move: (e: TouchEvent) => void; end: (e: TouchEvent) => void } | null>(null);

  useEffect(() => {
    function hitTest(s: DragState) {
      const col = document.elementFromPoint(s.x, s.y)?.closest<HTMLElement>(`[data-${target}]`)?.getAttribute(`data-${target}`) ?? null;
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
      s.t.fired = performance.now();
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
      s.t.ghost = performance.now();
      navigator.vibrate?.(25); // Android; iPhone browsers don't allow vibration
      handlersRef.current.onStart(s.id);
      s.t.started = performance.now();
      place(s);
      hitTest(s);
      s.raf = requestAnimationFrame(tick);
      if (debugOn()) {
        // Two frames later the lifted card has been drawn
        requestAnimationFrame(() => requestAnimationFrame(() => {
          const t = s.t, shown = performance.now();
          debugShow([
            `lifted ${ms(shown - t.down)} after the finger went down`,
            `  hold ${HOLD_MS}ms · timer late ${ms(t.fired! - t.queued - HOLD_MS)} · touch reached the app ${ms(t.queued - t.down)}`,
            `  copy card ${ms(t.ghost! - t.fired!)} · app on lift ${ms(t.started! - t.ghost!)} · to screen ${ms(shown - t.started!)}`,
          ].join("\n"));
        }));
      }
    }
    function finish(s: DragState) {
      clearTimeout(s.timer);
      cancelAnimationFrame(s.raf);
      s.ghost?.remove();
      s.el.style.opacity = "";
      unlisten(s);
      if (drag.current === s) drag.current = null;
    }
    function unlisten(s: DragState) {
      s.src?.removeEventListener("touchmove", onMove as EventListener);
      s.src?.removeEventListener("touchend", onEnd as EventListener);
      s.src?.removeEventListener("touchcancel", onEnd as EventListener);
      s.src = null;
    }

    // The same event can arrive twice — at the finger's element and at the page — but counts once
    let last: TouchEvent | null = null;
    function onMove(e: TouchEvent) {
      const s = drag.current;
      if (!s || e === last) return;
      last = e;
      const t = e.touches[0];
      s.x = t.clientX;
      s.y = t.clientY;
      if (!s.active) {
        // Moved before the hold finished: it's a scroll, not a drag
        const moved = Math.hypot(s.x - s.startX, s.y - s.startY);
        if (moved > SLOP_PX) {
          if (debugOn()) debugShow(`cancelled: the finger moved ${Math.round(moved)}px after ${ms(performance.now() - s.t.down)} (more than ${SLOP_PX}px = a scroll)`);
          finish(s);
        }
        return;
      }
      e.preventDefault(); // keep the page still while dragging
      place(s);
      hitTest(s);
    }
    function onEnd(e: TouchEvent) {
      const s = drag.current;
      if (!s || e === last) return;
      last = e;
      const wasActive = s.active;
      const over = s.over;
      finish(s);
      if (!wasActive) { // a plain tap — let it open the card
        if (debugOn()) debugShow(`released after ${ms(performance.now() - s.t.down)} — before the ${HOLD_MS}ms hold`);
        return;
      }
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
    finishRef.current = finish;
    listenRef.current = { move: onMove, end: onEnd };
    return () => {
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
      if (drag.current) finish(drag.current);
    };
  }, [board, target]);

  /** Start watching for a hold on this card (call from onTouchStart) */
  function begin(id: string, el: HTMLElement, e: React.TouchEvent) {
    // A drag that never heard its finger lift is over now
    if (drag.current) finishRef.current?.(drag.current);
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    // e.timeStamp: when the touch happened (same clock as performance.now in current browsers)
    const now = performance.now();
    const down = e.timeStamp > 0 && e.timeStamp <= now ? e.timeStamp : now;
    const s: DragState = {
      id, el, startX: t.clientX, startY: t.clientY, x: t.clientX, y: t.clientY,
      offX: 0, offY: 0, active: false, over: null, ghost: null, raf: 0, src: e.target,
      t: { down, queued: now },
      timer: setTimeout(() => activateRef.current?.(s), HOLD_MS),
    };
    drag.current = s;
    // Touch events go to the element the finger went down on. If a re-render takes it off the page,
    // they no longer reach the page's listeners — so listen on it too, or the drag never ends
    const l = listenRef.current;
    if (l && s.src) {
      s.src.addEventListener("touchmove", l.move as EventListener, { passive: false });
      s.src.addEventListener("touchend", l.end as EventListener, { passive: false });
      s.src.addEventListener("touchcancel", l.end as EventListener);
    }
  }

  return { begin, justDragged };
}

/**
 * True when the main pointer is a mouse or trackpad. Cards are only marked `draggable` then:
 * on phones and tablets (iOS 15+, Chrome on Android) a draggable element starts the
 * browser's own drag on a long press, which cancels our touch events mid-drag — the card
 * lifts but won't follow the finger.
 */
export function useFinePointer(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia("(pointer: fine)");
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia("(pointer: fine)").matches,
    () => true, // server render: assume a mouse; phones correct it straight after
  );
}
