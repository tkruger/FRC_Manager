import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageTitle } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { DISCORD_ADMIN_ROLES, EMAIL_ADMIN_ROLES } from "@/lib/rbac";
import { tbaConfigured } from "@/lib/frc/tba";
import { nexusConfigured } from "@/lib/frc/nexus";
import { appUrl } from "@/lib/app-url";

// Settings → Integrations (Head Mentors, Team Leadership, Integration Admins): the services the app
// connects to, each with where it stands and a link to set it up.

export default async function IntegrationsPage() {
  const session = await auth();
  if (!session?.user?.teamId) redirect("/dashboard");
  const roles = session.user.roles;
  const discord = roles.some((r) => DISCORD_ADMIN_ROLES.includes(r));
  const email = roles.some((r) => EMAIL_ADMIN_ROLES.includes(r));
  if (!discord && !email) redirect("/dashboard");

  const superAdmin = session.user.isSuperAdmin === true;
  const [configs, server, verify] = await Promise.all([
    discord ? prisma.discordConfig.findMany({ where: { teamId: session.user.teamId }, select: { audience: true } }) : [],
    email ? prisma.teamEmailServer.findUnique({ where: { teamId: session.user.teamId }, select: { enabled: true, fromEmail: true, lastError: true, lastErrorAt: true, lastSentAt: true } }) : null,
    // The latest code The Blue Alliance sent to verify its webhook
    superAdmin ? prisma.reminderLog.findFirst({ where: { key: { startsWith: "tba-webhook-verify:" } }, orderBy: { lastSentAt: "desc" } }) : null,
  ]);
  const base = appUrl();
  const student = configs.some((c) => c.audience === "STUDENT");
  const parent = configs.some((c) => c.audience === "PARENT");
  const emailFailing = !!server?.lastErrorAt && (!server.lastSentAt || server.lastErrorAt > server.lastSentAt);

  const items: { title: string; href?: string; desc: string; status: React.ReactNode; extra?: React.ReactNode }[] = [
    ...(discord ? [{
      title: "Discord",
      href:  "/settings/discord",
      desc:  "Slash commands and notifications in the student server, and an optional parent server for volunteer and milestone posts.",
      status: student || parent
        ? <Badge variant="success">{[student && "Student server", parent && "Parent server"].filter(Boolean).join(" + ")}</Badge>
        : <Badge variant="neutral">Not connected</Badge>,
    }] : []),
    ...(email ? [{
      title: "Team email",
      href:  "/settings/email",
      desc:  "Send the team's emails from your own account, so they come from an address families recognize.",
      status: !server ? <Badge variant="neutral">Using FRC Manager&apos;s email</Badge>
        : !server.enabled ? <Badge variant="neutral">Turned off</Badge>
        : emailFailing ? <Badge variant="danger">Failing — check the settings</Badge>
        : <Badge variant="success">Sending from {server.fromEmail}</Badge>,
    }] : []),
    {
      title: "The Blue Alliance",
      desc:  "Match schedules, results and rankings on the competition pages, and live notifications during events (schedule, next match, results, alliance selection, awards). Set up for the whole app by whoever hosts it (the TBA_API_KEY setting); link each competition to its event in Season settings.",
      status: tbaConfigured() ? <Badge variant="success">Connected</Badge> : <Badge variant="neutral">Not set up — links only</Badge>,
      extra: superAdmin && (
        <div className="mt-3 rounded-md bg-(--color-surface-overlay) px-3 py-2 text-small text-(--color-text-secondary) space-y-1">
          <p><b>Faster updates (optional):</b> add a webhook in myTBA → Account → Webhooks with the URL <code className="break-all">{base}/api/webhooks/tba</code> and the secret set as TBA_WEBHOOK_SECRET, and subscribe the account to your team. Without it, updates arrive within about 5 minutes.</p>
          {verify && <p>Latest verification code from TBA: <code className="font-semibold text-(--color-text-primary)">{verify.key.replace("tba-webhook-verify:", "")}</code></p>}
        </div>
      ),
    },
    {
      title: "FRC Nexus",
      desc:  "\"Now queuing\" alerts at events that use Nexus for queuing. Without it, the next-match alert comes about 20 minutes before the match's predicted time.",
      status: nexusConfigured() ? <Badge variant="success">Connected</Badge> : <Badge variant="neutral">Not set up</Badge>,
      extra: superAdmin && (
        <div className="mt-3 rounded-md bg-(--color-surface-overlay) px-3 py-2 text-small text-(--color-text-secondary)">
          Get an API key at frc.nexus/api and set it as NEXUS_API_KEY. For instant alerts, register the webhook <code className="break-all">{base}/api/webhooks/nexus</code> there with the token set as NEXUS_WEBHOOK_TOKEN.
        </div>
      ),
    },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div>
        <PageTitle help="discord">Integrations</PageTitle>
        <p className="text-body text-(--color-text-secondary) mt-1">The services FRC Manager connects to for your team.</p>
      </div>
      <ul className="space-y-3">
        {items.map((i) => {
          const body = (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-h3 text-(--color-text-primary)">{i.title}</h2>
                {i.status}
              </div>
              <p className="mt-1 text-small text-(--color-text-secondary)">{i.desc}</p>
              {i.extra}
              {i.href && <p className="mt-2 text-sm font-medium text-(--color-secondary)">Set up →</p>}
            </>
          );
          return (
            <li key={i.title}>
              {i.href
                ? <Link href={i.href} className="card block no-underline hover:border-(--color-primary)">{body}</Link>
                : <div className="card">{body}</div>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
