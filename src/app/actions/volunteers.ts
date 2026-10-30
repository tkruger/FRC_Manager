"use server";

// Volunteers: Head Mentors clear adults to volunteer; cleared adults sign up for meetings
// (or confirm when a coordinator asks them); coordinators assign people, set the shift
// instructions and how many adults a meeting needs.

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { issueMessage } from "@/lib/validation";
import { notifyUsers } from "@/lib/notify/deliver";
import { calendarDayKey, FALLBACK_TIMEZONE, isValidTimezone, localParts } from "@/lib/notify/time";
import { canCoordinate, coverage, DEFAULT_MIN_ADULTS, isCleared, shiftWhen } from "@/lib/volunteers";

type Result = { success: true } | { success: false; error: string };

async function me() {
  const session = await auth();
  if (!session?.user?.id || !session.user.teamId) return null;
  return { id: session.user.id, name: session.user.name ?? "Someone", teamId: session.user.teamId, roles: session.user.roles as string[] };
}

function refresh() {
  revalidatePath("/volunteers");
  revalidatePath("/calendar");
  revalidatePath("/settings/members");
}

/** A meeting of the caller's team that hasn't happened yet (and isn't canceled) */
async function upcomingMeeting(meetingId: string, teamId: string) {
  const m = await prisma.meeting.findFirst({
    where:  { id: meetingId, season: { teamId } },
    select: {
      id: true, date: true, startTime: true, endTime: true, title: true, cancelled: true,
      volunteerNote: { select: { instructions: true } },
      season: { select: { team: { select: { timezone: true, volunteerSettings: { select: { instructions: true, minAdults: true } } } } } },
    },
  });
  if (!m) return { error: "Meeting not found." } as const;
  if (m.cancelled) return { error: "That meeting is canceled." } as const;
  const tz = isValidTimezone(m.season.team.timezone) ? m.season.team.timezone : FALLBACK_TIMEZONE;
  if (calendarDayKey(m.date) < localParts(new Date(), tz).dateKey) return { error: "That meeting has already happened." } as const;
  const settings = m.season.team.volunteerSettings;
  return {
    meeting: m,
    what: `${m.title || "Team meeting"} — ${shiftWhen(m)}`,
    instructions: m.volunteerNote?.instructions ?? settings?.instructions ?? null,
    minAdults: settings?.minAdults ?? DEFAULT_MIN_ADULTS,
  } as const;
}

/** Who hears about gaps: the team's volunteer coordinators, or its Head Mentors if it has none */
async function coordinatorIds(teamId: string, exclude?: string): Promise<string[]> {
  const find = (role: "VOLUNTEER_COORDINATOR" | "HEAD_MENTOR") => prisma.user.findMany({
    where:  { teamId, status: "ACTIVE", deletedAt: null, roles: { some: { role } } },
    select: { id: true },
  });
  let ids = (await find("VOLUNTEER_COORDINATOR")).map((u) => u.id);
  if (ids.length === 0) ids = (await find("HEAD_MENTOR")).map((u) => u.id);
  return ids.filter((id) => id !== exclude);
}

const link = (meetingId: string) => `/volunteers?meeting=${meetingId}`;

/** After someone drops out: tell the coordinators if the meeting is now short */
async function warnIfShort(meetingId: string, teamId: string, who: string, verb: string, by: string) {
  const info = await upcomingMeeting(meetingId, teamId);
  if (info.error !== undefined) return;
  const vols = await prisma.meetingVolunteer.findMany({ where: { meetingId }, select: { status: true } });
  const c = coverage(vols, info.minAdults);
  if (c.covered) return;
  await notifyUsers(await coordinatorIds(teamId, by), {
    topic: "volunteers.coverage", type: "VOLUNTEER_COVERAGE",
    title: `${who} ${verb} — ${info.meeting.title || "meeting"} is short`,
    body: `${info.what}: ${c.confirmed} of ${info.minAdults} adults confirmed${c.pending ? `, ${c.pending} waiting for a reply` : ""}.`,
    url: link(meetingId), tag: `coverage-${meetingId}`,
  }).catch((e) => console.error("[volunteers] coverage notice", e));
}

