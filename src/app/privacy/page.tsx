import type { Metadata } from "next";
import { LegalPage, LegalContact } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Privacy Policy — FRC Manager" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="October 4, 2026">
      <p>
        FRC Manager is a team management app for FIRST Robotics Competition (FRC) teams, covering tasks, tools,
        inventory, orders, budgets, meetings and safety records. This policy explains what information the app
        stores, why, and who can see it. It also covers the FRC Manager Discord bot.
      </p>

      <h2>Information we store</h2>
      <ul>
        <li><b>Your account:</b> your name, email address, and either a securely hashed password or, if you sign in with Google, your Google account identifier. Also your team, your roles, account status, and the note you add when registering.</li>
        <li><b>Team records you create or update:</b> tasks, task templates, meetings, robots, tools and checkouts, certifications, inventory, orders and order items (including vendor links and tracking links), budgets and expenses, inspection checklists and safety incident reports. Each record may note who created or changed it and when.</li>
        <li><b>Photos you upload</b>, such as tool photos.</li>
        <li><b>Notification settings:</b> which notifications you want, your quiet hours and time zone, and — if you turn on push notifications — the push address and keys your browser gives us for each device.</li>
        <li><b>Discord, if you use it:</b> when you link your account, your Discord user ID and username. When anyone uses the bot, the command name, its options, whether it worked and when, kept as a log for the team. Team leaders also store the server and channel IDs the bot posts to.</li>
        <li><b>Technical data:</b> a sign-in cookie that keeps you logged in, and preferences stored in your browser (such as light or dark mode and the selected robot). Our hosting provider keeps standard server logs, which include IP addresses and browser details.</li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>To run the app&apos;s features for your team — for example, showing who has a tool checked out or which orders are waiting for approval.</li>
        <li>To send the in-app, push and Discord notifications you&apos;ve chosen, and reminders such as meeting times or orders waiting on you.</li>
        <li>To let you use the app from Discord after you link your account.</li>
        <li>To keep the service secure and fix problems.</li>
      </ul>
      <p>We do not sell your information, show ads, or use third-party analytics or advertising trackers.</p>

      <h2>Who can see it</h2>
      <ul>
        <li><b>Your team:</b> records are visible to members of your team, limited by role. For example, only leaders can manage members, and only Head Mentors can change the purchase workflow. Other teams using FRC Manager cannot see your team&apos;s data.</li>
        <li><b>Your team&apos;s Discord server:</b> bot replies and notifications posted in your server are visible to its members, under Discord&apos;s own rules.</li>
        <li><b>Service providers</b> that host or deliver the app on our behalf: Vercel (hosting and photo storage), Neon (database), Discord (for Discord features), Google (only if you sign in with Google), and your browser maker&apos;s push service — for example Apple, Google or Mozilla — which delivers push notifications to your device.</li>
        <li>When someone pastes a product link into an order, the app fetches that public product page to fill in its details. No personal information is sent to the vendor.</li>
        <li>We may disclose information if the law requires it.</li>
      </ul>

      <h2>How long we keep it</h2>
      <p>
        Team records are kept for as long as your team uses FRC Manager, so the team keeps its history across seasons.
        Unlinking Discord (the <code>/unlink</code> command) stops the bot acting for you; past command logs are kept with the
        team&apos;s records. To have your account or personal information deleted, <LegalContact />.
      </p>

      <h2>Students and young people</h2>
      <p>
        Many FRC team members are under 18. Accounts are approved and managed by each team&apos;s mentors and leaders, and
        we only collect what&apos;s needed to run the team. Parents or guardians who have questions, or want a student&apos;s
        information changed or deleted, should <LegalContact />.
      </p>

      <h2>Security</h2>
      <p>
        The app is only available over encrypted (HTTPS) connections, passwords are stored hashed rather than as plain
        text, and every request checks that you belong to the team and have the role needed for what you&apos;re doing.
        No system is perfectly secure, so please use a strong, unique password.
      </p>

      <h2>Your choices</h2>
      <ul>
        <li>Change which notifications you get, and turn push on or off per device, in Settings → Notifications.</li>
        <li>Update your name and email in Settings → Profile.</li>
        <li>Unlink Discord at any time with <code>/unlink</code>.</li>
        <li>To ask what information is stored about you, or to have it corrected or deleted, <LegalContact />.</li>
      </ul>

      <h2>Changes</h2>
      <p>If this policy changes, we&apos;ll update the date at the top of this page.</p>

      <h2>Contact</h2>
      <p>For privacy questions, <LegalContact />.</p>

      <p className="text-small text-(--color-text-secondary)">
        FRC Manager is not affiliated with or endorsed by FIRST® or Discord.
      </p>
    </LegalPage>
  );
}
