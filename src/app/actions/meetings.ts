"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { regenerateFutureMeetings } from "@/lib/season-meetings";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import * as notify from "@/lib/notify/events";

const LEADERSHIP = ["HEAD_MENTOR", "TEAM_LEADERSHIP", "BUILD_LEAD"] as const;

async function requireLeadership() {
  const session = await auth();
  if (!session?.user?.teamId) throw new Error("Not authenticated.");
  if (!session.user.roles.some((r) => LEADERSHIP.includes(r as any)))
    throw new Error("Only Head Mentors, Team Leadership, and Build Leads can manage meetings.");
  return session;
}

/** Meetings are reached through their season — only allow the caller's own team. */
async function findTeamMeeting(meetingId: string, teamId: string) {
  return prisma.meeting.findFirst({
    where:  { id: meetingId, season: { teamId } },
    select: { id: true, seasonId: true, date: true, startTime: true, endTime: true },
  });
}

/** Regenerate the season's regular meetings from tomorrow to the season end */
export async function generateMeetingsAction(
  seasonId: string
): Promise<{ success: boolean; error?: string; count?: number }> {
  let session;
  try { session = await requireLeadership(); } catch (e: any) { return { success: false, error: e.message }; }

  const season = await prisma.season.findFirst({
    where: { id: seasonId, teamId: session.user.teamId },
  });
  if (!season) return { success: false, error: "Season not found." };

  // Rebuild from tomorrow on — past meetings (and today's) are never changed
  const count = await regenerateFutureMeetings(seasonId);
  if (count > 0) await notify.meetingsPublished(session.user.teamId!, count, session.user.id);

  revalidatePath("/calendar");
  return { success: true, count };
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
  let session;
  try { session = await requireLeadership(); } catch (e: any) { return { success: false, error: e.message }; }

  const before = await findTeamMeeting(meetingId, session.user.teamId!);
  if (!before) return { success: false, error: "Meeting not found." };

  // Only link tasks from the same season
  const taskIds = data.taskIds
    ? (await prisma.task.findMany({
        where:  { id: { in: data.taskIds }, seasonId: before.seasonId },
        select: { id: true },
      })).map((t) => t.id)
    : undefined;

  const timeSetByHand =
    (data.date && new Date(data.date).getTime() !== before.date.getTime()) ||
    (data.startTime && data.startTime !== before.startTime) ||
    (data.endTime && data.endTime !== before.endTime);

  await prisma.meeting.update({
    where: { id: meetingId },
    data: {
      ...(data.date      ? { date: new Date(data.date) }  : {}),
      ...(data.startTime ? { startTime: data.startTime }   : {}),
      ...(data.endTime   ? { endTime:   data.endTime }     : {}),
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.notes !== undefined ? { notes: data.notes } : {}),
      ...(taskIds        ? { tasks: { set: taskIds.map((id) => ({ id })) } } : {}),
      // Its own date/time now — season schedule changes won't move it
      ...(timeSetByHand  ? { customTime: true } : {}),
    },
  });

  // Only time/date changes are worth a notification — not agenda edits
  const moved = (
    (data.date && new Date(data.date).getTime() !== before.date.getTime()) ||
    (data.startTime && data.startTime !== before.startTime) ||
    (data.endTime && data.endTime !== before.endTime)
  );
  if (moved) await notify.meetingChanged(meetingId, "moved", session.user.id);

  revalidatePath("/calendar");
  return { success: true };
}

export async function cancelMeetingAction(
  meetingId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  let session;
  try { session = await requireLeadership(); } catch (e: any) { return { success: false, error: e.message }; }
  if (!await findTeamMeeting(meetingId, session.user.teamId!)) return { success: false, error: "Meeting not found." };

  await prisma.meeting.update({
    where: { id: meetingId },
    data: { cancelled: true, cancelReason: reason ?? null },
  });
  await notify.meetingChanged(meetingId, "cancelled", session.user.id);

  revalidatePath("/calendar");
  return { success: true };
}

export async function restoreMeetingAction(meetingId: string): Promise<{ success: boolean }> {
  let session;
  try { session = await requireLeadership(); } catch { return { success: false }; }
  if (!await findTeamMeeting(meetingId, session.user.teamId!)) return { success: false };
  await prisma.meeting.update({ where: { id: meetingId }, data: { cancelled: false, cancelReason: null } });
  await notify.meetingChanged(meetingId, "restored", session.user.id);
  revalidatePath("/calendar");
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

  const meeting = await prisma.meeting.create({
    // Added by hand, so schedule changes leave its time alone
    data: { seasonId, date: new Date(date), startTime, endTime, title, customTime: true },
  });
  await notify.meetingChanged(meeting.id, "added", session.user.id);

  revalidatePath("/calendar");
  return { success: true };
}

/** Generate (or regenerate) the calendar share token for a season */
export async function generateCalendarTokenAction(
  seasonId: string
): Promise<{ success: boolean; token?: string; error?: string }> {
  // Regenerating the token breaks everyone's existing calendar subscriptions
  let session;
  try { session = await requireLeadership(); } catch (e: any) { return { success: false, error: e.message }; }

  const crypto = await import("crypto");
  const token  = crypto.randomBytes(16).toString("hex");

  await prisma.season.updateMany({
    where: { id: seasonId, teamId: session.user.teamId },
    data:  { calendarToken: token },
  });

  revalidatePath("/calendar");
  return { success: true, token };
}
