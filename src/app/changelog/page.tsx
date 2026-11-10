import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";
import { APP_VERSION } from "@/lib/version";

export const metadata: Metadata = { title: "What's new — FRC Manager" };

// What has shipped, one entry per 1.x release with its patch releases rolled in. Written for
// anyone (signed in or not) — plain language, no internals. CHANGELOG.md has every release.
// When a new 1.x ships, add it at the top; a patch release adds to its 1.x entry.
type Release = { version: string; date: string; title: string; items: React.ReactNode[] };

const RELEASES: Release[] = [
  {
    version: "1.19", date: "November 2026", title: "Shared order drafts",
    items: [
      <><b>Order drafts are shared with the team.</b> Whoever starts a draft can invite teammates, who can edit it, add items (also from Inventory) and submit it.</>,
      <><b>Fill says why a link couldn&apos;t be read</b> — the store asked to slow down, refused, or timed out.</>,
      <><b>Security improvements</b> across sign-up, invites, uploads and exports.</>,
    ],
  },
  {
    version: "1.18", date: "November 2026", title: "Ordering from inventory, faster photos",
    items: [
      <><b>Order from inventory onto a draft</b> — pick one of your open drafts, start a new one, or submit it straight away.</>,
      <><b>Photos load faster:</b> uploads are resized and lists use small thumbnails. Tapping a photo opens it straight away.</>,
      <><b>Renaming an item renames its whole group</b> (its full stock and partial pieces).</>,
      <><b>Certification matrix on phones</b> as a list of members, or who has a given certification.</>,
      <><b>New app icons</b> (red &amp; blue bumpers), a home-button logo, and the chosen icon works on iOS 26 home screens.</>,
      <>Robot picker only when there&apos;s more than one robot to choose; proper buttons on every row action.</>,
      <>Smoother touch-and-hold dragging on iPhones; WCP family pages fill in again.</>,
    ],
  },
  {
    version: "1.17", date: "November 2026", title: "Inventory sub-categories",
    items: [
      <><b>Sub-categories</b> (Gears, Belts, Pulleys… under Mechanical) shown as sub-folders. Every team starts with a suggested set.</>,
      <>A material and its partial pieces are one row in the list.</>,
    ],
  },
  {
    version: "1.16", date: "November 2026", title: "Inventory folders",
    items: [
      <><b>A folder per category</b> — drag items between folders to file them, and close the ones you don&apos;t need.</>,
      <>Filter by location and item type; new items start in Uncategorized.</>,
      <><b>Full-screen photos</b> with tap-to-zoom.</>,
    ],
  },
  {
    version: "1.15", date: "November 2026", title: "Partial pieces & inventory photos",
    items: [
      <><b>Partial pieces</b> for part-used material (offcuts, part-used spools), each with its own photo, label code and amount left — managed on its item.</>,
      <><b>Inventory grouped like tools</b>, with photos and QR label codes.</>,
      <>Photos are stored in the app and shown only to the team.</>,
    ],
  },
  {
    version: "1.14", date: "November 2026", title: "Order comments, price checks and split orders",
    items: [
      <><b>Comments on orders</b>, with everyone on the order notified.</>,
      <><b>Check prices</b> looks every item up again and shows what changed.</>,
      <><b>Split a vendor&apos;s items</b> over several orders, each with its own vendor order number, tax and shipping.</>,
      <><b>Edit order</b> records exactly what changed and tells everyone on the order; <b>Change status</b> applies to the items you tick.</>,
      <><b>Import CSV</b> into a new order; Mouser links fill in.</>,
      <><b>Share links</b> for orders, tasks, expenses, competitions, meetings and shifts.</>,
      <>The same page header everywhere, with a <b>⋯ More</b> menu.</>,
    ],
  },
  {
    version: "1.13", date: "November 2026", title: "Real names & parents",
    items: [
      <>Sign-up asks for a first and last name; <b>parents name their students</b> and are linked to them.</>,
      <><b>Budget changes in the audit log</b>, and categories can be marked <b>Not used</b>.</>,
      <><b>Order emails</b> for orders waiting on you and updates on your own.</>,
      <>Snooze competition alerts for days at a time; Home counts only your own overdue tasks.</>,
    ],
  },
  {
    version: "1.12", date: "November 2026", title: "App tour & FRC basics",
    items: [
      <><b>App tour</b> on first visit, different for parents, students, mentors and Head Mentors.</>,
      <><b>FRC basics</b> for families new to FRC: the season, competitions, how a team works and a glossary.</>,
      <>Invite by name and email, pasted straight from an email&apos;s To: line.</>,
    ],
  },
  {
    version: "1.11", date: "November 2026", title: "Team email for Google Workspace",
    items: [
      <>Send the team&apos;s email through a <b>Google Workspace service account</b>.</>,
      <><b>Sending limits</b> on every team&apos;s email, with a heads-up before they&apos;re reached.</>,
    ],
  },
  {
    version: "1.10", date: "November 2026", title: "Connect Gmail with Google",
    items: [
      <><b>Connect with Google</b> for team email — send-only access, no app password.</>,
      <><b>Integration setup guide</b> for email, Discord, The Blue Alliance, Nexus and push.</>,
    ],
  },
  {
    version: "1.9", date: "November 2026", title: "Competitions",
    items: [
      <><b>Competition pages:</b> our next match and bumper color, our matches and scores, rank and alliance, livestream and links to follow along.</>,
      <><b>Live notifications:</b> match schedule, now queuing, results, alliance selection and awards.</>,
      <><b>Team history</b> of every season and event.</>,
      <>Members in <b>several sub-teams</b>, and sub-team meetings.</>,
      <><b>Broadcast messages</b> to students, parents and mentors — in the app, on Discord and by email.</>,
      <><b>Give feedback</b> from any page; the new <b>Slice</b> color scheme.</>,
      <>Home and the phone tab bar put what matters to you first; volunteer requests appear on Home.</>,
    ],
  },
  {
    version: "1.8", date: "October 2026", title: "Expenses & refunds",
    items: [
      <><b>Expenses &amp; refunds:</b> anyone submits an expense with receipts; Treasurers review and pay back.</>,
      <><b>Parent Discord server</b> and the Integration Admin role.</>,
      <><b>Present on TV:</b> a full-screen task board and timeline; sticky notes colored by sub-team.</>,
      <>Raised + pledged on the budget chart; Terms of Service and a footer on every page.</>,
    ],
  },
  {
    version: "1.7", date: "October 2026", title: "Volunteers, parents & change history",
    items: [
      <><b>Volunteers:</b> meeting coverage, cleared adults, sign-ups, coordinator requests and reminders.</>,
      <><b>Parent</b> (view-only) and <b>Volunteer Coordinator</b> roles.</>,
      <><b>Change history</b> for orders, tasks, meetings and members, plus a single <b>Audit log</b>.</>,
      <><b>Tax &amp; shipping per vendor</b>; fix and resubmit denied orders.</>,
      <><b>Team email:</b> notifications come from the team&apos;s own account.</>,
    ],
  },
  {
    version: "1.6", date: "October 2026", title: "Kickoff date",
    items: [
      <>Seasons have a <b>Kickoff</b> date of their own; the Home countdown follows the season step by step.</>,
    ],
  },
  {
    version: "1.5", date: "October 2026", title: "Budget goal, raised and spent",
    items: [
      <><b>Goal, raised and spent</b> charted over the season, with pledges tracked.</>,
      <>Set up future seasons ahead of time; several meetings on one day.</>,
    ],
  },
  {
    version: "1.4", date: "October 2026", title: "Task dependencies",
    items: [
      <>Tasks <b>scheduled after their prerequisites</b>, moving when those move.</>,
      <>The <b>Standard FRC season</b> template.</>,
      <>Clear form errors that say which field is wrong and why.</>,
    ],
  },
  {
    version: "1.3", date: "October 2026", title: "Task details & presentations",
    items: [
      <><b>Markdown details</b> on tasks and template tasks.</>,
      <>A new <b>Gantt chart</b>, and <b>▶ Present</b> for templates as full-screen slides.</>,
    ],
  },
  {
    version: "1.2", date: "October 2026", title: "Budget categories & Buyer",
    items: [
      <><b>Budget categories</b> on every order and item.</>,
      <>The <b>Buyer</b> role; password reset, email confirmation and account security settings.</>,
    ],
  },
  {
    version: "1.1", date: "October 2026", title: "Discord sign-in & tool locations",
    items: [
      <><b>Sign in with Discord</b>.</>,
      <><b>Tool locations</b> with barcodes, and <b>competition pack lists</b>.</>,
      <>Welcome emails for newly approved members.</>,
    ],
  },
  {
    version: "1.0", date: "October 2026", title: "First release",
    items: [
      <>Team accounts with roles, invites and approvals.</>,
      <>Seasons, meetings, tasks (Kanban, list and Gantt), templates and a calendar feed.</>,
      <>Inventory, tools with checkout, orders with approvals and product lookup, and a budget.</>,
      <>Safety records, certifications, inspections and the robot fleet.</>,
      <>Notifications in the app, by push and in Discord; installable on phones.</>,
    ],
  },
];

export default async function ChangelogPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  // Opened from the footer in the app (its own window or tab, or over the home-screen app): show a ✕
  const fromApp = (await searchParams).from === "app";
  return (
    <LegalPage title="What's new" updated={`v${APP_VERSION}`} updatedLabel="Current version" closable={fromApp}>
      <p>What has shipped in FRC Manager, release by release, newest first.</p>
      {RELEASES.map((r) => (
        <section key={r.version} id={`v${r.version}`} className="space-y-2">
          <h2>
            {r.version} — {r.title}
            <span className="ml-2 text-small font-normal text-(--color-text-secondary)">{r.date}</span>
          </h2>
          <ul>
            {r.items.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        </section>
      ))}
    </LegalPage>
  );
}
