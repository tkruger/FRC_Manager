import Link from "next/link";
import type { HelpTopic } from "@/components/HelpLink";

export const metadata = { title: "Help & guide — FRC Manager" };

// The in-app guide. Pages link here with a "?" icon (HelpLink) to /help#<section>.

const SECTIONS: { id: HelpTopic; title: string }[] = [
  { id: "getting-started", title: "Getting started" },
  { id: "tasks",           title: "Tasks" },
  { id: "templates",       title: "Task templates" },
  { id: "season",          title: "Season, robots & competitions" },
  { id: "calendar",        title: "Meeting calendar" },
  { id: "inventory",       title: "Inventory & the order queue" },
  { id: "purchasing",      title: "Purchase requests & approvals" },
  { id: "budget",          title: "Budget" },
  { id: "tools",           title: "Tools" },
  { id: "safety",          title: "Safety" },
  { id: "fleet",           title: "Robot fleet" },
  { id: "notifications",   title: "Notifications & reminders" },
  { id: "roles",           title: "Roles & permissions" },
  { id: "discord",         title: "Discord" },
];

export default function HelpPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <h1 className="text-h1 text-(--color-text-primary)">Help &amp; guide</h1>
        <p className="text-body text-(--color-text-secondary) mt-1">
          How FRC Manager works, section by section. Look for the <HelpBadge /> icon on a page to jump straight to its part of this guide.
        </p>
      </div>

      <nav aria-label="Contents" className="card">
        <p className="text-xs font-semibold uppercase tracking-wide text-(--color-text-secondary) mb-2">Contents</p>
        <ol className="grid gap-x-6 gap-y-1 sm:grid-cols-2 list-decimal list-inside">
          {SECTIONS.map((s) => (
            <li key={s.id} className="text-sm">
              <a href={`#${s.id}`} className="text-(--color-secondary) hover:underline">{s.title}</a>
            </li>
          ))}
        </ol>
      </nav>

      <Section id="getting-started" title="Getting started">
        <H3>Install it on your phone</H3>
        <Steps>
          <li><b>iPhone / iPad:</b> open the site in Safari, tap <b>Share</b>, then <b>Add to Home Screen</b>. Open it from the home-screen icon — it runs full screen, like an app, and can send push notifications.</li>
          <li><b>Android:</b> open the site in Chrome, tap the <b>⋮</b> menu, then <b>Install app</b> (or <b>Add to Home screen</b>).</li>
        </Steps>
        <H3>Finding your way around</H3>
        <ul className="list">
          <li>On a computer, the main sections are along the top. On a phone they&apos;re in the bar at the bottom — <b>More</b> has the rest.</li>
          <li>The <b>robot picker</b> at the top filters tasks and other lists to one robot. Choose <b>All robots</b> to see everything.</li>
          <li>Your name in the top-right opens your profile, notification settings, this guide and (depending on your role) team settings.</li>
          <li>The bell shows your latest notifications.</li>
        </ul>
      </Section>

      <Section id="tasks" title="Tasks">
        <p>Everything the team needs to get done this season. Switch between three views at the top of the page:</p>
        <ul className="list">
          <li><b>Kanban</b> — cards in columns by status. Drag a card to another column to change its status. <b>Future</b> holds tasks that haven&apos;t started yet.</li>
          <li><b>Gantt</b> — tasks on a timeline from kickoff to Week 0 (only tasks with start and due dates appear).</li>
          <li><b>List</b> — a sortable table.</li>
        </ul>
        <ul className="list">
          <li><b>My tasks / All tasks</b> switches between tasks assigned to you and the whole team. Your choice is remembered.</li>
          <li>Filter by sub-team, priority, assignee or due date (next 7, 14 or 30 days, or a custom range).</li>
          <li>Tap a task to edit it, assign people, add prerequisites or change its status.</li>
          <li>Marking a task <b>Blocked</b> notifies its assignees, Build Leads and Head Mentors.</li>
          <li>The progress card at the top shows how far through the build season you are and how each sub-team is doing. Tap it to collapse it.</li>
        </ul>
      </Section>

      <Section id="templates" title="Task templates">
        <p>
          A template is a reusable list of tasks — like your standard build-season plan — that can be added to the
          current season in one click. Head Mentors, Build Leads and Inventory Admins can create and edit templates; Head Mentors apply them.
        </p>
        <H3>When does each task start?</H3>
        <p>Every template task starts a number of days <b>before</b> (negative) or <b>after</b> (positive) a date in the season:</p>
        <Table
          head={["Starts relative to", "Uses", "Example"]}
          rows={[
            ["Kickoff", "The season's kickoff date", "+3 → 3 days after kickoff"],
            ["Season Week 0 date", "The end of the build season, set in Season settings", "−5 → 5 days before Week 0"],
            ["Practice match", "Competitions designated PracticeMatch1, PracticeMatch2, …", "−1 → day before each practice match"],
            ["Week competition", "Competitions designated Week0, Week1, Week2, …", "−2 → pack the robot 2 days before each event"],
            ["Playoff", "Competitions designated Playoff0, Playoff1, …", "0 → on the day of each playoff"],
            ["Worlds", "The competition designated Worlds", "−14 → two weeks before Worlds"],
            ["Offseason competition", "Competitions designated Offseason1, Offseason2, …", "+1 → day after each offseason event"],
          ]}
        />
        <H3>One competition, or every one</H3>
        <ul className="list">
          <li>Leave the <b>#</b> blank to create the task once <b>for each</b> matching competition. Each copy is named after its event, e.g. “Pack robot — Week1”, “Pack robot — Week2”.</li>
          <li>Enter a number to target just that event — e.g. Week competition <b>1</b> means only Week1.</li>
          <li>The form shows a preview such as “Starts: 2d before each week competition”.</li>
        </ul>
        <H3>Applying a template</H3>
        <ul className="list">
          <li>On <b>Tasks → Templates</b>, a Head Mentor taps <b>Apply</b>. Tasks are added to the active season with real dates.</li>
          <li>If the season doesn&apos;t have a matching competition yet, that task is <b>skipped</b> and listed in the result. Add the competition in <Link href="/settings/season" className="link">Season settings</Link> and apply again.</li>
          <li>Applying again never duplicates tasks — only tasks that don&apos;t exist yet (for example, for a newly added competition) are created.</li>
          <li><b>Save season as template</b> turns the current season&apos;s tasks into a new template.</li>
        </ul>
        <H3>Import &amp; export (CSV)</H3>
        <ul className="list">
          <li><b>Download CSV</b> exports a template; <b>Import CSV</b> adds tasks from a spreadsheet, with a preview first. The empty CSV includes an example and notes on every column.</li>
          <li>Columns <code>anchor</code> (KICKOFF, SEASON_WEEK0, PRACTICE, WEEK, PLAYOFF, WORLDS, OFFSEASON) and <code>anchorNumber</code> (blank = each) set the start, with <code>startOffset</code> as the days before/after. Older CSVs without an anchor still work: positive offsets count from kickoff, negative ones back from Week 0.</li>
          <li><code>prerequisiteNames</code> lists other task names separated by <code>|</code>.</li>
        </ul>
      </Section>

      <Section id="season" title="Season, robots & competitions">
        <ul className="list">
          <li><b>Season settings</b> (Head Mentors) hold the kickoff and Week 0 dates, meeting days and times, and expected attendance. Only one season is active at a time; everything else in the app uses the active season.</li>
          <li><b>Robots</b>: add the season&apos;s robots and use <b>Edit robot</b> to change a name, role, status, weight target or description. A robot&apos;s name always includes the season year.</li>
          <li><b>Past seasons</b> open on their own page with their stats, robots, competitions and milestones.</li>
        </ul>
        <H3>Competitions</H3>
        <p>Add each event the team attends. Its type and number give it a designation that templates can refer to:</p>
        <Table
          head={["Type", "Designation"]}
          rows={[
            ["Practice match", "PracticeMatch1, PracticeMatch2, …"],
            ["Week competition", "Week0, Week1, Week2, …"],
            ["Playoff", "Playoff0, Playoff1, …"],
            ["Worlds", "Worlds"],
            ["Offseason competition", "Offseason1, Offseason2, …"],
          ]}
        />
        <p>Each designation can only be used once per season. Competitions also drive the daily countdown notification.</p>
      </Section>

      <Section id="calendar" title="Meeting calendar">
        <ul className="list">
          <li>The calendar opens on the current month; use the arrows or <b>Full season</b> to look around.</li>
          <li>Meeting managers (Head Mentors, Team Leadership, Build Leads) can generate the season&apos;s meetings from the meeting days, add one-off meetings, change times, or cancel a meeting. Everyone is notified of changes to upcoming meetings.</li>
          <li><b>Subscribe</b> adds the team schedule to Google, Apple or Outlook calendar, and keeps it updated.</li>
        </ul>
      </Section>

      <Section id="inventory" title="Inventory & the order queue">
        <ul className="list">
          <li><b>All items</b> lists the team&apos;s stock. Taking something for a robot (<b>Acquire</b>) reduces the stock count.</li>
          <li>Each item can have a <b>minimum</b>. When stock falls to or below it, the item goes into the <b>order queue</b> automatically.</li>
          <li><b>Low stock</b> shows items at or below their minimum, with an <b>Order</b> button.</li>
          <li>The <b>Order queue</b> shows everything that needs ordering or is on its way, and where each request is. Items stay there until the delivery is received.</li>
        </ul>
        <H3>Ordering something</H3>
        <Steps>
          <li><b>Item already in inventory:</b> tap <b>Order</b>, set the quantity, priority and reason, and submit. You&apos;ll see where the request went and a link to it.</li>
          <li><b>Something new:</b> tap <b>+ Order a new item</b>. It&apos;s added to inventory with 0 in stock, put in the order queue, and the purchase request is sent — all in one go. If an item with the same name already exists, that one is used.</li>
        </Steps>
        <p>An item that&apos;s already on an open request can&apos;t be requested again — open the existing request from the order queue instead.</p>
      </Section>

      <Section id="purchasing" title="Purchase requests & approvals">
        <p>Every purchase follows the team&apos;s <b>purchase workflow</b>. By default:</p>
        <Steps>
          <li><b>Budget approval</b> — Budget Managers or Head Mentors approve or deny. Routine requests of $50 or less skip this step automatically; emergencies always need approval.</li>
          <li><b>Place order</b> — someone orders from the vendor and records the confirmation number, actual total and expected delivery. The total is logged as committed spend in the budget.</li>
          <li><b>Receive &amp; stock</b> — when the delivery arrives, <b>Mark received</b> adds the quantities to inventory and records the expense.</li>
        </Steps>
        <ul className="list">
          <li>Each request page shows a <b>Waiting on</b> banner and a full timeline: who did what and when, which steps were skipped and why, and what happens next.</li>
          <li>Only people with the right role for the current step see its buttons. The requester (or anyone who can act) can <b>cancel</b> before the order is placed. A denied or cancelled request puts its items back in the order queue.</li>
          <li>Whoever a request is waiting on gets reminders until they act — daily for routine requests, every 3 hours for urgent and emergency ones.</li>
        </ul>
        <H3>Changing the workflow</H3>
        <p>
          <Link href="/settings/workflows" className="link">Settings → Purchase workflow</Link> shows every step. Head Mentors can
          add approval steps (for example, a mentor sign-off above $500), choose who acts and who is notified, set when a step is
          required, change reminder timing, and turn the stock and budget updates on or off. Each save is a new version; requests
          already in progress keep the version they started with, and older versions can be restored.
        </p>
      </Section>

      <Section id="budget" title="Budget">
        <ul className="list">
          <li>Budget Managers and Head Mentors set up the season budget by category, record funding sources and log expenses.</li>
          <li>Purchases update the budget automatically: when ordered they appear as <b>Committed — on order</b>, and become a regular expense once received.</li>
        </ul>
      </Section>

      <Section id="tools" title="Tools">
        <ul className="list">
          <li>Every physical tool is its own entry with its own <b>asset tag</b> (TOOL-0001, TOOL-0002, …) and barcode. Tools with the same name — say, three drills — are grouped on one card so you can see which ones are free.</li>
          <li>Tap a tool for its details, to check it out, or (for tool managers) to edit or retire it — it opens in a window over the list.</li>
          <li>Check a tool out with an expected return date and check it back in with its condition. The condition you report becomes that tool&apos;s condition — it doesn&apos;t affect other tools with the same name. Tools that are out of service or out for maintenance can&apos;t be checked out.</li>
          <li><b>Add tool</b> can add several identical tools at once; each gets its own tag.</li>
          <li>Some tools need a <b>certification</b> before you can check them out — ask a Safety Captain, Inventory Admin or Head Mentor.</li>
          <li><b>Scan</b> reads a tool&apos;s QR code or asset tag to check it in or out quickly.</li>
          <li>You&apos;ll get a reminder when a tool is due back today and each day it&apos;s overdue.</li>
        </ul>
      </Section>

      <Section id="safety" title="Safety">
        <ul className="list">
          <li><b>Incidents</b>: anyone can report one. Safety Captains and Head Mentors are notified straight away.</li>
          <li><b>Certifications</b>: Safety Captains, Inventory Admins and Head Mentors award and revoke them. You&apos;re reminded 14 and 3 days before yours expires.</li>
          <li><b>Inspection</b>: run a pre-competition checklist for a robot and tick items off as they pass.</li>
        </ul>
      </Section>

      <Section id="fleet" title="Robot fleet">
        <ul className="list">
          <li>Every robot this season, with its weight against the limit (115 lb unless a target is set), weight history and open tasks.</li>
          <li>Log a weight reading from the robot&apos;s page. Head Mentors, Team Leadership and Build Leads can edit a robot&apos;s details.</li>
        </ul>
      </Section>

      <Section id="notifications" title="Notifications & reminders">
        <p>
          Choose what you hear about in <Link href="/settings/notifications" className="link">Settings → Notifications</Link>. Each
          type can show <b>in the app</b>, as a <b>push notification</b>, or both.
        </p>
        <H3>Turning on push notifications</H3>
        <p>The first time you open the app on a device, it asks whether to turn on notifications. If you choose <b>Not now</b>, it won&apos;t ask again on that device — you can turn them on any time here:</p>
        <Steps>
          <li>On iPhone/iPad, first add the app to your home screen (see <a href="#getting-started" className="link">Getting started</a>) and open it from there — iOS only allows push for installed apps.</li>
          <li>Go to <b>Settings → Notifications</b> and tap <b>Turn on push</b>, then allow notifications when asked.</li>
          <li>Tap <b>Send test</b> to check it works. Repeat on each device you want notifications on.</li>
        </Steps>
        <H3>What you can get</H3>
        <ul className="list">
          <li><b>Purchasing</b> — requests waiting on you (with reminders until you act), updates on your own requests, low stock.</li>
          <li><b>Meetings</b> — a reminder the day before and shortly before each meeting, and any changes or cancellations.</li>
          <li><b>Tasks</b> — when you&apos;re assigned, a morning digest of overdue and upcoming tasks, and blocked tasks.</li>
          <li><b>Competitions</b> — a daily countdown each morning for the 30 days before every event.</li>
          <li><b>Tools &amp; safety</b> — tool returns, expiring certifications, safety incidents.</li>
          <li><b>Team</b> — new members waiting for approval, and your own account.</li>
        </ul>
        <H3>Quiet hours &amp; time zone</H3>
        <p>
          No push notifications arrive during your quiet hours (9 PM–7 AM unless you change them); reminders wait until they end.
          Emergency purchase requests and serious safety incidents still come through. Daily digests arrive around 8 AM in your
          time zone. Meeting times use the team time zone, which Head Mentors and Team Leadership set on the same page.
        </p>
      </Section>

      <Section id="roles" title="Roles & permissions">
        <p>Head Mentors and Team Leadership approve new members and assign roles. A member can have several roles.</p>
        <Table
          head={["Role", "Can also…"]}
          rows={[
            ["Team Member", "Use tasks, tools, inventory and the calendar; submit purchase requests; order items; report incidents."],
            ["Build Lead", "Manage meetings and task templates, edit robots and tools, receive deliveries."],
            ["Inventory Admin", "Manage inventory and tools, manage task templates, place orders, receive deliveries, award certifications."],
            ["Budget Manager", "Manage the budget, approve purchases, place orders, receive deliveries."],
            ["Safety Captain", "Award and revoke certifications; notified of safety incidents."],
            ["Team Leadership", "Approve members and assign roles (except Head Mentor), manage meetings, Discord and the team time zone; view the purchase workflow."],
            ["Head Mentor", "Everything: seasons, robots, applying templates, editing the purchase workflow, and acting on any purchase step. Only Head Mentors can grant or remove the Head Mentor role."],
          ]}
        />
        <p>Role changes and suspensions take effect immediately.</p>
      </Section>

      <Section id="discord" title="Discord">
        <ul className="list">
          <li>Team Leadership connects the team&apos;s Discord server in <b>Settings → Discord</b>.</li>
          <li>Run <code>/link</code> in Discord to connect your account, then use commands such as <code>/tasks mine</code>, <code>/task done</code>, <code>/milestone next</code>, <code>/tool checkout</code>, <code>/stock check</code> and <code>/order request</code>. <code>/help</code> lists them all.</li>
          <li>Purchase requests follow the same workflow and permissions in Discord as in the app.</li>
        </ul>
      </Section>
    </div>
  );
}

// ── Building blocks ─────────────────────────────────────────────────────────

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    // scroll-mt keeps the heading clear of the fixed top bar when jumping to #id
    <section id={id} className="card scroll-mt-24 space-y-3 text-sm text-(--color-text-primary) [&_.list]:list-disc [&_.list]:pl-5 [&_.list]:space-y-1.5 [&_.link]:text-(--color-secondary) [&_.link]:underline [&_code]:rounded [&_code]:bg-(--color-surface-overlay) [&_code]:px-1 [&_code]:text-xs">
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
            <tr key={r[0]}>{r.map((c, i) => <td key={i} className={`px-3 py-2 align-top ${i === 0 ? "font-medium whitespace-nowrap" : "text-(--color-text-secondary)"}`}>{c}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HelpBadge() {
  return (
    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-(--color-border-strong) text-xs font-bold align-middle">?</span>
  );
}
