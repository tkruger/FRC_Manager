"use client";

import { X } from "lucide-react";

// Floating ✕ for a page the app opened in its own window or tab (What's new from the footer).
// Closes it where the browser allows (a tab or window opened by a link); otherwise — e.g. iPhone's
// home-screen app showing it over the app — goes back, or to the app.
export function ClosePageButton() {
  const close = () => {
    if (window.history.length > 1) { window.history.back(); return; }
    window.close();
    // Still open: this browser won't close it
    setTimeout(() => { window.location.href = "/dashboard"; }, 300);
  };
  return (
    <button
      type="button"
      onClick={close}
      aria-label="Close"
      className="fixed right-4 z-50 top-[calc(env(safe-area-inset-top,0px)+0.75rem)] flex h-10 w-10 items-center justify-center rounded-full bg-(--color-surface) text-(--color-text-primary) shadow-lg ring-1 ring-(--color-border) hover:text-(--color-primary)"
    >
      <X className="h-5 w-5" aria-hidden strokeWidth={2.25} />
    </button>
  );
}
