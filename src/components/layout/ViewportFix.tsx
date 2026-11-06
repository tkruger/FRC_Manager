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
// The home-screen app doesn't shift anything: the page scrolls inside <main> there (html.standalone in
// globals.css) — shifting only pushed the tab bar off the bottom of the screen. But iOS still moves
// the window to make room for the keyboard (or a drop-down's picker wheel) and can leave it there,
// with the tab bar and background drawn partway up. The window should never be scrolled in the app,
// so when the keyboard or picker closes — or the window has moved at all — put it back.

const TYPING = /^(INPUT|TEXTAREA|SELECT)$/;

function standaloneReset(vv: VisualViewport | null) {
  let last = vv?.height ?? 0;
  const reset = () => {
    // Moving the window (even by a pixel and back) makes iOS re-measure the screen
    window.scrollTo(0, 1);
    window.scrollTo(0, 0);
  };
  const later = (ms: number) => () => setTimeout(reset, ms);
  const onResize = () => {
    if (vv && vv.height - last > 100) setTimeout(reset, 50);
    if (vv) last = vv.height;
  };
  const onFocusOut = (e: FocusEvent) => {
    const t = e.target as HTMLElement | null;
    if (t && TYPING.test(t.tagName)) setTimeout(reset, 300);
  };
  const onChange = (e: Event) => { if ((e.target as HTMLElement | null)?.tagName === "SELECT") setTimeout(reset, 300); };
  const onScroll = () => { if (window.scrollY !== 0 && !TYPING.test(document.activeElement?.tagName ?? "")) reset(); };
  const onShow = later(50);

  vv?.addEventListener("resize", onResize);
  document.addEventListener("focusout", onFocusOut);
  document.addEventListener("change", onChange, true);
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("pageshow", onShow);
  window.addEventListener("orientationchange", onShow);
  return () => {
    vv?.removeEventListener("resize", onResize);
    document.removeEventListener("focusout", onFocusOut);
    document.removeEventListener("change", onChange, true);
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("pageshow", onShow);
    window.removeEventListener("orientationchange", onShow);
  };
}

export function ViewportFix() {
  useEffect(() => {
    const root = document.documentElement;
    const vv = window.visualViewport;
    if (root.classList.contains("standalone")) {
      root.style.setProperty("--vv-gap", "0px");
      return standaloneReset(vv);
    }
    if (!vv) {
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
