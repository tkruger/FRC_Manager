"use client";

import { useEffect } from "react";

// iOS (home-screen app especially): after the on-screen keyboard closes, the page's layout
// viewport sometimes stays the keyboard's height short. Everything pinned to the bottom — the
// tab bar, the background — is then drawn about two-thirds of the way down the screen.
//
// Two remedies:
//  1. When the keyboard goes away, nudge the scroll position so iOS re-measures the page.
//  2. Whatever's left over, --vv-gap holds how far the real screen bottom is below the
//     layout viewport's; pinned-to-bottom things shift down by it. Never negative, so the
//     keyboard itself doesn't push the tab bar up.

export function ViewportFix() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;

    let last = vv.height;
    const measure = () => {
      const gap = Math.max(0, Math.round(vv.offsetTop + vv.height - window.innerHeight));
      root.style.setProperty("--vv-gap", `${gap}px`);
    };
    const nudge = () => {
      const y = window.scrollY;
      window.scrollTo(window.scrollX, y + 1);
      window.scrollTo(window.scrollX, y);
      requestAnimationFrame(measure);
    };
    const onResize = () => {
      // Grew back by a keyboard's worth: the keyboard closed
      if (vv.height - last > 100) setTimeout(nudge, 50);
      last = vv.height;
      measure();
    };
    const onFocusOut = (e: FocusEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) setTimeout(nudge, 300);
    };

    measure();
    vv.addEventListener("resize", onResize);
    vv.addEventListener("scroll", measure);
    window.addEventListener("orientationchange", measure);
    window.addEventListener("pageshow", measure);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      vv.removeEventListener("resize", onResize);
      vv.removeEventListener("scroll", measure);
      window.removeEventListener("orientationchange", measure);
      window.removeEventListener("pageshow", measure);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, []);
  return null;
}