// ── Clearance (Head Mentors) ────────────────────────────────────────────────

const ClearanceSchema = z.object({
  userId:  z.string().min(1).max(100),
  cleared: z.boolean(),
  /** Last day it's good for, "YYYY-MM-DD" (optional) */
  until:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date.").nullable().optional(),
});

export async function setVolunteerClearanceAction(input: unknown): Promise<Result> {
  const who = await me();
  if (!who) return { success: false, error: "Not authenticated." };
  if (!who.roles.includes("HEAD_MENTOR")) return { success: false, error: "Only Head Mentors can clear adults to volunteer." };
  const parsed = ClearanceSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: issueMessage(parsed.error) };
  const { userId, cleared, until } = parsed.data;

  const target = await prisma.user.findFirst({ where: { id: userId, teamId: who.teamId, deletedAt: null }, select: { id: true, volunteerClearedAt: true } });
  if (!target) return { success: false, error: "Member not found." };

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: cleared
        ? { volunteerClearedAt: target.volunteerClearedAt ?? new Date(), volunteerClearedById: who.id, volunteerClearedUntil: until ? new Date(`${until}T00:00:00Z`) : null }
        : { volunteerClearedAt: null, volunteerClearedById: null, volunteerClearedUntil: null },
    });
    // No longer cleared: off any upcoming shifts
    if (!cleared) {
      await tx.meetingVolunteer.deleteMany({ where: { userId, meeting: { date: { gte: new Date(Date.now() - 86_400_000) } } } });
    }
  });
  refresh();
  return { success: true };
}

// ── Signing up (cleared adults) ─────────────────────────────────────────────

async function clearedMe() {
  const who = await me();
  if (!who) return { error: "Not authenticated." } as const;
  const u = await prisma.user.findUnique({ where: { id: who.id }, select: { volunteerClearedAt: true, volunteerClearedUntil: true } });
  if (!u || !isCleared(u)) return { error: "A Head Mentor needs to clear you to volunteer first." } as const;
  return { who } as const;
}

/** Sign yourself up for a meeting (confirmed straight away) */
export async function signUpForShiftAction(meetingId: string): Promise<Result> {
  const c = await clearedMe();
  if (c.error !== undefined) return { success: false, error: c.error };
  const { who } = c;
  const info = await upcomingMeeting(String(meetingId), who.teamId);
  if (info.error !== undefined) return { success: false, error: info.error };

  await prisma.meetingVolunteer.upsert({
    where:  { meetingId_userId: { meetingId: info.meeting.id, userId: who.id } },
    create: { meetingId: info.meeting.id, userId: who.id, status: "CONFIRMED", respondedAt: new Date() },
    update: { status: "CONFIRMED", respondedAt: new Date() },
  });
  await notifyUsers([who.id], {
    topic: "volunteers.shifts", type: "VOLUNTEER_SHIFT",
    title: `You're volunteering: ${info.meeting.title || "team meeting"}`,
    body: `${info.what}. Thanks for signing up! You'll get a reminder the day before.`,
    details: info.instructions ? `Shift instructions:\n${info.instructions}` : undefined,
    url: link(info.meeting.id), tag: `shift-${info.meeting.id}`,
  }).catch((e) => console.error("[volunteers] sign-up notice", e));
  refresh();
  return { success: true };
}

