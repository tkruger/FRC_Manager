// Slash command handlers — each returns a Discord interaction response
// All DB access uses the team's active season and the caller's linked account

import { prisma } from "@/lib/prisma";
import { appUrl } from "@/lib/app-url";
import {
  embed, ephemeralReply, reply, COLORS, getStringOption, getIntOption,
  type DiscordEmbed, followUpInteraction,
} from "@/lib/discord";
import { differenceInCalendarDays } from "date-fns";
import type { DiscordConfig, DiscordLink } from "@/generated/prisma";
import { performCurrentStepAction, describeRequestState, type Actor } from "@/lib/workflow/engine";
import { createOrder } from "@/lib/orders/create";
import { itemRef } from "@/lib/orders/constants";
import { competitionCountdown } from "@/lib/competition";

async function actorFor(userId: string, teamId: string): Promise<Actor> {
  const user = await prisma.user.findUniqueOrThrow({
    where:  { id: userId },
    select: { name: true, roles: { select: { role: true } } },
  });
  return { id: userId, name: user.name, roles: user.roles.map((r) => r.role), teamId };
}

// ─── Context resolution ────────────────────────────────────────────────────

interface InteractionContext {
  guildId: string;
  discordUserId: string;
  config: DiscordConfig;
  link: DiscordLink | null;
  teamId: string;
}

export async function resolveContext(
  guildId: string,
  discordUserId: string
): Promise<InteractionContext | null> {
  const config = await prisma.discordConfig.findFirst({
    where: { guildId, active: true },
  });
  if (!config) return null;

  // Only count the link if its member is active and on the team that owns this server —
  // otherwise suspended members, or members of another team, could act through Discord
  const link = await prisma.discordLink.findFirst({
    where: { discordUserId, revokedAt: null, user: { status: "ACTIVE", teamId: config.teamId } },
  });

  return { guildId, discordUserId, config, link, teamId: config.teamId };
}

/** Require a linked account; returns error response if missing */
function requireLink(link: DiscordLink | null): Response | null {
  if (!link) {
    return ephemeralReply(
      "❌ **Account not linked.** Run `/link` to connect your Discord account to your platform account first."
    );
  }
  return null;
}

/** Check if user has one of the required roles */
async function hasRole(userId: string, roles: string[]): Promise<boolean> {
  const userRoles = await prisma.userRole.findMany({ where: { userId } });
  return userRoles.some((r) => roles.includes(r.role) || r.role === "HEAD_MENTOR");
}

async function getActiveSeason(teamId: string) {
  return prisma.season.findFirst({
    where:   { teamId, isActive: true },
    include: { competitionEvents: { select: { name: true, stage: true, stageNumber: true, startDate: true, endDate: true } } },
  });
}

// ─── /link ─────────────────────────────────────────────────────────────────

