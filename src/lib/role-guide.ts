// What each team role is for and what it can do — shown on Settings → Roles explained.
// Keep in step with the permission checks in the app (rbac.ts, actions, pages). Head
// Mentors can do everything; Mentor counts as Team Leadership (see withImpliedRoles).

import type { Role } from "@/generated/prisma";

export const ROLE_ORDER: Role[] = [
  "TEAM_MEMBER", "BUILD_LEAD", "INVENTORY_ADMIN", "BUDGET_MANAGER", "SAFETY_CAPTAIN",
  "TEAM_ADMIN", "TEAM_LEADERSHIP", "MENTOR", "HEAD_MENTOR",
];

export const ROLE_SUMMARY: Record<Role, { who: string; summary: string }> = {
  TEAM_MEMBER:     { who: "Every student and mentor",       summary: "Uses the app day to day: tasks, tools, inventory, the calendar, orders and safety reports." },
  BUILD_LEAD:      { who: "Students running the build",     summary: "Runs the build: manages meetings and task templates, and edits robots and tools." },
  INVENTORY_ADMIN: { who: "Whoever looks after the shop",   summary: "Looks after parts and tools: manages and retires inventory, edits tools, manages vendors and templates, awards certifications." },
  BUDGET_MANAGER:  { who: "Treasurer or finance mentor",    summary: "Owns the money: sets up the budget, logs expenses and approves orders over the budget threshold." },
  SAFETY_CAPTAIN:  { who: "Safety lead",                    summary: "Keeps the shop safe: awards and revokes certifications and hears about every safety incident." },
  TEAM_ADMIN:      { who: "Whoever places the orders",      summary: "Buys what's approved: works the To order list, exports the purchasing spreadsheet, adds tracking links, invites people." },
  TEAM_LEADERSHIP: { who: "Captains and student leaders",   summary: "Runs the team: approves members and assigns roles, invites people, manages meetings, Discord and the team time zone, and acts as captain on orders." },
  MENTOR:          { who: "Mentors",                        summary: "Same access as Team Leadership: approves members, assigns roles, invites people, manages meetings, Discord and orders." },
  HEAD_MENTOR:     { who: "The lead mentor (one or more)",  summary: "Everything, including seasons, robots, the purchase workflow and granting the Head Mentor role." },
};

/** Roles that can do something, besides Head Mentor (who can do everything) */
type Who = Role[] | "everyone";

export const CAPABILITIES: { area: string; items: { action: string; who: Who }[] }[] = [
  {
    area: "Tasks & calendar",
    items: [
      { action: "Create, edit and update tasks; move cards on the board", who: "everyone" },
      { action: "Manage task templates",                                 who: ["BUILD_LEAD", "INVENTORY_ADMIN"] },
      { action: "Add, change and cancel meetings",                       who: ["BUILD_LEAD", "TEAM_LEADERSHIP", "MENTOR"] },
    ],
  },
  {
    area: "Inventory & tools",
    items: [
      { action: "See inventory, order items, check tools in and out",    who: "everyone" },
      { action: "See low stock and the order queue",                     who: ["BUILD_LEAD", "INVENTORY_ADMIN", "TEAM_LEADERSHIP", "MENTOR"] },
      { action: "Add, edit and retire inventory items",                  who: ["INVENTORY_ADMIN"] },
      { action: "Add and edit tools",                                    who: ["BUILD_LEAD", "INVENTORY_ADMIN", "TEAM_LEADERSHIP", "MENTOR"] },
      { action: "Manage vendors",                                        who: ["INVENTORY_ADMIN", "BUDGET_MANAGER"] },
    ],
  },
  {
    area: "Orders & budget",
    items: [
      { action: "Place orders and mark items arrived",                   who: "everyone" },
      { action: "Approve or deny orders (default workflow)",             who: ["BUDGET_MANAGER"] },
      { action: "Edit open orders",                                      who: ["BUDGET_MANAGER", "TEAM_ADMIN"] },
      { action: "Team Admin page: to-order list, CSV export, tracking",  who: ["TEAM_ADMIN", "TEAM_LEADERSHIP", "MENTOR"] },
      { action: "Set any item's status by hand",                         who: ["TEAM_ADMIN", "TEAM_LEADERSHIP", "MENTOR"] },
      { action: "Set up the budget and log expenses",                    who: ["BUDGET_MANAGER"] },
    ],
  },
  {
    area: "Safety",
    items: [
      { action: "Report incidents, run PRECHECK and inspections",        who: "everyone" },
      { action: "Award and revoke certifications",                       who: ["SAFETY_CAPTAIN", "INVENTORY_ADMIN"] },
    ],
  },
  {
    area: "Team & settings",
    items: [
      { action: "Invite people by email or Discord",                     who: ["TEAM_ADMIN", "TEAM_LEADERSHIP", "MENTOR"] },
      { action: "Approve new members and assign roles",                  who: ["TEAM_LEADERSHIP", "MENTOR"] },
      { action: "Edit robots",                                           who: ["BUILD_LEAD", "TEAM_LEADERSHIP", "MENTOR"] },
      { action: "Connect Discord, set the team time zone",               who: ["TEAM_LEADERSHIP", "MENTOR"] },
      { action: "See the purchase workflow",                             who: ["TEAM_LEADERSHIP", "MENTOR"] },
      { action: "Seasons, competitions, adding robots, editing the purchase workflow, granting Head Mentor", who: [] },
    ],
  },
];
