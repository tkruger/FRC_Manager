# Changelog

## Unreleased

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