export async function handleLink(
  discordUserId: string,
  discordUsername: string,
  config: DiscordConfig
): Promise<Response> {
  // Check already linked
  const existing = await prisma.discordLink.findFirst({
    where: { discordUserId, revokedAt: null },
    include: { user: { select: { name: true } } },
  });
  if (existing) {
    return ephemeralReply(
      `✅ Already linked to **${existing.user.name}**. Use \`/unlink\` first if you want to relink.`
    );
  }

  // The token carries who's linking; they pick their platform account on the web.
  // userId holds the Discord details as JSON until the web page resolves it.
  const token = await prisma.discordLinkToken.create({
    data: {
      userId:    JSON.stringify({ discordUserId, discordUsername, teamId: config.teamId }),
      token:     crypto.randomUUID(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 min
    },
  });

  const baseUrl = appUrl();
  const linkUrl = `${baseUrl}/settings/discord/link?token=${token.token}`;

  // A private reply only this person can see — no DM needed (DMs are often blocked and slower)
  return ephemeralReply(null, [
    embed({
      title: "🔗 Link your FRC Manager account",
      description:
        `**[Click here to link your account](${linkUrl})**

` +
        `Sign in to FRC Manager if asked, and your Discord account will be connected.
` +
        `⏰ This link expires in **10 minutes**.`,
      color: COLORS.info,
    }),
  ]);
}

// ─── /unlink ───────────────────────────────────────────────────────────────

export async function handleUnlink(link: DiscordLink | null): Promise<Response> {
  const err = requireLink(link);
  if (err) return err;

  await prisma.discordLink.update({
    where: { id: link!.id },
    data: { revokedAt: new Date() },
  });
  return ephemeralReply("✅ Your Discord account has been unlinked from the platform.");
}

// ─── /whoami ───────────────────────────────────────────────────────────────

export async function handleWhoami(link: DiscordLink | null): Promise<Response> {
  const err = requireLink(link);
  if (err) return err;

  const user = await prisma.user.findUnique({
    where: { id: link!.userId },
    include: { roles: true, team: { select: { teamNumber: true, name: true } } },
  });
  if (!user) return ephemeralReply("❌ Platform account not found. Try `/unlink` and `/link` again.");

  const roleLabels: Record<string, string> = {
    TEAM_MEMBER: "Team Member", BUILD_LEAD: "Build Lead",
    INVENTORY_ADMIN: "Inventory Admin", BUDGET_MANAGER: "Budget Manager", TEAM_ADMIN: "Team Admin",
    SAFETY_CAPTAIN: "Safety Captain", HEAD_MENTOR: "Head Mentor",
  };

  return ephemeralReply(null, [
    embed({
      title: "👤 Your Platform Account",
      fields: [
        { name: "Name",  value: user.name,  inline: true },
        { name: "Team",  value: `Team ${user.team?.teamNumber} — ${user.team?.name ?? ""}`, inline: true },
        { name: "Roles", value: user.roles.map((r) => roleLabels[r.role] ?? r.role).join(", ") || "None" },
        { name: "Email", value: user.email, inline: true },
      ],
      color: COLORS.info,
    }),
  ]);
}

// ─── /team status ──────────────────────────────────────────────────────────

export async function handleTeamStatus(ctx: InteractionContext): Promise<Response> {
  const err = requireLink(ctx.link);
  if (err) return err;

  const season = await getActiveSeason(ctx.teamId);
  if (!season) return ephemeralReply("❌ No active season configured.");

  const now = new Date();
  const daysToEnd = differenceInCalendarDays(season.endDate, now);
  const kickoffDay  = differenceInCalendarDays(now, season.kickoffDate) + 1;
  const totalDays   = differenceInCalendarDays(season.endDate, season.kickoffDate);
  const nextComp    = competitionCountdown(season.competitionEvents, now);

  const [taskStats, robotData, inventoryAlerts, openCheckouts, nextMilestone] = await Promise.all([
    prisma.task.groupBy({
      by: ["status"],
      where: { seasonId: season.id },
      _count: { id: true },
    }),
    prisma.robot.findFirst({
      where: { seasonId: season.id, role: "COMPETITION", archived: false },
      include: {
        weightSnaps: { orderBy: { createdAt: "desc" }, take: 1, select: { weight: true } },
        bomItems:    { select: { totalFmv: true } },
      },
    }),
    prisma.baseInventoryItem.count({
      where: { seasonId: season.id, archived: false, currentStock: { lte: prisma.baseInventoryItem.fields.minStockThreshold } },
    }).catch(() => 0),
    prisma.toolCheckout.count({ where: { returnedAt: null, tool: { teamId: ctx.teamId } } }),
    prisma.task.findFirst({
      where: { seasonId: season.id, isMilestone: true, status: { not: "COMPLETE" }, dueDate: { gte: now } },
      orderBy: { dueDate: "asc" },
      select: { name: true, dueDate: true },
    }),
  ]);

  const total    = taskStats.reduce((s, g) => s + g._count.id, 0);
  const complete = taskStats.find((g) => g.status === "COMPLETE")?._count.id ?? 0;
  const overdue  = await prisma.task.count({ where: { seasonId: season.id, status: { not: "COMPLETE" }, dueDate: { lt: now } } });
  const blocked  = taskStats.find((g) => g.status === "BLOCKED")?._count.id ?? 0;

  const weight = robotData?.weightSnaps[0]?.weight ?? 0;
  const bomFmv = robotData?.bomItems.reduce((s, b) => s + (b.totalFmv ?? 0), 0) ?? 0;

  const pct = total > 0 ? Math.round((complete / total) * 100) : 0;

  const weightBar = weight > 0 ? `${weight.toFixed(1)} lbs / 115 lbs ${weight > 103 ? "🔴" : weight > 90 ? "🟡" : "🟢"}` : "No data";

  const lines = [
    `**Day ${kickoffDay} of ${totalDays}** · ${nextComp ? `${nextComp.name} in **${nextComp.days} days**` : daysToEnd >= 0 ? `Season ends in **${daysToEnd} days**` : "Season over"}`,
    "",
    `⚖️ **Robot Weight:** ${weightBar}`,
    `📋 **Tasks:** ${pct}% complete · ${overdue} overdue · ${blocked} blocked`,
    bomFmv > 0 ? `💰 **BOM FMV:** ${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(bomFmv)}` : null,
    inventoryAlerts > 0 ? `📦 **Inventory:** ${inventoryAlerts} item${inventoryAlerts !== 1 ? "s" : ""} below threshold` : null,
    openCheckouts > 0 ? `🔧 **Tools out:** ${openCheckouts} checked out` : null,
    nextMilestone ? `🏁 **Next milestone:** ${nextMilestone.name} — ${differenceInCalendarDays(nextMilestone.dueDate!, now)} days` : null,
  ].filter(Boolean).join("\n");

  const baseUrl = appUrl();
  return reply(null, [
    embed({
      title: `🤖 ${season.name} — Team Status`,
      description: lines,
      color: COLORS.primary,
      footer: { text: `[Open Dashboard ↗](${baseUrl}/dashboard)` },
    }),
  ]);
}

// ─── /tasks mine ───────────────────────────────────────────────────────────

export async function handleTasksMine(
  ctx: InteractionContext,
  options: any[]
): Promise<Response> {
  const err = requireLink(ctx.link);
  if (err) return err;

  const statusFilter = getStringOption(options, "status");
  const season = await getActiveSeason(ctx.teamId);
  if (!season) return ephemeralReply("❌ No active season configured.");

  const tasks = await prisma.task.findMany({
    where: {
      seasonId: season.id,
      assignees: { some: { id: ctx.link!.userId } },
      ...(statusFilter ? { status: statusFilter as any } : {}),
    },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }],
    select: { id: true, name: true, status: true, dueDate: true, priority: true },
  });

  if (tasks.length === 0) {
    return ephemeralReply(statusFilter ? `No tasks with status **${statusFilter}** assigned to you.` : "✅ No tasks currently assigned to you.");
  }

  const now = new Date();
  const STATUS_EMOJI: Record<string, string> = {
    NOT_STARTED: "⚪", IN_PROGRESS: "🔵", BLOCKED: "🔴", IN_REVIEW: "🟡", COMPLETE: "✅",
  };

  const grouped: Record<string, string[]> = {};
  for (const t of tasks) {
    const s = t.status;
    if (!grouped[s]) grouped[s] = [];
    const overdue = t.dueDate && t.dueDate < now && s !== "COMPLETE";
    const dueStr = t.dueDate ? ` (due ${t.dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}${overdue ? " ⚠️" : ""})` : "";
    grouped[s].push(`• ${t.name}${dueStr}`);
  }

  const fields = Object.entries(grouped).map(([status, items]) => ({
    name: `${STATUS_EMOJI[status] ?? "•"} ${status.replace("_", " ")}`,
    value: items.slice(0, 10).join("\n"),
  }));

  return ephemeralReply(null, [
    embed({ title: "📋 Your Tasks", fields, color: COLORS.info }),
  ]);
}

