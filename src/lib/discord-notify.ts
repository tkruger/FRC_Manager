// Sends Discord channel notifications triggered by platform events.
// All sends are best-effort (errors are swallowed) so they never block app actions.
//
// A team can have two servers: the students' (every build notification) and the parents'
// (milestones, and meetings that need adult volunteers).

import { prisma } from "@/lib/prisma";
import { sendChannelMessage, sendDM, embed, COLORS, type DiscordEmbed } from "@/lib/discord";
import { appUrl } from "@/lib/app-url";
import type { DiscordAudience } from "@/generated/prisma";

async function getConfig(teamId: string, audience: DiscordAudience = "STUDENT") {
  return prisma.discordConfig.findFirst({ where: { teamId, audience, active: true } });
}

async function getDiscordId(userId: string): Promise<string | null> {
  const link = await prisma.discordLink.findFirst({ where: { userId, revokedAt: null } });
  return link?.discordUserId ?? null;
}

async function postToChannel(teamId: string, channelField: string, embeds: DiscordEmbed[]) {
  try {
    const config = await getConfig(teamId);
    const channelId = (config as any)?.[channelField];
    if (!channelId) return;
    await sendChannelMessage(channelId, null, embeds);
  } catch { /* best-effort */ }
}

// ── Procurement ────────────────────────────────────────────────────────────

export async function notifyPurchaseSubmitted(teamId: string, title: string, estimatedTotal: number, priority: string, requestId: string) {
  const isEmergency = priority === "EMERGENCY";
  await postToChannel(teamId, "channelOrders", [
    embed({
      title: isEmergency ? "🚨 EMERGENCY Order" : "📋 Order Submitted",
      description: `**${title}** — Est. $${estimatedTotal.toFixed(2)}`,
      fields: [{ name: "Priority", value: priority, inline: true }],
      color: isEmergency ? COLORS.danger : COLORS.warning,
    }),
  ]);
}

export async function notifyPurchaseApproved(teamId: string, requestedById: string, title: string, approverName: string) {
  try {
    const discordId = await getDiscordId(requestedById);
    if (discordId) {
      await sendDM(discordId, null, [
        embed({
          title: "✅ Order Approved",
          description: `**${title}** was approved by **${approverName}**.`,
          color: COLORS.success,
        }),
      ]);
    }
    // Also post to orders channel
    await postToChannel(teamId, "channelOrders", [
      embed({ title: "✅ Order Approved", description: `**${title}** — approved by ${approverName}`, color: COLORS.success }),
    ]);
  } catch { /* best-effort */ }
}

export async function notifyPurchaseDenied(teamId: string, requestedById: string, title: string, reason?: string) {
  try {
    const discordId = await getDiscordId(requestedById);
    if (discordId) {
      await sendDM(discordId, null, [
        embed({
          title: "❌ Order Denied",
          description: `**${title}**${reason ? `\nReason: ${reason}` : ""}`,
          color: COLORS.danger,
        }),
      ]);
    }
  } catch { /* best-effort */ }
}

export async function notifyPurchaseProgress(teamId: string, title: string, detail: string) {
  await postToChannel(teamId, "channelOrders", [
    embed({ title: "📦 Order Update", description: `**${title}** — ${detail}`, color: COLORS.info }),
  ]);
}

// ── Tasks ─────────────────────────────────────────────────────────────────

export async function notifyTaskAssigned(teamId: string, assigneeId: string, taskName: string, dueDate?: Date | null) {
  try {
    const discordId = await getDiscordId(assigneeId);
    if (!discordId) return;
    await sendDM(discordId, null, [
      embed({
        title: "📋 Task Assigned to You",
        description: `**${taskName}**${dueDate ? `\nDue: ${dueDate.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}` : ""}`,
        color: COLORS.info,
        footer: { text: "Run /tasks mine in Discord to see all your tasks" },
      }),
    ]);
  } catch { /* best-effort */ }
}

export async function notifyMilestoneComplete(teamId: string, milestoneName: string, completedByName: string, seasonId: string) {
  try {
    const [students, parents] = await Promise.all([getConfig(teamId), getConfig(teamId, "PARENT")]);
    // Both servers celebrate (the parents' only if it has a milestones channel)
    const channels = [students?.channelMilestones ?? students?.channelTasks, parents?.channelMilestones].filter(Boolean) as string[];
    if (!channels.length) return;

    const nextMilestone = await prisma.task.findFirst({
      where: { seasonId, isMilestone: true, status: { not: "COMPLETE" } },
      orderBy: { dueDate: "asc" },
    });

    const message = [
      embed({
        title: "🏆 MILESTONE REACHED",
        description: [
          `✅ **${milestoneName}**`,
          `Completed by: **${completedByName}**`,
          nextMilestone?.name ? `\n🏁 Next: **${nextMilestone.name}**` : "",
        ].join("\n"),
        color: COLORS.success,
      }),
    ];
    await Promise.allSettled(channels.map((id) => sendChannelMessage(id, null, message)));
  } catch { /* best-effort */ }
}

// ── Volunteers (parent server) ───────────────────────────────────────────────

/** Meetings that need adult volunteers, posted in the parent server's Volunteers channel. Returns whether it posted. */
export async function notifyVolunteersNeeded(teamId: string, title: string, lines: string[]): Promise<boolean> {
  try {
    const config = await getConfig(teamId, "PARENT");
    if (!config?.channelVolunteers) return false;
    await sendChannelMessage(config.channelVolunteers, null, [
      embed({
        title,
        description: `${lines.join("\n")}\n\n**[Sign up in FRC Manager](${appUrl()}/volunteers)** — cleared adults only.`,
        color: COLORS.warning,
      }),
    ]);
    return true;
  } catch {
    return false;
  }
}

// ── Safety ────────────────────────────────────────────────────────────────

export async function notifySafetyIncident(teamId: string, severity: string, description: string, reportedByName: string) {
  await postToChannel(teamId, "channelSafety", [
    embed({
      title: `🚨 Safety Incident — ${severity.replace("_", " ")}`,
      description: `${description.slice(0, 200)}${description.length > 200 ? "…" : ""}`,
      fields: [{ name: "Reported by", value: reportedByName, inline: true }],
      color: severity === "SIGNIFICANT_INJURY" ? COLORS.danger : COLORS.warning,
    }),
  ]);
}

// ── Inventory ─────────────────────────────────────────────────────────────

export async function notifyLowStock(teamId: string, itemName: string, currentStock: number, threshold: number, uom: string) {
  await postToChannel(teamId, "channelInventory", [
    embed({
      title: "📦 Inventory Alert — Low Stock",
      description: `**${itemName}**: ${currentStock} ${uom.toLowerCase()} remaining (threshold: ${threshold})`,
      color: currentStock === 0 ? COLORS.danger : COLORS.warning,
    }),
  ]);
}
