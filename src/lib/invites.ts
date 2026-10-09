// Team invitations. Server-only.

import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { appUrl } from "@/lib/app-url";
import type { Role } from "@/generated/prisma";
import { grantableRoles } from "@/lib/rbac";

/** Who can invite people (Mentors count as Team Leadership) */
export const INVITE_ROLES: Role[] = ["HEAD_MENTOR", "TEAM_LEADERSHIP", "TEAM_ADMIN"];

export const EMAIL_INVITE_DAYS = 14;
export const LINK_INVITE_DAYS  = 7;

export function canInvite(roles: string[]): boolean {
  return roles.some((r) => (INVITE_ROLES as string[]).includes(r));
}

/** Long, unguessable — the link is the only thing that lets someone join */
export function newInviteToken(): string {
  return crypto.randomBytes(24).toString("base64url");
}

export function inviteUrl(token: string): string {
  return `${appUrl()}/invite/${token}`;
}

export function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 86_400_000);
}

export type UsableInvite = { ok: true; invite: { id: string; kind: "EMAIL" | "LINK"; email: string | null; teamId: string; roles: Role[] }; team: { id: string; teamNumber: number; name: string } }
                         | { ok: false; reason: string };

/** An invite that can still be accepted, or why not */
export async function findUsableInvite(token: string): Promise<UsableInvite> {
  const invite = await prisma.invite.findUnique({
    where:  { token },
    select: { id: true, kind: true, email: true, teamId: true, roles: true, expiresAt: true, revokedAt: true, acceptedAt: true,
              team: { select: { id: true, teamNumber: true, name: true, status: true } } },
  });
  if (!invite) return { ok: false, reason: "This invite link isn't valid. Check you copied all of it." };
  if (invite.revokedAt) return { ok: false, reason: "This invite was cancelled. Ask your team for a new one." };
  if (invite.expiresAt < new Date()) return { ok: false, reason: "This invite has expired. Ask your team for a new one." };
  if (invite.kind === "EMAIL" && invite.acceptedAt) return { ok: false, reason: "This invite has already been used. Sign in instead." };
  if (invite.team.status !== "ACTIVE") return { ok: false, reason: "This team isn't open to new members right now." };
  return {
    ok: true,
    invite: { id: invite.id, kind: invite.kind, email: invite.email, teamId: invite.teamId, roles: invite.roles.length ? invite.roles : ["TEAM_MEMBER"] },
    team: { id: invite.team.id, teamNumber: invite.team.teamNumber, name: invite.team.name },
  };
}

/** Record that someone joined with this invite */
export async function markInviteUsed(inviteId: string) {
  await prisma.invite.update({ where: { id: inviteId }, data: { acceptedAt: new Date(), uses: { increment: 1 } } });
}

/** The roles an inviter picked, if they're allowed to give them all; otherwise why not */
export function checkInviteRoles(actorRoles: Role[], picked: string[]): { ok: true; roles: Role[] } | { ok: false; error: string } {
  const allowed = grantableRoles(actorRoles);
  const roles = [...new Set(picked)] as Role[];
  if (roles.length === 0) return { ok: false, error: "Pick at least one role." };
  const notAllowed = roles.filter((r) => !allowed.includes(r));
  if (notAllowed.length) return { ok: false, error: notAllowed.includes("HEAD_MENTOR") ? "Only Head Mentors can invite Head Mentors." : "You can only give roles up to your own." };
  return { ok: true, roles };
}
