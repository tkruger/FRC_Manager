import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageTitle } from "@/components/PageHeader";
import { EmailServerForm } from "./EmailServerForm";
import { EMAIL_ADMIN_ROLES } from "@/lib/rbac";
import { gmailConfigured } from "@/lib/gmail-api";

/** What the Gmail connect flow came back with (?gmail=…) */
const GMAIL_RESULT: Record<string, { ok: boolean; text: string }> = {
  connected:   { ok: true,  text: "Gmail is connected — the team's emails now come from it." },
  cancelled:   { ok: false, text: "Connecting Gmail was cancelled." },
  expired:     { ok: false, text: "That sign-in took too long or came from somewhere else — try Connect with Google again." },
  denied:      { ok: false, text: "Only Head Mentors and Integration Admins can connect the team's email." },
  unavailable: { ok: false, text: "Google sign-in isn't set up for this site (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET)." },
  failed:      { ok: false, text: "Google didn't connect." },
};

// Settings → Email (Head Mentors, Integration Admins): send the team's emails from its own mail account.

export default async function EmailSettingsPage({ searchParams }: { searchParams: Promise<{ gmail?: string; reason?: string }> }) {
  const { gmail, reason } = await searchParams;
  const gmailResult = gmail ? GMAIL_RESULT[gmail] : undefined;
  const session = await auth();
  if (!session?.user?.teamId) redirect("/dashboard");
  if (!session.user.roles.some((r) => EMAIL_ADMIN_ROLES.includes(r))) redirect("/dashboard");

  const [server, team] = await Promise.all([
    prisma.teamEmailServer.findUnique({ where: { teamId: session.user.teamId } }),
    prisma.team.findUnique({ where: { id: session.user.teamId }, select: { teamNumber: true } }),
  ]);

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div>
        <nav className="text-small text-(--color-text-secondary) mb-1">
          <Link href="/settings/integrations" className="hover:text-(--color-primary)">Integrations</Link>
          <span className="mx-2">›</span>Team email
        </nav>
        <PageTitle help="notifications">Team email</PageTitle>
        <p className="text-body text-(--color-text-secondary) mt-1">
          Send the team&apos;s emails — notifications like volunteer shifts, invites and welcome emails — from your own email
          account (for example the team&apos;s Gmail), so they come from an address families recognize. Account emails
          (confirming an address, resetting a password) still come from FRC Manager, and if your server ever fails, FRC
          Manager&apos;s email sends the message instead.
        </p>
      </div>
      {gmailResult && (
        <div className={`rounded-md px-3 py-2 text-sm ${gmailResult.ok ? "bg-(--color-success)/10 text-(--color-success)" : "bg-(--color-danger)/10 text-(--color-danger)"}`}>
          {gmailResult.text}{!gmailResult.ok && reason ? ` ${reason.slice(0, 300)}` : ""}
        </div>
      )}
      <EmailServerForm
        teamNumber={team?.teamNumber ?? null}
        googleAvailable={gmailConfigured()}
        saved={server && {
          provider: server.provider, method: server.method, googleEmail: server.googleEmail,
          host: server.host, port: server.port, security: (server.security ?? "ssl") as "ssl" | "starttls",
          username: server.username, fromName: server.fromName, fromEmail: server.fromEmail, enabled: server.enabled,
          lastSentAt: server.lastSentAt?.toISOString() ?? null,
          lastError: server.lastError, lastErrorAt: server.lastErrorAt?.toISOString() ?? null,
        }}
      />
    </div>
  );
}
