"use client";

import { createContext, useContext } from "react";
import Link from "next/link";

// View-only accounts (Parents, Volunteer coordinators with no other role) see the app but
// can't change it. The app layout provides the flag; components hide their edit controls.
// The database refuses their writes regardless (src/lib/access/guard.ts).

const ViewOnlyContext = createContext(false);

export function ViewOnlyProvider({ viewOnly, children }: { viewOnly: boolean; children: React.ReactNode }) {
  return <ViewOnlyContext.Provider value={viewOnly}>{children}</ViewOnlyContext.Provider>;
}

/** True for view-only accounts */
export function useViewOnly(): boolean {
  return useContext(ViewOnlyContext);
}

/** Shows its children only to people who can make changes */
export function CanEdit({ children, fallback = null }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  return <>{useViewOnly() ? fallback : children}</>;
}

/** The strip under the top nav telling a view-only account what it can do */
export function ViewOnlyBanner({ canVolunteer }: { canVolunteer: boolean }) {
  return (
    <div className="no-print border-b border-(--color-border) bg-(--color-info)/10 px-4 py-2 text-center text-small text-(--color-text-primary)">
      <b>View-only.</b> You can see everything the team sees, but not change it.{" "}
      {canVolunteer
        ? <Link href="/volunteers" className="font-medium text-(--color-primary) hover:underline">Sign up to volunteer →</Link>
        : <>Volunteering opens once a Head Mentor clears you.</>}
    </div>
  );
}

/** A whole page that only makes changes (e.g. New task), opened by a view-only account */
export function ViewOnlyNotice({ what }: { what: string }) {
  return (
    <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-3">
      <h1 className="text-h2 text-(--color-text-primary)">{what}</h1>
      <p className="text-body text-(--color-text-secondary)">Your account is view-only, so it can&apos;t make changes here.</p>
    </div>
  );
}
