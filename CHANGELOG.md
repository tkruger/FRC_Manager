# Changelog

## Unreleased

- **Budget changes in the audit log**: category allocations, funding sources (added, edited — e.g. a pledge marked received — and removed) and expenses logged on the budget now record who changed what, from → to. Find them under **Changes to the budget, funding and expenses** on the Audit log, or **History** at the bottom of the Budget page (Treasurers and Head Mentors). Spending that orders record on their own stays in each order's history
**Real names & parents**
- Sign-up (email, Google/Discord and invites) and Profile now ask for a **first and last name** — a single word or a username isn't accepted, and Profile asks anyone whose name is only one word to add the rest
- **Whose parent are you?** Signing up, a parent can tick **I'm a parent or guardian of a student on the team** and name their students. Mentors see it on the approval list, and **Approve** starts with the Parent role picked
- Parents and students are **linked**: names that match a student on the team link automatically (also when the student joins later; a first name alone works when the last name matches the parent's). Parents can add or remove their students under **My students** in Profile, and Team members shows "Parent of …" and "Parents: …"

## 1.12.1 — 2026-11-05

- Sign-in, sign-up and invite pages warn that Discord is often blocked on school Wi-Fi (sign-in then fails); a failed sign-in mentions it too
- **Invites with names**: invite by email now also takes `Dana Starler <dana@example.com>` (or `"Starler, Dana" <…>`), so you can paste straight from an email’s To: line. The name greets them in the invite email, fills in their sign-up form, and shows in Open invites. Plain addresses work as before; anything that isn’t an address is listed back as skipped

## 1.12.0 — 2026-11-05

- iPhone home-screen app: fixed the bottom bar being pushed partly off the bottom of the screen

**App tour & FRC basics**
- **App tour**: the first time someone opens Home, a short tour points out each part of the screen — the bottom bar (or the top tabs on a computer), More, the bell and the profile menu — and what they can do there. It's different for **parents, students, mentors and Head Mentors**, can be skipped, and doesn't come back once finished (on any device). **Take the tour** in the profile menu or on Help runs it again
- The tour has a picture for each step, cards that slide in, a progress bar, and a highlight with a bright double border and a pulsing ring so it stands out in dark mode too (motion is turned off for anyone who has reduced motion set)
- The tour and the first-visit questions (turn on notifications, add to the home screen) never overlap. Taking the tour, they're part of it — a **Turn on notifications** step and an **Add it to your home screen** step near the end, when they apply — and aren't asked again afterward. Choosing **Not now** on the tour (or skipping it early) leaves them to come up on their own, one at a time
- The tour explains **volunteering**: parents get how to get cleared, sign up, answer a request, get shift reminders and drop out; **Volunteer Coordinators and Head Mentors** get how coverage works, asking someone to cover, and setting shift instructions — each with a small drawn preview of the screen, the button that matters highlighted
- **New to FRC?** The tour can start with four quick cards on how FRC works — what it is, the season, a competition, and the words you'll hear — and there's a full **FRC basics** page (Help → FRC basics): the season month by month, how matches and events work, how a team works, a glossary, and how families help

## 1.11.0 — 2026-11-04

**Team email**
- **Google Workspace — service account**: a new way to send the team's email for teams with a Workspace — upload the service account's key file (JSON, or base64), name the one mailbox it sends as, and **Check and save** confirms it with Google before storing the key encrypted. Nothing goes in the site's Vercel settings; FRC Manager only ever sends as that mailbox
- **Sending limits** on every team's email, whichever way it goes out (250 an hour and 1,000 a day unless changed on the Team email page): Head Mentors and Integration Admins get a heads-up at 80% of either limit, and past either, no more are sent until it resets (and they're told). A guard against the app ever being used to send spam
- The integration setup guide covers the service account (Google Cloud, Admin console domain-wide delegation) and the limits

## 1.10.1 — 2026-11-03

- **Integration setup guide** (Help → integration setup guide, and linked from Settings → Integrations, Team email, Discord and The Blue Alliance & Nexus): step-by-step setup for site settings, background jobs, Gmail / Google Workspace (Google Cloud, scopes, redirect address, verification), other mail providers, Discord, The Blue Alliance, FRC Nexus, push notifications and storage — with this site's own addresses filled in — plus **how your data is protected**