/** Confirm or decline a shift a coordinator asked you to cover */
export async function respondToShiftAction(meetingId: string, accept: boolean): Promise<Result> {
  const c = await clearedMe();
  if (c.error !== undefined) return { success: false, error: c.error };
  const { who } = c;
  const info = await upcomingMeeting(String(meetingId), who.teamId);
  if (info.error !== undefined) return { success: false, error: info.error };
  const row = await prisma.meetingVolunteer.findUnique({ where: { meetingId_userId: { meetingId: info.meeting.id, userId: who.id } } });
  if (!row) return { success: false, error: "You aren't on this shift." };

  await prisma.meetingVolunteer.update({
    where: { id: row.id },
    data:  { status: accept ? "CONFIRMED" : "DECLINED", respondedAt: new Date() },
  });
  if (accept) {
    await notifyUsers([who.id], {
      topic: "volunteers.shifts", type: "VOLUNTEER_SHIFT",
      title: `Confirmed: ${info.meeting.title || "team meeting"}`,
      body: `${info.what}. Thanks! You'll get a reminder the day before.`,
      details: info.instructions ? `Shift instructions:\n${info.instructions}` : undefined,
      url: link(info.meeting.id), tag: `shift-${info.meeting.id}`,
    }).catch((e) => console.error("[volunteers] confirm notice", e));
  } else {
    await warnIfShort(info.meeting.id, who.teamId, who.name, "can't make it", who.id);
  }
  refresh();
  return { success: true };
}

/** Take yourself off a shift */
export async function withdrawFromShiftAction(meetingId: string): Promise<Result> {
  const who = await me();
  if (!who) return { success: false, error: "Not authenticated." };
  const info = await upcomingMeeting(String(meetingId), who.teamId);
  if (info.error !== undefined) return { success: false, error: info.error };
  const row = await prisma.meetingVolunteer.findUnique({ where: { meetingId_userId: { meetingId: info.meeting.id, userId: who.id } } });
  if (!row) return { success: true };

  // Kept as "can't make it" so coordinators don't ask again
  await prisma.meetingVolunteer.update({ where: { id: row.id }, data: { status: "DECLINED", respondedAt: new Date() } });
  if (row.status === "CONFIRMED") await warnIfShort(info.meeting.id, who.teamId, who.name, "dropped out", who.id);
  refresh();
  return { success: true };
}

// ── Coordinating ────────────────────────────────────────────────────────────

async function coordinator() {
  const who = await me();
  if (!who) return { error: "Not authenticated." } as const;
  if (!canCoordinate(who.roles)) return { error: "Only volunteer coordinators and Head Mentors can do that." } as const;
  return { who } as const;
}

/** Ask a cleared adult to cover a meeting (they confirm or decline) */
export async function assignVolunteerAction(meetingId: string, userId: string): Promise<Result> {
  const c = await coordinator();
  if (c.error !== undefined) return { success: false, error: c.error };
  const { who } = c;
  const info = await upcomingMeeting(String(meetingId), who.teamId);
  if (info.error !== undefined) return { success: false, error: info.error };
  const person = await prisma.user.findFirst({
    where:  { id: String(userId), teamId: who.teamId, status: "ACTIVE", deletedAt: null },
    select: { id: true, name: true, volunteerClearedAt: true, volunteerClearedUntil: true },
  });
  if (!person) return { success: false, error: "Member not found." };
  if (!isCleared(person)) return { success: false, error: `${person.name} isn't cleared to volunteer.` };

  // Assigning yourself needs no confirming
  const self = person.id === who.id;
  const existing = await prisma.meetingVolunteer.findUnique({ where: { meetingId_userId: { meetingId: info.meeting.id, userId: person.id } } });
  if (existing?.status === "CONFIRMED") return { success: false, error: `${person.name} is already confirmed for this meeting.` };
  await prisma.meetingVolunteer.upsert({
    where:  { meetingId_userId: { meetingId: info.meeting.id, userId: person.id } },
    create: { meetingId: info.meeting.id, userId: person.id, status: self ? "CONFIRMED" : "PENDING", assignedById: who.id, respondedAt: self ? new Date() : null },
    update: { status: self ? "CONFIRMED" : "PENDING", assignedById: who.id, respondedAt: self ? new Date() : null },
  });
  if (!self) {
    await notifyUsers([person.id], {
      topic: "volunteers.shifts", type: "VOLUNTEER_SHIFT",
      title: `Can you volunteer? ${info.meeting.title || "Team meeting"}`,
      body: `${who.name} asked you to cover ${info.what}. Please confirm or say you can't make it.`,
      details: info.instructions ? `Shift instructions:\n${info.instructions}` : undefined,
      url: link(info.meeting.id), tag: `shift-${info.meeting.id}`,
    }).catch((e) => console.error("[volunteers] assign notice", e));
  }
  refresh();
  return { success: true };
}