// ─── /tasks today ──────────────────────────────────────────────────────────

export async function handleTasksToday(ctx: InteractionContext): Promise<Response> {
  const err = requireLink(ctx.link);
  if (err) return err;

  const season = await getActiveSeason(ctx.teamId);
  if (!season) return ephemeralReply("❌ No active season configured.");

  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end   = new Date(); end.setHours(23, 59, 59, 999);

  const tasks = await prisma.task.findMany({
    where: { seasonId: season.id, dueDate: { gte: start, lte: end }, status: { notIn: ["COMPLETE"] } },
    include: { assignees: { select: { name: true } } },
    orderBy: { subTeam: "asc" },
  });

  if (tasks.length === 0) return reply("✅ No tasks due today.");

  const lines = tasks.map((t) => {
    const assignees = t.assignees.map((a) => a.name).join(", ") || "Unassigned";
    return `• **${t.name}** — ${assignees} [${t.subTeam?.replace("_", " ") ?? "Other"}]`;
  });

  return reply(null, [
    embed({
      title: `📅 Tasks Due Today (${tasks.length})`,
      description: lines.slice(0, 20).join("\n"),
      color: COLORS.warning,
    }),
  ]);
}

// ─── /task done|start|block ────────────────────────────────────────────────

export async function handleTaskUpdate(
  ctx: InteractionContext,
  subcommand: "done" | "start" | "block",
  options: any[]
): Promise<Response> {
  const err = requireLink(ctx.link);
  if (err) return err;

  const name   = getStringOption(options, "name") ?? "";
  const reason = getStringOption(options, "reason");
  const season = await getActiveSeason(ctx.teamId);
  if (!season) return ephemeralReply("❌ No active season configured.");

  const task = await prisma.task.findFirst({
    where: {
      seasonId: season.id,
      name: { contains: name, mode: "insensitive" },
    },
    include: { assignees: { select: { id: true } } },
  });

  if (!task) return ephemeralReply(`❌ No task found matching "**${name}**". Check the name and try again.`);

  // Permission: assignee or build lead+
  const isAssignee = task.assignees.some((a) => a.id === ctx.link!.userId);
  const canUpdate  = isAssignee || await hasRole(ctx.link!.userId, ["BUILD_LEAD", "INVENTORY_ADMIN", "HEAD_MENTOR"]);
  if (!canUpdate) return ephemeralReply("❌ You must be assigned to this task or a Build Lead to update it.");

  const statusMap = { done: "COMPLETE", start: "IN_PROGRESS", block: "BLOCKED" } as const;
  const newStatus = statusMap[subcommand];

  await prisma.task.update({
    where: { id: task.id },
    data: {
      status:         newStatus,
      completionDate: newStatus === "COMPLETE" ? new Date() : null,
      blockersNotes:  newStatus === "BLOCKED" ? reason : undefined,
    },
  });

  const emojiMap = { done: "✅", start: "🔵", block: "🔴" };
  const labelMap = { done: "marked complete", start: "started", block: "marked as blocked" };

  // Milestone celebration
  if (newStatus === "COMPLETE" && task.isMilestone && ctx.config.channelMilestones) {
    const season2 = await prisma.season.findUnique({ where: { id: task.seasonId } });
    const nextMilestone = await prisma.task.findFirst({
      where: { seasonId: task.seasonId, isMilestone: true, status: { not: "COMPLETE" }, dueDate: { gte: new Date() } },
      orderBy: { dueDate: "asc" },
    });
    const user = await prisma.user.findUnique({ where: { id: ctx.link!.userId }, select: { name: true } });

    const celebEmbed: DiscordEmbed = {
      title: "🏆 MILESTONE REACHED",
      description: [
        `✅ **${task.name}**`,
        `Completed by: **${user?.name}**`,
        nextMilestone ? `\n🏁 Next milestone: **${nextMilestone.name}** (${differenceInCalendarDays(nextMilestone.dueDate!, new Date())} days)` : "",
      ].join("\n"),
      color: COLORS.success,
    };

    import("@/lib/discord").then(({ sendChannelMessage }) =>
      sendChannelMessage(ctx.config.channelMilestones!, null, [celebEmbed]).catch(() => {})
    );
  }

  return reply(`${emojiMap[subcommand]} **${task.name}** ${labelMap[subcommand]}${reason ? ` — *${reason}*` : ""}.`);
}

