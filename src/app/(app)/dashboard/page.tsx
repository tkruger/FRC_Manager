import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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
  const daysToWeek0 = activeSeason
    ? differenceInCalendarDays(activeSeason.week0Date, now)
    : null;

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
            A Head Mentor can set up the current season, kickoff date, and Week 0 deadline in{" "}
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
              label: "Week 0",
              value: daysToWeek0 !== null && daysToWeek0 >= 0
                ? `${daysToWeek0}d away`
                : daysToWeek0 !== null
                ? "Past"
                : "—",
              sub: formatDate(activeSeason.week0Date),
              urgent: daysToWeek0 !== null && daysToWeek0 <= 14,
            },
            {
              label: "Robots",
              value: activeSeason.robots.length,
              sub: activeSeason.robots.map((r) => r.displayName).join(", ") || "None yet",
              urgent: false,
            },
            {
              label: "Overdue tasks",
              value: overdueCount,
              sub: overdueCount > 0 ? "Need attention" : "All on track",
              urgent: overdueCount > 0,
            },
            {
              label: "Pending orders",
              value: pendingOrdersCount,
              sub: pendingOrdersCount > 0 ? "Awaiting approval" : "None pending",
              urgent: pendingOrdersCount > 0,
            },
          ].map((s) => (
            <div key={s.label} className="card">
              <p className="text-small text-[--color-text-secondary]">{s.label}</p>
              <p className={`text-h2 mt-1 ${s.urgent ? "text-[--color-warning]" : "text-[--color-text-primary]"}`}>
                {s.value}
              </p>
              <p className="text-small text-[--color-text-secondary] mt-0.5 truncate">{s.sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* Module grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {[
          { title: "Robot Fleet",   href: "/fleet",           desc: "Manage your robots",     color: "var(--color-primary)",   icon: "🤖" },
          { title: "Tools",         href: "/tools",           desc: "Checkout & maintenance", color: "#7C3AED",               icon: "🔧" },
          { title: "Inventory",     href: "/inventory",       desc: "Parts & materials",      color: "var(--color-secondary)", icon: "📦" },
          { title: "Procurement",   href: "/procurement",     desc: "Orders & requests",      color: "#059669",               icon: "🛒" },
          { title: "Budget",        href: "/budget",          desc: "Spend & BOM tracking",   color: "#D97706",               icon: "💰" },
          { title: "Schedule",      href: "/schedule",        desc: "Build season tasks",     color: "#DC2626",               icon: "📅" },
          { title: "Safety",        href: "/safety",          desc: "Certs & checklists",     color: "#0891B2",               icon: "🛡️" },
          { title: "Season",        href: "/settings/season", desc: "Season configuration",  color: "#64748B",               icon: "⚙️" },
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
