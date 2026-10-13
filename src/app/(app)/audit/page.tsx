import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/PageHeader";
import { PrintButton } from "@/components/PrintButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { canSeeAudit } from "@/lib/packing";
import { localParts, zonedTimeToUtc, calendarDayKey, FALLBACK_TIMEZONE, isValidTimezone } from "@/lib/notify/time";

// Audit log for mentors and leadership: every tool check-out and check-in, and every
// safety report, in a date range — printable.

const SEVERITY: Record<string, { label: string; variant: "danger" | "warning" | "info" }> = {
  SIGNIFICANT_INJURY: { label: "Significant injury", variant: "danger" },
  MINOR_INJURY:       { label: "Minor injury",       variant: "warning" },
  NEAR_MISS:          { label: "Near miss",          variant: "info" },
};
const CONDITION: Record<string, string> = {
  EXCELLENT: "excellent", GOOD: "good", FAIR: "fair", NEEDS_REPAIR: "needs repair",
  OUT_OF_SERVICE: "out of service", OUT_FOR_MAINTENANCE: "out for maintenance",
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;

function addDays(key: string, n: number) {
  return new Date(Date.parse(key) + n * 86_400_000).toISOString().slice(0, 10);
}
function dayText(key: string) {
  return new Date(`${key}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

type Show = "all" | "tools" | "safety";

export default async function AuditLogPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; show?: string }> }) {
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user?.teamId) redirect("/dashboard");
  const teamId = session.user.teamId;

  if (!canSeeAudit(session.user.roles)) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-3">
        <h1 className="text-h2 text-(--color-text-primary)">Audit log</h1>
        <p className="text-body text-(--color-text-secondary)">Only Mentors, Team Leadership, Head Mentors and the Safety Captain can see the audit log.</p>
      </div>
    );
  }

  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { teamNumber: true, timezone: true } });
  const tz = isValidTimezone(team?.timezone) ? team!.timezone! : FALLBACK_TIMEZONE;

  // Range of local calendar days (inclusive); default: the last 30 days
  const today = localParts(new Date(), tz).dateKey;
  let to   = sp.to && DAY.test(sp.to) ? sp.to : today;
  let from = sp.from && DAY.test(sp.from) ? sp.from : addDays(to, -29);
  if (from > to) [from, to] = [to, from];
  const show: Show = sp.show === "tools" || sp.show === "safety" ? sp.show : "all";

  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = addDays(to, 1).split("-").map(Number);
  const start = zonedTimeToUtc(fy, fm, fd, 0, 0, tz);
  const end   = zonedTimeToUtc(ty, tm, td, 0, 0, tz); // exclusive

  const [checkouts, incidents] = await Promise.all([
    show === "safety" ? [] : prisma.toolCheckout.findMany({
      where: {
        tool: { teamId },
        OR: [{ checkedOutAt: { gte: start, lt: end } }, { returnedAt: { gte: start, lt: end } }],
      },
      include: {
        tool: { select: { name: true, assetTag: true } },
        user: { select: { name: true } },
      },
    }),
    show === "tools" ? [] : prisma.safetyIncident.findMany({
      // Incident dates are calendar days (stored at UTC midnight)
      where:   { reportedBy: { teamId }, incidentDate: { gte: new Date(from), lt: new Date(addDays(to, 1)) } },
      include: { reportedBy: { select: { name: true } } },
      orderBy: [{ incidentDate: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  // One row per check-out and per check-in that falls in the range, oldest first
  type Event = { at: Date; kind: "out" | "in"; c: (typeof checkouts)[number] };
  const events: Event[] = [];
  for (const c of checkouts) {
    if (c.checkedOutAt >= start && c.checkedOutAt < end) events.push({ at: c.checkedOutAt, kind: "out", c });
    if (c.returnedAt && c.returnedAt >= start && c.returnedAt < end) events.push({ at: c.returnedAt, kind: "in", c });
  }
  events.sort((a, b) => a.at.getTime() - b.at.getTime() || (a.kind === "out" ? -1 : 1));

  const outs = events.filter((e) => e.kind === "out").length;
  const ins  = events.length - outs;
  const stillOut = checkouts.filter((c) => !c.returnedAt && c.checkedOutAt < end).length;

  const quick = [
    { label: "Last 7 days",  from: addDays(today, -6),  to: today },
    { label: "Last 30 days", from: addDays(today, -29), to: today },
    { label: "Last 90 days", from: addDays(today, -89), to: today },
  ];
  const href = (f: string, t: string) => `/audit?from=${f}&to=${t}${show !== "all" ? `&show=${show}` : ""}`;
  const fieldCls = "h-11 rounded-md border border-(--color-border) bg-(--color-surface) text-(--color-text-primary) px-3 text-sm focus:outline-none focus:ring-2 focus:ring-(--color-primary)/40";

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <PageHeader
        title="Audit log"
        subtitle={<>Team {team?.teamNumber} · {dayText(from)} – {dayText(to)}</>}
        actions={<PrintButton />}
      />

      {/* Filters */}
      <form method="get" className="no-print card flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-(--color-text-primary)">
          From
          <input type="date" name="from" defaultValue={from} max={today} className={fieldCls} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-(--color-text-primary)">
          To
          <input type="date" name="to" defaultValue={to} max={today} className={fieldCls} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-(--color-text-primary)">
          Show
          <select name="show" defaultValue={show} className={fieldCls}>
            <option value="all">Tools and safety</option>
            <option value="tools">Tool check-outs and check-ins</option>
            <option value="safety">Safety reports</option>
          </select>
        </label>
        <Button type="submit">Apply</Button>
        <div className="flex w-full flex-wrap gap-x-4 gap-y-1 text-small">
          {quick.map((q) => (
            <Link key={q.label} href={href(q.from, q.to)} className={`hover:text-(--color-primary) ${q.from === from && q.to === to ? "text-(--color-primary) font-medium" : "text-(--color-text-secondary)"}`}>
              {q.label}
            </Link>
          ))}
        </div>
      </form>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          ...(show !== "safety" ? [
            { label: "Check-outs", value: outs },
            { label: "Check-ins", value: ins },
            { label: "Still out", value: stillOut },
          ] : []),
          ...(show !== "tools" ? [{ label: "Safety reports", value: incidents.length }] : []),
        ].map((s) => (
          <div key={s.label} className="card py-3 text-center">
            <p className="text-h2 text-(--color-text-primary)">{s.value}</p>
            <p className="text-small text-(--color-text-secondary)">{s.label}</p>
          </div>
        ))}
      </div>

      {show !== "safety" && (
        <section className="space-y-3">
          <h2 className="text-h2 text-(--color-text-primary)">Tool check-outs and check-ins</h2>
          {events.length === 0 ? (
            <p className="text-body text-(--color-text-secondary)">No tools were checked out or in during these dates.</p>
          ) : (
            <div className="card p-0 overflow-x-auto print-break-inside-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-(--color-border) text-left text-small text-(--color-text-secondary)">
                    <th className="px-3 py-2 font-medium whitespace-nowrap">When</th>
                    <th className="px-3 py-2 font-medium">Event</th>
                    <th className="px-3 py-2 font-medium">Tool</th>
                    <th className="px-3 py-2 font-medium">Who</th>
                    <th className="px-3 py-2 font-medium">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-(--color-border)">
                  {events.map(({ at, kind, c }) => {
                    const overdue = kind === "out" && !c.returnedAt && c.expectedReturn < now;
                    const details = kind === "out"
                      ? [c.intendedUse, `due ${dayText(calendarDayKey(c.expectedReturn))}`, c.returnedAt ? null : overdue ? "not returned — overdue" : "not returned yet"]
                      : [c.returnCondition ? `returned ${CONDITION[c.returnCondition] ?? c.returnCondition}` : null, c.notes];
                    return (
                      <tr key={`${c.id}-${kind}`} className="align-top break-inside-avoid">
                        <td className="px-3 py-2 whitespace-nowrap text-(--color-text-secondary)">{fmt.format(at)}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <Badge variant={kind === "out" ? "warning" : "success"}>{kind === "out" ? "Checked out" : "Checked in"}</Badge>
                        </td>
                        <td className="px-3 py-2 text-(--color-text-primary)">
                          {c.tool.name}{c.tool.assetTag && <span className="ml-1.5 font-mono text-xs text-(--color-text-secondary)">{c.tool.assetTag}</span>}
                        </td>
                        <td className="px-3 py-2 text-(--color-text-primary)">{c.user.name}</td>
                        <td className={`px-3 py-2 ${overdue ? "text-(--color-danger)" : "text-(--color-text-secondary)"}`}>{details.filter(Boolean).join(" · ")}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {show !== "tools" && (
        <section className="space-y-3">
          <h2 className="text-h2 text-(--color-text-primary)">Safety reports</h2>
          {incidents.length === 0 ? (
            <p className="text-body text-(--color-text-secondary)">No safety reports during these dates.</p>
          ) : (
            <div className="space-y-3">
              {incidents.map((i) => {
                const sev = SEVERITY[i.severity] ?? { label: i.severity, variant: "info" as const };
                const rows = [
                  ["Tool or material", i.toolOrMaterial],
                  ["People involved", i.peopleInvolved],
                  ["Immediate action", i.immediateAction],
                  ["Corrective action", i.correctiveAction],
                ].filter(([, v]) => v);
                return (
                  <article key={i.id} className="card space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={sev.variant}>{sev.label}</Badge>
                      <span className="text-small text-(--color-text-secondary)">
                        {dayText(calendarDayKey(i.incidentDate))} · reported by {i.reportedBy.name} on {fmt.format(i.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-(--color-text-primary) whitespace-pre-wrap">{i.description}</p>
                    {rows.length > 0 && (
                      <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-[10rem_1fr] text-sm">
                        {rows.map(([k, v]) => (
                          <div key={k} className="contents">
                            <dt className="text-(--color-text-secondary)">{k}</dt>
                            <dd className="text-(--color-text-primary) whitespace-pre-wrap">{v}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      <p className="hidden print:block text-small text-(--color-text-secondary)">
        Printed {fmt.format(now)} from FRC Manager.
      </p>
    </div>
  );
}
