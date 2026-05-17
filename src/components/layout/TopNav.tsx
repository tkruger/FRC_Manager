"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useTheme } from "@/components/providers/ThemeProvider";
import { cn } from "@/lib/utils";
import type { Session } from "next-auth";

const MODULE_TABS = [
  { label: "Fleet",       href: "/fleet" },
  { label: "Tools",       href: "/tools" },
  { label: "Inventory",   href: "/inventory" },
  { label: "Procurement", href: "/procurement" },
  { label: "Budget",      href: "/budget" },
  { label: "Schedule",    href: "/schedule" },
  { label: "Safety",      href: "/safety" },
];

const ROBOT_CONTEXT_PATHS = ["/fleet", "/inventory", "/schedule", "/budget"];

interface Props {
  session: Session | null;
  robots?: { id: string; displayName: string; status: string }[];
  activeRobotId?: string;
  pendingMemberCount?: number;
  unreadNotificationCount?: number;
}

export function TopNav({ session, robots = [], activeRobotId, pendingMemberCount = 0, unreadNotificationCount = 0 }: Props) {
  const pathname = usePathname();
  const { resolvedTheme, toggle, mode } = useTheme();

  const showRobotSelector = ROBOT_CONTEXT_PATHS.some((p) => pathname.startsWith(p));
  const activeRobot = robots.find((r) => r.id === activeRobotId);

  return (
    <header className="fixed inset-x-0 top-0 z-40 h-14 border-b border-[--color-border] bg-[--color-surface]/95 backdrop-blur-sm flex items-center px-4 gap-4 transition-colors">
      {/* Logo */}
      <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
        <div className="w-7 h-7 rounded bg-[--color-primary] flex items-center justify-center">
          <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 text-white" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
          </svg>
        </div>
        <span className="font-bold text-sm text-[--color-text-primary] hidden sm:block">FRC Manager</span>
      </Link>

      {/* Module tabs */}
      <nav className="hidden lg:flex items-center gap-1 flex-1 justify-center" aria-label="Modules">
        {MODULE_TABS.map((tab) => {
          const active = pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "relative px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                active
                  ? "text-[--color-primary]"
                  : "text-[--color-text-secondary] hover:text-[--color-text-primary] hover:bg-[--color-surface-overlay]"
              )}
            >
              {tab.label}
              {active && <span className="absolute bottom-0 inset-x-0 h-0.5 rounded-t-full bg-[--color-primary]" />}
            </Link>
          );
        })}
      </nav>

      {/* Right controls */}
      <div className="flex items-center gap-2 ml-auto shrink-0">
        {showRobotSelector && robots.length > 0 && (
          <RobotSelector robots={robots} activeRobotId={activeRobotId} activeRobot={activeRobot} />
        )}

        {/* Theme toggle */}
        <button
          onClick={toggle}
          className="h-9 w-9 rounded-md flex items-center justify-center text-[--color-text-secondary] hover:bg-[--color-surface-overlay] transition-colors"
          aria-label={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          title={`Mode: ${mode}`}
        >
          {resolvedTheme === "dark" ? (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
            </svg>
          )}
        </button>

        {/* Notification bell */}
        <Link
          href="/notifications"
          className="relative h-9 w-9 rounded-md flex items-center justify-center text-[--color-text-secondary] hover:bg-[--color-surface-overlay] transition-colors"
          aria-label="Notifications"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
          </svg>
          {unreadNotificationCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-[--color-primary] text-white text-[10px] font-bold flex items-center justify-center">
              {unreadNotificationCount > 9 ? "9+" : unreadNotificationCount}
            </span>
          )}
        </Link>

        {/* Settings / member approval — with pending badge */}
        <Link
          href="/settings/members"
          className="relative h-9 w-9 rounded-md flex items-center justify-center text-[--color-text-secondary] hover:bg-[--color-surface-overlay] transition-colors"
          aria-label="Team settings"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {pendingMemberCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-[--color-warning] text-white text-[10px] font-bold flex items-center justify-center">
              {pendingMemberCount > 9 ? "9+" : pendingMemberCount}
            </span>
          )}
        </Link>

        {session?.user && <UserMenu user={session.user} />}
      </div>
    </header>
  );
}

function RobotSelector({
  robots,
  activeRobotId,
  activeRobot,
}: {
  robots: { id: string; displayName: string; status: string }[];
  activeRobotId?: string;
  activeRobot?: { id: string; displayName: string; status: string };
}) {
  const isRetired = activeRobot?.status?.startsWith("RETIRED") || activeRobot?.status === "DECOMMISSIONED";
  return (
    <div className="flex items-center gap-1.5 rounded-md border border-[--color-border] bg-[--color-surface-raised] px-3 h-9 text-sm">
      <span className="text-[--color-text-secondary] text-xs">Robot:</span>
      <select
        className="bg-transparent text-[--color-text-primary] text-sm font-medium focus:outline-none cursor-pointer max-w-[160px]"
        value={activeRobotId ?? ""}
        onChange={(e) => {
          const url = new URL(window.location.href);
          url.searchParams.set("robotId", e.target.value);
          window.location.href = url.toString();
        }}
      >
        <option value="">All Robots</option>
        {robots.map((r) => (
          <option key={r.id} value={r.id}>{r.displayName}</option>
        ))}
      </select>
      {isRetired && <span className="badge badge-neutral text-xs">Retired</span>}
    </div>
  );
}

function UserMenu({ user }: { user: { name?: string | null; email?: string | null } }) {
  return (
    <div className="relative group">
      <button
        className="h-9 w-9 rounded-full bg-[--color-primary] flex items-center justify-center text-white text-sm font-bold shrink-0"
        aria-label="User menu"
      >
        {user.name?.[0]?.toUpperCase() ?? "U"}
      </button>
      <div className="absolute right-0 top-full mt-1 w-52 rounded-md border border-[--color-border] bg-[--color-surface-raised] shadow-lg py-1 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-50">
        <div className="px-3 py-2 border-b border-[--color-border]">
          <p className="text-sm font-medium text-[--color-text-primary] truncate">{user.name}</p>
          <p className="text-xs text-[--color-text-secondary] truncate">{user.email}</p>
        </div>
        <Link href="/settings/members" className="flex items-center gap-2 px-3 py-2 text-sm text-[--color-text-primary] hover:bg-[--color-surface-overlay]">
          Team members
        </Link>
        <Link href="/settings/season" className="flex items-center gap-2 px-3 py-2 text-sm text-[--color-text-primary] hover:bg-[--color-surface-overlay]">
          Season settings
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[--color-danger] hover:bg-[--color-surface-overlay]"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
