"use client";

import { useLayoutEffect, useRef, useState } from "react";
import * as RadixDialog from "@radix-ui/react-dialog";
import { X, ZoomIn, ZoomOut } from "lucide-react";
import { cn } from "@/lib/utils";

// A photo you can tap to see full screen. In the viewer, tap the photo to zoom in on that spot (drag or
// scroll to look around) and tap again to fit it back; tap outside it, ✕ or Esc to close.

const ZOOM = 2.5;

export function PhotoViewer({ src, alt, open, onOpenChange }: {
  src: string; alt: string; open: boolean; onOpenChange: (open: boolean) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  // Zoomed in: the photo's width, and the spot (0–1 across and down) to center
  const [zoom, setZoom] = useState<{ width: number; fx: number; fy: number } | null>(null);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || !zoom) return;
    el.scrollLeft = zoom.fx * el.scrollWidth - el.clientWidth / 2;
    el.scrollTop = zoom.fy * el.scrollHeight - el.clientHeight / 2;
  }, [zoom]);

  function toggle(e: React.MouseEvent<HTMLImageElement>) {
    e.stopPropagation();
    if (zoom) { setZoom(null); return; }
    const r = e.currentTarget.getBoundingClientRect();
    setZoom({ width: r.width * ZOOM, fx: (e.clientX - r.left) / r.width, fy: (e.clientY - r.top) / r.height });
  }

  return (
    <RadixDialog.Root open={open} onOpenChange={(o) => { if (!o) setZoom(null); onOpenChange(o); }}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-[60] bg-black/90" />
        {/* Clicks stay in here (React passes them up through portals — e.g. to a card that's a link) */}
        <RadixDialog.Content className="fixed inset-0 z-[60] outline-none" aria-describedby={undefined} onClick={(e) => e.stopPropagation()}>
          <RadixDialog.Title className="sr-only">{alt || "Photo"}</RadixDialog.Title>
          <div ref={scroller} onClick={() => onOpenChange(false)}
            className={cn("h-full w-full overflow-auto overscroll-contain", !zoom && "flex items-center justify-center p-4 sm:p-10")}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={alt} onClick={toggle} draggable={false}
              style={zoom ? { width: zoom.width, maxWidth: "none" } : undefined}
              className={cn("select-none", zoom ? "cursor-zoom-out" : "max-h-full max-w-full object-contain cursor-zoom-in")} />
          </div>
          <div className="pointer-events-none fixed inset-x-0 top-0 flex items-center justify-end gap-2 p-3" style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}>
            <span className="pointer-events-auto hidden items-center gap-1 rounded-full bg-black/60 px-3 py-1.5 text-xs text-white sm:inline-flex">
              {zoom ? <ZoomOut className="h-3.5 w-3.5" aria-hidden /> : <ZoomIn className="h-3.5 w-3.5" aria-hidden />}
              {zoom ? "Click to fit" : "Click to zoom"}
            </span>
            <RadixDialog.Close aria-label="Close"
              className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80">
              <X className="h-5 w-5" aria-hidden />
            </RadixDialog.Close>
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

/** An image that opens full screen when tapped. `className` styles the button around it. */
export function ZoomablePhoto({ src, alt, className, imgClassName, children }: {
  src: string; alt: string; className?: string; imgClassName?: string; children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" aria-label={`View ${alt || "photo"} full screen`}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}
        className={cn("relative block cursor-zoom-in overflow-hidden", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} draggable={false} className={imgClassName} />
        {children}
      </button>
      <PhotoViewer src={src} alt={alt} open={open} onOpenChange={setOpen} />
    </>
  );
}
