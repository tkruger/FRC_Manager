// Discord API utility — webhook-based interactions (serverless compatible)
// Handles: Ed25519 signature verification, REST calls, embed formatting

import crypto from "crypto";

const DISCORD_API = "https://discord.com/api/v10";

// ─── Signature verification ────────────────────────────────────────────────

export function verifyDiscordSignature(
  publicKey: string,
  signature: string,
  timestamp: string,
  body: string
): boolean {
  try {
    return crypto.verify(
      "ed25519",
      Buffer.from(timestamp + body),
      Buffer.from(publicKey, "hex"),
      Buffer.from(signature, "hex")
    );
  } catch {
    return false;
  }
}

// ─── REST helpers ──────────────────────────────────────────────────────────

export async function discordRequest(
  endpoint: string,
  options: RequestInit = {}
): Promise<any> {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) throw new Error("DISCORD_BOT_TOKEN not set");

  const res = await fetch(`${DISCORD_API}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Discord API ${res.status}: ${text}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

/** Send a message to a channel */
export async function sendChannelMessage(
  channelId: string,
  content: string | null,
  embeds?: DiscordEmbed[]
): Promise<void> {
  await discordRequest(`/channels/${channelId}/messages`, {
    method: "POST",
    body: JSON.stringify({ content, embeds }),
  });
}

/** Send a DM to a user */
export async function sendDM(
  discordUserId: string,
  content: string | null,
  embeds?: DiscordEmbed[]
): Promise<void> {
  // Open a DM channel first
  const dm = await discordRequest("/users/@me/channels", {
    method: "POST",
    body: JSON.stringify({ recipient_id: discordUserId }),
  });
  await sendChannelMessage(dm.id, content, embeds);
}

/** Follow up on a deferred interaction */
export async function followUpInteraction(
  applicationId: string,
  token: string,
  content: string | null,
  embeds?: DiscordEmbed[],
  ephemeral = false
): Promise<void> {
  await fetch(
    `${DISCORD_API}/webhooks/${applicationId}/${token}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content,
        embeds,
        flags: ephemeral ? 64 : undefined,
      }),
    }
  );
}

// ─── Interaction response helpers ──────────────────────────────────────────

export const RESPONSE_TYPES = {
  PONG: 1,
  CHANNEL_MESSAGE: 4,
  DEFERRED_CHANNEL_MESSAGE: 5,
} as const;

export function pong() {
  return Response.json({ type: RESPONSE_TYPES.PONG });
}

export function reply(content: string | null, embeds?: DiscordEmbed[], ephemeral = false) {
  return Response.json({
    type: RESPONSE_TYPES.CHANNEL_MESSAGE,
    data: {
      content,
      embeds,
      flags: ephemeral ? 64 : undefined,
    },
  });
}

export function ephemeralReply(content: string | null, embeds?: DiscordEmbed[]) {
  return reply(content, embeds, true);
}

export function deferredReply(ephemeral = false) {
  return Response.json({
    type: RESPONSE_TYPES.DEFERRED_CHANNEL_MESSAGE,
    data: { flags: ephemeral ? 64 : undefined },
  });
}

// ─── Embed builder ─────────────────────────────────────────────────────────

export interface DiscordEmbed {
  title?: string;
  description?: string;
  color?: number;
  fields?: { name: string; value: string; inline?: boolean }[];
  footer?: { text: string };
  timestamp?: string;
  url?: string;
}

export const COLORS = {
  primary:   0xE63946,  // FRC red
  success:   0x34C77B,
  warning:   0xF59E0B,
  danger:    0xE63946,
  info:      0x4F7FE8,
  neutral:   0x64748B,
} as const;

export function embed(opts: DiscordEmbed): DiscordEmbed {
  return { color: COLORS.primary, ...opts };
}

// ─── Command option extraction ─────────────────────────────────────────────

export function getOption(options: any[], name: string): string | number | boolean | undefined {
  return options?.find((o: any) => o.name === name)?.value;
}

export function getStringOption(options: any[], name: string): string | undefined {
  const v = getOption(options, name);
  return v != null ? String(v) : undefined;
}

export function getIntOption(options: any[], name: string): number | undefined {
  const v = getOption(options, name);
  return v != null ? Number(v) : undefined;
}

