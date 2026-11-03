import Link from "next/link";
import { appUrl } from "@/lib/app-url";

// The technical setup behind each integration — for whoever hosts the site (Vercel settings,
// Google Cloud, Discord, GitHub) and the Head Mentors / Integration Admins who connect a team.
// Kept apart from the everyday guide. The addresses shown are this site's.

export const dynamic = "force-dynamic";

const SECTIONS = [
  { id: "overview",   title: "Who sets up what" },
  { id: "site",       title: "Site settings (environment variables)" },
  { id: "jobs",       title: "Background jobs (GitHub Actions)" },
  { id: "gmail",      title: "Team email — Gmail / Google Workspace" },
  { id: "smtp",       title: "Team email — other providers" },
  { id: "discord",    title: "Discord" },
  { id: "tba",        title: "The Blue Alliance" },
  { id: "nexus",      title: "FRC Nexus" },
  { id: "push",       title: "Push notifications" },
  { id: "storage",    title: "Storage & housekeeping (Vercel)" },
  { id: "security",   title: "How your data is protected" },
];

export default function IntegrationGuidePage() {
  const base = appUrl();
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <nav className="text-small text-(--color-text-secondary) mb-1">
          <Link href="/help" className="hover:text-(--color-primary)">Help &amp; guide</Link>
          <span className="mx-2">›</span>Integration setup
        </nav>
        <h1 className="text-h1 text-(--color-text-primary)">Integration setup guide</h1>
        <p className="text-body text-(--color-text-secondary) mt-1">
          The technical steps behind each connection — email, Discord, The Blue Alliance, Nexus, push notifications and
          background jobs. For whoever hosts the site and the Head Mentors and Integration Admins who connect a team. The
          addresses below are this site&apos;s (<code className="rounded bg-(--color-surface-overlay) px-1 text-xs">{base}</code>);
          if you also run a test copy, repeat the steps with its address.
        </p>
      </div>

      <nav aria-label="Contents" className="card">
        <ol className="grid gap-1 sm:grid-cols-2 text-sm list-decimal pl-5">
          {SECTIONS.map((s) => <li key={s.id}><a href={`#${s.id}`} className="text-(--color-secondary) hover:underline">{s.title}</a></li>)}
        </ol>
      </nav>

      <Section id="overview" title="Who sets up what">
        <Table head={["Who", "Where", "What"]} rows={[
          ["Whoever hosts the site", "Vercel → Project → Settings → Environment Variables", "Keys shared by every team: sign-in, email service, push, storage, Discord bot, a fallback TBA key. Redeploy after changing them."],
          ["Whoever hosts the site", "GitHub → repository → Settings → Secrets and variables → Actions", "APP_URL and CRON_SECRET, so the reminder and live-update jobs run."],
          ["Whoever hosts the site", "Google Cloud Console, Discord Developer Portal", "The Google sign-in / Gmail app and the Discord bot."],
          ["Head Mentor or Integration Admin", "Settings → Integrations", "The team's own connections: its Gmail or mail server, its Discord servers and channels, its TBA and Nexus keys and webhooks."],
        ]} />
        <p>Secrets entered in the app (passwords, tokens, keys) are stored encrypted and never shown again in full.</p>
      </Section>

      <Section id="site" title="Site settings (environment variables)">
        <p>Set in Vercel for Production (and Preview, for the test site). <b>Required</b> ones are needed to run at all; the rest turn features on.</p>
        <Table head={["Variable", "What it's for"]} rows={[
          ["DATABASE_URL (required)", "The Postgres database (e.g. Neon)."],
          ["AUTH_SECRET (required)", "Signs sign-in sessions. A long random string (e.g. openssl rand -base64 32). Also encrypts stored secrets unless EMAIL_CONFIG_KEY is set."],
          ["AUTH_URL", `The site's address (${base}) — keeps sign-in, emailed links and webhook addresses consistent. Without it, Vercel's own address is used.`],
          ["EMAIL_CONFIG_KEY", "Optional separate key for encrypting stored secrets (mail passwords, Google, TBA, Nexus). Changing it makes saved secrets unreadable — they're entered again."],
          ["GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET", "Sign in with Google, and Connect with Google for Gmail team email (see Gmail below)."],
          ["DISCORD_APPLICATION_ID, DISCORD_PUBLIC_KEY, DISCORD_BOT_TOKEN", "The Discord bot (see Discord below)."],
          ["DISCORD_CLIENT_SECRET", "Sign in with Discord (uses DISCORD_APPLICATION_ID as the client ID, or DISCORD_CLIENT_ID)."],
          ["RESEND_API_KEY, EMAIL_FROM", "The app's own email (resend.com) — account emails, and the fallback for teams without their own. EMAIL_FROM like FRC Manager <noreply@yourdomain>, on a domain verified in Resend."],
          ["VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT", "Push notifications (see Push below)."],
          ["BLOB_READ_WRITE_TOKEN", "Tool photos (Vercel Blob — added automatically when you create a Blob store for the project)."],
          ["CRON_SECRET", "Protects the background job addresses; the same value goes in the GitHub secret."],
          ["TBA_API_KEY", "Optional shared The Blue Alliance key, used by teams that haven't added their own."],
          ["DEFAULT_TIMEZONE", "Time zone for teams that haven't set one (default America/New_York)."],
          ["LEGAL_CONTACT_EMAIL", "Contact address on the Terms and Privacy pages."],
          ["TEST_SITE", "Set to 1 to mark a copy as the test site (hazard stripe, TEST tag)."],
        ]} />
      </Section>

      <Section id="jobs" title="Background jobs (GitHub Actions)">
        <p>Reminders, digests, live competition updates and clean-up run from GitHub Actions on a schedule, calling the site:</p>
        <Table head={["Workflow", "Runs", "Calls"]} rows={[
          ["Notification reminders", "Hourly (:05)", `${base}/api/cron/notifications`],
          ["Frequent updates", "Every 5 minutes", `${base}/api/cron/frequent`],
        ]} />
        <Steps>
          <li>Pick a long random value and set it as <code>CRON_SECRET</code> in Vercel.</li>
          <li>In GitHub → the repository → Settings → Secrets and variables → Actions, add <code>APP_URL</code> = <code>{base}</code> and <code>CRON_SECRET</code> = the same value.</li>
          <li>Actions tab → each workflow → <b>Run workflow</b> to check it (a 401 means the secrets don&apos;t match).</li>
        </Steps>
        <p className="text-(--color-text-secondary)">GitHub runs schedules on a best-effort basis — a few minutes late is normal.</p>
      </Section>

      <Section id="gmail" title="Team email — Gmail / Google Workspace">
        <p>
          Teams connect Gmail with <b>Connect with Google</b> (Settings → Integrations → Team email). FRC Manager gets one permission —
          sending email (<code>gmail.send</code>) — and can&apos;t read the mailbox. It uses the same Google Cloud project as Sign in with Google.
        </p>
        <H3>One-time setup in Google Cloud (whoever hosts the site)</H3>
        <Steps>
          <li>Open <a className="link" href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer">console.cloud.google.com</a> and pick the project whose OAuth client is in <code>GOOGLE_CLIENT_ID</code>.</li>
          <li><b>APIs &amp; Services → Library</b> → search <b>Gmail API</b> → <b>Enable</b>.</li>
          <li><b>APIs &amp; Services → Credentials</b> → the OAuth 2.0 client → <b>Authorized redirect URIs</b> → add <code>{base}/api/integrations/gmail/callback</code> (and the same path on any other copy, like the test site). Save.</li>
          <li><b>Google Auth Platform → Data access</b> (or OAuth consent screen → Scopes) → <b>Add or remove scopes</b> → add <code>https://www.googleapis.com/auth/gmail.send</code>. Save.</li>
          <li><b>Audience / Publishing status</b> — pick one:
            <ul className="list mt-1">
              <li><b>Testing</b> — only accounts listed under <b>Test users</b> can connect, and Google ends the connection after <b>7 days</b>. Good for trying it out; not for real use.</li>
              <li><b>In production</b> — anyone can connect. Because <code>gmail.send</code> is a sensitive scope, submit the app for <b>Google verification</b> (privacy policy, app homepage, a short video of the Connect flow). Until it&apos;s verified, people see an &quot;unverified app&quot; warning and the number of accounts is limited.</li>
              <li><b>Internal</b> — only if the project belongs to a Google Workspace organization and every team account is in it. No verification needed.</li>
            </ul>
          </li>
        </Steps>
        <H3>Connecting a team (Head Mentor or Integration Admin)</H3>
        <Steps>
          <li>Settings → Integrations → <b>Team email</b> → provider <b>Gmail / Google Workspace</b> → <b>Connect with Google</b>.</li>
          <li>Sign in with the team&apos;s account and allow <b>Send email on your behalf</b>.</li>
          <li>Back in the app, set the <b>From name</b>, and a <b>From email</b> if you send as an alias (it must be set up in Gmail → Settings → Accounts → Send mail as). Then <b>Send me a test email</b>.</li>
        </Steps>
        <p className="text-(--color-text-secondary)">
          Remove (or reconnecting another account) revokes the access with Google. Gmail sends about 500 emails a day from a free account and
          2,000 from Workspace; past that, FRC Manager&apos;s own email sends the rest.
        </p>
      </Section>

      <Section id="smtp" title="Team email — other providers">
        <p>Outlook / Microsoft 365, Yahoo, iCloud, Zoho or any mail server connect with a server, username and password (Settings → Integrations → Team email). Saving logs in to check them.</p>
        <ul className="list">
          <li><b>Yahoo</b> and <b>iCloud</b> need an <b>app password</b> (Yahoo Account Security → Generate app password; appleid.apple.com → Sign-In and Security → App-Specific Passwords).</li>
          <li><b>Microsoft 365</b>: the admin may need to turn on <b>Authenticated SMTP</b> for the mailbox (Microsoft 365 admin → Users → the mailbox → Mail → Manage email apps).</li>
          <li>The <b>From email</b> must be the account&apos;s address or an alias it can send as.</li>
        </ul>
      </Section>

      <Section id="discord" title="Discord">
        <H3>The bot (whoever hosts the site, once)</H3>
        <Steps>
          <li><a className="link" href="https://discord.com/developers/applications" target="_blank" rel="noopener noreferrer">discord.com/developers/applications</a> → <b>New Application</b>.</li>
          <li><b>General Information</b>: copy the <b>Application ID</b> → <code>DISCORD_APPLICATION_ID</code> and the <b>Public Key</b> → <code>DISCORD_PUBLIC_KEY</code>. Set <b>Interactions Endpoint URL</b> to <code>{base}/api/discord/interactions</code> (Discord checks it when you save, so do it after deploying with the keys).</li>
          <li><b>Bot</b> → <b>Reset Token</b> → copy it → <code>DISCORD_BOT_TOKEN</code>.</li>
          <li>For Sign in with Discord: <b>OAuth2</b> → copy the <b>Client Secret</b> → <code>DISCORD_CLIENT_SECRET</code>, and add the redirect <code>{base}/api/auth/callback/discord</code>.</li>
          <li>Redeploy, then a super admin taps <b>Register Commands</b> on Settings → Integrations → Discord.</li>
        </Steps>
        <H3>A team&apos;s servers (Head Mentor, Team Leadership or Integration Admin)</H3>
        <Steps>
          <li>Invite the bot to the server: <b>OAuth2 → URL Generator</b> → scopes <b>bot</b> and <b>applications.commands</b>, permissions <b>Send Messages</b>, <b>Embed Links</b> and <b>Read Message History</b> → open the link.</li>
          <li>In Discord, turn on <b>Developer Mode</b> (User Settings → Advanced). Right-click the server → <b>Copy Server ID</b>; right-click each channel → <b>Copy Channel ID</b>.</li>
          <li>Settings → Integrations → <b>Discord</b>: paste the Server ID and the channel IDs (build alerts, orders, announcements, volunteers…) for the <b>student</b> server, and optionally a separate <b>parent</b> server. Save, then <b>Test</b>.</li>
          <li>Members link their accounts with <code>/link</code> in Discord.</li>
        </Steps>
      </Section>

      <Section id="tba" title="The Blue Alliance">
        <p>Match schedules, results, history and live competition notifications. Each team uses its own key (Settings → Integrations → The Blue Alliance &amp; Nexus); <code>TBA_API_KEY</code> is a shared fallback.</p>
        <H3>Read API key</H3>
        <Steps>
          <li>Sign in at <a className="link" href="https://www.thebluealliance.com/account" target="_blank" rel="noopener noreferrer">thebluealliance.com/account</a> → <b>Read API Keys</b> → add one (any description).</li>
          <li>Paste it under <b>Read API key</b> and <b>Save keys</b> — it&apos;s checked with TBA first.</li>
          <li>Link each competition to its event in <Link className="link" href="/settings/season">Season settings</Link>.</li>
        </Steps>
        <H3>Webhook (optional — updates in seconds instead of within 5 minutes)</H3>
        <Steps>
          <li>Copy the team&apos;s webhook URL from the settings page (it ends in a private code: <code>{base}/api/webhooks/tba/…</code>).</li>
          <li>myTBA → Account → <b>Webhooks</b> → <b>Add</b> → paste the URL. TBA makes a <b>secret</b> and sends a <b>verification code</b> to the app.</li>
          <li>On the settings page tap <b>Check for code</b>, copy it, and enter it in myTBA under <b>Verify</b>.</li>
          <li>Copy the secret myTBA shows into <b>Webhook secret</b> and save.</li>
          <li>In myTBA, <b>favorite your team</b> with notifications on, so its updates are sent.</li>
        </Steps>
      </Section>

      <Section id="nexus" title="FRC Nexus">
        <p>&quot;Now queuing&quot; alerts at events that use Nexus. Without it, next-match alerts come about 20 minutes before the predicted match time.</p>
        <Steps>
          <li>Get an API key at <a className="link" href="https://frc.nexus/api" target="_blank" rel="noopener noreferrer">frc.nexus/api</a> and paste it under <b>API key</b> (Settings → Integrations → The Blue Alliance &amp; Nexus).</li>
          <li>Optional, for instant alerts: register the team&apos;s Nexus webhook URL there (<code>{base}/api/webhooks/nexus/…</code>, shown on the settings page) for your team number, and paste the <b>token</b> Nexus gives you under <b>Webhook token</b>.</li>
        </Steps>
      </Section>

      <Section id="push" title="Push notifications">
        <Steps>
          <li>Run <code>npx web-push generate-vapid-keys</code> once.</li>
          <li>Set <code>VAPID_PUBLIC_KEY</code> and <code>VAPID_PRIVATE_KEY</code> in Vercel, and <code>VAPID_SUBJECT</code> to <code>mailto:</code> plus a contact address. Redeploy.</li>
          <li>Keep the same keys afterward — changing them stops push on every device until each person turns it on again.</li>
        </Steps>
        <p className="text-(--color-text-secondary)">On iPhone and iPad, push only works for the app added to the Home Screen.</p>
      </Section>

      <Section id="storage" title="Storage & housekeeping (Vercel)">
        <ul className="list">
          <li><b>Functions storage</b> grows with every deployment Vercel keeps. Set Project → Settings → Security → <b>Deployment Retention Policy</b> (e.g. 1 week for previews) and delete old deployments now and then. The <code>dev</code> branch isn&apos;t deployed (vercel.json).</li>
          <li><b>Blob</b> holds tool photos; they&apos;re shrunk before upload and unused ones are cleared daily.</li>
          <li>The <b>database</b> clears old change history (a year), read notifications (90 days) and logs on its own. If it&apos;s on Neon, delete old <b>preview branches</b> and keep history retention short.</li>
        </ul>
      </Section>

      <Section id="security" title="How your data is protected">
        <p>The safeguards in place, in plain terms. For questions or to report a problem, use <b>Give feedback</b> or the contact on the <Link className="link" href="/privacy">Privacy Policy</Link>.</p>
        <H3>In transit and at rest</H3>
        <ul className="list">
          <li>Every connection to the site is encrypted (HTTPS only), and browsers are told never to use an unencrypted connection.</li>
          <li>The database and file storage are run by the hosting providers with encryption at rest and their own access controls.</li>
          <li>Secrets a team enters — mail passwords, the Google connection, TBA and Nexus keys, webhook secrets — are encrypted before they&apos;re saved, with a key kept outside the database. They&apos;re never shown again in full or sent to anyone&apos;s browser.</li>
        </ul>
        <H3>Accounts and sign-in</H3>
        <ul className="list">
          <li>Passwords are stored only as salted one-way hashes — nobody, including the people who run the site, can read them.</li>
          <li>Repeated failed sign-ins are slowed down, and email links (confirming an address, resetting a password, invites) work once and expire.</li>
          <li>Changing your password, or <b>Sign out everywhere</b> on your Profile, ends every other session.</li>
          <li>New accounts are approved by the team before they can see anything.</li>
        </ul>
        <H3>Who can see what</H3>
        <ul className="list">
          <li>Every team&apos;s data is kept separate; each request is checked against the signed-in person&apos;s team and roles.</li>
          <li>Roles limit what each person can do (see <Link className="link" href="/settings/roles">Roles explained</Link>). Parent accounts are view-only.</li>
          <li>More sensitive things are limited further: expense receipts only to the submitter, Treasurers and Head Mentors; phone numbers only to volunteer coordinators and Head Mentors; member history to team leaders.</li>
          <li>Tool photos are stored as unlisted links — not searchable or listed anywhere, but anyone given a link can open it, so don&apos;t photograph anything private.</li>
        </ul>
        <H3>Connections to other services</H3>
        <ul className="list">
          <li>Each integration asks for the least it needs: Gmail can only <b>send</b> (not read) mail, The Blue Alliance and Nexus keys only read event data, and the Discord bot only posts and answers its own commands.</li>
          <li>Messages coming in from Discord, The Blue Alliance and Nexus are checked to be genuine (signatures or tokens) before anything is done with them, and each team&apos;s webhook address is private to it.</li>
          <li>Removing a connection deletes its stored secret, and revokes the access where the service allows it (Google).</li>
        </ul>
        <H3>Uploads, records and clean-up</H3>
        <ul className="list">
          <li>Uploaded files are checked by their actual contents and size, not by their name.</li>
          <li>Changes to orders, tasks, meetings, members, expenses and broadcasts are recorded in the <b>Audit log</b> — who changed what, and when.</li>
          <li>Old data is cleared on a schedule: change history after a year, read notifications after 90 days, logs and expired links sooner. Deleting a member with history erases their personal details.</li>
          <li>The site sends security headers that stop it being framed by other sites and limit what scripts can run.</li>
        </ul>
      </Section>
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="card scroll-mt-24 space-y-3 text-sm text-(--color-text-primary) [&_.list]:list-disc [&_.list]:pl-5 [&_.list]:space-y-1.5 [&_.link]:text-(--color-secondary) [&_.link]:underline [&_code]:rounded [&_code]:bg-(--color-surface-overlay) [&_code]:px-1 [&_code]:text-xs [&_code]:break-all">
      <h2 className="text-h2 text-(--color-text-primary)">{title}</h2>
      {children}
    </section>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="text-h3 text-(--color-text-primary) pt-1">{children}</h3>;
}

function Steps({ children }: { children: React.ReactNode }) {
  return <ol className="list-decimal pl-5 space-y-1.5">{children}</ol>;
}

function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-md border border-(--color-border)">
      <table className="w-full text-left text-sm">
        <thead className="bg-(--color-surface-overlay)">
          <tr>{head.map((h) => <th key={h} className="px-3 py-2 font-semibold">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-(--color-border)">
          {rows.map((r) => (
            <tr key={r[0] + r[1]}>{r.map((c, i) => <td key={i} className={`px-3 py-2 align-top ${i === 0 ? "font-medium break-words" : "text-(--color-text-secondary)"}`}>{c}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
