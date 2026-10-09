import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageTitle } from "@/components/PageHeader";
import { withImpliedRoles } from "@/lib/rbac";
import { canInvite, inviteUrl, EMAIL_INVITE_DAYS, LINK_INVITE_DAYS } from "@/lib/invites";
import { emailConfigured } from "@/lib/email";
import { discordRequest } from "@/lib/discord";
import { EmailInvites, DiscordInvite, InviteList } from "./InviteClient";

/** Invite people to the team: by email, or a join link posted to Discord. */
export default async function InvitesPage() {
  const session = await auth();
  if (!session?.user?.teamId) redirect("/dashboard");
  if (!canInvite(withImpliedRoles(session.user.roles))) redirect("/settings/members");
  const teamId = session.user.teamId;
  const now = new Date();

  const [open, joined, discord] = await Promise.all([
    prisma.invite.findMany({
      where:   { teamId, revokedAt: null, expiresAt: { gt: now }, OR: [{ kind: "LINK" }, { kind: "EMAIL", acceptedAt: null }] },
      orderBy: { createdAt: "desc" },
      select:  { id: true, kind: true, email: true, token: true, createdAt: true, expiresAt: true, uses: true, emailSent: true, invitedBy: { select: { name: true } } },
    }),
    prisma.invite.findMany({
      where:   { teamId, kind: "EMAIL", acceptedAt: { not: null } },
      orderBy: { acceptedAt: "desc" },
      take:    10,
      select:  { id: true, email: true, acceptedAt: true },
    }),
    prisma.discordConfig.findFirst({ where: { teamId, active: true }, select: { guildId: true, channelGeneral: true } }),
  ]);

  // The server's text channels, by name (falls back to typing an ID if the bot can't list them)
  let channels: { id: string; name: string }[] = [];
  if (discord) {
    try {
      const all = await discordRequest(`/guilds/${discord.guildId}/channels`) as { id: string; name: string; type: number; position: number }[];
      channels = all.filter((c) => c.type === 0 || c.type === 5).sort((a, b) => a.position - b.position).map((c) => ({ id: c.id, name: c.name }));
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
          People who accept an invite join your team straight away as Team Members — no approval needed.
          Change their roles afterwards in Team members.
        </p>
      </div>

      <EmailInvites emailReady={emailConfigured()} days={EMAIL_INVITE_DAYS} />

      <DiscordInvite connected={!!discord} channels={channels} defaultChannel={discord?.channelGeneral ?? channels[0]?.id ?? ""} days={LINK_INVITE_DAYS} />

      <InviteList
        invites={open.map((i) => ({
          id: i.id, kind: i.kind, email: i.email, url: inviteUrl(i.token), uses: i.uses, emailSent: i.emailSent,
          invitedBy: i.invitedBy?.name ?? null, createdAt: i.createdAt.toISOString(), expiresAt: i.expiresAt.toISOString(),
        }))}
        joined={joined.map((j) => ({ id: j.id, email: j.email ?? "", acceptedAt: j.acceptedAt!.toISOString() }))}
      />
    </div>
  );
}
