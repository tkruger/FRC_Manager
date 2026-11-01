import { auth } from "@/lib/auth";
import { hiddenForViewOnly, isViewOnly } from "@/lib/access/read-only";
import { prisma } from "@/lib/prisma";
import { nextUp } from "@/lib/competition";
import { FALLBACK_TIMEZONE, isValidTimezone, localParts } from "@/lib/notify/time";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import { TiltCard } from "@/components/ui/TiltCard";
import { seasonBudgetChart } from "@/lib/budget-summary";
import { BudgetTile } from "@/components/budget/BudgetTile";
import { tbaConfigured } from "@/lib/frc/tba";
import { eventWindow, loadEventLive } from "@/lib/frc/event-live";
import { BumperChip, matchTime } from "@/components/competitions/parts";
import { canCoordinate, coverage, DEFAULT_MIN_ADULTS, isAdult, isCleared, shiftWhen } from "@/lib/volunteers";

const MODULES = [
  { title: "Volunteers",    href: "/volunteers",      desc: "Sign up to help at meetings", color: "#DB2777",          icon: "🙋" },
  { title: "Calendar",      href: "/calendar",        desc: "Meeting schedule",        color: "#7C3AED",              icon: "📅" },
  { title: "Competitions",  href: "/competitions",    desc: "Schedules, results & where to watch", color: "#2563EB", icon: "🏆" },
  { title: "Season",        href: "/settings/season", desc: "Dates, competitions & robots", color: "#64748B",         icon: "⚙️" },
  { title: "Tasks",         href: "/tasks",           desc: "Kanban & build schedule", color: "#DC2626",              icon: "✅" },
  { title: "Tools",         href: "/tools",           desc: "Checkout & maintenance",  color: "#7C3AED",              icon: "🔧" },
  { title: "Inventory",     href: "/inventory",       desc: "Parts & materials",       color: "var(--color-secondary)", icon: "📦" },
  { title: "Procurement",   href: "/procurement",     desc: "Orders & purchasing",     color: "#059669",              icon: "🛒" },
  { title: "Budget",        href: "/budget",          desc: "Spend & BOM tracking",    color: "#D97706",              icon: "💰" },
  { title: "Fleet",         href: "/fleet",           desc: "Manage your robots",      color: "var(--color-primary)", icon: "🤖" },
  { title: "Safety",        href: "/safety",          desc: "Certs & checklists",      color: "#0891B2",              icon: "🛡️" },
];

// What each audience reaches for first
const moduleOrder = {
  parent:  ["/volunteers", "/calendar", "/competitions", "/settings/season", "/budget", "/tasks", "/tools", "/safety", "/inventory"],
  student: ["/tasks", "/calendar", "/competitions", "/tools", "/inventory", "/safety", "/procurement", "/fleet", "/budget", "/settings/season"],
  mentor:  ["/tasks", "/procurement", "/budget", "/calendar", "/competitions", "/volunteers", "/inventory", "/tools", "/safety", "/fleet", "/settings/season"],
};

