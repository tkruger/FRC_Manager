"use server";

import { z } from "zod";
import { issueMessage } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { seasonStarted, syncSeasonMeetings } from "@/lib/season-meetings";
import { syncActiveSeason } from "@/lib/season-active";
import { minutesOf, type Slot } from "@/lib/meeting-schedule";
import * as notify from "@/lib/notify/events";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import crypto from "crypto";
import { STAGE_INFO, designation } from "@/lib/competition";
import { ActionError, userMessage } from "@/lib/action-error";

async function requireHeadMentor() {
  const session = await auth();
  if (!session?.user?.teamId) throw new ActionError("Not authenticated.");
  if (!session.user.roles.includes("HEAD_MENTOR" as any))
    throw new ActionError("Only Head Mentors can manage seasons.");
  return session;
}

const ALL_DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

/**
 * Check if the proposed start→end range overlaps any existing season
 * for this team. Excludes `excludeSeasonId` (used when editing an existing season).
 * Two ranges overlap when: proposedStart < existingEnd AND proposedEnd > existingStart
 */
async function checkSeasonOverlap(
  teamId: string,
  kickoffDate: Date,
  endDate: Date,
  excludeSeasonId?: string
): Promise<string | null> {
  const overlapping = await prisma.season.findFirst({
    where: {
      teamId,
      ...(excludeSeasonId ? { id: { not: excludeSeasonId } } : {}),
      kickoffDate: { lt: endDate },    // existing starts before proposed ends
      endDate:   { gt: kickoffDate },  // existing ends after proposed starts
    },
    select: { name: true, kickoffDate: true, endDate: true },
  });

  if (!overlapping) return null;

  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }); // calendar dates are UTC midnight

  return (
    `This season's schedule overlaps with "${overlapping.name}" ` +
    `(${fmt(overlapping.kickoffDate)} – ${fmt(overlapping.endDate)}). ` +
    `Adjust the dates so they don't conflict.`
  );
}

const SeasonSchema = z.object({
  name:               z.string().max(300).min(1),
  year:               z.coerce.number().int().min(2000).max(2100),
  kickoffDate:        z.string().max(300).min(1),
  endDate:            z.string().max(300).min(1),
  meetingDays:        z.array(z.enum(ALL_DAYS as [string, ...string[]])).max(7).min(1, "Pick at least one meeting day."),
  expectedAttendance: z.coerce.number().int().min(1).default(10),
}).refine((d) => new Date(d.endDate) > new Date(d.kickoffDate), { message: "The season has to end after it starts.", path: ["endDate"] });

export type SeasonActionState =
  | { success: true; seasonId: string; meetings?: { added: number; removed: number; moved: number }; /** It's the active season now */ active?: boolean }
  | { success: false; error: string };

/**
 * Each meeting day's meetings from the form: dayStart_MON / dayEnd_MON appear once per
 * meeting (a day can have several), in order. The first meeting of the first day is also
 * kept as the season's default times. Returns an error when a meeting ends before it starts.
 */
function extractDayTimes(
  formData: FormData,
  selectedDays: string[]
): { dayTimes: Record<string, Slot[]>; globalStart: string; globalEnd: string } | { error: string } {
  const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
  const fallbackStart = (formData.get("meetingStartTime") as string) || "15:00";
  const fallbackEnd   = (formData.get("meetingEndTime")   as string) || "20:00";

  const dayTimes: Record<string, Slot[]> = {};
  for (const day of selectedDays) {
    const starts = formData.getAll(`dayStart_${day}`).map(String);
    const ends   = formData.getAll(`dayEnd_${day}`).map(String);
    const slots = (starts.length ? starts : [fallbackStart]).slice(0, 6).map((start, i) => ({
      start: TIME.test(start) ? start : fallbackStart,
      end:   TIME.test(ends[i] ?? "") ? ends[i] : fallbackEnd,
    }));
    const bad = slots.find((sl) => minutesOf(sl.end) <= minutesOf(sl.start));
    if (bad) return { error: `A ${day.charAt(0) + day.slice(1).toLowerCase()} meeting ends before it starts (${bad.start}–${bad.end}).` };
    dayTimes[day] = slots.sort((x, y) => x.start.localeCompare(y.start));
  }

  const first = dayTimes[selectedDays[0]]?.[0];
  return { dayTimes, globalStart: first?.start ?? fallbackStart, globalEnd: first?.end ?? fallbackEnd };
}