// ─── Slash command definitions for registration ────────────────────────────

export const SLASH_COMMANDS = [
  // General
  { name: "link",    description: "Link your Discord account to your team platform account" },
  { name: "unlink",  description: "Unlink your Discord account from your team platform account" },
  { name: "whoami",  description: "Show your linked platform name, team, and roles" },
  { name: "help",    description: "List available commands",
    options: [{ name: "command", description: "Specific command to get help for", type: 3, required: false }] },
  { name: "team",    description: "Team commands",
    options: [{
      name: "status", description: "Show build season dashboard summary",
      type: 1, // SUB_COMMAND
    }]
  },

  // Tasks
  { name: "tasks", description: "View tasks",
    options: [
      { name: "mine",  description: "Your assigned tasks", type: 1,
        options: [{ name: "status", description: "Filter by status", type: 3, required: false,
          choices: [
            { name: "Not Started", value: "NOT_STARTED" },
            { name: "In Progress", value: "IN_PROGRESS" },
            { name: "Blocked", value: "BLOCKED" },
          ]}]},
      { name: "today",   description: "All tasks due today", type: 1 },
      { name: "overdue", description: "All overdue incomplete tasks", type: 1 },
    ]
  },
  { name: "task", description: "Update a task",
    options: [
      { name: "done",  description: "Mark a task complete",      type: 1,
        options: [{ name: "name", description: "Task name or partial match", type: 3, required: true }] },
      { name: "start", description: "Mark a task in progress",   type: 1,
        options: [{ name: "name", description: "Task name or partial match", type: 3, required: true }] },
      { name: "block", description: "Mark a task as blocked",    type: 1,
        options: [
          { name: "name",   description: "Task name", type: 3, required: true },
          { name: "reason", description: "Reason it is blocked", type: 3, required: true },
        ]},
    ]
  },
  { name: "milestone", description: "View milestones",
    options: [
      { name: "next", description: "Next upcoming milestone and days remaining", type: 1 },
      { name: "list", description: "All milestones with status and dates",       type: 1 },
    ]
  },

  // Tools
  { name: "tool", description: "Tool management",
    options: [
      { name: "status",   description: "Check tool availability", type: 1,
        options: [{ name: "name", description: "Tool name or asset tag", type: 3, required: true }] },
      { name: "checkout", description: "Check out a tool",        type: 1,
        options: [
          { name: "name",    description: "Tool name or asset tag", type: 3, required: true },
          { name: "purpose", description: "What will you use it for", type: 3, required: false },
        ]},
      { name: "checkin",  description: "Return a tool you checked out", type: 1,
        options: [{ name: "name", description: "Tool name", type: 3, required: true }] },
      { name: "overdue",  description: "List all overdue tool checkouts", type: 1 },
    ]
  },

  // Inventory
  { name: "stock", description: "Inventory",
    options: [
      { name: "check", description: "Check stock level of an item", type: 1,
        options: [{ name: "item", description: "Item name", type: 3, required: true }] },
      { name: "list",  description: "List inventory items", type: 1,
        options: [{ name: "low_only", description: "Only show low/critical items", type: 5, required: false }] },
    ]
  },

  // Orders
  { name: "order", description: "Purchase requests",
    options: [
      { name: "request", description: "Submit a purchase request", type: 1,
        options: [
          { name: "item",   description: "Item name",   type: 3, required: true },
          { name: "qty",    description: "Quantity",    type: 4, required: true },
          { name: "vendor", description: "Vendor name", type: 3, required: true },
          { name: "cost",   description: "Unit cost ($)", type: 10, required: true },
          { name: "reason", description: "Why is this needed?", type: 3, required: true },
        ]},
      { name: "status",  description: "Check status of your requests", type: 1 },
      { name: "pending", description: "List approved requests waiting to be ordered", type: 1 },
      { name: "approve", description: "Approve a purchase request", type: 1,
        options: [
          { name: "id",    description: "Request number (e.g. 47)", type: 4, required: true },
          { name: "notes", description: "Optional approval notes", type: 3, required: false },
        ]},
      { name: "deny", description: "Deny a purchase request", type: 1,
        options: [
          { name: "id",     description: "Request number", type: 4, required: true },
          { name: "reason", description: "Reason for denial", type: 3, required: true },
        ]},
    ]
  },
];
