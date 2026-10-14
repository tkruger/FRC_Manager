# Changelog

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