export async function createSeasonAction(
  _prev: SeasonActionState | null,
  formData: FormData
): Promise<SeasonActionState> {
  let session;
  try { session = await requireHeadMentor(); } catch (e) { return { success: false, error: userMessage(e) }; }

  const days = formData.getAll("meetingDays") as string[];
  const parsed = SeasonSchema.safeParse({
    name: formData.get("name"),
    year: formData.get("year"),
    kickoffDate: formData.get("kickoffDate"),
    endDate: formData.get("endDate"),
    meetingDays: days,
    expectedAttendance: formData.get("expectedAttendance"),
  });

  if (!parsed.success) return { success: false, error: issueMessage(parsed.error) };
  const d = parsed.data;

  const overlapError = await checkSeasonOverlap(
    session.user.teamId!,
    new Date(d.kickoffDate),
    new Date(d.endDate)
  );
  if (overlapError) return { success: false, error: overlapError };

  const times = extractDayTimes(formData, d.meetingDays);
  if ("error" in times) return { success: false, error: times.error };
  const { dayTimes, globalStart, globalEnd } = times;

  // Not made active here: the season today falls in is (see syncActiveSeason), so a future
  // season can be set up ahead and takes over on its start date
  const season = await prisma.season.create({
    data: {
      teamId:             session.user.teamId!,
      name:               d.name,
      year:               d.year,
      kickoffDate:        new Date(d.kickoffDate),
      endDate:            new Date(d.endDate),
      isActive:           false,
      meetingDays:        d.meetingDays,
      meetingStartTime:   globalStart,
      meetingEndTime:     globalEnd,
      meetingDayTimes:    dayTimes,
      expectedAttendance: d.expectedAttendance,
      calendarToken:      crypto.randomBytes(16).toString("hex"),
    },
  });

  await syncSeasonMeetings(season.id);
  const activeId = await syncActiveSeason(session.user.teamId!);

  revalidatePath("/", "layout");
  revalidatePath("/settings/season");
  revalidatePath("/dashboard");
  return { success: true, seasonId: season.id, active: activeId === season.id };
}

export async function updateSeasonAction(
  seasonId: string,
  _prev: SeasonActionState | null,
  formData: FormData
): Promise<SeasonActionState> {
  let session;
  try { session = await requireHeadMentor(); } catch (e) { return { success: false, error: userMessage(e) }; }

  const days = formData.getAll("meetingDays") as string[];
  const parsed = SeasonSchema.safeParse({
    name:               formData.get("name"),
    year:               formData.get("year"),
    kickoffDate:        formData.get("kickoffDate"),
    endDate:            formData.get("endDate"),
    meetingDays:        days,
    expectedAttendance: formData.get("expectedAttendance"),
  });

  if (!parsed.success) return { success: false, error: issueMessage(parsed.error) };
  const d = parsed.data;

  const overlapError = await checkSeasonOverlap(
    session.user.teamId!,
    new Date(d.kickoffDate),
    new Date(d.endDate),
    seasonId  // exclude self when editing
  );
  if (overlapError) return { success: false, error: overlapError };

  const times = extractDayTimes(formData, d.meetingDays);
  if ("error" in times) return { success: false, error: times.error };
  const { dayTimes, globalStart, globalEnd } = times;

  const before = await prisma.season.findFirst({
    where:  { id: seasonId, teamId: session.user.teamId },
    select: { kickoffDate: true },
  });
  if (!before) return { success: false, error: "Season not found." };
  const kickoff = new Date(d.kickoffDate);
  const end     = new Date(d.endDate);
  const sameDay = (a: Date, b: Date) => a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);
  // Once a season has started, its start date stays put
  if (seasonStarted(before.kickoffDate) && !sameDay(kickoff, before.kickoffDate)) {
    return { success: false, error: "This season has already started, so its start date can't be changed." };
  }

  const updated = await prisma.season.updateMany({
    where: { id: seasonId, teamId: session.user.teamId },
    data: {
      name:               d.name,
      year:               d.year,
      kickoffDate:        kickoff,
      endDate:            end,
      meetingDays:        d.meetingDays,
      meetingStartTime:   globalStart,
      meetingEndTime:     globalEnd,
      meetingDayTimes:    dayTimes,
      expectedAttendance: d.expectedAttendance,
    },
  });
  if (updated.count === 0) return { success: false, error: "Season not found." };

  // Meetings that haven't started yet (later today included) follow the season's dates and schedule on every save,
  // so they can never drift from it. Past meetings, and ones whose time was set by hand, stay.
  const meetings = await syncSeasonMeetings(seasonId);
  if (meetings?.added) await notify.meetingsPublished(session.user.teamId!, meetings.added, session.user.id);
  // New dates can change which season today falls in
  const activeId = await syncActiveSeason(session.user.teamId!);

  // Robots copy the season year into their display name ("2026 Ironclad") —
  // keep them in step when the season's year changes.
  const robots = await prisma.robot.findMany({
    where:  { seasonId, year: { not: d.year } },
    select: { id: true, name: true },
  });
  for (const r of robots) {
    await prisma.robot.update({ where: { id: r.id }, data: { year: d.year, displayName: `${d.year} ${r.name}` } });
  }

  revalidatePath("/", "layout");
  revalidatePath("/settings/season");
  revalidatePath("/dashboard");
  revalidatePath("/calendar");
  return { success: true, seasonId, meetings, active: activeId === seasonId };
}

