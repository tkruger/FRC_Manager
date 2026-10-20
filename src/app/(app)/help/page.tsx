import Link from "next/link";
import { APP_VERSION } from "@/lib/version";
import { HelpBadge, type HelpTopic } from "@/components/HelpLink";

export const metadata = { title: "Help & guide — FRC Manager" };

// The in-app guide. Pages link here with a "?" icon (HelpLink) to /help#<section>.

const SECTIONS: { id: HelpTopic; title: string }[] = [
  { id: "getting-started", title: "Getting started" },
  { id: "tasks",           title: "Tasks" },
  { id: "templates",       title: "Task templates" },
  { id: "season",          title: "Season, robots & competitions" },
  { id: "calendar",        title: "Meeting calendar" },
  { id: "inventory",       title: "Inventory & the order queue" },
  { id: "purchasing",      title: "Orders" },
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
          How FRC Manager works, section by section. Tap the <HelpBadge /> button on a page to jump straight to its part of this guide.
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
        <p>Opening FRC Manager in a phone browser shows these steps for your device (once every couple of weeks until it&apos;s installed).</p>
        <p>Want a different icon? Pick one under <b>Settings → Profile &amp; appearance → App icon</b> first, then add (or remove and re-add) the app — phones only read the icon when it&apos;s added.</p>
        <H3>Finding your way around</H3>
        <ul className="list">
          <li>On a computer, the main sections are along the top. On a phone they&apos;re in the bar at the bottom — <b>More</b> has the rest.</li>
          <li>The <b>robot picker</b> at the top filters tasks and other lists to one robot. Choose <b>All robots</b> to see everything.</li>
          <li>Your name in the top-right opens your profile, notification settings, this guide and (depending on your role) team settings.</li>
          <li>The bell shows your latest notifications.</li>
        </ul>
        <H3>Your account</H3>
        <ul className="list">
          <li><b>Confirm your email</b> from the link we send when you sign up (or <b>Settings → Profile → Send confirmation link</b>). It&apos;s needed before Google or Discord can sign in to an account that has a password.</li>
          <li>Forgot your password? Tap <b>Forgot password?</b> on the sign-in page for a reset link. Change it any time in <b>Profile → Account &amp; security</b>.</li>
          <li>To sign in with Google or Discord too, use <b>Connect</b> under <b>Sign-in methods</b> on your profile.</li>
          <li>Lost a phone or used a shared computer? <b>Sign out of all devices</b> is on your profile. Changing your password also signs out your other devices.</li>
          <li>After 10 wrong passwords, sign-in pauses for 15 minutes for that email.</li>
        </ul>
      </Section>

      <Section id="tasks" title="Tasks">
        <p>Everything the team needs to get done this season. Switch between three views at the top of the page:</p>
        <ul className="list">
          <li><b>Kanban</b> — cards in columns by status. Drag a card to another column to change its status — on a phone or tablet, touch and hold a card until it lifts, then drag it. <b>Future</b> holds tasks that haven&apos;t started yet — drop a card there and pick the date it should start.</li>
          <li><b>Gantt</b> — tasks on a timeline from the season start to its end (only tasks with start and due dates appear).</li>
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
        <H3>When is each task due?</H3>
        <p>When adding a template task, choose <b>Task</b> or <b>Milestone</b>, then say when it&apos;s <b>due</b> — some days <b>before</b>, <b>on</b>, or <b>after</b> a date in the season:</p>
        <ul className="list">
          <li><b>Tasks</b> also say how long they <b>take</b> (days). They start that many days before they&apos;re due — e.g. “due 3 days before Week 0, takes 5 days” starts 8 days before Week 0.</li>
          <li><b>Milestones</b> are just a date — no length.</li>
          <li>The form spells it out and shows the dates it would get in your current season, e.g. “Starts Sat, Feb 7 → due Thu, Feb 12”.</li>
        </ul>
        <Table
          head={["Relative to", "Uses", "Example"]}
          rows={[
            ["Kickoff", "The season's kickoff date", "Due 3 days after kickoff"],
            ["Week 0", "Your Week0 competition — or the first week competition if there's no Week0", "Due 5 days before Week 0"],
            ["Season end", "The season's end date, set in Season settings", "Due a week before the season ends"],
            ["Practice match", "Competitions designated PracticeMatch1, PracticeMatch2, …", "Due the day before each practice match"],
            ["Week competition", "Competitions designated Week0, Week1, Week2, …", "Robot packed 2 days before each event"],
            ["Playoff", "Competitions designated Playoff0, Playoff1, …", "Due on the day of each playoff"],
            ["Worlds", "The competition designated Worlds", "Due two weeks before Worlds"],
            ["Offseason competition", "Competitions designated Offseason1, Offseason2, …", "Due the day after each offseason event"],
          ]}
        />
        <H3>One competition, or every one</H3>
        <ul className="list">
          <li>Leave <b>Which one</b> blank to create the task once <b>for each</b> matching competition. Each copy is named after its event, e.g. “Pack robot — Week1”, “Pack robot — Week2”.</li>
          <li>Enter a number to target just that event — e.g. Week competition <b>1</b> means only Week1.</li>

        </ul>
        <H3>Applying a template</H3>
        <ul className="list">
          <li>On <b>Tasks → Templates</b>, a Head Mentor taps <b>Apply</b>. Tasks are added to the active season with real dates.</li>
          <li>If the season doesn&apos;t have a matching competition yet, that task is <b>skipped</b> and listed in the result. Add the competition in <Link href="/settings/season" className="link">Season settings</Link> and apply again.</li>
          <li>Applying again never duplicates tasks — only tasks that don&apos;t exist yet (for example, for a newly added competition) are created.</li>
          <li><b>Save season as template</b> turns the current season&apos;s tasks into a new template.</li>
          <li><b>▶ Present</b> (on a template) opens full-screen slides to walk the team through it: the whole timeline as a Gantt chart, the milestones, each phase up close, who&apos;s busy when, and a checklist of what might be missing. Dates are drawn on an example season for illustration (kickoff on the second Sunday of January, Week 2 and Week 4 events, a regional playoff three weeks before Worlds in April, with competitions on weekends), and weekends are shaded. Long timelines scroll on their slide (↑/↓, the mouse wheel or a swipe) while the dates stay at the top. Use ←/→, space or a click to move on, <b>F</b> for full screen and <b>Esc</b> to leave. On a phone or tablet, swipe.</li>
        </ul>
        <H3>Import &amp; export (CSV)</H3>
        <ul className="list">
          <li><b>Download CSV</b> exports a template; <b>Import CSV</b> adds tasks from a spreadsheet, with a preview first. The empty CSV includes an example and notes on every column.</li>
          <li>Columns <code>anchor</code> (KICKOFF, SEASON_WEEK0, SEASON_END, PRACTICE, WEEK, PLAYOFF, WORLDS, OFFSEASON) and <code>anchorNumber</code> (blank = each) set the anchor; <code>startOffset</code> is when the task <b>starts</b> (days before/after it) and <code>durationBuildDays</code> how long it takes, so it&apos;s due at start + length. Milestones can use a length of 0. Older CSVs without an anchor still work: positive offsets count from kickoff, negative ones back from Week 0.</li>
          <li><code>prerequisiteNames</code> lists other task names separated by <code>|</code>.</li>
        </ul>
      </Section>

      <Section id="season" title="Season, robots & competitions">
        <ul className="list">
          <li><b>Season settings</b> (Head Mentors) hold the season&apos;s start (kickoff) and end dates, its competitions, meeting days and times, and expected attendance. Only one season is active at a time; everything else in the app uses the active season.</li>
          <li>Changing the season&apos;s dates or meeting schedule updates every meeting that <b>hasn&apos;t started yet</b>, including ones later today — past meetings never change. Upcoming meetings move to a day&apos;s new times, days dropped from the schedule lose their meetings (unless one has a title, notes, tasks or was canceled), and new meeting days and dates get meetings. A meeting you&apos;ve moved to another time by hand keeps its time. Once the season has started, its start date is locked.</li>
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
          <li>The <b>Order queue</b> shows everything that needs ordering or is on its way, and where each order is. Items stay there until the delivery is received.</li>
          <li><b>Retiring an item</b> (Inventory Admins and Head Mentors): open the item and tap <b>Retire item</b>. It leaves the inventory, low stock and the order queue, and can&apos;t be added to new orders, but its history stays. Tick <b>Show retired items</b> on All items to see retired items, and open one to <b>Restore</b> it.</li>
        </ul>
        <H3>Ordering something</H3>
        <Steps>
          <li><b>Item already in inventory:</b> tap <b>Order</b>, set the quantity, priority and reason, and submit. You&apos;ll see where the order went and a link to it.</li>
          <li><b>Something new:</b> tap <b>+ Order a new item</b>. It&apos;s added to inventory with 0 in stock, put in the order queue, and the order is sent — all in one go. If an item with the same name already exists, that one is used.</li>
        </Steps>
        <p>An item that&apos;s already on an open order can&apos;t be ordered again — open the existing order from the order queue instead.</p>
      </Section>

      <Section id="purchasing" title="Orders">
        <p>
          An <b>order</b> is a group of <b>items</b> someone needs bought. One order can include parts for several sub-teams
          from several vendors. Each order has a name, an order date and a total cost.
        </p>
        <H3>Placing an order</H3>
        <Steps>
          <li>Go to <b>Orders → + New order</b>, give it a name, and pick its <b>Budget category</b> (Robot Parts — Mechanical, Tools &amp; Equipment, …). That&apos;s where its spend shows on the budget. An item that belongs somewhere else can have its own category.</li>
          <li>For each item, paste the product <b>link</b> — for most FRC vendors (REV, AndyMark, WCP and other Shopify stores) the vendor, name, part number and price fill in automatically. Some sites (McMaster-Carr, Amazon) block this; just type the details.</li>
          <li>Set the quantity, sub-team, importance (Routine, Urgent or Emergency), why it&apos;s needed, and any notes for the Buyer.</li>
          <li>Paste a product link to fill in the item. If the page sells several products (a WCP parts page, or a product with sizes), you&apos;ll get a list to pick from: tick one or more and each becomes its own item. Amazon links fill in the name, price and ASIN.</li>
          <li>Not ready to submit? Tap <b>Save draft</b>. Your drafts are under <b>Orders → My drafts</b>, only visible to you, until you submit or delete them.</li>
          <li>Submit. Items show a draft ID (like DRAFT-7K2Q) until the order is approved; then each gets its permanent 4-digit item ID (0415, 0416, …). Denied or canceled orders never use up item IDs.</li>
          <li>Need to change something? Anyone who can approve or order it (and Head Mentors) can tap <b>Edit order</b> while it&apos;s open to change, add or remove items. Arrived items are locked, and every edit is noted in the order&apos;s progress.</li>
        </Steps>
        <p>You can also order straight from <b>Inventory</b> — the <b>Order</b> button on low-stock items, or <b>Order a new item</b>.</p>
        <H3>Item statuses</H3>
        <Table
          head={["Status", "Meaning"]}
          rows={[
            ["Queued", "The order is waiting for approval."],
            ["To order", "Approved and sent to the Buyer to purchase."],
            ["Ordered", "The Buyer added a tracking link."],
            ["Arrived", "Someone marked it arrived — it's been added to inventory."],
          ]}
        />
        <H3>What happens next</H3>
        <Steps>
          <li><b>Approval</b> — Treasurers or Head Mentors approve or deny the order. Routine orders of $50 or less are approved automatically; emergencies always need approval. Approved items become <b>To order</b>.</li>
          <li><b>Buyer orders</b> — on <b>Orders → Buyer</b>, the Buyer copies or downloads the to-order items as CSV for the purchasing spreadsheet (no header; grouped by vendor; columns #XXXX item ID, Vendor, Part Name, Link, Unit Price, Qty, Order Notes, Order Date), places the orders, then selects the items that shipped together and adds one <b>tracking link</b> — they become <b>Ordered</b>.</li>
          <li><b>Arrival</b> — when a box shows up, anyone can tick the items and tap <b>Mark arrived</b>. Each item is added to inventory (matched by its inventory link, part number or name, or created new) and becomes <b>Arrived</b>.</li>
        </Steps>
        <ul className="list">
          <li><b>Export CSV</b> on an order, or on the Orders list (for every order on the tab you&apos;re viewing), downloads the items in the same spreadsheet format (no header row). In the iPhone app it opens in Safari so you can save the file.</li>
          <li>The order moves along by itself: it&apos;s ordered once every item is ordered, and complete once every item has arrived.</li>
          <li>Captains (Team Leadership) and the Buyer can set any item&apos;s status by hand. Arrived items can&apos;t be changed back, because their stock has already been added.</li>
          <li>Each order page shows a <b>Waiting on</b> banner and a timeline of who did what and when.</li>
          <li>Whoever an order is waiting on is reminded until they act — daily for routine orders, every 3 hours for urgent and emergency ones.</li>
        </ul>
        <H3>Changing the workflow</H3>
        <p>
          <Link href="/settings/workflows" className="link">Settings → Purchase workflow</Link> shows every step. Head Mentors can
          add approval steps (for example, a mentor sign-off above $500), choose who acts and who is notified, set when a step is
          required, change reminder timing, and turn the stock and budget updates on or off. Each save is a new version; orders
          already in progress keep the version they started with.
        </p>
      </Section>

      <Section id="budget" title="Budget">
        <ul className="list">
          <li>Treasurers and Head Mentors set up the season budget by category, record funding sources and log expenses.</li>
          <li>Purchases update the budget automatically: when ordered they appear as <b>Committed — on order</b>, and become a regular expense once received. Each item counts toward its order&apos;s budget category (or its own), so one order can show in several categories.</li>
          <li>Spend without a category shows as <b>Uncategorized</b> with links to the orders. Open one and use <b>Budget → Change</b> to fix it. That works at any stage, even after the items arrive, and moves the spend already recorded. The person who placed the order, its approvers, the Buyer, the Treasurer, Team Leadership and Head Mentors can change it.</li>
        </ul>
      </Section>

      <Section id="tools" title="Tools">
        <ul className="list">
          <li>Every physical tool is its own entry with its own <b>asset tag</b> (TOOL-0001, TOOL-0002, …) and barcode. Tools with the same name — say, three drills — are grouped on one card so you can see which ones are free.</li>
          <li>When adding a tool, pick its <b>Named group</b> from the list to add another of a tool you already have, or choose <b>+ New group…</b> to start a new one. Renaming a tool that shares its name asks whether to rename the <b>whole group</b> or <b>just this one</b> (which moves it into its own group).</li>
          <li>Tap a tool for its details, to check it out, or (for tool managers) to edit or retire it — it opens in a window over the list.</li>
          <li>Check a tool out with an expected return date and check it back in with its condition. The condition you report becomes that tool&apos;s condition — it doesn&apos;t affect other tools with the same name. Tools that are out of service or out for maintenance can&apos;t be checked out.</li>
          <li><b>Add tool</b> can add several identical tools at once; each gets its own tag.</li>
          <li>Some tools need a <b>certification</b> before you can check them out — ask a Safety Captain, Inventory Admin or Head Mentor.</li>
          <li><b>Scan</b> reads a tool&apos;s QR code or asset tag to check it in or out quickly — or to move it: scan the tool, then <b>Scan where it&apos;s going</b> and scan a location.</li>
          <li><b>Locations</b> are the shelves, cabinets, totes and cases tools live in. Each has its own barcode (LOC-0001, …) to print and stick on. Scan a location to see what&apos;s there, or to scan tools into it one after another. Build Leads, Inventory Admins, Team Leadership and Head Mentors add and rename locations.</li>
          <li><b>Pack lists</b>: Team Leadership and Head Mentors keep a master list of what comes to every competition — tool groups (&ldquo;Drill × 2&rdquo;; any drills count) and other items (&ldquo;Battery cart&rdquo;) — and <b>start packing</b> for an event. While packing, a banner on the Tools page lets anyone help: scan a tote or case, then every tool going into it, and tick off the other items. Packing is a checklist only; it doesn&apos;t check tools out. Print it to see what&apos;s in each tote at the event.</li>
          <li><b>Audit log</b> (Team Leadership, Head Mentors and the Safety Captain): every tool check-out and check-in plus every safety report between two dates, ready to print. Find it on the Tools and Safety pages.</li>
          <li>You&apos;ll get a reminder when a tool is due back today and each day it&apos;s overdue.</li>
        </ul>
      </Section>

      <Section id="safety" title="Safety">
        <ul className="list">
          <li><b>Incidents</b>: anyone can report one. Safety Captains and Head Mentors are notified straight away.</li>
          <li><b>Certifications</b>: Safety Captains, Inventory Admins and Head Mentors award and revoke them. You&apos;re reminded 14 and 3 days before yours expires.</li>
          <li><b>Inspection</b>: run FIRST&apos;s official self-inspection at <a href="https://precheck.frc.nexus/" target="_blank" rel="noopener noreferrer" className="link">PRECHECK</a>, paste the link it gives you at the end into the robot&apos;s PRECHECK box, and set its status: <b>Complete</b>, <b>Needs work</b> or <b>Incomplete</b>. The status shows on the robot&apos;s Fleet card. The in-app checklist is still there below it.</li>
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
          <li><b>Purchasing</b> — orders waiting on you (with reminders until you act), updates on your own orders, low stock.</li>
          <li><b>Meetings</b> — a reminder the day before and shortly before each meeting, and any changes or cancellations.</li>
          <li><b>Tasks</b> — when you&apos;re assigned, a morning digest of overdue and upcoming tasks, and blocked tasks.</li>
          <li><b>Competitions</b> — a daily countdown each morning for the 30 days before every event.</li>
          <li><b>Tools &amp; safety</b> — tool returns, expiring certifications, safety incidents.</li>
          <li><b>Team</b> — new members waiting for approval, and your own account.</li>
        </ul>
        <H3>Quiet hours &amp; time zone</H3>
        <p>
          No push notifications arrive during your quiet hours (9 PM–7 AM unless you change them); reminders wait until they end.
          Emergency orders and serious safety incidents still come through. Daily digests arrive around 8 AM in your
          time zone. Meeting times use the team time zone, which Head Mentors and Team Leadership set on the same page.
        </p>
      </Section>

      <Section id="roles" title="Roles & permissions">
        <p>Head Mentors and Team Leadership approve new members and assign roles. <b>Mentor</b> has the same access as Team Member — give a mentor Team Leadership (or other roles) for more. A member can have several roles. <Link href="/settings/roles" className="link">Roles explained</Link> has the full list of who can do what.</p>
        <p><b>Inviting people:</b> Head Mentors and Team Leadership can invite people from <b>Settings → Invite people</b> — by email (separate addresses with commas) or with a join link the bot posts in a Discord channel. Pick the roles they'll get (Team Member by default — you can give roles up to your own; only Head Mentors can invite Head Mentors). Anyone who accepts joins the team straight away with those roles.</p>
        <Table
          head={["Role", "Can also…"]}
          rows={[
            ["Team Member", "Use tasks, tools, inventory and the calendar; place orders and mark items arrived; report incidents."],
            ["Build Lead", "Manage meetings and task templates, edit robots and tools."],
            ["Inventory Admin", "Manage inventory and tools, manage task templates, award certifications."],
            ["Treasurer", "Manage the budget and approve orders."],
            ["Safety Captain", "Award and revoke certifications; notified of safety incidents."],
            ["Buyer", "Get approved items to order, export the purchasing CSV, add tracking links and set item statuses."],
            ["Team Leadership", "Approve members and assign roles (except Head Mentor), invite people, manage meetings, Discord and the team time zone; act as captains on orders (Buyer page, item statuses); view the purchase workflow."],
            ["Mentor", "The same as Team Leadership."],
            ["Head Mentor", "Everything: seasons, robots, applying templates, editing the purchase workflow, and acting on any purchase step. Only Head Mentors can grant or remove the Head Mentor role."],
          ]}
        />
        <p>Role changes and suspensions take effect immediately.</p>
        <p><b>Deleting a member</b> (Team members → Delete) removes their access straight away and takes them off their tasks. If they have orders, safety reports, tool checkouts or certifications, those stay — shown as &ldquo;Former member&rdquo; — and the rest of their details are erased. It can&apos;t be undone.</p>
      </Section>

      <Section id="discord" title="Discord">
        <ul className="list">
          <li>Team Leadership connects the team&apos;s Discord server in <b>Settings → Discord</b>.</li>
          <li>You can sign in and sign up with <b>Continue with Discord</b> (or Google). If that account's email matches your FRC Manager account, it signs you into that account. Discord sign-in also connects you for the bot — no <code>/link</code> needed.</li>
          <li>Run <code>/link</code> in Discord to connect your account, then use commands such as <code>/tasks mine</code>, <code>/task done</code>, <code>/milestone next</code>, <code>/tool checkout</code>, <code>/stock check</code> and <code>/order request</code>. <code>/help</code> lists them all.</li>
          <li>Orders follow the same workflow and permissions in Discord as in the app.</li>
        </ul>
      </Section>

      <p className="text-center text-small text-(--color-text-secondary)">FRC Manager v{APP_VERSION}</p>
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