// ─── /milestone next|list ──────────────────────────────────────────────────

export async function handleMilestone(
  ctx: InteractionContext,
  subcommand: "next" | "list"
): Promise<Response> {
  const err = requireLink(ctx.link);
  if (err) return err;

  const season = await getActiveSeason(ctx.teamId);
  if (!season) return ephemeralReply("❌ No active season configured.");

  const now = new Date();
  const milestones = await prisma.task.findMany({
    where: { seasonId: season.id, isMilestone: true },
    orderBy: { dueDate: "asc" },
  });

  if (milestones.length === 0) return ephemeralReply("No milestones configured. Apply a template to add standard FRC milestones.");

  if (subcommand === "next") {
    const next = milestones.find((m) => m.status !== "COMPLETE" && m.dueDate && m.dueDate >= now);
    if (!next) return reply("🏆 All milestones complete!");

    const days = differenceInCalendarDays(next.dueDate!, now);
    const risk = days < 3 ? "🔴 At Risk" : days < 7 ? "🟡 Watch" : "🟢 On Track";
    return reply(null, [
      embed({
        title: "🏁 Next Milestone",
        description: `**${next.name}**\nDue: **${next.dueDate!.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}** — **${days} days from now**\nStatus: ${risk}`,
        color: days < 3 ? COLORS.danger : days < 7 ? COLORS.warning : COLORS.success,
      }),
    ]);
  }

  // List all
  const STATUS_EMOJI: Record<string, string> = { COMPLETE: "✅", BLOCKED: "🔴", IN_PROGRESS: "🔵", NOT_STARTED: "⚪", IN_REVIEW: "🟡" };
  const lines = milestones.map((m) => {
    const days = m.dueDate ? differenceInCalendarDays(m.dueDate, now) : null;
    const daysStr = days !== null ? (days >= 0 ? `${days}d away` : `${Math.abs(days)}d ago`) : "no date";
    return `${STATUS_EMOJI[m.status] ?? "•"} **${m.name}** — ${daysStr}`;
  });

  return reply(null, [
    embed({ title: "🏁 Milestones", description: lines.join("\n"), color: COLORS.info }),
  ]);
}

// ─── /tool status ──────────────────────────────────────────────────────────