const RobotSchema = z.object({
  name:         z.string().max(300).min(1),
  role:         z.enum(["COMPETITION", "PRACTICE", "DEMO", "OTHER"]),
  weightTarget: z.coerce.number().optional(),
  description:  z.string().max(5000).optional(),
});

export async function createRobotAction(
  seasonId: string,
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  let session;
  try { session = await requireHeadMentor(); } catch (e) { return { success: false, error: userMessage(e) }; }

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

// ─── Competitions ────────────────────────────────────────────────────────────

const CompetitionSchema = z.object({
  stage:       z.enum(["PRACTICE", "WEEK", "PLAYOFF", "WORLDS", "OFFSEASON"]),
  stageNumber: z.coerce.number().int().min(0).max(99).optional(),
  name:        z.string().trim().max(300).min(1, "Enter the event name.").max(120),
  location:    z.string().trim().max(300).max(160).optional(),
  startDate:   z.string().max(300).min(1, "Choose a start date."),
  endDate:     z.string().max(300).optional(),
});

type CompetitionResult = { success: boolean; error?: string };

async function saveCompetition(
  seasonId: string,
  competitionId: string | null,
  formData: FormData,
): Promise<CompetitionResult> {
  let session;
  try { session = await requireHeadMentor(); } catch (e) { return { success: false, error: userMessage(e) }; }

  const season = await prisma.season.findFirst({ where: { id: seasonId, teamId: session.user.teamId }, select: { id: true } });
  if (!season) return { success: false, error: "Season not found." };

  const parsed = CompetitionSchema.safeParse({
    stage:       formData.get("stage"),
    stageNumber: formData.get("stageNumber") || undefined,
    name:        formData.get("name"),
    location:    formData.get("location") || undefined,
    startDate:   formData.get("startDate"),
    endDate:     formData.get("endDate") || undefined,
  });
  if (!parsed.success) return { success: false, error: issueMessage(parsed.error) };
  const d = parsed.data;

  const info = STAGE_INFO[d.stage];
  const stageNumber = info.numbered ? d.stageNumber ?? null : null;
  if (info.numbered && stageNumber == null) return { success: false, error: `Enter the ${info.label.toLowerCase()} number.` };

  const start = new Date(d.startDate);
  const end   = d.endDate ? new Date(d.endDate) : start;
  if (end < start) return { success: false, error: "End date can't be before the start date." };

  // Designations must be unique within a season (templates refer to them)
  const clash = await prisma.competitionEvent.findFirst({
    where: { seasonId, stage: d.stage, stageNumber, ...(competitionId ? { id: { not: competitionId } } : {}) },
    select: { name: true },
  });
  if (clash) return { success: false, error: `${designation(d.stage, stageNumber)} is already "${clash.name}".` };

  const data = {
    name: d.name, location: d.location || null, startDate: start, endDate: end,
    stage: d.stage, stageNumber,
    eventType: d.stage === "WEEK" && stageNumber === 0 ? "WEEK_0" as const : info.eventType,
  };

  if (competitionId) {
    const updated = await prisma.competitionEvent.updateMany({ where: { id: competitionId, seasonId }, data });
    if (updated.count === 0) return { success: false, error: "Competition not found." };
  } else {
    await prisma.competitionEvent.create({ data: { ...data, seasonId } });
  }

  revalidatePath("/", "layout");
  return { success: true };
}

export async function addCompetitionAction(seasonId: string, formData: FormData): Promise<CompetitionResult> {
  return saveCompetition(seasonId, null, formData);
}

export async function updateCompetitionAction(seasonId: string, competitionId: string, formData: FormData): Promise<CompetitionResult> {
  return saveCompetition(seasonId, competitionId, formData);
}

export async function deleteCompetitionAction(competitionId: string): Promise<CompetitionResult> {
  let session;
  try { session = await requireHeadMentor(); } catch (e) { return { success: false, error: userMessage(e) }; }
  const deleted = await prisma.competitionEvent.deleteMany({
    where: { id: competitionId, season: { teamId: session.user.teamId } },
  });
  if (deleted.count === 0) return { success: false, error: "Competition not found." };
  revalidatePath("/", "layout");
  return { success: true };
}
