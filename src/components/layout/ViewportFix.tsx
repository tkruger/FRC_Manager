"use client";

import { useEffect } from "react";

// iOS in the browser: after the on-screen keyboard closes, the page's layout viewport sometimes stays
// the keyboard's height short, and everything pinned to the bottom (the tab bar, the background) is
// drawn partway up the screen.
//
//  1. When the keyboard goes away, nudge the scroll position so iOS re-measures the page.
//  2. Whatever's left over, --vv-gap holds how far the real screen bottom is below the layout
//     viewport's; pinned-to-bottom things shift down by it. Never negative, so the keyboard itself
//     doesn't push the tab bar up.
//
// The home-screen app needs none of this: the page scrolls inside <main> there (html.standalone in
// globals.css), so the window never scrolls and nothing is shifted — shifting there only pushed the
// tab bar off the bottom of the screen.

const TYPING = /^(INPUT|TEXTAREA|SELECT)$/;

export function ViewportFix() {
  useEffect(() => {
    const root = document.documentElement;
    const vv = window.visualViewport;
    if (!vv || root.classList.contains("standalone")) {
      root.style.setProperty("--vv-gap", "0px");
      return;
    }

    let last = vv.height;
    let frame = 0;

    function measure() {
      frame = 0;
      const gap = vv!.offsetTop + vv!.height - window.innerHeight;
      root.style.setProperty("--vv-gap", `${Math.max(0, Math.round(gap))}px`);
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure); };
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
      schedule();
    };
    const onFocusOut = (e: FocusEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && TYPING.test(t.tagName)) setTimeout(nudge, 300);
    };

    measure();
    vv.addEventListener("resize", onResize);
    vv.addEventListener("scroll", schedule);
    window.addEventListener("orientationchange", schedule);
    window.addEventListener("pageshow", schedule);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      vv.removeEventListener("resize", onResize);
      vv.removeEventListener("scroll", schedule);
      window.removeEventListener("orientationchange", schedule);
      window.removeEventListener("pageshow", schedule);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, []);
  return null;
}
