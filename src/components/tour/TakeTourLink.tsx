"use client";

import { startTour } from "./AppTour";

/** "Take the tour" as a link-styled button (Help page) */
export function TakeTourLink() {
  return <button type="button" onClick={startTour} className="font-medium text-(--color-secondary) hover:underline">Take the tour</button>;
}
