"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { useTheme } from "@/components/providers/ThemeProvider";
import { cn } from "@/lib/utils";
import type { Session } from "next-auth";
import { NotificationsDropdown } from "./NotificationsDropdown";
import { canCoordinate, isAdult } from "@/lib/volunteers";
import { hiddenForViewOnly, isViewOnly } from "@/lib/access/read-only";
import { audienceOf, MOBILE_TABS_BY_AUDIENCE } from "@/lib/audience";
import { FeedbackLink } from "@/components/feedback/Feedback";
import { startTour } from "@/components/tour/AppTour";
import { Compass, Megaphone } from "lucide-react";

const MODULE_TABS = [
  { label: "Home",        href: "/dashboard",   icon: HomeIcon,        exact: true },
  { label: "Tasks",       href: "/tasks",    icon: TasksIcon,       exact: false },
  { label: "Tools",       href: "/tools",       icon: ToolsIcon,       exact: false },
  { label: "Inventory",   href: "/inventory",   icon: InventoryIcon,   exact: false },
  { label: "Orders",      href: "/procurement", icon: ProcurementIcon, exact: false },
  { label: "Budget",      href: "/budget",      icon: BudgetIcon,      exact: false },
  { label: "Fleet",        href: "/fleet",       icon: FleetIcon,       exact: false },
  { label: "Safety",      href: "/safety",      icon: SafetyIcon,      exact: false },
  { label: "Volunteers",  href: "/volunteers",  icon: VolunteersIcon,  exact: false },
  { label: "Events",      href: "/competitions", icon: TrophyIcon,     exact: false },
  { label: "Season",      href: "/settings/season", icon: SettingsNavIcon, exact: false },
];

// Everything on the phone's bottom bar and its More sheet. Four of them are tabs — chosen for who's
// looking (parents, students, mentors; see src/lib/audience.ts) — and the rest go under More.
const MOBILE_ITEMS = [
  { label: "Home",       href: "/dashboard",      icon: HomeIcon },
  { label: "Tasks",      href: "/tasks",          icon: TasksIcon },
  { label: "Calendar",   href: "/calendar",       icon: CalendarIcon },
  // Our competitions: schedule, bumper colors, results, where to watch
  { label: "Events",     href: "/competitions",   icon: TrophyIcon },
  { label: "Volunteers", href: "/volunteers",     icon: VolunteersIcon },
  { label: "Tools",      href: "/tools",          icon: ToolsIcon },
  { label: "Safety",     href: "/safety",         icon: SafetyIcon },
  { label: "Inventory",  href: "/inventory",      icon: InventoryIcon },
  { label: "Orders",     href: "/procurement",    icon: ProcurementIcon },
  { label: "Budget",     href: "/budget",         icon: BudgetIcon },
  // Submit an expense / ask to be paid back (Treasurers: the review queue)
  { label: "Expenses",   href: "/budget/claims",  icon: ExpensesIcon },
  { label: "Fleet",      href: "/fleet",          icon: FleetIcon },
  { label: "Season",     href: "/settings/season", icon: SettingsNavIcon },
];
// If one of an audience's tabs isn't available to someone, the next of these fills in
const MOBILE_TAB_FALLBACK = ["/tasks", "/calendar", "/competitions", "/tools", "/safety", "/dashboard"];

interface Props {
  session: Session | null;
  pendingMemberCount?: number;
  unreadNotificationCount?: number;
  activeSeasonName?: string | null;
  /** The testing copy of the app: a TEST tag beside the logo */
  testSite?: boolean;
}

