import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageTitle } from "@/components/PageHeader";
import { EmailServerForm } from "./EmailServerForm";

// Settings → Email (Head Mentors): send the team's emails from its own mail account.

export default async function EmailSettingsPage() {
  const session = await auth();
  if (!session?.user?.teamId) redirect("/dashboard");
  if (!session.user.roles.includes("HEAD_MENTOR")) redirect("/dashboard");

  const [server, team] = await Promise.all([
    prisma.teamEmailServer.findUnique({ where: { teamId: session.user.teamId } }),
    prisma.team.findUnique({ where: { id: session.user.teamId }, select: { teamNumber: true } }),
  ]);

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div>
        <PageTitle help="notifications">Team email</PageTitle>
        <p className="text-body text-(--color-text-secondary) mt-1">
          Send the team&apos;s emails — notifications like volunteer shifts, invites and welcome emails — from your own email
          account (for example the team&apos;s Gmail), so they come from an address families recognize. Account emails
          (confirming an address, resetting a password) still come from FRC Manager, and if your server ever fails, FRC
          Manager&apos;s email sends the message instead.
        </p>
      </div>
      <EmailServerForm
        teamNumber={team?.teamNumber ?? null}
        saved={server && {
          provider: server.provider, host: server.host, port: server.port, security: server.security as "ssl" | "starttls",
          username: server.username, fromName: server.fromName, fromEmail: server.fromEmail, enabled: server.enabled,
          lastSentAt: server.lastSentAt?.toISOString() ?? null,
          lastError: server.lastError, lastErrorAt: server.lastErrorAt?.toISOString() ?? null,
        }}
      />
    </div>
  );
}
