"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

// Tiny app-wide toast: call toast.success("Saved") from any client component.
// <Toaster /> (mounted once in the app layout) shows them.

type Kind = "success" | "error";
interface Toast { id: number; kind: Kind; text: string }

let nextId = 1;
const listeners = new Set<(t: Toast) => void>();

function push(kind: Kind, text: string) {
  const t = { id: nextId++, kind, text };
  listeners.forEach((l) => l(t));
}

export const toast = {
  success: (text: string) => push("success", text),
  error:   (text: string) => push("error", text),
};

const VISIBLE_MS = 3500;

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const onToast = (t: Toast) => {
      setToasts((list) => [...list.slice(-2), t]); // keep at most 3 on screen
      setTimeout(() => setToasts((list) => list.filter((x) => x.id !== t.id)), VISIBLE_MS);
    };
    listeners.add(onToast);
    return () => { listeners.delete(onToast); };
  }, []);

  return (
    <div
      aria-live="polite"
      // Above the phone tab bar; bottom-right on larger screens
      className="pointer-events-none fixed inset-x-0 bottom-20 z-[100] flex flex-col items-center gap-2 px-4 lg:bottom-6 lg:items-end lg:right-6 lg:left-auto"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.kind === "error" ? "alert" : "status"}
          className={cn(
            "pointer-events-auto flex max-w-sm items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium shadow-lg",
            "bg-(--color-surface) text-(--color-text-primary)",
            t.kind === "success" ? "border-(--color-success)" : "border-(--color-danger)"
          )}
        >
          <span aria-hidden className={t.kind === "success" ? "text-(--color-success)" : "text-(--color-danger)"}>
            {t.kind === "success" ? "✓" : "!"}
          </span>
          {t.text}
        </div>
      ))}
    </div>
  );
}
