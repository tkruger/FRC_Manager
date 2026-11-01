"use client";

import { useEffect } from "react";

// iOS (home-screen app especially): the page's layout viewport sometimes ends up short — after the
// on-screen keyboard closes, and sometimes just while scrolling a long page. Everything pinned to the
// bottom — the tab bar, the background — is then drawn partway up the screen.
//
// Remedies:
//  1. When the keyboard goes away, or the viewport shrinks with no keyboard up, nudge the scroll
//     position so iOS re-measures the page.
//  2. Whatever's left over, --vv-gap holds how far the real screen bottom is below the layout
//     viewport's; pinned-to-bottom things shift down by it. It's the larger of
//       · the visual viewport reaching below the layout viewport, and
//       · (home-screen app, no keyboard) how much shorter the page is than its tallest healthy
//         height in this orientation.
//     Never negative, so the keyboard itself doesn't push the tab bar up.

const TYPING = /^(INPUT|TEXTAREA|SELECT)$/;

export function ViewportFix() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    const standalone = window.matchMedia("(display-mode: standalone)").matches
      || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const typing = () => {
      const a = document.activeElement as HTMLElement | null;
      return !!a && (TYPING.test(a.tagName) || a.isContentEditable);
    };
    const orientation = () => (window.innerWidth > window.innerHeight ? "landscape" : "portrait");
    // The tallest the page has been in each orientation with no keyboard up
    const tallest: Record<string, number> = {};

    let last = vv.height;
    let lastNudge = 0;
    let frame = 0;

    const nudge = () => {
      lastNudge = Date.now();
      const y = window.scrollY;
      window.scrollTo(window.scrollX, y + 1);
      window.scrollTo(window.scrollX, y);
      requestAnimationFrame(measure);
    };

    function measure() {
      frame = 0;
      let gap = vv!.offsetTop + vv!.height - window.innerHeight;
      if (standalone && !typing()) {
        const o = orientation();
        const h = window.innerHeight;
        tallest[o] = Math.max(tallest[o] ?? 0, h);
        const short = tallest[o] - h;
        if (short > 40) {
          gap = Math.max(gap, short);
          // Try to get iOS to fix it properly (at most every couple of seconds)
          if (Date.now() - lastNudge > 2000) setTimeout(nudge, 50);
        }
      }
      root.style.setProperty("--vv-gap", `${Math.max(0, Math.round(gap))}px`);
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure); };

    const onResize = () => {
      // Grew back by a keyboard's worth: the keyboard closed
      if (vv.height - last > 100) setTimeout(nudge, 50);
      last = vv.height;
      schedule();
    };
    const onFocusOut = (e: FocusEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && TYPING.test(t.tagName)) setTimeout(nudge, 300);
    };

    measure();
    vv.addEventListener("resize", onResize);
    vv.addEventListener("scroll", schedule);
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("orientationchange", schedule);
    window.addEventListener("pageshow", schedule);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      vv.removeEventListener("resize", onResize);
      vv.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("orientationchange", schedule);
      window.removeEventListener("pageshow", schedule);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, []);
  return null;
}