export async function handleToolStatus(
  ctx: InteractionContext,
  options: any[]
): Promise<Response> {
  const err = requireLink(ctx.link);
  if (err) return err;

  const name = getStringOption(options, "name") ?? "";
  // Each physical tool is its own record — show every copy that matches
  const tools = await prisma.tool.findMany({
    where: {
      teamId: ctx.teamId,
      retired: false,
      OR: [
        { name: { contains: name, mode: "insensitive" } },
        { assetTag: { equals: name, mode: "insensitive" } },
      ],
    },
    include: {
      checkouts: {
        where: { returnedAt: null },
        include: { user: { select: { name: true } } },
      },
    },
    orderBy: [{ name: "asc" }, { assetTag: "asc" }],
    take: 15,
  });

  if (tools.length === 0) return ephemeralReply(`❌ No tool found matching "**${name}**".`);

  const free = tools.filter((t) => t.checkouts.length === 0 && !["OUT_OF_SERVICE", "OUT_FOR_MAINTENANCE"].includes(t.condition));
  const lines = tools.map((t) => {
    const c = t.checkouts[0];
    const state = c
      ? `out — ${c.user.name}, due ${c.expectedReturn.toLocaleDateString("en-US", { month: "short", day: "numeric" })}${c.expectedReturn < new Date() ? " ⚠️ OVERDUE" : ""}`
      : free.includes(t) ? "✅ available" : "⛔ unavailable";
    return `**${t.name}** \`${t.assetTag ?? "no tag"}\` · ${t.condition.replace(/_/g, " ").toLowerCase()} · ${state}`;
  });
  const cert = tools.find((t) => t.requiresCertification && t.certificationName);

  return reply(null, [
    embed({
      title: `🔧 ${tools.length === 1 ? tools[0].name : `${free.length} of ${tools.length} available`}`,
      description: lines.join("\n"),
      fields: cert ? [{ name: "⚠️ Certification required", value: cert.certificationName!, inline: false }] : [],
      color: free.length > 0 ? COLORS.success : COLORS.danger,
    }),
  ]);
}

// ─── /tool checkout ────────────────────────────────────────────────────────

export async function handleToolCheckout(
  ctx: InteractionContext,
  options: any[]
): Promise<Response> {
  const err = requireLink(ctx.link);
  if (err) return err;

  const name    = getStringOption(options, "name") ?? "";
  const purpose = getStringOption(options, "purpose");

  // Prefer an exact asset tag; otherwise any free copy with that name
  const candidates = await prisma.tool.findMany({
    where: { teamId: ctx.teamId, retired: false, OR: [
      { name: { contains: name, mode: "insensitive" } },
      { assetTag: { equals: name, mode: "insensitive" } },
    ]},
    include: { checkouts: { where: { returnedAt: null }, select: { id: true } } },
    orderBy: [{ name: "asc" }, { assetTag: "asc" }],
  });
  if (candidates.length === 0) return ephemeralReply(`❌ No tool found matching "**${name}**".`);

  const usable = candidates.filter((t) => t.checkouts.length === 0 && !["OUT_OF_SERVICE", "OUT_FOR_MAINTENANCE"].includes(t.condition));
  const tool = usable.find((t) => t.assetTag?.toLowerCase() === name.toLowerCase()) ?? usable[0];
  if (!tool) return ephemeralReply(`❌ Every **${candidates[0].name}** is checked out or out of service. Try again when one is returned.`);

  // Check certification
  if (tool.requiresCertification && tool.certificationName) {
    const cert = await prisma.userCertification.findFirst({
      where: { userId: ctx.link!.userId, certName: tool.certificationName, status: "ACTIVE" },
    });
    if (!cert) return ephemeralReply(`❌ **${tool.name}** requires **${tool.certificationName}** certification. Contact a mentor.`);
  }

  const expectedReturn = new Date();
  expectedReturn.setHours(20, 0, 0, 0); // end of build day
  if (expectedReturn < new Date()) expectedReturn.setDate(expectedReturn.getDate() + 1);

  await prisma.toolCheckout.create({
    data: {
      toolId:         tool.id,
      userId:         ctx.link!.userId,
      intendedUse:    purpose ?? null,
      expectedReturn,
    },
  });

  const user = await prisma.user.findUnique({ where: { id: ctx.link!.userId }, select: { name: true } });
  return reply(null, [
    embed({
      title: `✅ Checked Out`,
      description: `**${tool.name}** \`${tool.assetTag ?? ""}\` → **${user?.name}** until ${expectedReturn.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} today.\nRun \`/tool checkin ${tool.assetTag ?? tool.name}\` when done.`,
      fields: [
        { name: "Condition", value: tool.condition.replace(/_/g, " "), inline: true },
        { name: "Location",  value: tool.homeLocation ?? "—", inline: true },
      ],
      color: COLORS.success,
    }),
  ]);
}

// ─── /tool checkin ─────────────────────────────────────────────────────────

