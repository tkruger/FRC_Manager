"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

const LEADERSHIP = ["HEAD_MENTOR", "TEAM_LEADERSHIP", "BUILD_LEAD"] as const;

async function requireLeadership() {
  const session = await auth();
  if (!session?.user?.teamId) throw new Error("Not authenticated.");
  if (!session.user.roles.some((r) => LEADERSHIP.includes(r as any)))
    throw new Error("Only Head Mentors, Team Leadership, and Build Leads can manage meetings.");
  return session;
}

const DAY_MAP: Record<string, number> = {
  SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6,
};

/** Generate all meeting instances for a season between kickoff and week0 */
export async function generateMeetingsAction(
  seasonId: string
): Promise<{ success: boolean; error?: string; count?: number }> {
  let session;
  try { session = await requireLeadership(); } catch (e: any) { return { success: false, error: e.message }; }

  const season = await prisma.season.findFirst({
    where: { id: seasonId, teamId: session.user.teamId },
  });
  if (!season) return { success: false, error: "Season not found." };

  // Delete any auto-generated (not manually-customised) meetings
  await prisma.meeting.deleteMany({ where: { seasonId } });

  const dayTimes = (season.meetingDayTimes as Record<string, { start: string; end: string }>) ?? {};
  const meetingDayNums = season.meetingDays.map((d) => DAY_MAP[d]).filter((n) => n !== undefined);

  const meetings: { seasonId: string; date: Date; startTime: string; endTime: string }[] = [];
  const cursor = new Date(season.kickoffDate);
  cursor.setHours(0, 0, 0, 0);

  const end = new Date(season.week0Date);
  end.setHours(23, 59, 59, 999);

  while (cursor <= end) {
    if (meetingDayNums.includes(cursor.getDay())) {
      const dayKey = Object.entries(DAY_MAP).find(([, v]) => v === cursor.getDay())?.[0] ?? "";
      const times = dayTimes[dayKey] ?? { start: season.meetingStartTime, end: season.meetingEndTime };
      meetings.push({
        seasonId,
        date:      new Date(cursor),
        startTime: times.start,
        endTime:   times.end,
      });
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  await prisma.meeting.createMany({ data: meetings });

  revalidatePath("/schedule/calendar");
  revalidatePath("/schedule");
  return { success: true, count: meetings.length };
}

export async function updateMeetingAction(
  meetingId: string,
  data: {
    date?: string;
    startTime?: string;
    endTime?: string;
    title?: string | null;
    notes?: string | null;
    taskIds?: string[];
  }
): Promise<{ success: boolean; error?: string }> {
  try { await requireLeadership(); } catch (e: any) { return { success: false, error: e.message }; }

  await prisma.meeting.update({
    where: { id: meetingId },
    data: {
      ...(data.date      ? { date: new Date(data.date) }  : {}),
      ...(data.startTime ? { startTime: data.startTime }   : {}),
      ...(data.endTime   ? { endTime:   data.endTime }     : {}),
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.notes !== undefined ? { notes: data.notes } : {}),
      ...(data.taskIds   ? { tasks: { set: data.taskIds.map((id) => ({ id })) } } : {}),
    },
  });

  revalidatePath("/schedule/calendar");
  return { success: true };
}

export async function cancelMeetingAction(
  meetingId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  try { await requireLeadership(); } catch (e: any) { return { success: false, error: e.message }; }

  await prisma.meeting.update({
    where: { id: meetingId },
    data: { cancelled: true, cancelReason: reason ?? null },
  });

  revalidatePath("/schedule/calendar");
  return { success: true };
}

export async function restoreMeetingAction(meetingId: string): Promise<{ success: boolean }> {
  try { await requireLeadership(); } catch { return { success: false }; }
  await prisma.meeting.update({ where: { id: meetingId }, data: { cancelled: false, cancelReason: null } });
  revalidatePath("/schedule/calendar");
  return { success: true };
}

export async function addMeetingAction(
  seasonId: string,
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  let session;
  try { session = await requireLeadership(); } catch (e: any) { return { success: false, error: e.message }; }

  const season = await prisma.season.findFirst({ where: { id: seasonId, teamId: session.user.teamId } });
  if (!season) return { success: false, error: "Season not found." };

  const date = formData.get("date") as string;
  const startTime = formData.get("startTime") as string;
  const endTime   = formData.get("endTime")   as string;
  const title     = formData.get("title") as string || null;

  if (!date || !startTime || !endTime) return { success: false, error: "Date and times are required." };

  await prisma.meeting.create({
    data: { seasonId, date: new Date(date), startTime, endTime, title },
  });

  revalidatePath("/schedule/calendar");
  return { success: true };
}
