import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { PageTitle } from "@/components/PageHeader";
import { FRC_ADMIN_ROLES } from "@/lib/rbac";
import { open } from "@/lib/security/secret-box";
import { appUrl } from "@/lib/app-url";
import { ensureFrcSettings } from "@/lib/frc/team-keys";
import { FrcSettingsForm } from "./FrcSettingsForm";

// Settings → Integrations → The Blue Alliance & Nexus (Head Mentors, Integration Admins): the team's
// own keys, and its private webhook addresses for instant competition updates.

export default async function FrcSettingsPage() {
  const session = await auth();
  if (!session?.user?.teamId) redirect("/dashboard");
  if (!session.user.roles.some((r) => FRC_ADMIN_ROLES.includes(r))) redirect("/dashboard");

  const s = await ensureFrcSettings(session.user.teamId);
  const base = appUrl();
  const hint = (enc: string | null) => {
    const v = enc ? open(enc) : null;
    return v ? `•••• ${v.slice(-4)}` : null;
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div>
        <nav className="text-small text-(--color-text-secondary) mb-1">
          <Link href="/settings/integrations" className="hover:text-(--color-primary)">Integrations</Link>
          <span className="mx-2">›</span>The Blue Alliance &amp; Nexus
        </nav>
        <PageTitle help="competitions">The Blue Alliance &amp; Nexus</PageTitle>
        <p className="text-body text-(--color-text-secondary) mt-1">
          Your team&apos;s own keys for match schedules, results, history and live notifications. Each team uses its own, so
          nobody shares a limit. The webhooks are optional — they make updates arrive in seconds instead of within about 5 minutes.
        </p>
      </div>
      <FrcSettingsForm
        sharedTbaKey={!!process.env.TBA_API_KEY}
        tbaKey={hint(s.tbaKeyEnc)}
        nexusKey={hint(s.nexusKeyEnc)}
        nexusToken={hint(s.nexusWebhookTokenEnc)}
        tbaWebhook={{
          url: `${base}/api/webhooks/tba/${s.hookId}`,
          secret: s.tbaWebhookSecretEnc ? open(s.tbaWebhookSecretEnc) : null,
          verificationCode: s.tbaVerificationCode,
        }}
        nexusWebhookUrl={`${base}/api/webhooks/nexus/${s.hookId}`}
        lastWebhookAt={s.lastWebhookAt?.toISOString() ?? null}
      />
    </div>
  );
}
