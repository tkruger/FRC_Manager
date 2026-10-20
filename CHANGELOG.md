# Changelog

## Unreleased

- Template Edit and Clone dialogs: Save/Add copy and Cancel stay pinned to the bottom while the form scrolls behind them (like the task card)
- Presentation: the Milestones slide now comes before the whole-plan Timeline
- Presentation Gantt slides: smaller text, a one-line title and slimmer margins, so about twice as many rows fit and the chart gets most of the slide
- Presentation example season: the district playoffs are in Week 6 (they landed in Week 5 before), with Worlds on the third Saturday of April
- Task card: the Edit/Delete/Close and Save/Cancel buttons stay pinned to the bottom of the card while long details and forms scroll behind them
- Tasks have a **Details** section for longer notes — steps, links, checklists — written in Markdown with formatting buttons (bold, italic, heading, lists, checklist, link, code, quote) and a Preview tab. Details only show when a task is opened (and on its create/edit forms), never on cards or lists. Template tasks have details too, copied to the real task when the template is applied (and kept by Save season as template and Clone)
- Week 0 is the week before the Week 1 events: the season's Week0 event, else 7 days before Week 1 — worked out from its Week events or, with none, the typical FRC schedule (about seven weeks after kickoff). Template tasks and milestones tied to Week 0 are always added, never skipped
- Template Clone buttons match Edit (outlined)
- Template pages: hover a milestone or task for its full details (timing in words, example dates, hours, prerequisites, description), and **Clone** any of them to add a similar one quickly
- Presentation: hover any Gantt row for its full name, dates, rule and description; sub-team colors now match the rest of the app, and milestones are dark diamonds
- Tasks → Gantt matches the presentation: rows in the order things happen with sub-team color dots, shaded weekends, day and week ticks, kickoff / Week 0 / competition / season-end lines, length and due date beside each bar, and a hover card with the full details
- Presentation: milestones in true date order, a sub-team color key from the first slide (and on every Gantt slide), day and week ticks and shaded weekends on Gantt rows, and long lists scroll on one slide instead of splitting
- Template pages list milestones and tasks in the order they happen (tasks by start, milestones by due date), even when they count from different dates
- **Present** a template: full-screen 16:9 slides with the whole plan as a Gantt chart, the milestones, each phase up close, who's busy when, and a checklist of what might be missing. Shown on an example season (kickoff on the second Sunday of January, Week 2 and Week 4, a regional playoff and Worlds in April — competitions on weekends) for illustration. Keyboard, click or swipe to move through it
- Template tasks: the form now asks when a task is **due** (days before, on or after kickoff, Week 0, a competition…) and how long it **takes**, and spells out when it starts with this season's real dates. Milestones are just a due date, with no length

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