export async function handleToolCheckin(
  ctx: InteractionContext,
  options: any[]
): Promise<Response> {
  const err = requireLink(ctx.link);
  if (err) return err;

  const name = getStringOption(options, "name") ?? "";
  const checkout = await prisma.toolCheckout.findFirst({
    where: {
      userId: ctx.link!.userId,
      returnedAt: null,
      tool: { teamId: ctx.teamId, OR: [
        { name: { contains: name, mode: "insensitive" } },
        { assetTag: { equals: name, mode: "insensitive" } },
      ]},
    },
    include: { tool: { select: { name: true, assetTag: true } } },
    orderBy: { checkedOutAt: "asc" },
  });
  if (!checkout) return ephemeralReply(`❌ You don't have a tool matching **${name}** checked out.`);
  const tool = checkout.tool;

  await prisma.toolCheckout.update({
    where: { id: checkout.id },
    data: { returnedAt: new Date(), returnCondition: "GOOD" },
  });

  return reply(`✅ **${tool.name}** \`${tool.assetTag ?? ""}\` returned. Thanks!`);
}

// ─── /tool overdue ─────────────────────────────────────────────────────────

export async function handleToolOverdue(ctx: InteractionContext): Promise<Response> {
  const err = requireLink(ctx.link);
  if (err) return err;

  const overdue = await prisma.toolCheckout.findMany({
    where: {
      tool: { teamId: ctx.teamId },
      returnedAt: null,
      expectedReturn: { lt: new Date() },
    },
    include: {
      tool: { select: { name: true } },
      user: { select: { name: true } },
    },
    orderBy: { expectedReturn: "asc" },
  });

  if (overdue.length === 0) return reply("✅ No overdue tool checkouts!");

  const lines = overdue.map((c) => {
    const days = differenceInCalendarDays(new Date(), c.expectedReturn);
    return `• **${c.tool.name}** — ${c.user.name} (${days}d overdue, due ${c.expectedReturn.toLocaleDateString("en-US", { month: "short", day: "numeric" })})`;
  });

  return reply(null, [
    embed({ title: `⚠️ Overdue Tools (${overdue.length})`, description: lines.join("\n"), color: COLORS.danger }),
  ]);
}

// ─── /stock check ──────────────────────────────────────────────────────────

export async function handleStockCheck(
  ctx: InteractionContext,
  options: any[]
): Promise<Response> {
  const err = requireLink(ctx.link);
  if (err) return err;

  const itemName = getStringOption(options, "item") ?? "";
  const season   = await getActiveSeason(ctx.teamId);
  if (!season) return ephemeralReply("❌ No active season configured.");

  const item = await prisma.baseInventoryItem.findFirst({
    where: { seasonId: season.id, archived: false, name: { contains: itemName, mode: "insensitive" } },
  });

  if (!item) return ephemeralReply(`❌ No inventory item found matching "**${itemName}**".`);

  const isLow      = item.currentStock <= item.minStockThreshold && item.minStockThreshold > 0;
  const isEmpty    = item.currentStock === 0;
  const statusEmoji = isEmpty ? "🔴" : isLow ? "🟡" : "🟢";
  const statusLabel = isEmpty ? "Out of stock" : isLow ? "Below threshold" : "Healthy";

  return reply(null, [
    embed({
      title: `📦 ${item.name}`,
      fields: [
        { name: "In stock",   value: `${item.currentStock} ${item.unitOfMeasure.toLowerCase()}`, inline: true },
        { name: "Threshold",  value: `${item.minStockThreshold} ${item.unitOfMeasure.toLowerCase()}`, inline: true },
        { name: "Status",     value: `${statusEmoji} ${statusLabel}`, inline: true },
        ...(item.storageLocation ? [{ name: "Location", value: item.storageLocation, inline: true }] : []),
        ...(item.preferredSupplier ? [{ name: "Supplier", value: item.preferredSupplier, inline: true }] : []),
      ],
      color: isEmpty ? COLORS.danger : isLow ? COLORS.warning : COLORS.success,
    }),
  ]);
}

// ─── /order request ────────────────────────────────────────────────────────

export async function handleOrderRequest(
  ctx: InteractionContext,
  options: any[]
): Promise<Response> {
  const err = requireLink(ctx.link);
  if (err) return err;

  const itemName = getStringOption(options, "item")   ?? "";
  const qty      = getIntOption(options, "qty")        ?? 1;
  const vendor   = getStringOption(options, "vendor") ?? "";
  const cost     = (options.find((o: any) => o.name === "cost")?.value ?? 0) as number;
  const reason   = getStringOption(options, "reason") ?? "";

  const season = await getActiveSeason(ctx.teamId);
  if (!season) return ephemeralReply("❌ No active season configured.");

  const preferredVendor = await prisma.vendor.findFirst({
    where: { teamId: ctx.teamId, name: { contains: vendor, mode: "insensitive" } },
    select: { name: true },
  });
  const estimated = cost * qty;

  // Same path as the app: item IDs, workflow (approval if needed), notifications
  const res = await createOrder({
    actor:    await actorFor(ctx.link!.userId, ctx.teamId),
    seasonId: season.id,
    name:     `${itemName} × ${qty}`,
    items:    [{ name: itemName, quantity: qty, unitCost: cost, vendorName: preferredVendor?.name ?? (vendor || null), reasoning: reason }],
  });
  if (!res.success) return ephemeralReply(`❌ ${res.error}`);

  const item = await prisma.purchaseLineItem.findFirst({ where: { requestId: res.requestId }, select: { id: true, orderNumber: true } });

  return reply(null, [
    embed({
      title: "📋 Order Submitted",
      description: `**${itemName} × ${qty}** — Est. $${estimated.toFixed(2)} | Vendor: ${preferredVendor?.name ?? vendor}`,
      fields: [
        { name: "Reason", value: reason || "—" },
        { name: "Status", value: res.stage },
        { name: "Item ID", value: item ? itemRef(item) : "—", inline: true },
      ],
      color: COLORS.info,
    }),
  ]);
}

