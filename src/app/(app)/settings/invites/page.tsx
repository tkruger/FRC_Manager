import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageTitle } from "@/components/PageHeader";
import { withImpliedRoles, grantableRoles, ROLE_LABELS } from "@/lib/rbac";
import { canInvite, inviteUrl, EMAIL_INVITE_DAYS, LINK_INVITE_DAYS } from "@/lib/invites";
import { teamEmailReady } from "@/lib/email";
import { discordRequest } from "@/lib/discord";
import { EmailInvites, DiscordInvite, InviteList } from "./InviteClient";

/** Invite people to the team: by email, or a join link posted to Discord. */
export default async function InvitesPage() {
  const session = await auth();
  if (!session?.user?.teamId) redirect("/dashboard");
  if (!canInvite(withImpliedRoles(session.user.roles))) redirect("/settings/members");
  const teamId = session.user.teamId;
  const now = new Date();
  // Roles this person may hand out on an invite (up to their own; Head Mentor only by Head Mentors)
  const roleOptions = grantableRoles(withImpliedRoles(session.user.roles)).map((r) => ({ value: r, label: ROLE_LABELS[r] }));

  const [open, joined, discord] = await Promise.all([
    prisma.invite.findMany({
      where:   { teamId, revokedAt: null, expiresAt: { gt: now }, OR: [{ kind: "LINK" }, { kind: "EMAIL", acceptedAt: null }] },
      orderBy: { createdAt: "desc" },
      select:  { id: true, kind: true, email: true, name: true, token: true, roles: true, createdAt: true, expiresAt: true, uses: true, emailSent: true, invitedBy: { select: { name: true } } },
    }),
    prisma.invite.findMany({
      where:   { teamId, kind: "EMAIL", acceptedAt: { not: null } },
      orderBy: { acceptedAt: "desc" },
      take:    10,
      select:  { id: true, email: true, name: true, acceptedAt: true },
    }),
    prisma.discordConfig.findMany({ where: { teamId, active: true }, orderBy: { audience: "asc" }, select: { guildId: true, channelGeneral: true, audience: true } }),
  ]);

  // Each server's text channels, by name (falls back to typing an ID if the bot can't list them).
  // A parent join link usually goes in the parent server.
  const channels: { id: string; name: string; server: string }[] = [];
  for (const d of discord) {
    try {
      const all = await discordRequest(`/guilds/${d.guildId}/channels`) as { id: string; name: string; type: number; position: number }[];
      const server = d.audience === "PARENT" ? "Parent server" : "Student server";
      channels.push(...all.filter((c) => c.type === 0 || c.type === 5).sort((a, b) => a.position - b.position).map((c) => ({ id: c.id, name: c.name, server })));
    } catch { /* bot can't list channels — the picker takes an ID instead */ }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div>
        <nav className="text-small text-(--color-text-secondary) mb-1">
          <Link href="/settings/members" className="hover:text-(--color-primary)">Team members</Link>
          <span className="mx-2">›</span>Invite people
        </nav>
        <PageTitle help="roles">Invite people</PageTitle>
        <p className="text-body text-(--color-text-secondary) mt-1">
          People who accept an invite join your team straight away with the roles you pick — no approval needed.
          You can change their roles later in Team members.
        </p>
      </div>

      <EmailInvites emailReady={await teamEmailReady(teamId)} days={EMAIL_INVITE_DAYS} roles={roleOptions} />

      <DiscordInvite roles={roleOptions} connected={discord.length > 0} channels={channels} defaultChannel={discord[0]?.channelGeneral ?? channels[0]?.id ?? ""} days={LINK_INVITE_DAYS} />

      <InviteList
        invites={open.map((i) => ({
          id: i.id, kind: i.kind, email: i.email, name: i.name, url: inviteUrl(i.token), uses: i.uses, emailSent: i.emailSent,
          roles: i.roles.map((r) => ROLE_LABELS[r]),
          invitedBy: i.invitedBy?.name ?? null, createdAt: i.createdAt.toISOString(), expiresAt: i.expiresAt.toISOString(),
        }))}
        joined={joined.map((j) => ({ id: j.id, email: j.name ?? j.email ?? "", acceptedAt: j.acceptedAt!.toISOString() }))}
      />
    </div>
  );
}
