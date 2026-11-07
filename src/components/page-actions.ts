"use client";

// Page actions by name: the header (or its ⋯ menu) fires one, and the component that does it — a dialog,
// a confirmation panel — listens for it wherever it's mounted. That way an action can sit in the header
// on a computer and in the menu on a phone without being built twice.

import { useEffect, useRef } from "react";

const EVENT = "frc:page-action";

export function firePageAction(name: string) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: name }));
}

/** Run `handler` when the page action `name` fires */
export function usePageAction(name: string | undefined, handler: () => void) {
  const ref = useRef(handler);
  useEffect(() => { ref.current = handler; });
  useEffect(() => {
    if (!name) return;
    const on = (e: Event) => { if ((e as CustomEvent<string>).detail === name) ref.current(); };
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, [name]);
}
