"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Home-screen app: the page scrolls inside <main> (see .standalone in globals.css), so a new page
// would open wherever the last one was scrolled to — or just under the top bar. Start each page
// at the top.

export function ScrollReset() {
  const pathname = usePathname();
  useEffect(() => {
    if (!document.documentElement.classList.contains("standalone")) return;
    const main = document.querySelector<HTMLElement>("#app-shell > main");
    if (!main) return;
    // After Next.js has done its own scrolling for the new page
    const id = requestAnimationFrame(() => { main.scrollTop = 0; });
    return () => cancelAnimationFrame(id);
  }, [pathname]);
  return null;
}