// ─── /order status ─────────────────────────────────────────────────────────

export async function handleOrderStatus(ctx: InteractionContext): Promise<Response> {
  const err = requireLink(ctx.link);
  if (err) return err;

  const season = await getActiveSeason(ctx.teamId);
  if (!season) return ephemeralReply("❌ No active season configured.");

  const requests = await prisma.purchaseRequest.findMany({
    where: { seasonId: season.id, requestedById: ctx.link!.userId, status: { notIn: ["RECEIVED", "CANCELLED"] } },
    orderBy: { submittedAt: "desc" },
    take: 10,
  });

  if (requests.length === 0) return ephemeralReply("You have no open orders.");

  const STATUS_EMOJI: Record<string, string> = {
    DRAFT: "📝", SUBMITTED: "⏳", APPROVED: "✅", DENIED: "❌",
    ORDERED: "📦", PARTIAL_RECEIVED: "🔄", RECEIVED: "✅",
  };

  const lines = requests.map((r) =>
    `${STATUS_EMOJI[r.status] ?? "•"} **${r.title}** — ${r.status.replace("_", " ").toLowerCase().replace("cancelled", "canceled")} · ${(r.estimatedTotal ?? 0).toFixed(2)}`);

  return ephemeralReply(null, [
    embed({ title: "📋 Your Orders", description: lines.join("\n"), color: COLORS.info }),
  ]);
}

// ─── /order approve|deny ───────────────────────────────────────────────────

export async function handleOrderApprove(
  ctx: InteractionContext,
  options: any[],
  deny = false
): Promise<Response> {
  const err = requireLink(ctx.link);
  if (err) return err;

  const idNum = getIntOption(options, "id");
  if (!idNum) return ephemeralReply("❌ Please provide the request number.");

  // Find request where ID ends with this number pattern
  const season = await getActiveSeason(ctx.teamId);
  if (!season) return ephemeralReply("❌ No active season.");

  const requests = await prisma.purchaseRequest.findMany({
    where: { seasonId: season.id, status: "SUBMITTED" },
    include: { requestedBy: { select: { id: true, name: true, discordLink: { select: { discordUserId: true } } } } },
    orderBy: { submittedAt: "asc" },
  });

  // Match by the last 6 chars of the ID converted to a sequential number (approx)
  const request = requests[idNum - 1] ?? requests.find((r) => r.id.slice(-6).toUpperCase() === String(idNum).toUpperCase());
  if (!request) return ephemeralReply(`❌ No pending request #${idNum} found.`);

  const notes  = getStringOption(options, "notes");
  const reason = getStringOption(options, "reason");
  // The workflow engine checks the caller is allowed to act on the request's current
  // approval step and handles notifications (including the requester's DM).
  const actor  = await actorFor(ctx.link!.userId, ctx.teamId);
  const result = await performCurrentStepAction(request.id, deny ? "deny" : "approve", actor, {
    note: (deny ? reason : notes) ?? undefined,
  });
  if (!result.success) return ephemeralReply(`❌ ${result.error}`);

  const emoji = deny ? "❌" : "✅";
  const verb  = deny ? "denied" : "approved";
  const next  = deny ? "" : `\n${await describeRequestState(request.id)}`;
  return reply(`${emoji} **${result.stepName}** for **${request.title}** ${verb} by **${actor.name}**.${next}`);
}

// ─── /tasks overdue ────────────────────────────────────────────────────────

