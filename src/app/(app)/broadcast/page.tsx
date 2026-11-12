import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/PageHeader";
import { BROADCAST_GROUPS, groupOf } from "@/lib/broadcast-groups";
import { teamEmailReady } from "@/lib/email";
import { BroadcastForm } from "./BroadcastForm";

// Broadcast message (Head Mentors): one message to students, parents and/or mentors — in the app
// with a push, on Discord, and by email.

const WHEN = (d: Date) => d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const GROUP_LABEL: Record<string, string> = Object.fromEntries(BROADCAST_GROUPS.map((g) => [g.id, g.label]));

export default async function BroadcastPage() {
  const session = await auth();
  if (!session?.user?.teamId) redirect("/dashboard");
  if (!session.user.roles.includes("HEAD_MENTOR")) redirect("/dashboard");
  const teamId = session.user.teamId;

  const [members, configs, recent, teamEmail] = await Promise.all([
    prisma.user.findMany({ where: { teamId, status: "ACTIVE", deletedAt: null }, select: { email: true, roles: { select: { role: true } } } }),
    prisma.discordConfig.findMany({ where: { teamId, active: true }, select: { audience: true, guildName: true, channelAnnouncements: true, channelGeneral: true } }),
    prisma.broadcast.findMany({
      where: { teamId }, orderBy: { createdAt: "desc" }, take: 10,
      select: { id: true, title: true, groups: true, emailGroups: true, discord: true, counts: true, createdAt: true, sentBy: { select: { name: true } } },
    }),
    teamEmailReady(teamId),
  ]);

  // How many people each choice reaches
  const counts = Object.fromEntries(BROADCAST_GROUPS.map((g) => [g.id, { people: 0, emails: 0 }]));
  for (const m of members) {
    const g = groupOf(m.roles.map((r) => r.role));
    if (!g) continue;
    counts[g].people++;
    if (!m.email.endsWith(".invalid")) counts[g].emails++;
  }
  const servers = (["STUDENT", "PARENT"] as const).map((audience) => {
    const c = configs.find((x) => x.audience === audience);
    return {
      audience,
      label: audience === "STUDENT" ? "Student server" : "Parent server",
      // Why it can't be picked, if it can't
      unavailable: !c ? "not connected" : !(c.channelAnnouncements || c.channelGeneral) ? "no announcements or general channel set" : null,
      channel: c ? (c.channelAnnouncements ? "announcements channel" : "general channel") : null,
      guild: c?.guildName ?? null,
    };
  });

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <PageHeader title="Broadcast message" help="notifications"
        subtitle="One message to students, parents and/or mentors — in the app with a push notification, on Discord, and by email." />

      <BroadcastForm counts={counts} servers={servers} teamEmail={teamEmail} />

      {recent.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-h2 text-(--color-text-primary)">Recently sent</h2>
          <ul className="card p-0 divide-y divide-(--color-border) overflow-hidden">
            {recent.map((b) => {
              const c = (b.counts ?? {}) as { inApp?: number; emailed?: number; discord?: number };
              return (
                <li key={b.id} id={`b-${b.id}`}>
                  <Link href={`/broadcast?broadcast=${b.id}`} className="block px-4 py-3 hover:bg-(--color-surface-overlay)">
                    <p className="text-sm font-medium text-(--color-text-primary)">📣 {b.title}</p>
                    <p className="text-small text-(--color-text-secondary)">
                      {WHEN(b.createdAt)}{b.sentBy ? ` · ${b.sentBy.name}` : ""}
                      {b.groups.length > 0 && ` · app: ${b.groups.map((g) => GROUP_LABEL[g] ?? g).join(", ")} (${c.inApp ?? 0})`}
                      {b.emailGroups.length > 0 && ` · email: ${b.emailGroups.map((g) => GROUP_LABEL[g] ?? g).join(", ")} (${c.emailed ?? 0})`}
                      {b.discord.length > 0 && ` · Discord: ${c.discord ?? 0} of ${b.discord.length}`}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
