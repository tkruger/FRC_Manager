import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";

export default async function PublicSchedulePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const season = await prisma.season.findUnique({
    where: { calendarToken: token },
    include: {
      team: { select: { teamNumber: true, name: true } },
      meetings: {
        where: { cancelled: false },
        orderBy: { date: "asc" },
        include: { tasks: { select: { name: true, subTeam: true } } },
      },
    },
  });

  if (!season) notFound();

  // Group meetings by month
  type Meeting = typeof season.meetings[0];
  const byMonth: Record<string, Meeting[]> = {};
  for (const m of season.meetings) {
    const key = m.date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    if (!byMonth[key]) byMonth[key] = [];
    byMonth[key].push(m);
  }

  function fmt12(time24: string) {
    const [h, m] = time24.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
  }

  const icsUrl = `/api/calendar/${token}.ics`;

  return (
    <div className="min-h-screen bg-[--color-surface]">
      {/* Header */}
      <header className="border-b border-[--color-border] py-6 px-4 sm:px-8">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded flex items-center justify-center text-white text-sm font-bold"
              style={{ backgroundColor: "var(--color-primary)" }}>
              {season.team.teamNumber}
            </div>
            <div>
              <h1 className="text-h2 text-[--color-text-primary]">{season.team.name}</h1>
              <p className="text-small text-[--color-text-secondary]">{season.name} — Build Season Schedule</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 mt-3 text-small text-[--color-text-secondary]">
            <span>Kickoff: <strong className="text-[--color-text-primary]">{season.kickoffDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</strong></span>
            <span>Week 0: <strong className="text-[--color-text-primary]">{season.week0Date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</strong></span>
            <span>Meeting days: <strong className="text-[--color-text-primary]">{season.meetingDays.join(", ")}</strong></span>
          </div>
          <div className="mt-3 flex gap-2">
            <a href={icsUrl}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[--color-border] text-sm text-[--color-text-primary] hover:bg-[--color-surface-overlay] transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
              Add to Google / Apple Calendar
            </a>
          </div>
        </div>
      </header>

      {/* Meeting list */}
      <main className="max-w-3xl mx-auto px-4 sm:px-8 py-8 space-y-8">
        {Object.keys(byMonth).length === 0 && (
          <div className="text-center py-16 text-[--color-text-secondary]">
            No meetings scheduled yet. Check back soon.
          </div>
        )}

        {Object.entries(byMonth).map(([monthLabel, monthMeetings]) => (
          <section key={monthLabel}>
            <h2 className="text-h3 text-[--color-text-primary] mb-4">{monthLabel}</h2>
            <div className="space-y-3">
              {monthMeetings.map((m) => {
                const isToday = m.date.toDateString() === new Date().toDateString();
                const isPast  = m.date < new Date(new Date().toDateString());
                return (
                  <div key={m.id}
                    className={`rounded-lg border px-4 py-3 ${isToday ? "border-[--color-primary] bg-[--color-primary]/5" : "border-[--color-border]"} ${isPast ? "opacity-60" : ""}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-[--color-text-primary]">
                            {m.date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
                            {isToday && <span className="ml-2 badge badge-info text-xs">Today</span>}
                          </p>
                        </div>
                        {m.title && <p className="text-body text-[--color-text-primary] mt-0.5">{m.title}</p>}
                        <p className="text-small text-[--color-text-secondary] mt-0.5">
                          {fmt12(m.startTime)} – {fmt12(m.endTime)}
                        </p>
                      </div>
                    </div>

                    {m.tasks.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {m.tasks.map((t, i) => (
                          <span key={i} className="badge badge-neutral text-xs">{t.name}</span>
                        ))}
                      </div>
                    )}

                    {m.notes && (
                      <p className="text-small text-[--color-text-secondary] mt-2 whitespace-pre-wrap">{m.notes}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </main>

      <footer className="border-t border-[--color-border] py-4 px-4 text-center text-small text-[--color-text-disabled]">
        FRC Manager — Team {season.team.teamNumber}
      </footer>
    </div>
  );
}
