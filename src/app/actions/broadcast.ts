"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifyUsers } from "@/lib/notify/deliver";
import { sendEmail, escapeHtml } from "@/lib/email";
import { sendChannelMessage, embed } from "@/lib/discord";
import { appUrl } from "@/lib/app-url";
import { groupOf, isBroadcastGroup, type BroadcastGroup } from "@/lib/broadcast-groups";

type Result<T = object> = ({ success: true } & T) | { success: false; error: string };

const MAX_TITLE = 120;
const MAX_BODY = 4000;

/** Where a broadcast opens: whatever page, with the message on top */
const openUrl = (id: string) => `/dashboard?broadcast=${id}`;

/**
 * A Head Mentor's message to some of the team: in the app with a push (everyone in the chosen
 * groups), posted in the student and/or parent Discord server's announcements channel, and emailed
 * to the chosen groups.
 */
export async function sendBroadcastAction(input: {
  title: string; body: string; groups: string[]; emailGroups: string[]; discord: string[];
}): Promise<Result<{ id: string; counts: { inApp: number; pushed: number; emailed: number; discord: number } }>> {
  const session = await auth();
  if (!session?.user?.teamId) return { success: false, error: "Not signed in." };
  if (!session.user.roles.includes("HEAD_MENTOR")) return { success: false, error: "Only Head Mentors can send broadcast messages." };
  const teamId = session.user.teamId;

  const title = String(input.title ?? "").trim().slice(0, MAX_TITLE);
  const body = String(input.body ?? "").trim().slice(0, MAX_BODY);
  if (!title) return { success: false, error: "Give the message a title." };
  if (!body) return { success: false, error: "Write the message." };
  const groups = [...new Set(input.groups ?? [])].filter(isBroadcastGroup);
  const emailGroups = [...new Set(input.emailGroups ?? [])].filter(isBroadcastGroup);
  const discord = [...new Set(input.discord ?? [])].filter((d) => d === "STUDENT" || d === "PARENT") as ("STUDENT" | "PARENT")[];
  if (!groups.length && !emailGroups.length && !discord.length) return { success: false, error: "Pick who it goes to." };

  const [members, team, sender, configs] = await Promise.all([
    prisma.user.findMany({
      where:  { teamId, status: "ACTIVE", deletedAt: null },
      select: { id: true, email: true, name: true, roles: { select: { role: true } } },
    }),
    prisma.team.findUnique({ where: { id: teamId }, select: { teamNumber: true, name: true } }),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { name: true } }),
    discord.length ? prisma.discordConfig.findMany({ where: { teamId, active: true, audience: { in: discord } } }) : [],
  ]);
  const inGroup = (gs: BroadcastGroup[]) => members.filter((m) => {
    const g = groupOf(m.roles.map((r) => r.role));
    return !!g && gs.includes(g);
  });

  const b = await prisma.broadcast.create({
    data: { teamId, sentById: session.user.id, title, body, groups, emailGroups, discord },
  });
  const url = openUrl(b.id);
  const from = sender?.name ?? "A Head Mentor";

  // In the app, with a push — tapping it opens the whole message
  const app = groups.length
    ? await notifyUsers(inGroup(groups).map((m) => m.id), {
        topic: "team.broadcast", type: "BROADCAST",
        title: `📣 ${title}`,
        body:  body.length > 180 ? `${body.slice(0, 177).trimEnd()}… (tap to read)` : body,
        url, tag: `broadcast-${b.id}`,
      })
    : { inApp: 0, pushed: 0 };

  // Email (from the team's own mail server if it has one)
  const link = `${appUrl()}${url}`;
  const teamName = team ? `Team ${team.teamNumber}` : "your team";
  const emails = await Promise.allSettled(
    inGroup(emailGroups).filter((m) => !m.email.endsWith(".invalid")).map((m) => sendEmail({
      to: m.email,
      subject: title,
      text: `${body}\n\n— ${from}, ${teamName}\n\nOpen in FRC Manager: ${link}`,
      html: `<div style="font-family:system-ui,sans-serif;max-width:560px;line-height:1.5;color:#1f2430">
        <p style="font-size:18px;font-weight:600;margin:0 0 12px">${escapeHtml(title)}</p>
        <p style="white-space:pre-wrap;margin:0 0 16px">${escapeHtml(body)}</p>
        <p style="color:#555;margin:0 0 16px">— ${escapeHtml(from)}, ${escapeHtml(teamName)}</p>
        <p><a href="${link}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">Open in FRC Manager</a></p>
      </div>`,
    }, { teamId })),
  );
  const emailed = emails.filter((e) => e.status === "fulfilled" && e.value.sent).length;

  // Discord: each chosen server's announcements channel (or its general channel)
  const posts = await Promise.allSettled(configs.map((c) => {
    const channel = c.channelAnnouncements || c.channelGeneral;
    if (!channel) return Promise.reject(new Error("no channel"));
    return sendChannelMessage(channel, null, [embed({ title: `📣 ${title}`, description: `${body.slice(0, 3800)}\n\n— ${from}` })]);
  }));
  const posted = posts.filter((p) => p.status === "fulfilled").length;

  const counts = { inApp: app.inApp, pushed: app.pushed, emailed, discord: posted };
  await prisma.broadcast.update({ where: { id: b.id }, data: { counts } });
  revalidatePath("/broadcast");
  return { success: true, id: b.id, counts };
}

/** One broadcast, to show when its notification is opened (anyone on the team) */
export async function getBroadcastAction(id: string): Promise<Result<{ broadcast: { title: string; body: string; from: string | null; sentAt: string } }>> {
  const session = await auth();
  if (!session?.user?.teamId) return { success: false, error: "Not signed in." };
  const b = await prisma.broadcast.findFirst({
    where:  { id: String(id), teamId: session.user.teamId },
    select: { title: true, body: true, createdAt: true, sentBy: { select: { name: true } } },
  });
  if (!b) return { success: false, error: "That message isn't available." };
  return { success: true, broadcast: { title: b.title, body: b.body, from: b.sentBy?.name ?? null, sentAt: b.createdAt.toISOString() } };
}