## 1.10.0 — 2026-11-03

- **Team email with Gmail** now connects with Google (the Gmail API) instead of an app password: tap **Connect with Google** in Settings → Integrations → Team email and sign in with the team's Google or Workspace account. FRC Manager only gets permission to send (not read) email, the connection is stored encrypted, and removing it revokes the access. The From name and a Send-mail-as alias can be set after connecting

## 1.9.1.1 — 2026-11-02

**Housekeeping (storage)**
- Tool photos are shrunk on the phone before uploading (longest side 1600px) — a few hundred KB instead of several MB
- Replaced tool photos are deleted, and a daily sweep removes uploaded photos no tool uses (e.g. a form closed after picking one)
- Old rows are cleared out: read notifications after 90 days (any after 180), reminder bookkeeping after 180 days, Discord command logs after 90 days
- The `dev` branch no longer makes its own Vercel deployment (it was identical to preprod), halving the deployments stored

## 1.9.1 — 2026-11-02

**Broadcast messages**
- Head Mentors: **Broadcast message** in the profile menu sends one message to **Team Members**, **Parents** and/or **Mentors** — in the app with a push notification (tapping it opens the whole message in a card), posted in the student and/or parent Discord server's announcements channel, and by email to the groups you pick. It shows how many people each choice reaches, asks before sending, and lists recent broadcasts
- Discord settings: an **Announcements channel** for each server (broadcasts use the general channel until it's set)
- Broadcasts are in the **Audit log** — what was sent, and to whom
- **Invite people** left the profile menu — it's on the Team members page

## 1.9.0.7 — 2026-11-01

- Volunteer settings (adults each meeting needs, default shift instructions) moved to their own page — **Edit Shift Instructions** at the top of the Volunteers page, for volunteer coordinators and Head Mentors

## 1.9.0.6 — 2026-11-01

- **Snooze competition alerts** — for when you're not at the event: on the event's page or in Settings → Notifications, pause schedule, next-match, result and award alerts for **2 hours**, **until tomorrow morning** or **until the event ends**. No push or email while snoozed; they still collect in your notifications and come back on by themselves

## 1.9.0.5 — 2026-11-01

- Super admins can **Edit roles** on their own row in Team members (Head Mentor stays on — nobody can remove it from a super admin). Everyone else still can't change their own roles

## 1.9.0.4 — 2026-11-01

- Volunteer clearance is for adults only: students no longer get a **Volunteer clearance** control on Team members, a Volunteering section on their profile, or a place on the Volunteers page, and a student can't be cleared, sign up or be asked to cover a meeting (an old clearance can still be removed)

## 1.9.0.3 — 2026-11-01

- The Blue Alliance webhook: the verification code now always shows up, even if a secret from the earlier setup is still saved; **Check for code** refreshes it without reloading the page

## 1.9.0.2 — 2026-11-01

- The Blue Alliance webhook setup now follows how myTBA works: add the URL in myTBA, the **verification code** TBA sends shows up on the settings page (even before anything else is saved) to enter back in myTBA, then paste the **secret myTBA made** into **Webhook secret**. Updates are accepted once the secret is saved

- Phones: the **bottom bar** puts first what matters to you, like Home does — parents get **Volunteers, Calendar, Events, Season**; students **Tasks, Calendar, Events, Tools**; mentors **Tasks, Orders, Budget, Calendar**. Everything else is under **More**

- iPhone home-screen app: the bottom tab bar no longer floats up the screen while scrolling — in the home-screen app the page now scrolls inside the app instead of moving the whole window, which is what iOS got wrong. Each page opens at the top

- **Home**: when you've been asked to volunteer at a meeting, the request is the first thing on the page — the meeting, its date and time and who asked — with **Confirm** and **Can't make it** right there, the shift instructions, **Details** to open it on the Volunteers page, and a count of any other requests waiting

## 1.9.0.1 — 2026-11-01

- New **Slice** color scheme — orange and teal — and it's now the default. Anyone who already picked a scheme keeps it; **FRC Classic** (red and blue) is still in Profile → Color theme

## 1.9.0 — 2026-11-01

**Competitions**
- **Competitions** page (**Events** in the menu; under **More** on phones), and an event page for each competition: **our next match** with its expected time and our **bumper color** (red or blue — who to cheer for), partners and opponents; **our matches** with scores and wins/losses; our **rank and record** and playoff alliance. It updates itself every minute during the event
- **Follow along** links on each event: the livestream, the Nexus queue page, The Blue Alliance, Match13 rankings and predictions, FIRST's official results, and The Blue Alliance app — plus a plain-language **New to FRC competitions?** explainer for parents
- During a competition (and the week before), the Home page shows it at the top with our next match
- Season settings: each competition takes its **event code** — pick it from **Find on The Blue Alliance** (fills in the name, dates, location and Week number) or paste a TBA, Nexus or FIRST link
- New guide section: **Competitions — following along**
- **Live competition notifications**, on for everyone (parents too) and each one can be turned off in Settings → Notifications: **Match schedule** (posted or changed, with our first match and bumper color), **Our next match** (“Now queuing” at events that use FRC Nexus, otherwise about 20 minutes before the predicted time, with our bumper color), **Match results** (score and our new rank), **Alliance selection & playoffs** (our alliance, winning the event, or the end of our run) and **Awards**
- Updates are checked every 5 minutes during a linked competition; optional The Blue Alliance and Nexus webhooks make them near-instant
- **Each team uses its own keys**: Settings → Integrations → **The Blue Alliance & Nexus** (Head Mentors and Integration Admins) takes the team's TBA Read API key and Nexus API key, and gives the team its own private webhook addresses (with a generated TBA secret and the verification code TBA sends back). Until a team adds a TBA key, the app's shared key is used if there is one
- The daily competition countdown opens the competition's page
- **Watch live** button on an event's page when it has a livestream (YouTube or Twitch), and a **▶ Video** link on each match once its video is up; awards won show at the top
- **Team history** (Competitions → Team history): every season the team has competed, with each event's rank, record, alliance and wins, and every award — plus a page for each season and each past event with all of our matches, scores and videos

**Menus**
- The profile menu is shorter: **Discord** and **Team email** are now one **Integrations** page, which shows where each stands (and whether The Blue Alliance is connected)
- **Expenses & refunds** left the profile menu — it stays under **More** on phones and on the Budget page
- **Season settings** left the profile menu too — it is the same page as **Season** in the main menu
- Team members: active members are split into **Students** (the Team Member role) and **Adults**
- **Home** puts first what matters most to each person: parents see Volunteers, Calendar, Competitions and Season first; students Tasks, Calendar and Competitions; mentors Tasks, Orders and Budget. Adults get a **Volunteers** tile and a stat with their next shift or how many meetings in the next two weeks still need adults

**Meetings & sub-teams**
- Members can be in **any number of sub-teams** — pick yours on your Profile (Head Mentors and Team Leadership can set anyone's in Team members → Edit roles); they show on the Team members list
- **Sub-team meetings**: a meeting can be just for one sub-team (**Who's it for** when adding or editing it). It shows in the sub-team's color on the calendar, and its reminders and changes go to that sub-team plus mentors and Team Leadership
- **Your open tasks when a meeting starts**: a push to everyone the meeting is for who has open tasks, listing them (due dates and blocked ones marked). On by default; turn it off in Settings → Notifications

**Feedback**
- **Give feedback** from anywhere (the footer of every page and the profile menu): an idea, a problem or anything else goes to the app's super admins by email and as a notification — with who sent it, their team and the page they were on. Replying to the email answers the sender

**Fixes**
- iPhone home-screen app: the bottom tab bar could float partway up the screen while scrolling a long page (not just after typing) — it now stays at the bottom
- Phones: the end of each page no longer hides behind the bottom tab bar

**Roles**
- Team Leadership can give and take away only the **Team roles** — Team Member, Build Lead, Inventory Admin, Safety Captain and Team Leadership. Every other role (Mentor, Parent, Treasurer, Buyer, Order Approver, Volunteer Coordinator, Integration Admin, Head Mentor) is given by a Head Mentor; the role pickers mark them “Head Mentor only”
- Task templates are managed by Head Mentors and Build Leads (no longer Inventory Admins)

## 1.8.4.1 — 2026-11-01

- Role names in title case like the rest: **Order Approver**, **Volunteer Coordinator** and **Integration Admin** (also in saved purchase workflows and order history)
- The guide has its own **Expenses & refunds** section: submitting an expense step by step, what each status means, how Treasurers review and pay back, and who can see receipts. The Guide button on the expense pages opens it

## 1.8.4 — 2026-11-01

**Expenses & refunds**
- **Expenses & refunds**: anyone on the team (parents too) can submit an expense with **+ Add expense** — contact information, date, amount, description, vendor, how it was paid, budget category and receipts (photos or PDFs, kept private) — and tick **I paid for this myself — please pay me back** to ask for a refund
- **Treasurer** role (new): gets notified (in the app, push and email) and works a queue — **To review** (approve, which records it in the budget, or deny with a reason) and **To pay back** (mark a refund paid with how, a reference and the date, which closes it). The submitter is notified at each step; nobody approves their own claim; a Treasurer's or Head Mentor's own purchase with no refund is recorded right away. Head Mentors can review too
- Every change to an expense claim is in its History and on the Audit log (“Changes to expense claims”)
- Budget page: “Log expense” is now **+ Add expense** for everyone, plus **Expenses & refunds** (also in the profile menu, and **Expenses** in the bottom bar's More menu on phones)

## 1.8.3 — 2026-10-31

**Budget**
- Budget chart: a dotted **raised + pledged** line above the raised line shows money promised but not in yet (from the day each pledge was entered). The expanded chart lists what's pledged, and the home page tile shows “$X raised + $Y pledged”

## 1.8.2 — 2026-10-31

**Integrations**
- **Integration admin** role: sets up the team's integrations — its Discord servers and its own email — without needing to be a Head Mentor or Team Leadership
- **Parent Discord server**: alongside the student server (which keeps every build notification), a team can connect a parent server. It gets milestone celebrations and a Volunteers channel: a morning list of the next two weeks' meetings that still need adults, and a post when a volunteer drops out of a meeting that's now short. Slash commands work in both; Discord join links can be posted in either. Existing Discord connections become the student server

**Terms & sign-up**
- **Terms of Service** updated: no guaranteed uptime, features may change or go away, use at your own risk and discretion; how to grab the source from GitHub and host it yourself; and a request not to use it to make money. Every page now has a footer with Terms, Privacy, the source code and the version, and the guide ends with a “Terms, privacy & source” section
- Signing up (email, Google/Discord, or from an invite) needs a tick in “I agree to the Terms of Service and Privacy Policy”; when each member agreed is recorded

## 1.8.0 — 2026-10-31

**Tasks**
- **Present on TV** (Tasks and Gantt): a full-screen view laid out for a 16:9 1080p TV that cycles between the task board (what's due, started or happening in the next 11 days, plus the last week's finished work) and an 11-day timeline — today on the left, the next 10 days to the right, competitions marked. It refreshes every minute and rolls forward with the days. Pause, Board only, Timeline only and full screen in the controls (or P, F, arrow keys)
- Task board: sticky notes are colored by **sub-team** (Mechanical red, Electrical blue, …) instead of random colors, and that's now the default look. Plain cards are outlined in their sub-team's color. Anyone who picked plain cards or one note color keeps it (Settings → Profile & appearance → Task board)

**Volunteers**
- Adults who aren't cleared yet (or whose clearance ended) are told to talk to a Head Mentor about getting cleared — naming the team's Head Mentors on the Volunteers page, where each meeting shows “Cleared adults only” instead of Sign up — and the same note appears on the meeting in the calendar, the view-only banner and their profile

**Fixes**
- iPhone: after the keyboard closes, the bottom tab bar (and the background) go back to the bottom of the screen. iOS sometimes left the screen a keyboard short, drawing them two-thirds of the way down until the app was reloaded

## 1.7.2 — 2026-10-31

**Orders**
- **Fix and resubmit**: a denied or canceled order can be corrected and sent for approval again from its page — by the person who placed it, its approvers, the Buyer or Head Mentors. It keeps its history and goes through the workflow from the start; restocks it was for are picked back up from the order queue
- Denying or canceling an order takes its committed spend off the budget (it used to stay)

**Fixes**
- iPhone: the bottom tab bar no longer floats up the screen while scrolling long pages (it's solid now, like the top bar — the see-through blur is what iOS drew in the wrong place)

## 1.7.1 — 2026-10-30

- The robot picker is gone from the top bar. Tasks and the Gantt chart have a **Robot** filter beside their buttons instead (the BOM already had its own), and it only appears when the season has more than one robot — with one robot nothing is filtered

## 1.7.0 — 2026-10-30

**Volunteers**
- Every meeting needs enough adults — two confirmed adults by default. The new **Volunteers** page shows each upcoming meeting's coverage, and meetings that are short are flagged there and (for coordinators) on the calendar
- **Parent** role: sees what a Team Member sees, but view-only (enforced for every change, not just hidden buttons); a banner says so. Parents can still help pack for competitions and scan tools into their locations, and don't see Orders, Fleet or the robot picker
- **Volunteer coordinator** role: asks cleared adults to cover meetings, takes people off shifts, sets the default shift instructions and how many adults a meeting needs, gives a meeting its own special instructions, and gets a morning list of the next two weeks' gaps
- Head Mentors mark adults **Cleared to volunteer** (optionally until a date) on Team members. Only cleared adults can sign up; ones asked by the coordinator confirm or decline
- Reminders: the day before each shift (with the instructions), morning nudges for unanswered asks, and a heads-up to coordinators when someone drops out of a meeting that's now short
- Volunteer notifications can also come by **email** (on by default; each person can turn it off in Settings → Notifications)
- Phone number on your profile (optional), shown only to coordinators and Head Mentors
- Regenerating the meeting schedule keeps meetings that adults have signed up for

**Orders & budget**
- **Order approver** replaces the Treasurer role (existing Treasurers become Order approvers). It approves, denies and edits open orders only; setting up the budget, logging expenses and recording funding are now for Head Mentors, and vendors for Head Mentors and Inventory Admins
- **Tax & shipping per vendor**: once an order is approved, the Buyer enters each vendor's tax and shipping on the order's page. Tax counts as spend in the categories of that vendor's items; shipping goes to a new **Shipping** budget category. The order's total cost includes them, and spend already in the budget is updated when they change
- New or edited order: Enter no longer submits the order — it moves to the next item's Link box (adding an item after the last one), so you can paste link after link

**Change history & audit log**
- **Change history** for orders (including their items and tax & shipping), tasks, meetings and members: who changed which field, from what to what, and when. Open **History** on an order, task card, meeting or member. Changes made from Discord count as the linked member's; background jobs show as System. Kept for a year
- Member history covers name, email, phone, account status, roles, volunteer clearance and password changes (never the password); deleting a member erases their name and contact details from it
- **Audit log**: one place to find it — your profile menu — with changes alongside tool check-outs and safety reports, and **Export CSV** for the dates and filter you're viewing

**Team & notifications**
- **Team email**: Head Mentors can connect the team's own email account (Gmail, Outlook, Yahoo, iCloud, Zoho or any mail server) in Settings → Team email. Notifications, invites and welcome emails then come from the team; account emails still come from FRC Manager, which also sends anything the team's server fails to. The password is stored encrypted
- **Clear notifications**: ✕ on each one, or Clear all, in the bell menu and on the Notifications page. Marking all as read from the bell now works
- Roles explained and the guide list the new roles; the guide's Mentor row now matches what Mentors can do (Team Member access)
- The test site (frc-manager.vercel.app) is marked: an amber hazard stripe along the top, a TEST tag beside the logo, and “TEST ·” in the tab title

**Seasons & forms**
- Date ranges: picking a start date fills an empty end (or due) date with the same day — seasons, competitions, tasks, the Kanban custom range and the audit log filter
- Adding a Week competition explains to use the official FRC week number and why it matters for Week 0; the guide has a new “Week numbers and Week 0” section
- Meetings can be linked directly (`/calendar?meeting=…`)

**Fixes**
- First visit on a phone: the “turn on notifications” question and the “add to home screen” steps take turns instead of opening on top of each other
- iPhone: the bottom tab bar (and top bar) stay put while scrolling long pages
- Team members on phones: names no longer get squeezed into a one-letter column
- The meeting card shows its date correctly in every time zone

## 1.6.0 — 2026-10-24

**Seasons**
- Seasons have a **Kickoff** date separate from the season's start. Template tasks counted from kickoff (and the Week 1 estimate) use it; until it's set, the start date is used as before. The kickoff shows on the season card, the Gantt's kickoff line, the calendar and the calendar feed's KICKOFF event
- Home page countdown follows the season in order: the next season's start, kickoff, Week 0, each competition (“Now” while one is on), then the season's end

**Budget**
- The unused “Total estimated revenue” field is gone from Edit budget — money raised and pledged comes from the funding sources

**Fixes**
- Dates no longer show a day early in some time zones (e.g. the Tasks progress card and the Templates page)

## 1.5.0 — 2026-10-23

**Budget**
- Track the **goal** (planned spend), how much has been **raised** (received funding, including a new **Team account** type for the team's own contribution; pledges shown separately) and how much has been **spent**
- The Budget page shows goal, raised and spent as a line chart over the season, and the badge warns when spending runs ahead of what's been raised
- Funding sources can be edited (e.g. mark a pledge received, with the date) or removed, and partly received pledges record how much has come in
- Home page: the first tile is the budget — a small goal / raised / spent chart with the numbers on it — in place of the Robots tile, and opens the Budget page

**Seasons & meetings**
- Set up a future season ahead of time: it's listed under Upcoming seasons and becomes active by itself on its start date. The active season is always the one today falls in (between seasons, the last one stays active)
- Creating or editing a season no longer clears the form when something's wrong, and the error says what to fix
- A meeting day can have several meetings (e.g. 3–5 pm and 6–8 pm) — “+ another time” on that day; the calendar gets one meeting per slot
- Time fields use the device's own time picker (iOS / Android wheels, desktop clock field); the hour / minute dropdowns are only a fallback

**Tasks & templates**
- Task lengths count both ends: a task that takes 4 days starting Thursday is due Sunday, and the Gantt charts show it as 4 days with the bar covering Sunday. Existing template tasks and tasks scheduled after prerequisites keep the due dates and lengths that were entered — their start moves a day later to match
- Standard template and presentation: events run on their real days — Worlds Thursday–Sunday (4 days), week events Saturday–Sunday, district championship Thursday–Saturday — and tasks after another task start the day after it's due. Competitions are dated on their first day

## 1.4.2 — 2026-10-21

- Orders: product links up to 2,000 characters work again (long links were rejected at 300), and so do longer purchase-request justifications
- Clear form errors everywhere: instead of a bare “Invalid input”, they say which field (and which order item) is wrong and why — e.g. “Item 2 (“Swerve module”): Link is too long — 2,000 characters at most.”

## 1.4.1 — 2026-10-21

**Tasks**
- Tasks can be scheduled **after their prerequisites**: give a length and a gap, and the dates are worked out from the last prerequisite's due date. When a prerequisite moves, the task and everything scheduled after it move too. Template tasks timed from another task become these when the template is applied
- Tasks and template tasks have one notes field, **Details** (Markdown). The separate Description is gone: any existing description was moved to the top of the task's details, so nothing is lost. Template CSVs use a `details` column (multi-line Markdown works); older files with `description` still import
- Task links work: /tasks/<id> (and “Open in Tasks” on the Gantt and Fleet pages) opens the Tasks page with that task's card instead of a 404

**Fixes**
- Gantt: tasks with only a start or only a due date no longer break the page; they show on the one date they have
- Colors fixed across the app: about 870 styles written in an older Tailwind syntax (`bg-[--color-surface]`) did nothing under Tailwind v4, so some backgrounds were see-through (e.g. the New Task buttons over the form), borders and dividers fell back to bright lines, and secondary text wasn't gray. They now use the theme colors as intended, in light and dark mode
- Database connections state their SSL mode (verify-full — unchanged behavior), which silences a warning in the server logs

## 1.4.0 — 2026-10-21

**Task dependencies**
- Templates: time a task from **another task in the template** (“due 1 day after Design locked is due”) as well as from events. It moves with that task, becomes its prerequisite, and repeats per competition when that task does (“Strategy debrief — Week1” follows “Event — Week1”). Renames and deletes keep the chain intact
- Templates: pick a task's **prerequisites** in the Add / Edit / Clone dialogs; applying a template now links them on the real tasks (they were dropped before), and Save season as template keeps them
- Tasks: moving a task's due date offers to **move what comes after it** — its dependents and theirs — by the same number of days (finished tasks stay put)
- CSV: new `anchorTaskName` column for tasks timed from another task (anchor `TASK`)

**Standard template**
- New **Standard FRC season** template, built with input from a real team's plan: kickoff prep, game analysis, prototyping and “the purge”, dimensions and design lock, three purchasing waves, a practice drivetrain for early auto work, the build split by sub-team up to Week 0, durability testing and driver practice, Impact Award and pit materials, prep and debrief around each event, and season wrap-up — 16 milestones and 58 tasks
- The standard template can be **presented** (▶ Present on Templates), and its milestone list is generated from the template itself

**Gantt**
- Milestones are marked with a diamond in the sub-team color instead of a dot plus ◆, so rows no longer look double-bulleted (Tasks → Gantt and the presentation)

## 1.3.0 — 2026-10-21

**Tasks**
- Tasks have a **Details** section for longer notes — steps, links, checklists — written in Markdown with formatting buttons (bold, italic, heading, lists, checklist, link, code, quote) and a Preview tab. Details only show when a task is opened and on its create/edit forms, never on cards or lists
- The task card's buttons (Edit / Delete / Close, or Save / Cancel) stay pinned to the bottom while long details and forms scroll behind them
- Tasks → Gantt has a new look: rows in the order things happen with sub-team color dots, shaded weekends, day and week ticks, kickoff / Week 0 / competition / season-end lines, length and due date beside each bar, and a hover card with the full details
- Week 0 is the week before the Week 1 events: the season's Week0 event, else 7 days before Week 1 — worked out from its Week events or, with none, the typical FRC schedule (about seven weeks after kickoff). Template tasks and milestones tied to Week 0 are always added, never skipped

**Templates**
- The task form asks when a task is **due** (days before, on or after kickoff, Week 0, a competition…) and how long it **takes**, and spells out when it starts with this season's real dates. Milestones are just a due date, with no length
- **+ Add task** opens the form in a dialog; Edit and Clone dialogs keep Save / Cancel pinned to the bottom
- Milestones and tasks are listed in the order they happen (milestones by due date, tasks by start), even when they count from different dates — and the CSV export uses the same order
- Hover a milestone or task for its full details (timing in words, example dates, hours, prerequisites, description), and **Clone** any of them to add a similar one quickly
- Template tasks have Markdown details too, copied to the real task when the template is applied (and kept by Clone and Save season as template)
- Works on phones: each row shows the full name with its sub-team, priority, timing and Edit / Clone / Delete underneath

**Present a template**
- **▶ Present** opens full-screen 16:9 slides: the milestones, the whole plan as a Gantt chart, each phase up close, who's busy when, and a checklist of what might be missing. Keyboard, click or swipe to move through it
- Drawn on an example season for illustration: kickoff on the second Sunday of January, Week 2 and Week 4 events, district playoffs in Week 6 and Worlds on the third Saturday of April, with competitions on weekends
- Gantt slides use compact text so about twice as many rows fit; long lists scroll on one slide under a fixed date header. Weekends are shaded, rows have day and week ticks, sub-team colors match the app with a color key on every Gantt slide, and hovering a row shows its full details

## 1.2.0 — 2026-10-16

**Budget**
- Every order has a required budget category, and items can be charged to a different one. Spend is split across categories by item cost, so orders now count toward Robot Parts, Tools and the rest instead of nowhere
- The order page has a Budget card to change categories at any stage (even after arrival); spend already recorded moves with it
- The budget page shows spend in categories with nothing allocated, and an Uncategorized line linking to the orders that still need a category

**Roles**
- Team Admin is now **Buyer**: places approved orders, exports the purchasing spreadsheet, adds tracking and sets item statuses. Buyers can no longer invite people. The Buyer page moved to Orders → Buyer
- Budget Manager is now **Treasurer** (same access)
- Mentor now has the same access as Team Member. Give mentors Team Leadership (or other roles) for more; existing Mentors keep only Team Member access until a Head Mentor adds roles

**Security**
- Upgraded Next.js (16.4.1) and Auth.js (5.0.0-beta.32) for published security fixes
- Email confirmation: new accounts get a confirmation link; Google/Discord only sign in to a password account whose email is confirmed (or that connects them from Profile)
- Forgot password and reset links; change password, change email (confirmed from the new address) and "Sign out of all devices" in Profile → Account & security
- Rate limits on sign-in, registration, team access codes, invites, password resets and photo uploads; team access codes need 12+ characters (Generate makes one)
- Security headers (Content-Security-Policy, no framing, referrer and permissions policies)
- Exports can no longer carry spreadsheet formulas; tool photos must be real JPEG/PNG/WebP files; tool names are escaped when printing barcodes
- Platform tools (environment check, Discord command registration) are for super admins only

**Fixes**
- Scanning several tools in a row no longer asks for camera permission each time (the camera pauses between scans instead of switching off)

## 1.1.1 — 2026-10-14

- Sign in and sign up with Discord. A matching verified email signs into your existing account, and Discord sign-in also connects you for the bot. Google sign-in also matches an existing account by verified email. People who sign up with Google or Discord now pick their team on a "Finish signing up" step
- Audit log for Mentors, Team Leadership, Head Mentors and the Safety Captain: every tool check-out and check-in and every safety report between two dates, with a print view
- Tool locations with their own barcodes (LOC-0001, …): scan a tool and then a location to move it there, or scan a location to put several tools away; print labels for one or all
- Competition pack lists: a master list of tool groups and other items, "Start packing" for any event, and a banner on the Tools page so anyone can help pack by scanning tools into totes and cases. Printable, with what's in each location

## 1.0.1 — 2026-10-13

- Email when someone is approved: new members get a welcome email with their team and roles; founders of newly approved teams get one too

## 1.0.0 — 2026-10-09

First release of FRC Manager.

**Team & access**
- Accounts with roles: Team Member, Build Lead, Inventory Admin, Budget Manager, Safety Captain, Team Admin, Team Leadership, Mentor and Head Mentor — see Settings → Roles explained
- Invite people by email or with a Discord join link, choosing the roles they get
- New teams are approved by super admins (Settings → Team approvals)
- Approve, suspend and delete members (deleted members with history stay as "Former member")

**Planning**
- Seasons with start and end dates, competitions, and meeting schedules that keep the calendar up to date
- Tasks as Kanban (with sticky notes and tap-and-hold dragging on phones), list and Gantt views
- Task templates anchored to kickoff, competitions and season end
- Calendar with subscribable iCal feed and a public schedule page

**Parts, tools & money**
- Inventory with low stock, an order queue and retiring items
- Tools grouped by name, each with its own tag, checkout and condition
- Orders with item IDs, product lookup (Shopify vendors, WCP parts pages, Amazon), drafts, editing, approvals, Team Admin CSV export and tracking
- Budget with committed and actual spend

**Safety & robots**
- Incidents, certifications, inspection checklists and PRECHECK status per robot
- Robot fleet with weights and season archive

**Everywhere**
- Notifications in the app and as push, with quiet hours and per-topic settings
- Discord bot: slash commands, channel updates and account linking
- Installable on iPhone and Android, with per-device app icons and themes
- Each deploy upgrades its own database before going live
