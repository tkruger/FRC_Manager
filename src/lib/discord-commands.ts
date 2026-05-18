// Slash command handlers — each returns a Discord interaction response
// All DB access uses the team's active season and the caller's linked account

import { prisma } from "@/lib/prisma";
import {
  embed, ephemeralReply, reply, COLORS, getStringOption, getIntOption,
  type DiscordEmbed, sendDM, followUpInteraction,
} from "@/lib/discord";
import { differenceInCalendarDays } from "date-fns";
import type { DiscordConfig, DiscordLink } from "@/generated/prisma";

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

  const link = await prisma.discordLink.findFirst({
    where: { discordUserId, revokedAt: null },
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
  return prisma.season.findFirst({ where: { teamId, isActive: true } });
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

  // We need a platform user to link — the user must be in the team
  // For the linking flow we generate a token and DM it
  // The token is associated with a team (not yet a user — user picks their account on the web)
  const token = await prisma.discordLinkToken.create({
    data: {
      userId: "PENDING",  // resolved when user clicks the link
      token:  crypto.randomUUID(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 min
    },
  });

  // Store the discord user info in the token so the web callback can use it
  // We repurpose userId field to encode discord info as JSON
  await prisma.discordLinkToken.update({
    where: { id: token.id },
    data: { userId: JSON.stringify({ discordUserId, discordUsername, teamId: config.teamId }) },
  });

  const baseUrl = process.env.NEXTAUTH_URL ?? "https://frc-manager.vercel.app";
  const linkUrl = `${baseUrl}/settings/discord/link?token=${token.token}`;

  try {
    await sendDM(discordUserId, null, [
      embed({
        title: "🔗 Link Your FRC Manager Account",
        description:
          `Click the link below to connect your Discord account to your team platform account.\n\n` +
          `**[Click here to link your account](${linkUrl})**\n\n` +
          `⏰ This link expires in **10 minutes**.\n` +
          `If you didn't request this, ignore this message.`,
        color: COLORS.info,
        footer: { text: `Team ${config.teamId}` },
      }),
    ]);
    return ephemeralReply("📬 Check your DMs — I've sent you a link to complete account linking.");
  } catch {
    return ephemeralReply(
      `❌ Couldn't send you a DM. Make sure your privacy settings allow DMs from server members, then try again.\n\nAlternatively, visit: ${linkUrl}`
    );
  }
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
    INVENTORY_ADMIN: "Inventory Admin", BUDGET_MANAGER: "Budget Manager",
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
  const daysToWeek0 = differenceInCalendarDays(season.week0Date, now);
  const kickoffDay  = differenceInCalendarDays(now, season.kickoffDate) + 1;
  const totalDays   = differenceInCalendarDays(season.week0Date, season.kickoffDate);

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
    `**Build Day ${kickoffDay} of ${totalDays}** · Week 0 in **${daysToWeek0} days**`,
    "",
    `⚖️ **Robot Weight:** ${weightBar}`,
    `📋 **Tasks:** ${pct}% complete · ${overdue} overdue · ${blocked} blocked`,
    bomFmv > 0 ? `💰 **BOM FMV:** ${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(bomFmv)}` : null,
    inventoryAlerts > 0 ? `📦 **Inventory:** ${inventoryAlerts} item${inventoryAlerts !== 1 ? "s" : ""} below threshold` : null,
    openCheckouts > 0 ? `🔧 **Tools out:** ${openCheckouts} checked out` : null,
    nextMilestone ? `🏁 **Next milestone:** ${nextMilestone.name} — ${differenceInCalendarDays(nextMilestone.dueDate!, now)} days` : null,
  ].filter(Boolean).join("\n");

  const baseUrl = process.env.NEXTAUTH_URL ?? "https://frc-manager.vercel.app";
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
  const tool = await prisma.tool.findFirst({
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
  });

  if (!tool) return ephemeralReply(`❌ No tool found matching "**${name}**".`);

  const checkedOut = tool.checkouts.reduce((s, c) => s + c.quantity, 0);
  const available  = tool.quantityOwned - checkedOut;

  const fields = [
    { name: "Condition", value: tool.condition.replace(/_/g, " "), inline: true },
    { name: "Available", value: `${available} / ${tool.quantityOwned}`, inline: true },
    { name: "Location",  value: tool.homeLocation ?? "—", inline: true },
  ];

  if (tool.checkouts.length > 0) {
    fields.push({
      name: "Checked out by",
      value: tool.checkouts.map((c) => {
        const overdue = c.expectedReturn < new Date();
        return `${c.user.name} (due ${c.expectedReturn.toLocaleDateString("en-US", { month: "short", day: "numeric" })}${overdue ? " ⚠️ OVERDUE" : ""})`;
      }).join("\n"),
      inline: false,
    });
  }

  if (tool.requiresCertification && tool.certificationName) {
    fields.push({ name: "⚠️ Certification required", value: tool.certificationName, inline: false });
  }

  return reply(null, [
    embed({
      title: `🔧 ${tool.name}`,
      fields,
      color: available > 0 ? COLORS.success : COLORS.danger,
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

  const tool = await prisma.tool.findFirst({
    where: { teamId: ctx.teamId, retired: false, OR: [
      { name: { contains: name, mode: "insensitive" } },
      { assetTag: { equals: name, mode: "insensitive" } },
    ]},
  });
  if (!tool) return ephemeralReply(`❌ No tool found matching "**${name}**".`);

  // Check certification
  if (tool.requiresCertification && tool.certificationName) {
    const cert = await prisma.userCertification.findFirst({
      where: { userId: ctx.link!.userId, certName: tool.certificationName, status: "ACTIVE" },
    });
    if (!cert) return ephemeralReply(`❌ **${tool.name}** requires **${tool.certificationName}** certification. Contact a mentor.`);
  }

  // Check availability
  const checkedOut = await prisma.toolCheckout.aggregate({
    where: { toolId: tool.id, returnedAt: null },
    _sum: { quantity: true },
  });
  const used = checkedOut._sum.quantity ?? 0;
  if (used >= tool.quantityOwned) return ephemeralReply(`❌ **${tool.name}** is fully checked out. Try again when it's returned.`);

  const expectedReturn = new Date();
  expectedReturn.setHours(20, 0, 0, 0); // end of build day
  if (expectedReturn < new Date()) expectedReturn.setDate(expectedReturn.getDate() + 1);

  await prisma.toolCheckout.create({
    data: {
      toolId:         tool.id,
      userId:         ctx.link!.userId,
      quantity:       1,
      intendedUse:    purpose ?? null,
      expectedReturn,
    },
  });

  const user = await prisma.user.findUnique({ where: { id: ctx.link!.userId }, select: { name: true } });
  return reply(null, [
    embed({
      title: `✅ Checked Out`,
      description: `**${tool.name}** → **${user?.name}** until ${expectedReturn.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} today.\nRun \`/tool checkin ${tool.name}\` when done.`,
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
  const tool = await prisma.tool.findFirst({
    where: { teamId: ctx.teamId, retired: false, OR: [
      { name: { contains: name, mode: "insensitive" } },
      { assetTag: { equals: name, mode: "insensitive" } },
    ]},
  });
  if (!tool) return ephemeralReply(`❌ No tool found matching "**${name}**".`);

  const checkout = await prisma.toolCheckout.findFirst({
    where: { toolId: tool.id, userId: ctx.link!.userId, returnedAt: null },
  });
  if (!checkout) return ephemeralReply(`❌ You don't have **${tool.name}** checked out.`);

  await prisma.toolCheckout.update({
    where: { id: checkout.id },
    data: { returnedAt: new Date(), returnCondition: "GOOD" },
  });

  return reply(`✅ **${tool.name}** returned. Thanks!`);
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
    select: { id: true, name: true },
  });

  const estimated = cost * qty;
  const AUTO_APPROVE = 50;

  const pr = await prisma.purchaseRequest.create({
    data: {
      seasonId:         season.id,
      title:            `${itemName} × ${qty}`,
      requestedById:    ctx.link!.userId,
      justification:    reason,
      estimatedTotal:   estimated,
      preferredVendorId: preferredVendor?.id ?? null,
      status:           estimated <= AUTO_APPROVE ? "APPROVED" : "SUBMITTED",
      lineItems: {
        create: [{
          name:     itemName,
          quantity: qty,
          unitCost: cost,
          lineTotal: estimated,
        }],
      },
    },
  });

  const prNumber = pr.id.slice(-6).toUpperCase();
  const autoApproved = estimated <= AUTO_APPROVE;

  return reply(null, [
    embed({
      title: `📋 Purchase Request ${autoApproved ? "Auto-Approved" : "Submitted"}`,
      description: `**${itemName} × ${qty}** — Est. $${estimated.toFixed(2)} | Vendor: ${preferredVendor?.name ?? vendor}`,
      fields: [
        { name: "Reason", value: reason },
        { name: "Status", value: autoApproved ? "✅ Auto-approved (under $50)" : "⏳ Pending approval from Budget Manager" },
        { name: "Ref",    value: `PR-${prNumber}`, inline: true },
      ],
      color: autoApproved ? COLORS.success : COLORS.warning,
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

  if (requests.length === 0) return ephemeralReply("You have no open purchase requests.");

  const STATUS_EMOJI: Record<string, string> = {
    DRAFT: "📝", SUBMITTED: "⏳", APPROVED: "✅", DENIED: "❌",
    ORDERED: "📦", PARTIAL_RECEIVED: "🔄", RECEIVED: "✅",
  };

  const lines = requests.map((r) => {
    const ref = `PR-${r.id.slice(-6).toUpperCase()}`;
    return `${STATUS_EMOJI[r.status] ?? "•"} **${r.title}** — ${r.status} | $${(r.estimatedTotal ?? 0).toFixed(2)} | ${ref}`;
  });

  return ephemeralReply(null, [
    embed({ title: "📋 Your Purchase Requests", description: lines.join("\n"), color: COLORS.info }),
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

  const canApprove = await hasRole(ctx.link!.userId, ["BUDGET_MANAGER", "HEAD_MENTOR"]);
  if (!canApprove) return ephemeralReply("❌ Only Budget Managers and Head Mentors can approve/deny requests.");

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
  const approver = await prisma.user.findUnique({ where: { id: ctx.link!.userId }, select: { name: true } });

  await prisma.purchaseRequest.update({
    where: { id: request.id },
    data: {
      status:       deny ? "DENIED" : "APPROVED",
      approverId:   ctx.link!.userId,
      approvalNotes: deny ? reason : (notes ?? null),
    },
  });

  // Notify requester via DM if linked
  const requesterDiscordId = (request.requestedBy as any).discordLink?.discordUserId;
  if (requesterDiscordId) {
    const msg = deny
      ? `❌ Your purchase request **${request.title}** was denied by **${approver?.name}**.${reason ? `\nReason: ${reason}` : ""}`
      : `✅ Your purchase request **${request.title}** was approved by **${approver?.name}**.${notes ? `\nNotes: ${notes}` : ""}`;
    sendDM(requesterDiscordId, msg).catch(() => {});
  }

  const emoji = deny ? "❌" : "✅";
  const verb  = deny ? "denied" : "approved";
  return reply(`${emoji} Request **${request.title}** ${verb} by **${approver?.name}**.`);
}
