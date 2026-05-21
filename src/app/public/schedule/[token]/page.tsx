import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { SubscribeCalendarButton } from "@/components/calendar/SubscribeCalendarButton";
import { PublicCalendarClient } from "./PublicCalendarClient";

export default async function PublicSchedulePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const season = await prisma.season.findUnique({
    where: { calendarToken: token },
    include: {
      team: { select: { teamNumber: true, name: true } },
      meetings: {
        where: { cancelled: false, date: { gte: new Date(new Date().toDateString()) } },
        orderBy: { date: "asc" },
        include: { tasks: { select: { name: true, subTeam: true } } },
      },
    },
  });

  if (!season) notFound();

  const baseUrl = process.env.NEXTAUTH_URL ?? "https://frc-manager.vercel.app";
  const icsUrl  = `${baseUrl}/api/calendar/${token}.ics`;

  const serializedMeetings = season.meetings.map((m) => ({
    id:        m.id,
    date:      m.date.toISOString(),
    startTime: m.startTime,
    endTime:   m.endTime,
    title:     m.title,
    notes:     m.notes,
    tasks:     m.tasks.map((t) => ({ name: t.name, subTeam: t.subTeam })),
  }));

  return (
    <div className="min-h-screen bg-[--color-surface]">
      {/* Header */}
      <header className="border-b border-[--color-border] py-6 px-4 sm:px-8">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-1">
            <div
              className="w-8 h-8 rounded flex items-center justify-center text-white text-sm font-bold"
              style={{ backgroundColor: "var(--color-primary)" }}
            >
              {season.team.teamNumber}
            </div>
            <div>
              <h1 className="text-h2 text-[--color-text-primary]">{season.team.name}</h1>
              <p className="text-small text-[--color-text-secondary]">
                {season.name} — Build Season Schedule
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 mt-3 text-small text-[--color-text-secondary]">
            <span>
              Kickoff:{" "}
              <strong className="text-[--color-text-primary]">
                {season.kickoffDate.toLocaleDateString("en-US", {
                  month: "short", day: "numeric", year: "numeric",
                })}
              </strong>
            </span>
            <span>
              Week 0:{" "}
              <strong className="text-[--color-text-primary]">
                {season.week0Date.toLocaleDateString("en-US", {
                  month: "short", day: "numeric", year: "numeric",
                })}
              </strong>
            </span>
          </div>
          <div className="mt-3">
            <SubscribeCalendarButton icsUrl={icsUrl} />
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-4 sm:px-8 py-8">
        <PublicCalendarClient
          meetings={serializedMeetings}
          kickoffDate={season.kickoffDate.toISOString()}
          week0Date={season.week0Date.toISOString()}
        />
      </main>

      <footer className="border-t border-[--color-border] py-4 px-4 text-center text-small text-[--color-text-disabled]">
        FRC Manager — Team {season.team.teamNumber}
      </footer>
    </div>
  );
}
