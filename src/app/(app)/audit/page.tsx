import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/PageHeader";
import { PrintButton } from "@/components/PrintButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { canSeeAudit } from "@/lib/packing";
import { calendarDayKey } from "@/lib/notify/time";
import { addDays, auditRange, loadAudit, SHOWS } from "@/lib/audit/report";
import { LinkedDates } from "@/components/ui/linked-dates";
import { ChangeEntries } from "@/components/history/ChangeHistory";
import { toHistoryEntries } from "@/lib/audit/history";
import { CHANGE_LOG_DAYS } from "@/lib/audit/changes";

// Audit log for mentors and leadership: every tool check-out and check-in, every safety
// report, and who changed what on orders, tasks, meetings and members, in a date range — printable.

const SEVERITY: Record<string, { label: string; variant: "danger" | "warning" | "info" }> = {
  SIGNIFICANT_INJURY: { label: "Significant injury", variant: "danger" },
  MINOR_INJURY:       { label: "Minor injury",       variant: "warning" },
  NEAR_MISS:          { label: "Near miss",          variant: "info" },
};
const CONDITION: Record<string, string> = {
  EXCELLENT: "excellent", GOOD: "good", FAIR: "fair", NEEDS_REPAIR: "needs repair",
  OUT_OF_SERVICE: "out of service", OUT_FOR_MAINTENANCE: "out for maintenance",
};

function dayText(key: string) {
  return new Date(`${key}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/** Most changes listed at once (narrow the dates to see the rest) */
const CHANGE_LIMIT = 500;

export default async function AuditLogPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; show?: string }> }) {
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user?.teamId) redirect("/dashboard");
  const teamId = session.user.teamId;

  if (!canSeeAudit(session.user.roles)) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-3">
        <h1 className="text-h2 text-(--color-text-primary)">Audit log</h1>
        <p className="text-body text-(--color-text-secondary)">Only Team Leadership, Head Mentors and the Safety Captain can see the audit log.</p>
      </div>
    );
  }

  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { teamNumber: true, timezone: true } });

  // The range and filter (default: the last 30 days, everything) — the same as the CSV export
  const range = auditRange(sp, team?.timezone);
  const { tz, today, from, to, show, showTools, showSafety, showChanges } = range;
  const { checkouts, events, incidents, changeRows, moreChanges } = await loadAudit(teamId, range, CHANGE_LIMIT);
  const changes = toHistoryEntries(changeRows);

  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });


  const outs = events.filter((e) => e.kind === "out").length;
  const ins  = events.length - outs;
  const stillOut = checkouts.filter((c) => !c.returnedAt && c.checkedOutAt < range.end).length;

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
        actions={<>
          <a href={`/api/audit/csv?from=${from}&to=${to}&show=${show}`} download>
            <Button variant="outline" size="sm">Export CSV</Button>
          </a>
          <PrintButton />
        </>}
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
        <LinkedDates start="from" end="to" />
        <label className="flex flex-col gap-1 text-sm font-medium text-(--color-text-primary)">
          Show
          <select name="show" defaultValue={show} className={fieldCls}>
            {Object.entries(SHOWS).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
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
          ...(showTools ? [
            { label: "Check-outs", value: outs },
            { label: "Check-ins", value: ins },
            { label: "Still out", value: stillOut },
          ] : []),
          ...(showSafety ? [{ label: "Safety reports", value: incidents.length }] : []),
          ...(showChanges ? [{ label: "Changes", value: moreChanges ? `${CHANGE_LIMIT}+` : changes.length }] : []),
        ].map((s) => (
          <div key={s.label} className="card py-3 text-center">
            <p className="text-h2 text-(--color-text-primary)">{s.value}</p>
            <p className="text-small text-(--color-text-secondary)">{s.label}</p>
          </div>
        ))}
      </div>

      {showChanges && (
        <section className="space-y-3">
          <h2 className="text-h2 text-(--color-text-primary)">{show === "all" ? SHOWS.changes : SHOWS[show]}</h2>
          {changes.length === 0 ? (
            <p className="text-body text-(--color-text-secondary)">No changes during these dates.</p>
          ) : (
            <div className="card print-break-inside-auto">
              <ChangeEntries entries={changes} showItem />
            </div>
          )}
          <p className="text-small text-(--color-text-secondary)">
            Newest first.{moreChanges ? ` Showing the latest ${CHANGE_LIMIT} — pick fewer days to see the rest.` : ""} Changes are kept for {CHANGE_LOG_DAYS / 365 === 1 ? "a year" : `${CHANGE_LOG_DAYS} days`}.
          </p>
        </section>
      )}

      {showTools && (
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

      {showSafety && (
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
