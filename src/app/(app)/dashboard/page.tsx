import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { competitionCountdown } from "@/lib/competition";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import { differenceInCalendarDays } from "date-fns";
import { TiltCard } from "@/components/ui/TiltCard";

export default async function DashboardPage() {
  const session = await auth();

  const activeSeason = session?.user?.teamId
    ? await prisma.season.findFirst({
        where: { teamId: session.user.teamId, isActive: true },
        include: {
          robots:          { where: { archived: false }, select: { id: true, displayName: true, role: true } },
          competitionEvents: { select: { name: true, stage: true, stageNumber: true, startDate: true, endDate: true } },
          _count: {
            select: {
              tasks:           true,
              purchaseRequests: true,
            },
          },
        },
      })
    : null;

  const now = new Date();
  const daysToEnd = activeSeason
    ? differenceInCalendarDays(activeSeason.endDate, now)
    : null;
  // Counts down to the next competition; once they're all done, to the season end
  const nextComp = activeSeason ? competitionCountdown(activeSeason.competitionEvents, now) : null;

  // Overdue tasks count
  const overdueCount = activeSeason
    ? await prisma.task.count({
        where: {
          seasonId: activeSeason.id,
          dueDate:  { lt: now },
          status:   { notIn: ["COMPLETE"] },
        },
      })
    : 0;

  // Pending purchase requests count
  const pendingOrdersCount = activeSeason
    ? await prisma.purchaseRequest.count({
        where: { seasonId: activeSeason.id, status: "SUBMITTED" },
      })
    : 0;

  return (
    <div className="space-y-0">
      {/* ── Hero gradient header ── */}
      <div className="hero-gradient border-b border-[--color-border]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <p className="text-label font-semibold text-[--color-text-secondary] uppercase tracking-widest mb-2">
            {activeSeason ? activeSeason.name : "FRC Team Management Suite"}
          </p>
          <h1 className="text-display text-[--color-text-primary]" style={{ letterSpacing: "-0.02em" }}>
            Welcome back,{" "}
            <span className="text-gradient">{session?.user?.name?.split(" ")[0]}</span>
          </h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

      {/* Season banner — only shown when no active season */}
      {!activeSeason && (
        <div className="card border-l-4 border-l-[--color-warning]">
          <p className="text-sm font-medium text-[--color-text-primary]">No active season configured</p>
          <p className="text-small text-[--color-text-secondary] mt-1">
            A Head Mentor can set up the current season, start and end dates in{" "}
            <Link href="/settings/season" className="text-[--color-secondary] hover:underline">
              Season Settings
            </Link>.
          </p>
        </div>
      )}

      {/* Season summary — shown when active season exists */}
      {activeSeason && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            {
              label: nextComp ? "Next competition" : "Season ends",
              value: nextComp
                ? (nextComp.days <= 0 ? "Now" : `${nextComp.days}d away`)
                : daysToEnd !== null && daysToEnd >= 0 ? `${daysToEnd}d away` : "Ended",
              sub: nextComp ? nextComp.name : formatDate(activeSeason.endDate),
              urgent: nextComp ? nextComp.days <= 14 : false,
              href: "/tasks",
              accent: "#059669",
            },
            {
              label: "Robots",
              value: activeSeason.robots.length,
              sub: activeSeason.robots.map((r) => r.displayName).join(", ") || "None yet",
              urgent: false,
              href: "/fleet",
              accent: "var(--color-primary)",
            },
            {
              label: "Overdue tasks",
              value: overdueCount,
              sub: overdueCount > 0 ? "Need attention" : "All on track",
              urgent: overdueCount > 0,
              href: "/tasks",
              accent: overdueCount > 0 ? "var(--color-danger)" : "var(--color-secondary)",
            },
            {
              label: "Pending orders",
              value: pendingOrdersCount,
              sub: pendingOrdersCount > 0 ? "Awaiting approval" : "None pending",
              urgent: pendingOrdersCount > 0,
              href: "/procurement",
              accent: "#D97706",
            },
          ].map((s) => (
            <Link key={s.label} href={s.href} className="card group no-underline block"
              style={{ borderLeftWidth: "3px", borderLeftColor: s.accent }}>
              <p className="text-small text-[--color-text-secondary] group-hover:text-[--color-text-primary] transition-colors">{s.label}</p>
              <p className={`text-h2 mt-1 ${s.urgent ? "text-[--color-warning]" : "text-[--color-text-primary]"}`}>
                {s.value}
              </p>
              <p className="text-small text-[--color-text-secondary] mt-0.5 truncate">{s.sub}</p>
            </Link>
          ))}
        </div>
      )}

      {/* Module grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {[
          { title: "Tasks",         href: "/tasks",           desc: "Kanban & build schedule", color: "#DC2626",              icon: "✅" },
          { title: "Tools",         href: "/tools",           desc: "Checkout & maintenance",  color: "#7C3AED",              icon: "🔧" },
          { title: "Inventory",     href: "/inventory",       desc: "Parts & materials",       color: "var(--color-secondary)", icon: "📦" },
          { title: "Procurement",   href: "/procurement",     desc: "Orders & purchasing",       color: "#059669",              icon: "🛒" },
          { title: "Budget",        href: "/budget",          desc: "Spend & BOM tracking",    color: "#D97706",              icon: "💰" },
          { title: "Fleet",         href: "/fleet",           desc: "Manage your robots",      color: "var(--color-primary)", icon: "🤖" },
          { title: "Safety",        href: "/safety",          desc: "Certs & checklists",      color: "#0891B2",              icon: "🛡️" },
          { title: "Season",        href: "/settings/season", desc: "Season configuration",   color: "#64748B",              icon: "⚙️" },
          { title: "Calendar",      href: "/calendar",        desc: "Meeting schedule",        color: "#7C3AED",              icon: "📅" },
        ].map((mod) => (
          <Link key={mod.href} href={mod.href} className="block no-underline">
            <TiltCard
              className="flex flex-col gap-3 h-full cursor-pointer"
              style={{ borderLeftColor: mod.color, borderLeftWidth: "4px" }}
            >
              <span className="text-2xl leading-none">{mod.icon}</span>
              <div>
                <p className="text-h3 text-[--color-text-primary] group-hover:text-[--color-primary] transition-colors">
                  {mod.title}
                </p>
                <p className="text-small text-[--color-text-secondary] mt-0.5">{mod.desc}</p>
              </div>
            </TiltCard>
          </Link>
        ))}
      </div>
    </div>
    </div>
  );
}

