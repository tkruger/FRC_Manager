"use server";

// Inviting people to a team (by email, or a join link posted to Discord) and accepting
// an invite. Accepting makes the person an approved member with the invite's roles.

import { z } from "zod";
import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth, signIn } from "@/lib/auth";
import { withImpliedRoles } from "@/lib/rbac";
import { sendEmail, escapeHtml } from "@/lib/email";
import { sendChannelMessage, embed, COLORS, explainDiscordError } from "@/lib/discord";
import {
  canInvite, checkInviteRoles, newInviteToken, inviteUrl, daysFromNow, findUsableInvite, markInviteUsed,
  EMAIL_INVITE_DAYS, LINK_INVITE_DAYS,
} from "@/lib/invites";

type Fail = { success: false; error: string };

async function requireInviter() {
  const session = await auth();
  if (!session?.user?.teamId) return null;
  return canInvite(withImpliedRoles(session.user.roles)) ? session : null;
}

function refresh() {
  revalidatePath("/settings/invites");
}

// ── Email invites ───────────────────────────────────────────────────────────

export interface EmailInviteResult {
  email:  string;
  /** sent = emailed; link = created but not emailed (copy the link); skipped = see reason */
  status: "sent" | "link" | "skipped";
  reason?: string;
  url?:   string;
}

/** Invite a comma-separated list of addresses. Each gets a personal, single-use invite. */
export async function sendEmailInvitesAction(raw: string, pickedRoles: string[] = ["TEAM_MEMBER"]): Promise<{ success: true; results: EmailInviteResult[] } | Fail> {
  const session = await requireInviter();
  if (!session) return { success: false, error: "Only Head Mentors, Mentors, Team Leadership and Team Admins can invite people." };
  const teamId = session.user.teamId!;
  // Roles they'll get on accepting — only ones the inviter may give
  const roleCheck = checkInviteRoles(withImpliedRoles(session.user.roles), pickedRoles);
  if (!roleCheck.ok) return { success: false, error: roleCheck.error };
  const roles = roleCheck.roles;

  const emails = [...new Set(raw.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean))];
  if (emails.length === 0) return { success: false, error: "Enter at least one email address." };
  if (emails.length > 50) return { success: false, error: "Up to 50 addresses at a time." };

  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { teamNumber: true, name: true } });
  if (!team) return { success: false, error: "Team not found." };
  const inviter = session.user.name ?? "Your team";

  const results: EmailInviteResult[] = [];
  for (const email of emails) {
    if (!z.string().email().safeParse(email).success) { results.push({ email, status: "skipped", reason: "Not a valid email address" }); continue; }

    const existing = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { teamId: true, status: true },
    });
    if (existing?.teamId === teamId && existing.status === "ACTIVE") { results.push({ email, status: "skipped", reason: "Already on the team" }); continue; }

    // A fresh invite replaces any earlier one still waiting for this address
    await prisma.invite.updateMany({
      where: { teamId, kind: "EMAIL", email, acceptedAt: null, revokedAt: null },
      data:  { revokedAt: new Date() },
    });
    const invite = await prisma.invite.create({
      data: { teamId, kind: "EMAIL", email, roles, token: newInviteToken(), invitedById: session.user.id, expiresAt: daysFromNow(EMAIL_INVITE_DAYS) },
    });
    const url = inviteUrl(invite.token);

    const subject = `${inviter} invited you to Team ${team.teamNumber} on FRC Manager`;
    const sent = await sendEmail({
      to: email,
      subject,
      text: `${inviter} invited you to join Team ${team.teamNumber} (${team.name}) on FRC Manager, where the team runs its tasks, tools, orders and calendar.\n\nAccept the invite: ${url}\n\nThe link works for ${EMAIL_INVITE_DAYS} days.`,
      html: `<div style="font-family:system-ui,sans-serif;max-width:480px;line-height:1.5;color:#1f2430">
        <p><b>${escapeHtml(inviter)}</b> invited you to join <b>Team ${team.teamNumber}</b> (${escapeHtml(team.name)}) on FRC Manager, where the team runs its tasks, tools, orders and calendar.</p>
        <p><a href="${url}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">Accept the invite</a></p>
        <p style="font-size:13px;color:#555">The link works for ${EMAIL_INVITE_DAYS} days. If the button doesn't work, open: ${url}</p>
      </div>`,
    });
    if (sent.sent) {
      await prisma.invite.update({ where: { id: invite.id }, data: { emailSent: true } });
      results.push({ email, status: "sent" });
    } else {
      results.push({ email, status: "link", reason: sent.error, url });
    }
  }

  refresh();
  return { success: true, results };
}

// ── Discord join link ───────────────────────────────────────────────────────

