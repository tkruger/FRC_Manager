import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageTitle } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { DISCORD_ADMIN_ROLES, EMAIL_ADMIN_ROLES } from "@/lib/rbac";
import { tbaConfigured } from "@/lib/frc/tba";

// Settings → Integrations (Head Mentors, Team Leadership, Integration Admins): the services the app
// connects to, each with where it stands and a link to set it up.

export default async function IntegrationsPage() {
  const session = await auth();
  if (!session?.user?.teamId) redirect("/dashboard");
  const roles = session.user.roles;
  const discord = roles.some((r) => DISCORD_ADMIN_ROLES.includes(r));
  const email = roles.some((r) => EMAIL_ADMIN_ROLES.includes(r));
  if (!discord && !email) redirect("/dashboard");

  const [configs, server] = await Promise.all([
    discord ? prisma.discordConfig.findMany({ where: { teamId: session.user.teamId }, select: { audience: true } }) : [],
    email ? prisma.teamEmailServer.findUnique({ where: { teamId: session.user.teamId }, select: { enabled: true, fromEmail: true, lastError: true, lastErrorAt: true, lastSentAt: true } }) : null,
  ]);
  const student = configs.some((c) => c.audience === "STUDENT");
  const parent = configs.some((c) => c.audience === "PARENT");
  const emailFailing = !!server?.lastErrorAt && (!server.lastSentAt || server.lastErrorAt > server.lastSentAt);

  const items: { title: string; href?: string; desc: string; status: React.ReactNode }[] = [
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
      desc:  "Match schedules, results and rankings on the competition pages. Set up for the whole app by whoever hosts it (the TBA_API_KEY setting); link each competition to its event in Season settings.",
      status: tbaConfigured() ? <Badge variant="success">Connected</Badge> : <Badge variant="neutral">Not set up — links only</Badge>,
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