/** Take someone off a shift */
export async function removeVolunteerAction(meetingId: string, userId: string): Promise<Result> {
  const c = await coordinator();
  if (c.error !== undefined) return { success: false, error: c.error };
  const { who } = c;
  const meeting = await prisma.meeting.findFirst({ where: { id: String(meetingId), season: { teamId: who.teamId } }, select: { id: true, title: true, date: true, startTime: true, endTime: true } });
  if (!meeting) return { success: false, error: "Meeting not found." };
  const row = await prisma.meetingVolunteer.findUnique({ where: { meetingId_userId: { meetingId: meeting.id, userId: String(userId) } } });
  if (!row) return { success: true };

  await prisma.meetingVolunteer.delete({ where: { id: row.id } });
  if (row.userId !== who.id && row.status !== "DECLINED") {
    await notifyUsers([row.userId], {
      topic: "volunteers.shifts", type: "VOLUNTEER_SHIFT",
      title: `You're off the shift: ${meeting.title || "team meeting"}`,
      body: `${who.name} took you off ${shiftWhen(meeting)}. Nothing else to do.`,
      url: "/volunteers", tag: `shift-${meeting.id}`,
    }).catch((e) => console.error("[volunteers] remove notice", e));
  }
  refresh();
  return { success: true };
}

const SettingsSchema = z.object({
  instructions: z.string().max(5000, "Keep the instructions under 5,000 characters.").nullable(),
  minAdults:    z.number().int().min(1, "A meeting needs at least one adult.").max(20, "That's a lot of adults — 20 at most."),
});

/** The team's default shift instructions and adults per meeting */
export async function saveVolunteerSettingsAction(input: unknown): Promise<Result> {
  const c = await coordinator();
  if (c.error !== undefined) return { success: false, error: c.error };
  const parsed = SettingsSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: issueMessage(parsed.error) };
  const instructions = parsed.data.instructions?.trim() || null;
  await prisma.volunteerSettings.upsert({
    where:  { teamId: c.who.teamId },
    create: { teamId: c.who.teamId, instructions, minAdults: parsed.data.minAdults, updatedById: c.who.id },
    update: { instructions, minAdults: parsed.data.minAdults, updatedById: c.who.id },
  });
  refresh();
  return { success: true };
}

/** Instructions for one meeting instead of the default (null: back to the default) */
export async function setMeetingInstructionsAction(meetingId: string, instructions: string | null): Promise<Result> {
  const c = await coordinator();
  if (c.error !== undefined) return { success: false, error: c.error };
  const text = typeof instructions === "string" ? instructions.trim() : "";
  if (text.length > 5000) return { success: false, error: "Keep the instructions under 5,000 characters." };
  const meeting = await prisma.meeting.findFirst({ where: { id: String(meetingId), season: { teamId: c.who.teamId } }, select: { id: true } });
  if (!meeting) return { success: false, error: "Meeting not found." };
  if (text) {
    await prisma.meetingVolunteerNote.upsert({
      where:  { meetingId: meeting.id },
      create: { meetingId: meeting.id, instructions: text, updatedById: c.who.id },
      update: { instructions: text, updatedById: c.who.id },
    });
  } else {
    await prisma.meetingVolunteerNote.deleteMany({ where: { meetingId: meeting.id } });
  }
  refresh();
  return { success: true };
}

// ── Profile ─────────────────────────────────────────────────────────────────

/** Your phone number, for volunteer coordinators (optional) */
export async function savePhoneAction(phone: string): Promise<Result> {
  const who = await me();
  if (!who) return { success: false, error: "Not authenticated." };
  const p = String(phone ?? "").trim();
  if (p && !/^[+()\d\s.-]{7,25}$/.test(p)) return { success: false, error: "Enter a phone number (digits, spaces, + ( ) - allowed)." };
  await prisma.user.update({ where: { id: who.id }, data: { phone: p || null } });
  revalidatePath("/settings/profile");
  return { success: true };
}
