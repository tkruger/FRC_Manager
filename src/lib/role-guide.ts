// What each team role is for and what it can do — shown on Settings → Roles explained.
// Keep in step with the permission checks in the app (rbac.ts, actions, pages). Head
// Mentors can do everything; Mentor has Team Member access unless given other roles;
// Parents see what Team Members see but can't change anything (src/lib/access/read-only.ts).

import type { Role } from "@/generated/prisma";
import { ALL_ROLES } from "@/lib/rbac";

export const ROLE_ORDER: Role[] = ALL_ROLES;

export const ROLE_SUMMARY: Record<Role, { who: string; summary: string }> = {
  TEAM_MEMBER:     { who: "Every student and mentor",       summary: "Uses the app day to day: tasks, tools, inventory, the calendar, orders and safety reports." },
  BUILD_LEAD:      { who: "Students running the build",     summary: "Runs the build: manages meetings and task templates, and edits robots and tools." },
  INVENTORY_ADMIN: { who: "Whoever looks after the shop",   summary: "Looks after parts and tools: manages and retires inventory, edits tools, manages vendors and templates, awards certifications." },
  ORDER_APPROVER:  { who: "Whoever signs off on spending",  summary: "Approves or denies orders (above the auto-approve limit) and can edit open orders. The budget itself is the Head Mentor's." },
  SAFETY_CAPTAIN:  { who: "Safety lead",                    summary: "Keeps the shop safe: awards and revokes certifications and hears about every safety incident." },
  BUYER:           { who: "Whoever places the orders",      summary: "Buys what's approved: works the To order list, exports the purchasing spreadsheet, adds tracking links and sets item statuses." },
  TEAM_LEADERSHIP: { who: "Captains and student leaders",   summary: "Runs the team: approves members and assigns roles, invites people, manages meetings, Discord and the team time zone, and acts as captain on orders." },
  MENTOR:          { who: "Mentors",                        summary: "Marks someone as a mentor. Same access as Team Member — add Team Leadership or other roles for more." },
  HEAD_MENTOR:     { who: "The lead mentor (one or more)",  summary: "Everything, including seasons, robots, the purchase workflow, granting the Head Mentor role and clearing adults to volunteer." },
  PARENT:          { who: "Students' parents",              summary: "Sees what a Team Member sees (apart from orders and robots), but view-only — except helping pack for competitions and scanning tools into locations. Once a Head Mentor clears them, they can sign up to volunteer at meetings." },
  VOLUNTEER_COORDINATOR: { who: "Whoever organizes adult volunteers", summary: "Makes sure every meeting has enough cleared adults: assigns volunteers, sets the shift instructions and hears about meetings that are short. View-only elsewhere unless they have other roles." },
};

/** Roles that can do something, besides Head Mentor (who can do everything). "everyone":
 *  every role but Parent (view-only); "all": Parents too; "cleared": any adult a Head Mentor
 *  cleared to volunteer */
type Who = Role[] | "everyone" | "all" | "cleared";

export const CAPABILITIES: { area: string; items: { action: string; who: Who }[] }[] = [
  {
    area: "Tasks & calendar",
    items: [
      { action: "Create, edit and update tasks; move cards on the board", who: "everyone" },
      { action: "Manage task templates",                                 who: ["BUILD_LEAD", "INVENTORY_ADMIN"] },
      { action: "Add, change and cancel meetings",                       who: ["BUILD_LEAD", "TEAM_LEADERSHIP"] },
    ],
  },
  {
    area: "Inventory & tools",
    items: [
      { action: "See inventory, order items, check tools in and out",    who: "everyone" },
      { action: "See low stock and the order queue",                     who: ["BUILD_LEAD", "INVENTORY_ADMIN", "TEAM_LEADERSHIP"] },
      { action: "Add, edit and retire inventory items",                  who: ["INVENTORY_ADMIN"] },
      { action: "Add and edit tools and tool locations",                 who: ["BUILD_LEAD", "INVENTORY_ADMIN", "TEAM_LEADERSHIP"] },
      { action: "Help pack for competitions, scan tools into locations", who: "all" },
      { action: "Edit the competition pack list, start and finish packing", who: ["TEAM_LEADERSHIP"] },
      { action: "Manage vendors",                                        who: ["INVENTORY_ADMIN"] },
    ],
  },
  {
    area: "Orders & budget",
    items: [
      { action: "Place orders and mark items arrived",                   who: "everyone" },
      { action: "Approve or deny orders (default workflow)",             who: ["ORDER_APPROVER"] },
      { action: "Edit open orders",                                      who: ["ORDER_APPROVER", "BUYER"] },
      { action: "Buyer page: to-order list, CSV export, tracking",  who: ["BUYER", "TEAM_LEADERSHIP"] },
      { action: "Set any item's status by hand",                         who: ["BUYER", "TEAM_LEADERSHIP"] },
      { action: "Set up the budget, log expenses and record funding",   who: [] },
    ],
  },
  {
    area: "Volunteers",
    items: [
      { action: "Sign up for (or confirm) a meeting's volunteer shift",   who: "cleared" },
      { action: "Assign volunteers, set shift instructions, see coverage", who: ["VOLUNTEER_COORDINATOR"] },
      { action: "Clear an adult to volunteer",                             who: [] },
    ],
  },
  {
    area: "Safety",
    items: [
      { action: "Report incidents, run PRECHECK and inspections",        who: "everyone" },
      { action: "Award and revoke certifications",                       who: ["SAFETY_CAPTAIN", "INVENTORY_ADMIN"] },
      { action: "See and print the audit log (tool check-outs and safety reports)", who: ["SAFETY_CAPTAIN", "TEAM_LEADERSHIP"] },
    ],
  },
  {
    area: "Team & settings",
    items: [
      { action: "Invite people by email or Discord",                     who: ["TEAM_LEADERSHIP"] },
      { action: "Approve new members and assign roles",                  who: ["TEAM_LEADERSHIP"] },
      { action: "Edit robots",                                           who: ["BUILD_LEAD", "TEAM_LEADERSHIP"] },
      { action: "Connect Discord, set the team time zone",               who: ["TEAM_LEADERSHIP"] },
      { action: "See the purchase workflow",                             who: ["TEAM_LEADERSHIP"] },
      { action: "Seasons, competitions, adding robots, editing the purchase workflow, granting Head Mentor", who: [] },
    ],
  },
];
