"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Refreshes the page's data every so often while the tab is visible (live events) */
export function AutoRefresh({ seconds = 60 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => { if (document.visibilityState === "visible") router.refresh(); }, seconds * 1000);
    const onShow = () => { if (document.visibilityState === "visible") router.refresh(); };
    document.addEventListener("visibilitychange", onShow);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onShow); };
  }, [router, seconds]);
  return null;
}
