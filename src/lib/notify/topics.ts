// Notification topics users can subscribe to. Shared by server (delivery) and
// client (settings UI). Add a topic here and it shows up in everyone's settings.

export interface TopicDef {
  id:          string;
  group:       string;
  label:       string;
  description: string;
  /** Who actually receives it — shown in settings so people know why they get it */
  audience:    string;
  defaultInApp: boolean;
  defaultPush:  boolean;
  /** Can't be turned off in-app (e.g. account status) */
  required?:   boolean;
}

export const TOPICS = [
  // Procurement
  {
    id: "purchase.action_needed", group: "Purchasing",
    label: "Orders waiting on you",
    description: "An order reaches a step you can act on (approve, order, receive).",
    audience: "Roles assigned to that step in the purchase workflow",
    defaultInApp: true, defaultPush: true,
  },
  {
    id: "purchase.reminders", group: "Purchasing",
    label: "Reminders until you act",
    description: "Repeats while an order is still waiting on you — daily for routine orders, every few hours for urgent and emergency ones.",
    audience: "Roles assigned to that step in the purchase workflow",
    defaultInApp: false, defaultPush: true,
  },
  {
    id: "purchase.my_requests", group: "Purchasing",
    label: "Updates on my orders",
    description: "Your order is approved, denied, ordered, delivered or cancelled.",
    audience: "The person who submitted the order",
    defaultInApp: true, defaultPush: true,
  },
  {
    id: "inventory.low_stock", group: "Purchasing",
    label: "Low stock",
    description: "An item falls to its minimum and is added to the order queue.",
    audience: "Roles chosen in the purchase workflow trigger",
    defaultInApp: true, defaultPush: false,
  },

  // Meetings
  {
    id: "meetings.reminder", group: "Meetings",
    label: "Meeting reminders",
    description: "The day before and an hour or two before each team meeting.",
    audience: "Everyone on the team",
    defaultInApp: false, defaultPush: true,
  },
  {
    id: "meetings.changes", group: "Meetings",
    label: "Meeting changes",
    description: "A meeting is added, moved, cancelled or reinstated.",
    audience: "Everyone on the team",
    defaultInApp: true, defaultPush: true,
  },

  // Tasks
  {
    id: "tasks.assigned", group: "Tasks",
    label: "Assigned to a task",
    description: "Someone assigns you to a task.",
    audience: "The assignee",
    defaultInApp: true, defaultPush: true,
  },
  {
    id: "tasks.due", group: "Tasks",
    label: "Due and overdue tasks",
    description: "A morning digest of your tasks due today, due tomorrow, or overdue.",
    audience: "Task assignees",
    defaultInApp: true, defaultPush: true,
  },
  {
    id: "tasks.blocked", group: "Tasks",
    label: "Blocked tasks",
    description: "A task is marked blocked.",
    audience: "Its assignees, Build Leads and Head Mentors",
    defaultInApp: true, defaultPush: false,
  },

  // Competitions
  {
    id: "competitions.countdown", group: "Competitions",
    label: "Competition countdown",
    description: "A daily countdown each morning for the 30 days before each event.",
    audience: "Everyone on the team",
    defaultInApp: false, defaultPush: true,
  },

  // Tools & safety
  {
    id: "tools.due", group: "Tools & safety",
    label: "Tool returns",
    description: "A tool you checked out is due back today or is overdue.",
    audience: "The person who checked it out",
    defaultInApp: true, defaultPush: true,
  },
  {
    id: "certs.expiring", group: "Tools & safety",
    label: "Expiring certifications",
    description: "Your tool or safety certification expires within two weeks.",
    audience: "The certified member",
    defaultInApp: true, defaultPush: true,
  },
  {
    id: "safety.incident", group: "Tools & safety",
    label: "Safety incidents",
    description: "A safety incident is reported.",
    audience: "Safety Captains and Head Mentors",
    defaultInApp: true, defaultPush: true,
  },

  // Team
  {
    id: "members.approval_needed", group: "Team",
    label: "New members to approve",
    description: "Someone registers and is waiting for approval.",
    audience: "Head Mentors and Team Leadership",
    defaultInApp: true, defaultPush: true,
  },
  {
    id: "account", group: "Team",
    label: "My account",
    description: "Your account is approved or your roles change.",
    audience: "You",
    defaultInApp: true, defaultPush: true, required: true,
  },
] as const satisfies readonly TopicDef[];

export type TopicId = (typeof TOPICS)[number]["id"];

export const TOPIC_BY_ID: Record<string, TopicDef> = Object.fromEntries(TOPICS.map((t) => [t.id, t]));

export const TOPIC_GROUPS = [...new Set(TOPICS.map((t) => t.group))];