/** Post a team join link to a Discord channel. Anyone with it can join until it expires. */
export async function postDiscordInviteAction(channelId: string, pickedRoles: string[] = ["TEAM_MEMBER"]): Promise<{ success: true; url: string } | Fail> {
  const session = await requireInviter();
  if (!session) return { success: false, error: "Only Head Mentors, Mentors, Team Leadership and Team Admins can invite people." };
  const teamId = session.user.teamId!;
  const roleCheck = checkInviteRoles(withImpliedRoles(session.user.roles), pickedRoles);
  if (!roleCheck.ok) return { success: false, error: roleCheck.error };
  if (!/^\d{5,25}$/.test(channelId)) return { success: false, error: "Pick a channel." };

  const [config, team] = await Promise.all([
    prisma.discordConfig.findFirst({ where: { teamId, active: true }, select: { id: true } }),
    prisma.team.findUnique({ where: { id: teamId }, select: { teamNumber: true, name: true } }),
  ]);
  if (!config) return { success: false, error: "Connect your Discord server first (Settings → Discord)." };
  if (!team) return { success: false, error: "Team not found." };

  const invite = await prisma.invite.create({
    data: { teamId, kind: "LINK", roles: roleCheck.roles, token: newInviteToken(), invitedById: session.user.id, postedTo: channelId, expiresAt: daysFromNow(LINK_INVITE_DAYS) },
  });
  const url = inviteUrl(invite.token);
  const until = invite.expiresAt.toLocaleDateString("en-US", { month: "long", day: "numeric" });

  try {
    await sendChannelMessage(channelId, null, [embed({
      title: `👋 Join Team ${team.teamNumber} on FRC Manager`,
      description: `We run our tasks, tools, orders and calendar on FRC Manager.\n\n**[Join the team](${url})** — create an account (or sign in) and you're in.\n\nThis link works until ${until}.`,
      color: COLORS.info,
    })]);
  } catch (e) {
    // Not posted, so don't leave a live link nobody can see
    await prisma.invite.update({ where: { id: invite.id }, data: { revokedAt: new Date() } });
    return { success: false, error: explainDiscordError(e instanceof Error ? e.message : String(e)) };
  }

  refresh();
  return { success: true, url };
}

export async function revokeInviteAction(inviteId: string): Promise<{ success: true } | Fail> {
  const session = await requireInviter();
  if (!session) return { success: false, error: "Not allowed." };
  await prisma.invite.updateMany({
    where: { id: inviteId, teamId: session.user.teamId!, revokedAt: null },
    data:  { revokedAt: new Date() },
  });
  refresh();
  return { success: true };
}

// ── Accepting ───────────────────────────────────────────────────────────────

const NewAccountSchema = z.object({
  name:     z.string().trim().min(2, "Enter your name."),
  email:    z.string().trim().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

/** New to FRC Manager: create an account from the invite — approved, on the team — and sign in. */
export async function acceptInviteWithNewAccountAction(token: string, input: unknown): Promise<{ success: true } | Fail> {
  const usable = await findUsableInvite(token);
  if (!usable.ok) return { success: false, error: usable.reason };

  const parsed = NewAccountSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  const { name, password } = parsed.data;
  // An email invite is for that address
  const email = (usable.invite.email ?? parsed.data.email).toLowerCase();

  const existing = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true } });
  if (existing) return { success: false, error: "There's already an account with that email — sign in instead, then open the invite again." };

  await prisma.user.create({
    data: {
      name, email,
      password:   await bcrypt.hash(password, 12),
      teamId:     usable.team.id,
      status:     "ACTIVE",
      approvedAt: new Date(),
      registrationNote: "Joined with an invite",
      roles:      { create: usable.invite.roles.map((role) => ({ role })) },
    },
  });
  await markInviteUsed(usable.invite.id);
  revalidatePath("/settings/members");

  try {
    await signIn("credentials", { email, password, redirect: false });
  } catch (e) {
    if (!(e instanceof AuthError)) throw e;
    return { success: false, error: "Your account is ready — sign in to continue." };
  }
  return { success: true };
}

/** Already signed in (e.g. with Google): join the team from the invite. */
export async function acceptInviteAsCurrentUserAction(token: string): Promise<{ success: true } | Fail> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Sign in first." };

  const usable = await findUsableInvite(token);
  if (!usable.ok) return { success: false, error: usable.reason };

  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { teamId: true, status: true } });
  if (!me) return { success: false, error: "Account not found." };
  if (me.teamId === usable.team.id && me.status === "ACTIVE") return { success: true }; // already in
  if (me.teamId && me.teamId !== usable.team.id && me.status === "ACTIVE") {
    return { success: false, error: "Your account already belongs to another team. Use a different account to join this one." };
  }

  // Joining a team gives exactly the invite's roles (nothing carried over from elsewhere)
  await prisma.$transaction([
    prisma.userRole.deleteMany({ where: { userId: session.user.id } }),
    prisma.user.update({
      where: { id: session.user.id },
      data:  { teamId: usable.team.id, status: "ACTIVE", approvedAt: new Date(), roles: { create: usable.invite.roles.map((role) => ({ role })) } },
    }),
  ]);
  await markInviteUsed(usable.invite.id);
  revalidatePath("/", "layout");
  return { success: true };
}
