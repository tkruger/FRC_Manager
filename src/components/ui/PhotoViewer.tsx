"use client";

import { useLayoutEffect, useRef, useState } from "react";
import * as RadixDialog from "@radix-ui/react-dialog";
import { ImageOff, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { thumbUrl } from "@/lib/photo-url";

// A photo you can tap to see bigger. It opens straight away as a card — the small copy (already
// loaded for the list) stands in, blurred, while the full photo loads — with ✕ to close at any time,
// before it has loaded too. Tap the photo to zoom in on that spot (scroll to look around) and tap again
// to fit it back; tap outside the card, ✕ or Esc to close.

const ZOOM = 2.5;

export function PhotoViewer({ src, alt, open, onOpenChange, placeholder }: {
  src: string; alt: string; open: boolean; onOpenChange: (open: boolean) => void;
  /** A small copy to show while the full photo loads */
  placeholder?: string;
}) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-[60] bg-black/70 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        {/* Clicks stay in here (React passes them up through portals — e.g. to a card that opens a page) */}
        <RadixDialog.Content aria-describedby={undefined} onClick={(e) => e.stopPropagation()}
          className="fixed left-1/2 top-1/2 z-[60] flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-1.5rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-(--color-border) shadow-2xl outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
          style={{ backgroundColor: "var(--color-surface)" }}>
          <div className="flex items-center gap-3 border-b border-(--color-border) py-2 pl-4 pr-2">
            <RadixDialog.Title className="min-w-0 flex-1 truncate text-sm font-medium text-(--color-text-primary)">{alt || "Photo"}</RadixDialog.Title>
            <RadixDialog.Close aria-label="Close"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-(--color-text-secondary) hover:bg-(--color-surface-overlay) hover:text-(--color-text-primary)">
              <X className="h-5 w-5" aria-hidden />
            </RadixDialog.Close>
          </div>
          {/* Mounted only while open, so each opening starts fresh */}
          {open && <ViewerBody src={src} alt={alt} placeholder={placeholder} />}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

function ViewerBody({ src, alt, placeholder }: { src: string; alt: string; placeholder?: string }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "loaded" | "failed">("loading");
  // Zoomed in: the photo's width, and the spot (0–1 across and down) to center
  const [zoom, setZoom] = useState<{ width: number; fx: number; fy: number } | null>(null);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || !zoom) return;
    el.scrollLeft = zoom.fx * el.scrollWidth - el.clientWidth / 2;
    el.scrollTop = zoom.fy * el.scrollHeight - el.clientHeight / 2;
  }, [zoom]);

  function toggle(e: React.MouseEvent<HTMLImageElement>) {
    if (state !== "loaded") return;
    if (zoom) { setZoom(null); return; }
    const r = e.currentTarget.getBoundingClientRect();
    setZoom({ width: r.width * ZOOM, fx: (e.clientX - r.left) / r.width, fy: (e.clientY - r.top) / r.height });
  }

  return (
    <div ref={scroller} className={cn("relative min-h-[40vh] flex-1 overflow-auto overscroll-contain bg-black/90", !zoom && "flex items-center justify-center")}>
      {/* The small copy, blurred, until the full photo is in */}
      {placeholder && state !== "loaded" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={placeholder} alt="" aria-hidden draggable={false}
          className="absolute inset-0 h-full w-full scale-105 object-contain opacity-60 blur-md" />
      )}
      {state === "loading" && (
        <span className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-white">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> Loading photo…
        </span>
      )}
      {state === "failed" ? (
        <span className="flex flex-col items-center gap-2 p-8 text-sm text-white/80">
          <ImageOff className="h-6 w-6" aria-hidden /> Couldn&apos;t load the photo.
        </span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} onClick={toggle} draggable={false} decoding="async"
          onLoad={() => setState("loaded")} onError={() => setState("failed")}
          style={zoom ? { width: zoom.width, maxWidth: "none" } : undefined}
          className={cn("relative select-none transition-opacity duration-200", state === "loaded" ? "opacity-100" : "opacity-0",
            zoom ? "cursor-zoom-out" : "max-h-[calc(100dvh-6rem)] max-w-full object-contain cursor-zoom-in")} />
      )}
    </div>
  );
}

/**
 * An image that opens bigger when tapped. `className` styles the button around it; `thumb` shows the
 * small copy (for a small image) — the full photo still opens, with the small copy standing in.
 */
export function ZoomablePhoto({ src, alt, className, imgClassName, thumb, children }: {
  src: string; alt: string; className?: string; imgClassName?: string; thumb?: boolean; children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const small = thumbUrl(src);
  return (
    <>
      <button type="button" aria-label={`View ${alt || "photo"} bigger`}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}
        className={cn("relative block cursor-zoom-in overflow-hidden", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={thumb ? small : src} alt={alt} draggable={false} loading="lazy" decoding="async" className={imgClassName} />
        {children}
      </button>
      <PhotoViewer src={src} alt={alt} open={open} onOpenChange={setOpen} placeholder={small !== src ? small : undefined} />
    </>
  );
}