export async function handleTasksOverdue(ctx: InteractionContext): Promise<Response> {
  const err = requireLink(ctx.link);
  if (err) return err;

  const season = await getActiveSeason(ctx.teamId);
  if (!season) return ephemeralReply("❌ No active season configured.");

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tasks = await prisma.task.findMany({
    where:   { seasonId: season.id, dueDate: { lt: today }, status: { notIn: ["COMPLETE"] } },
    include: { assignees: { select: { name: true } } },
    orderBy: { dueDate: "asc" },
  });

  if (tasks.length === 0) return reply("✅ Nothing overdue.");

  const lines = tasks.map((t) => {
    const days = differenceInCalendarDays(today, t.dueDate!);
    const assignees = t.assignees.map((a) => a.name).join(", ") || "Unassigned";
    return `• **${t.name}** — ${days} day${days === 1 ? "" : "s"} late · ${assignees}`;
  });

  return reply(null, [
    embed({
      title: `⚠️ Overdue Tasks (${tasks.length})`,
      description: lines.slice(0, 20).join("\n") + (tasks.length > 20 ? `\n…and ${tasks.length - 20} more` : ""),
      color: COLORS.danger,
    }),
  ]);
}

// ─── /stock list ───────────────────────────────────────────────────────────

export async function handleStockList(ctx: InteractionContext, options: any[]): Promise<Response> {
  const err = requireLink(ctx.link);
  if (err) return err;

  const lowOnly = options.find((o: any) => o.name === "low_only")?.value === true;
  const season  = await getActiveSeason(ctx.teamId);
  if (!season) return ephemeralReply("❌ No active season configured.");

  const all = await prisma.baseInventoryItem.findMany({
    where:   { seasonId: season.id, archived: false },
    select:  { name: true, currentStock: true, minStockThreshold: true, unitOfMeasure: true },
    orderBy: { name: "asc" },
  });
  const level = (i: (typeof all)[number]) =>
    i.currentStock === 0 ? "🔴" : i.minStockThreshold > 0 && i.currentStock <= i.minStockThreshold ? "🟡" : "🟢";
  const items = lowOnly ? all.filter((i) => level(i) !== "🟢") : all;

  if (items.length === 0) {
    return reply(lowOnly ? "✅ Nothing is low or out of stock." : "📦 No inventory items yet.");
  }

  const MAX = 40;
  const lines = items.slice(0, MAX).map((i) =>
    `${level(i)} **${i.name}** — ${i.currentStock} ${i.unitOfMeasure.toLowerCase()}` +
    (i.minStockThreshold > 0 ? ` (min ${i.minStockThreshold})` : ""));

  return reply(null, [
    embed({
      title: lowOnly ? `📦 Low Stock (${items.length})` : `📦 Inventory (${items.length})`,
      description: lines.join("\n") + (items.length > MAX ? `\n…and ${items.length - MAX} more — see the app` : ""),
      color: lowOnly ? COLORS.warning : COLORS.info,
    }),
  ]);
}

// ─── /order pending ────────────────────────────────────────────────────────

/** Orders waiting on approval (numbered for /order approve|deny) and items waiting to be bought. */
export async function handleOrderPending(ctx: InteractionContext): Promise<Response> {
  const err = requireLink(ctx.link);
  if (err) return err;

  const season = await getActiveSeason(ctx.teamId);
  if (!season) return ephemeralReply("❌ No active season configured.");

  const [awaiting, toOrder] = await Promise.all([
    // Same list and order /order approve uses to resolve its number
    prisma.purchaseRequest.findMany({
      where:   { seasonId: season.id, status: "SUBMITTED" },
      select:  { title: true, estimatedTotal: true, requestedBy: { select: { name: true } } },
      orderBy: { submittedAt: "asc" },
    }),
    prisma.purchaseLineItem.findMany({
      where:   { status: "TO_ORDER", request: { seasonId: season.id } },
      select:  { id: true, orderNumber: true, name: true, vendorName: true, quantity: true },
      orderBy: [{ vendorName: "asc" }, { orderNumber: "asc" }],
    }),
  ]);

  if (awaiting.length === 0 && toOrder.length === 0) return reply("✅ Nothing waiting — no orders to approve or buy.");

  const embeds: DiscordEmbed[] = [];
  if (awaiting.length > 0) {
    embeds.push(embed({
      title: `⏳ Awaiting Approval (${awaiting.length})`,
      description: awaiting.slice(0, 20).map((r, i) =>
        `**${i + 1}.** ${r.title} — $${(r.estimatedTotal ?? 0).toFixed(2)} · ${r.requestedBy.name}`).join("\n") +
        "\n\nApprove with `/order approve id:<number>` or deny with `/order deny`.",
      color: COLORS.warning,
    }));
  }
  if (toOrder.length > 0) {
    embeds.push(embed({
      title: `🛒 To Order (${toOrder.length})`,
      description: toOrder.slice(0, 30).map((i) =>
        `\`#${itemRef(i)}\` **${i.name}** × ${i.quantity}${i.vendorName ? ` — ${i.vendorName}` : ""}`).join("\n") +
        (toOrder.length > 30 ? `\n…and ${toOrder.length - 30} more` : ""),
      color: COLORS.info,
    }));
  }
  return reply(null, embeds);
}
