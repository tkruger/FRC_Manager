"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import crypto from "crypto";

async function requireHeadMentor() {
  const session = await auth();
  if (!session?.user?.teamId) throw new Error("Not authenticated.");
  if (!session.user.roles.includes("HEAD_MENTOR" as any))
    throw new Error("Only Head Mentors can manage seasons.");
  return session;
}

const ALL_DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

const SeasonSchema = z.object({
  name:               z.string().min(1),
  year:               z.coerce.number().int().min(2000).max(2100),
  kickoffDate:        z.string().min(1),
  week0Date:          z.string().min(1),
  meetingDays:        z.array(z.string()).min(1),
  expectedAttendance: z.coerce.number().int().min(1).default(10),
});

export type SeasonActionState =
  | { success: true; seasonId: string }
  | { success: false; error: string };

/** Extract per-day time config from form data:
 *  dayStart_MON, dayEnd_MON, dayStart_WED, dayEnd_WED, etc.
 *  Falls back to global meetingStartTime / meetingEndTime if no per-day fields. */
function extractDayTimes(
  formData: FormData,
  selectedDays: string[]
): { dayTimes: Record<string, { start: string; end: string }>; globalStart: string; globalEnd: string } {
  const globalStart = (formData.get("meetingStartTime") as string) || "15:00";
  const globalEnd   = (formData.get("meetingEndTime")   as string) || "20:00";

  const dayTimes: Record<string, { start: string; end: string }> = {};
  for (const day of selectedDays) {
    const start = (formData.get(`dayStart_${day}`) as string) || globalStart;
    const end   = (formData.get(`dayEnd_${day}`)   as string) || globalEnd;
    dayTimes[day] = { start, end };
  }

  // Use the first selected day's times as the global fallback
  const firstDay = selectedDays[0];
  return {
    dayTimes,
    globalStart: dayTimes[firstDay]?.start ?? globalStart,
    globalEnd:   dayTimes[firstDay]?.end   ?? globalEnd,
  };
}

export async function createSeasonAction(
  _prev: SeasonActionState | null,
  formData: FormData
): Promise<SeasonActionState> {
  let session;
  try { session = await requireHeadMentor(); } catch (e: any) { return { success: false, error: e.message }; }

  const days = formData.getAll("meetingDays") as string[];
  const parsed = SeasonSchema.safeParse({
    name: formData.get("name"),
    year: formData.get("year"),
    kickoffDate: formData.get("kickoffDate"),
    week0Date: formData.get("week0Date"),
    meetingDays: days,
    expectedAttendance: formData.get("expectedAttendance"),
  });

  if (!parsed.success) return { success: false, error: "Please fill in all required fields." };
  const d = parsed.data;
  const { dayTimes, globalStart, globalEnd } = extractDayTimes(formData, d.meetingDays);

  await prisma.season.updateMany({
    where: { teamId: session.user.teamId, isActive: true },
    data: { isActive: false },
  });

  const season = await prisma.season.create({
    data: {
      teamId:             session.user.teamId!,
      name:               d.name,
      year:               d.year,
      kickoffDate:        new Date(d.kickoffDate),
      week0Date:          new Date(d.week0Date),
      isActive:           true,
      meetingDays:        d.meetingDays,
      meetingStartTime:   globalStart,
      meetingEndTime:     globalEnd,
      meetingDayTimes:    dayTimes,
      expectedAttendance: d.expectedAttendance,
      calendarToken:      crypto.randomBytes(16).toString("hex"),
    },
  });

  revalidatePath("/settings/season");
  revalidatePath("/dashboard");
  return { success: true, seasonId: season.id };
}

export async function updateSeasonAction(
  seasonId: string,
  _prev: SeasonActionState | null,
  formData: FormData
): Promise<SeasonActionState> {
  let session;
  try { session = await requireHeadMentor(); } catch (e: any) { return { success: false, error: e.message }; }

  const days = formData.getAll("meetingDays") as string[];
  const parsed = SeasonSchema.safeParse({
    name:               formData.get("name"),
    year:               formData.get("year"),
    kickoffDate:        formData.get("kickoffDate"),
    week0Date:          formData.get("week0Date"),
    meetingDays:        days.length > 0 ? days : ["MON"],
    expectedAttendance: formData.get("expectedAttendance"),
  });

  if (!parsed.success) return { success: false, error: "Please fill in all required fields." };
  const d = parsed.data;
  const { dayTimes, globalStart, globalEnd } = extractDayTimes(formData, d.meetingDays);

  await prisma.season.updateMany({
    where: { id: seasonId, teamId: session.user.teamId },
    data: {
      name:               d.name,
      year:               d.year,
      kickoffDate:        new Date(d.kickoffDate),
      week0Date:          new Date(d.week0Date),
      meetingDays:        d.meetingDays,
      meetingStartTime:   globalStart,
      meetingEndTime:     globalEnd,
      meetingDayTimes:    dayTimes,
      expectedAttendance: d.expectedAttendance,
    },
  });

  revalidatePath("/settings/season");
  revalidatePath("/dashboard");
  revalidatePath("/schedule");
  return { success: true, seasonId };
}

const RobotSchema = z.object({
  name:         z.string().min(1),
  role:         z.enum(["COMPETITION", "PRACTICE", "DEMO", "OTHER"]),
  weightTarget: z.coerce.number().optional(),
  description:  z.string().optional(),
});

export async function createRobotAction(
  seasonId: string,
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  let session;
  try { session = await requireHeadMentor(); } catch (e: any) { return { success: false, error: e.message }; }

  const season = await prisma.season.findFirst({
    where: { id: seasonId, teamId: session.user.teamId },
  });
  if (!season) return { success: false, error: "Season not found." };

  const parsed = RobotSchema.safeParse({
    name:         formData.get("name"),
    role:         formData.get("role"),
    weightTarget: formData.get("weightTarget") || undefined,
    description:  formData.get("description") || undefined,
  });
  if (!parsed.success) return { success: false, error: "Invalid robot data." };
  const d = parsed.data;

  await prisma.robot.create({
    data: {
      seasonId,
      year:        season.year,
      name:        d.name,
      displayName: `${season.year} ${d.name}`,
      role:        d.role,
      weightTarget:d.weightTarget,
      description: d.description,
    },
  });

  revalidatePath("/settings/season");
  revalidatePath("/fleet");
  return { success: true };
}