export function TopNav({ session, pendingMemberCount = 0, unreadNotificationCount = 0, activeSeasonName, testSite = false }: Props) {
  const pathname = usePathname();
  const { resolvedTheme, toggle, mode } = useTheme();

  const roles             = session?.user?.roles ?? [];
  const canManageTeam     = roles.some((r) => ["HEAD_MENTOR", "TEAM_LEADERSHIP"].includes(r));
  const canManageDiscord  = roles.some((r) => ["HEAD_MENTOR", "TEAM_LEADERSHIP", "INTEGRATION_ADMIN"].includes(r)); // DISCORD_ADMIN_ROLES
  const canManageEmail    = roles.some((r) => ["HEAD_MENTOR", "INTEGRATION_ADMIN"].includes(r)); // EMAIL_ADMIN_ROLES
  const isSuperAdmin      = session?.user?.isSuperAdmin === true;
  // Volunteers: for adults and volunteer coordinators
  const showVolunteers    = isAdult(roles) || canCoordinate(roles);
  // View-only accounts (Parents): no Orders or Fleet, and no robot to pick
  const viewOnly          = isViewOnly(roles);
  const navShown          = (href: string) => (href !== "/volunteers" || showVolunteers) && !(viewOnly && hiddenForViewOnly(href));
  // Phone bottom bar: four tabs for this person, everything else under More
  const tabHrefs = [...new Set([...MOBILE_TABS_BY_AUDIENCE[audienceOf(roles)], ...MOBILE_TAB_FALLBACK])].filter(navShown).slice(0, 4);
  const MOBILE_TABS = tabHrefs.map((h) => MOBILE_ITEMS.find((i) => i.href === h)!);
  const MOBILE_MORE = MOBILE_ITEMS.filter((i) => navShown(i.href) && !tabHrefs.includes(i.href));
  const canBroadcast      = roles.includes("HEAD_MENTOR");
  const canManageTemplates = roles.some((r) => ["HEAD_MENTOR", "BUILD_LEAD"].includes(r));
  // Same people as the Audit log page (AUDIT_ROLES in lib/packing)
  const canSeeAudit       = roles.some((r) => ["HEAD_MENTOR", "TEAM_LEADERSHIP", "SAFETY_CAPTAIN"].includes(r));
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <>
      {/* ── Top navigation bar ── */}
      {/* CSS grid with 1fr | auto | 1fr ensures the center nav is always viewport-centered
          regardless of how wide the left logo or right controls are */}
      <header className="fixed inset-x-0 top-0 z-40 h-safe-nav safe-top-pad transition-colors pinned-layer"
        style={{
          // Fully opaque: a translucent/blurred header showed scrolling content as a
          // faded band at the top on iOS
          backgroundColor: "var(--color-surface)",
          borderBottom: "1px solid var(--color-border)",
        }}>
        <div className="h-full px-4 hidden lg:grid items-center" style={{ gridTemplateColumns: "1fr auto 1fr" }}>

          {/* Left: logo + season pill */}
          <div className="flex items-center gap-2">
            <Link href="/dashboard" className="flex items-center gap-2" aria-label="FRC Manager home">
              <div className="w-7 h-7 rounded bg-(--color-primary) flex items-center justify-center shrink-0">
                <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 text-white" stroke="currentColor" strokeWidth={2.5} aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
                </svg>
              </div>
              <span className="font-bold text-sm text-(--color-text-primary) hidden xl:inline">FRC Manager</span>
            </Link>
            {testSite && <TestTag />}
            {activeSeasonName && (
              <span className="hidden 2xl:inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-(--color-surface-overlay) text-(--color-text-secondary) border border-(--color-border) max-w-[140px] truncate">
                {activeSeasonName}
              </span>
            )}
          </div>

          {/* Center: module tabs — always perfectly centered */}
          <nav className="flex items-center" aria-label="Modules" data-tour="top-tabs">
            {MODULE_TABS.filter((t) => navShown(t.href)).map(({ label, href, exact, icon: Icon }) => {
              const active = exact ? pathname === href : (pathname.startsWith(href) && href !== "/dashboard");
              const isDashboard = href === "/dashboard" && pathname === "/dashboard";
              const isActive = isDashboard || (!exact && pathname.startsWith(href)) || (exact && pathname === href);
              return (
                <Link
                  key={href}
                  data-tour={`nav:${href}`}
                  href={href}
                  title={label}
                  className={cn(
                    "relative flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-all duration-150",
                    isActive
                      ? "text-(--color-text-primary) bg-(--color-surface-overlay)"
                      : "text-(--color-text-secondary) hover:text-(--color-text-primary) hover:bg-(--color-surface-overlay)/60"
                  )}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="hidden xl:inline">{label}</span>
                  {/* Active underline */}
                  {isActive && (
                    <span className="absolute bottom-0 inset-x-1.5 h-0.5 rounded-full"
                      style={{ backgroundColor: "var(--color-primary)" }} />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Right: controls */}
          <div className="flex items-center gap-0.5 justify-end">
          <button
            onClick={toggle}
            className="h-8 w-8 rounded-md flex items-center justify-center text-(--color-text-secondary) hover:bg-(--color-surface-overlay) transition-colors"
            aria-label={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            title={`Mode: ${mode}`}
          >
            {resolvedTheme === "dark" ? <SunIcon /> : <MoonIcon />}
          </button>

          <Link
            href="/calendar"
            className="h-8 w-8 rounded-md flex items-center justify-center text-(--color-text-secondary) hover:bg-(--color-surface-overlay) transition-colors"
            aria-label="Meeting calendar"
          >
            <CalendarIcon className="w-4 h-4" />
          </Link>

          {/* Notifications dropdown */}
          <NotificationsDropdown unreadCount={unreadNotificationCount} />

          {session?.user && <UserMenu user={session.user} canManageTeam={canManageTeam} canManageDiscord={canManageDiscord} canManageEmail={canManageEmail} canManageTemplates={canManageTemplates} isSuperAdmin={isSuperAdmin} canBroadcast={canBroadcast} canSeeAudit={canSeeAudit} pendingMemberCount={pendingMemberCount} />}
        </div>
        </div>

        {/* Mobile header (flex, shown below lg breakpoint) */}
        <div className="h-full px-4 flex lg:hidden items-center gap-3">
          <div className="flex items-center gap-2 shrink-0">
            <Link href="/dashboard" className="flex items-center gap-2" aria-label="FRC Manager home">
              <div className="w-7 h-7 rounded flex items-center justify-center shrink-0"
                style={{ backgroundColor: "var(--color-primary)" }}>
                <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 text-white" stroke="currentColor" strokeWidth={2.5} aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
                </svg>
              </div>
              <span className="font-bold text-sm text-(--color-text-primary) hidden sm:block">FRC Manager</span>
            </Link>
            {testSite && <TestTag />}
          </div>
          {/* min-w-0 + flex-1 let the robot picker shrink so the row never exceeds the screen */}
          <div className="flex min-w-0 flex-1 items-center justify-end gap-1">
            {/* Phones: theme lives in Profile & appearance, calendar in the bottom bar */}
            <button onClick={toggle} aria-label="Toggle light/dark mode" className="hidden sm:flex h-9 w-9 shrink-0 rounded-md items-center justify-center text-(--color-text-secondary) hover:bg-(--color-surface-overlay) transition-colors">
              {resolvedTheme === "dark" ? <SunIcon /> : <MoonIcon />}
            </button>
            <Link
              href="/calendar"
              className="hidden sm:flex h-9 w-9 shrink-0 rounded-md items-center justify-center text-(--color-text-secondary) hover:bg-(--color-surface-overlay) transition-colors"
              aria-label="Meeting calendar"
            >
              <CalendarIcon className="w-4 h-4" />
            </Link>
            <NotificationsDropdown unreadCount={unreadNotificationCount} />
            {session?.user && <UserMenu user={session.user} canManageTeam={canManageTeam} canManageDiscord={canManageDiscord} canManageEmail={canManageEmail} canManageTemplates={canManageTemplates} isSuperAdmin={isSuperAdmin} canBroadcast={canBroadcast} canSeeAudit={canSeeAudit} />}
          </div>
        </div>
      </header>

      {/* ── Mobile bottom tab bar (hidden on lg+) ── */}
      <>
        {/* More popup backdrop */}
        {moreOpen && (
          <div
            className="fixed inset-0 z-40 lg:hidden bg-black/40"
            onClick={() => setMoreOpen(false)}
            aria-hidden
          />
        )}

        {/* More popup sheet */}
        {moreOpen && (
          <div
            className="fixed bottom-14 inset-x-0 z-50 lg:hidden rounded-t-2xl safe-bottom pinned-bottom"
            style={{
              backgroundColor: "var(--color-surface)",
              boxShadow: "0 -8px 32px -4px rgb(0 0 0 / .25)",
              borderTop: "1px solid color-mix(in srgb, var(--color-border) 60%, transparent)",
            }}
          >
            <div className="px-4 pt-4 pb-2">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-(--color-text-primary)">More</p>
                <button
                  onClick={() => setMoreOpen(false)}
                  className="h-7 w-7 rounded-full flex items-center justify-center text-(--color-text-secondary) hover:bg-(--color-surface-overlay) transition-colors text-base leading-none"
                >×</button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {MOBILE_MORE.map(({ label, href, icon: Icon }) => {
                  // The most specific item wins (Expenses, not Budget, on /budget/claims)
                  const active = href === "/dashboard" ? pathname === href
                    : pathname.startsWith(href) && !MOBILE_ITEMS.some((o) => o.href.length > href.length && o.href.startsWith(href) && pathname.startsWith(o.href));
                  return (
                    <Link
                      key={href}
                      data-tour={`nav:${href}`}
                      href={href}
                      onClick={() => setMoreOpen(false)}
                      className={cn(
                        "flex flex-col items-center gap-1.5 rounded-xl py-3 px-2 transition-colors",
                        active
                          ? "bg-(--color-primary)/10 text-(--color-primary)"
                          : "text-(--color-text-secondary) hover:bg-(--color-surface-overlay) hover:text-(--color-text-primary)"
                      )}
                    >
                      <Icon className="w-6 h-6" />
                      <span className="text-[11px] font-medium">{label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <nav
          className="fixed bottom-0 inset-x-0 z-50 lg:hidden safe-bottom pinned-bottom"
          style={{
            // Opaque, no blur — like the header. On iOS a blurred (backdrop-filter) fixed bar
            // gets drawn mid-screen during momentum scrolling.
            backgroundColor: "var(--color-surface)",
            borderTop: "1px solid color-mix(in srgb, var(--color-border) 80%, transparent)",
            boxShadow: "0 -4px 12px -4px rgb(0 0 0 / .06)",
          }}
          aria-label="Mobile navigation"
          data-tour="bottom-bar"
        >
          <div className="flex items-stretch h-14">
            {MOBILE_TABS.map(({ label, href, icon: Icon }) => {
              // The most specific item wins (Expenses under More, not the Budget tab, on /budget/claims)
              const active = href === "/dashboard" ? pathname === href
                : pathname.startsWith(href) && !MOBILE_ITEMS.some((o) => o.href.length > href.length && o.href.startsWith(href) && pathname.startsWith(o.href));
              return (
                <Link
                  key={href}
                  data-tour={`nav:${href}`}
                  href={href}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    "flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors py-2",
                    active ? "text-(--color-primary)" : "text-(--color-text-secondary)"
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon className={cn("w-5 h-5", active && "text-(--color-primary)")} />
                  {label}
                </Link>
              );
            })}

            {/* More button */}
            <button
              data-tour="more"
              onClick={() => setMoreOpen((o) => !o)}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors py-2",
                moreOpen ? "text-(--color-primary)" : "text-(--color-text-secondary)"
              )}
              aria-expanded={moreOpen}
            >
              <MoreIcon className={cn("w-5 h-5", moreOpen && "text-(--color-primary)")} />
              More
            </button>
          </div>
        </nav>
      </>

    </>
  );
}

function UserMenu({ user, canManageTeam, canManageDiscord, canManageEmail = false, canManageTemplates, isSuperAdmin = false, canBroadcast = false, canSeeAudit = false, pendingMemberCount = 0 }: {
  canManageEmail?:    boolean;
  canSeeAudit?:       boolean;
  user: { name?: string | null; email?: string | null };
  canManageTeam:      boolean;
  canManageDiscord:   boolean;
  isSuperAdmin?:      boolean;
  canBroadcast?:      boolean;
  canManageTemplates: boolean;
  pendingMemberCount?: number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative h-8 w-8 rounded-md flex items-center justify-center text-white text-xs font-bold shrink-0 transition-opacity hover:opacity-90"
        style={{ backgroundColor: "var(--color-primary)" }}
        aria-label={`User menu${pendingMemberCount > 0 ? ` (${pendingMemberCount} pending approvals)` : ""}`}
        aria-expanded={open}
        aria-haspopup="menu"
        data-tour="profile"
      >
        {user.name?.[0]?.toUpperCase() ?? "U"}
        {pendingMemberCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-(--color-warning) text-white text-[10px] font-bold flex items-center justify-center" aria-hidden>
            {pendingMemberCount > 9 ? "9+" : pendingMemberCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 w-56 rounded-lg border border-(--color-border) py-1 z-50"
          style={{
            backgroundColor: "var(--color-surface)",
            boxShadow: "0 8px 32px -4px rgba(0,0,0,0.18), 0 0 0 1px var(--color-border)",
          }}
          role="menu"
        >
          <div className="px-3 py-2.5 border-b border-(--color-border)">
            <p className="text-sm font-semibold text-(--color-text-primary) truncate">{user.name}</p>
            <p className="text-xs text-(--color-text-secondary) truncate mt-0.5">{user.email}</p>
          </div>
          <Link href="/settings/profile" role="menuitem" onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-(--color-text-primary) hover:bg-(--color-surface-overlay) transition-colors">
            <svg className="w-4 h-4 text-(--color-text-secondary)" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
            Profile &amp; appearance
          </Link>
          <Link href="/settings/notifications" role="menuitem" onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-(--color-text-primary) hover:bg-(--color-surface-overlay) transition-colors">
            <svg className="w-4 h-4 text-(--color-text-secondary)" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
            </svg>
            Notification settings
          </Link>
          <Link href="/help" role="menuitem" onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-(--color-text-primary) hover:bg-(--color-surface-overlay) transition-colors">
            <svg className="w-4 h-4 text-(--color-text-secondary)" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
            </svg>
            Help &amp; guide
          </Link>
          <button type="button" onClick={() => { setOpen(false); startTour(); }}
            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-(--color-text-primary) hover:bg-(--color-surface-overlay) transition-colors">
            <Compass className="w-4 h-4 text-(--color-text-secondary)" aria-hidden strokeWidth={1.75} />
            Take the tour
          </button>
          <FeedbackLink onOpen={() => setOpen(false)}
            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-(--color-text-primary) hover:bg-(--color-surface-overlay) transition-colors">
            <svg className="w-4 h-4 text-(--color-text-secondary)" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
            </svg>
            Give feedback
          </FeedbackLink>
          {canManageTeam && (
            <Link href="/settings/members" role="menuitem" onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-(--color-text-primary) hover:bg-(--color-surface-overlay) transition-colors">
              <UserCircleIcon className="w-4 h-4 text-(--color-text-secondary)" />
              Team members
            </Link>
          )}
          {canSeeAudit && (
            <Link href="/audit" role="menuitem" onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-(--color-text-primary) hover:bg-(--color-surface-overlay) transition-colors">
              <svg className="w-4 h-4 text-(--color-text-secondary)" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v16.5c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9zm3.75 11.625a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
              Audit log
            </Link>
          )}
          {/* Head Mentors: a message to students, parents and/or mentors */}
          {canBroadcast && (
            <Link href="/broadcast" role="menuitem" onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-(--color-text-primary) hover:bg-(--color-surface-overlay) transition-colors">
              <Megaphone className="w-4 h-4 text-(--color-text-secondary)" aria-hidden strokeWidth={1.75} />
              Broadcast message
            </Link>
          )}
          {canManageTemplates && (
            <Link href="/tasks/templates" role="menuitem" onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-(--color-text-primary) hover:bg-(--color-surface-overlay) transition-colors">
              <svg className="w-4 h-4 text-(--color-text-secondary)" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
              </svg>
              Templates
            </Link>
          )}
          {/* Head Mentor + Team Leadership (view); editing is Head Mentor only */}
          {canManageTeam && (
            <Link href="/settings/workflows" role="menuitem" onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-(--color-text-primary) hover:bg-(--color-surface-overlay) transition-colors">
              <svg className="w-4 h-4 text-(--color-text-secondary)" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6h4.5v4.5h-4.5V6zm12 0h4.5v4.5h-4.5V6zm-6 7.5h4.5V18h-4.5v-4.5zM8.25 8.25h7.5M6 10.5v3.75h3.75M18 10.5v3.75h-3.75" />
              </svg>
              Purchase workflow
            </Link>
          )}
          {(canManageDiscord || canManageEmail) && (
            <Link href="/settings/integrations" role="menuitem" onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-(--color-text-primary) hover:bg-(--color-surface-overlay) transition-colors">
              <svg className="w-4 h-4 text-(--color-text-secondary)" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
              </svg>
              Integrations
            </Link>
          )}
          {/* Platform admin — not a team role */}
          {isSuperAdmin && (
            <Link href="/settings/admin" role="menuitem" onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-(--color-text-primary) hover:bg-(--color-surface-overlay) transition-colors">
              <svg className="w-4 h-4 text-(--color-text-secondary)" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
              Team approvals
            </Link>
          )}
          <div className="border-t border-(--color-border) mt-1 pt-1">
            <button
              role="menuitem"
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-(--color-danger) hover:bg-(--color-surface-overlay) transition-colors"
            >
              <SignOutIcon className="w-4 h-4" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── SVG icon components ──────────────────────────────────────────
function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={cn("w-4 h-4", className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
    </svg>
  );
}

function SettingsNavIcon({ className }: { className?: string }) {
  return (
    <svg className={cn("w-4 h-4", className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function FleetIcon({ className }: { className?: string }) {
  return (
    <svg className={cn("w-4 h-4", className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
    </svg>
  );
}

function ToolsIcon({ className }: { className?: string }) {
  return (
    <svg className={cn("w-4 h-4", className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
    </svg>
  );
}

function InventoryIcon({ className }: { className?: string }) {
  return (
    <svg className={cn("w-4 h-4", className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
    </svg>
  );
}

function ProcurementIcon({ className }: { className?: string }) {
  return (
    <svg className={cn("w-4 h-4", className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
    </svg>
  );
}

function ExpensesIcon({ className }: { className?: string }) {
  return (
    <svg className={cn("w-4 h-4", className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 14.25l6-6m4.5-3.493V21.75l-3.75-1.5-3.75 1.5-3.75-1.5-3.75 1.5V4.757c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0c1.1.128 1.907 1.077 1.907 2.185zM9.75 9h.008v.008H9.75V9zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 4.5h.008v.008h-.008V13.5zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
    </svg>
  );
}

function TrophyIcon({ className }: { className?: string }) {
  return (
    <svg className={cn("w-4 h-4", className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" />
    </svg>
  );
}

function BudgetIcon({ className }: { className?: string }) {
  return (
    <svg className={cn("w-4 h-4", className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function TasksIcon({ className }: { className?: string }) {
  return (
    <svg className={cn("w-4 h-4", className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  );
}

function SafetyIcon({ className }: { className?: string }) {
  return (
    <svg className={cn("w-4 h-4", className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  );
}

function MoreIcon({ className }: { className?: string }) {
  return (
    <svg className={cn("w-4 h-4", className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
    </svg>
  );
}

function UserCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={cn("w-4 h-4", className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

/** "TEST" beside the logo on the testing copy of the app */
function TestTag() {
  return (
    <span title="This is the testing copy of FRC Manager — changes here don't affect the real app"
      className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider leading-none"
      style={{ backgroundColor: "#f59e0b", color: "#111" }}>
      Test
    </span>
  );
}

function VolunteersIcon({ className }: { className?: string }) {
  return (
    <svg className={cn("w-4 h-4", className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={cn("w-4 h-4", className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
  );
}

function SignOutIcon({ className }: { className?: string }) {
  return (
    <svg className={cn("w-4 h-4", className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
    </svg>
  );
}