export default async function DashboardPage() {
  const session = await auth();
  const viewOnly = isViewOnly(session?.user?.roles);

  const activeSeason = session?.user?.teamId
    ? await prisma.season.findFirst({
        where: { teamId: session.user.teamId, isActive: true },
        include: {
          robots:          { where: { archived: false }, select: { id: true, displayName: true, role: true } },
          competitionEvents: { select: { id: true, name: true, stage: true, stageNumber: true, startDate: true, endDate: true, tbaEventKey: true } },
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
  // Counts down to what's next: the next season's start, kickoff, Week 0, each
  // competition, then the season's end — in the team's time zone
  const [team, upcomingSeasons] = session?.user?.teamId
    ? await Promise.all([
        prisma.team.findUnique({ where: { id: session.user.teamId }, select: { timezone: true, teamNumber: true } }),
        prisma.season.findMany({ where: { teamId: session.user.teamId, isActive: false, startDate: { gt: now } }, select: { name: true, startDate: true } }),
      ])
    : [null, []];
  const todayKey = localParts(now, isValidTimezone(team?.timezone) ? team!.timezone! : FALLBACK_TIMEZONE).dateKey;
  const next = nextUp(todayKey, activeSeason && { ...activeSeason, competitions: activeSeason.competitionEvents }, upcomingSeasons);
  const nextDate = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

  // A competition on now, or in the next week: its tile, with our next match and bumper color when live
  const soon = new Date(`${todayKey}T00:00:00Z`).getTime() + 7 * 86_400_000;
  const eventNow = activeSeason?.competitionEvents
    .filter((c) => eventWindow(todayKey, c.startDate, c.endDate) !== "after" && c.startDate.getTime() <= soon)
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())[0] ?? null;
  const eventIsLive = !!eventNow && eventWindow(todayKey, eventNow.startDate, eventNow.endDate) === "live";
  const eventLive = eventNow?.tbaEventKey && eventIsLive && team && tbaConfigured() ? await loadEventLive(team.teamNumber, eventNow.tbaEventKey) : null;
  const eventTz = isValidTimezone(eventLive?.event?.timezone) ? eventLive!.event!.timezone! : isValidTimezone(team?.timezone) ? team!.timezone! : FALLBACK_TIMEZONE;
  const rank = eventLive?.status?.qual?.ranking;

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

  // Budget at a glance: goal, raised, spent (null until a budget is set up)
  const budget = activeSeason ? await seasonBudgetChart(activeSeason.id) : null;

  // Who's looking: the tiles are ordered for parents, students and mentors
  const roles = session?.user?.roles ?? [];
  const audience: "parent" | "student" | "mentor" =
    roles.some((r) => r === "MENTOR" || r === "HEAD_MENTOR") ? "mentor"
    : viewOnly || roles.includes("VOLUNTEER_COORDINATOR") ? "parent"
    : "student";
  const showVolunteers = isAdult(roles) || canCoordinate(roles);

  // Volunteers: your next shift, else how many meetings in the next two weeks still need adults
  const volunteer = showVolunteers && activeSeason && session?.user?.id
    ? await (async () => {
        const from = new Date(`${todayKey}T00:00:00Z`);
        const to = new Date(from.getTime() + 14 * 86_400_000);
        const [me, settings, meetings] = await Promise.all([
          prisma.user.findUnique({
            where: { id: session.user.id },
            select: {
              volunteerClearedAt: true, volunteerClearedUntil: true,
              volunteerShifts: {
                where: { status: "CONFIRMED", meeting: { cancelled: false, date: { gte: from } } },
                orderBy: { meeting: { date: "asc" } }, take: 1,
                select: { meeting: { select: { date: true, startTime: true, endTime: true } } },
              },
            },
          }),
          prisma.volunteerSettings.findUnique({ where: { teamId: session.user.teamId! }, select: { minAdults: true } }),
          prisma.meeting.findMany({
            where: { seasonId: activeSeason.id, cancelled: false, date: { gte: from, lt: to } },
            select: { volunteers: { select: { status: true } } },
          }),
        ]);
        const min = settings?.minAdults ?? DEFAULT_MIN_ADULTS;
        return {
          cleared: !!me && isCleared(me),
          next: me?.volunteerShifts[0]?.meeting ?? null,
          short: meetings.filter((m) => !coverage(m.volunteers, min).covered).length,
        };
      })()
    : null;

  // Pending purchase requests count
  const pendingOrdersCount = activeSeason
    ? await prisma.purchaseRequest.count({
        where: { seasonId: activeSeason.id, status: "SUBMITTED" },
      })
    : 0;

  const stat = (t: { label: string; value: React.ReactNode; sub: string; urgent: boolean; href: string; accent: string }) => (
    <Link key={t.label} href={t.href} className="card group no-underline block"
      style={{ borderLeftWidth: "3px", borderLeftColor: t.accent }}>
      <p className="text-small text-(--color-text-secondary) group-hover:text-(--color-text-primary) transition-colors">{t.label}</p>
      <p className={`text-h2 mt-1 ${t.urgent ? "text-(--color-warning)" : "text-(--color-text-primary)"}`}>{t.value}</p>
      <p className="text-small text-(--color-text-secondary) mt-0.5 truncate">{t.sub}</p>
    </Link>
  );
  const stats: Record<string, React.ReactNode> = activeSeason ? {
    // Budget is everyone's: where the money stands (it takes the Robots tile's place)
    budget: budget ? (
      <BudgetTile key="budget" goal={budget.goal} raised={budget.raised} pledged={budget.pledged} spent={budget.spent}
        kickoffDate={activeSeason.startDate.toISOString()} endDate={activeSeason.endDate.toISOString()}
        expenses={budget.expenses} raises={budget.raises} pledges={budget.pledges} />
    ) : stat({
      label: "Robots", value: activeSeason.robots.length,
      sub: activeSeason.robots.map((r) => r.displayName).join(", ") || "None yet",
      urgent: false, href: "/fleet", accent: "var(--color-primary)",
    }),
    next: stat({
      label: next ? `${next.label}${next.estimated ? " (est.)" : ""}` : "Season",
      value: !next ? "Ended" : next.now ? "Now" : next.days === 0 ? "Today" : next.days === 1 ? "Tomorrow" : `${next.days}d away`,
      sub: next ? `${next.name} · ${nextDate(next.date)}` : formatDate(activeSeason.endDate),
      urgent: !!next && next.label !== "Season ends" && next.days <= 14,
      href: next?.label === "Season starts" ? "/settings/season" : next?.label === "Competition" || next?.label === "Next competition" ? "/competitions" : "/tasks",
      accent: "#059669",
    }),
    overdue: stat({
      label: "Overdue tasks", value: overdueCount,
      sub: overdueCount > 0 ? "Need attention" : "All on track",
      urgent: overdueCount > 0, href: "/tasks",
      accent: overdueCount > 0 ? "var(--color-danger)" : "var(--color-secondary)",
    }),
    orders: viewOnly ? null : stat({
      label: "Pending orders", value: pendingOrdersCount,
      sub: pendingOrdersCount > 0 ? "Awaiting approval" : "None pending",
      urgent: pendingOrdersCount > 0, href: "/procurement", accent: "#D97706",
    }),
    volunteers: volunteer && stat(volunteer.next ? {
      label: "Your next shift", value: nextDate(volunteer.next.date),
      sub: shiftWhen(volunteer.next), urgent: false, href: "/volunteers", accent: "#DB2777",
    } : {
      label: "Meetings needing adults", value: volunteer.short,
      sub: volunteer.short === 0 ? "All covered for 2 weeks" : volunteer.cleared ? "Sign up to help" : "Get cleared to sign up",
      urgent: volunteer.short > 0, href: "/volunteers", accent: "#DB2777",
    }),
  } : {};
  const statOrder = {
    parent:  ["volunteers", "next", "budget", "overdue"],
    student: ["next", "overdue", "budget", "orders"],
    mentor:  ["next", "overdue", "orders", "budget", "volunteers"],
  };

  return (
    <div className="space-y-0">
      {/* ── Hero gradient header ── */}
      <div className="hero-gradient border-b border-(--color-border)">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <p className="text-label font-semibold text-(--color-text-secondary) uppercase tracking-widest mb-2">
            {activeSeason ? activeSeason.name : "FRC Team Management Suite"}
          </p>
          <h1 className="text-display text-(--color-text-primary)" style={{ letterSpacing: "-0.02em" }}>
            Welcome back,{" "}
            <span className="text-gradient">{session?.user?.name?.split(" ")[0]}</span>
          </h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

      {/* Season banner — only shown when no active season */}
      {!activeSeason && (
        <div className="card border-l-4 border-l-(--color-warning)">
          <p className="text-sm font-medium text-(--color-text-primary)">No active season configured</p>
          <p className="text-small text-(--color-text-secondary) mt-1">
            A Head Mentor can set up the current season, start and end dates in{" "}
            <Link href="/settings/season" className="text-(--color-secondary) hover:underline">
              Season Settings
            </Link>.
          </p>
        </div>
      )}

      {eventNow && (
        <Link href={`/competitions/${eventNow.id}`} className="card no-underline flex flex-wrap items-center justify-between gap-4 border-l-4"
          style={{ borderLeftColor: eventLive?.next ? (eventLive.next.color === "red" ? "#DC2626" : "#2563EB") : "var(--color-primary)" }}>
          <div className="min-w-0">
            <p className="text-small text-(--color-text-secondary)">
              {eventIsLive ? <span className="mr-2 rounded-full bg-(--color-danger) px-2 py-0.5 text-xs font-bold uppercase text-white">Live</span> : "Coming up · "}
              {eventNow.name}
            </p>
            {eventLive?.next ? (
              <p className="mt-1 flex flex-wrap items-center gap-2 text-h3 text-(--color-text-primary)">
                Next: {eventLive.next.label} <BumperChip color={eventLive.next.color} size="sm" />
                {eventLive.next.when && <span className="text-sm font-normal text-(--color-text-secondary)">about {matchTime(eventLive.next.when, eventTz)}</span>}
              </p>
            ) : (
              <p className="mt-1 text-h3 text-(--color-text-primary)">
                {eventIsLive ? "Follow along — schedule, results and livestream" : `Starts ${nextDate(eventNow.startDate)} — see how to follow along`}
              </p>
            )}
            {rank?.rank != null && <p className="text-small text-(--color-text-secondary)">Rank {rank.rank}{rank.record ? ` · ${rank.record.wins}–${rank.record.losses}–${rank.record.ties}` : ""}</p>}
          </div>
          <span className="text-sm font-medium text-(--color-secondary)">Event page →</span>
        </Link>
      )}

      {/* Season summary — the tiles that matter most to whoever's looking come first */}
      {activeSeason && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {statOrder[audience].map((id) => stats[id]).filter(Boolean)}
        </div>
      )}

      {/* Module grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {moduleOrder[audience].map((href) => MODULES.find((m) => m.href === href)!)
          .filter((mod) => (!viewOnly || !hiddenForViewOnly(mod.href)) && (mod.href !== "/volunteers" || showVolunteers))
          .map((mod) => (
          <Link key={mod.href} href={mod.href} className="block no-underline">
            <TiltCard
              className="flex flex-col gap-3 h-full cursor-pointer"
              style={{ borderLeftColor: mod.color, borderLeftWidth: "4px" }}
            >
              <span className="text-2xl leading-none">{mod.icon}</span>
              <div>
                <p className="text-h3 text-(--color-text-primary) group-hover:text-(--color-primary) transition-colors">
                  {mod.title}
                </p>
                <p className="text-small text-(--color-text-secondary) mt-0.5">{mod.desc}</p>
              </div>
            </TiltCard>
          </Link>
        ))}
      </div>
    </div>
    </div>
  );
}

