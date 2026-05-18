// Sends Discord channel notifications triggered by platform events.
// All sends are best-effort (errors are swallowed) so they never block app actions.

import { prisma } from "@/lib/prisma";
import { sendChannelMessage, sendDM, embed, COLORS, type DiscordEmbed } from "@/lib/discord";

async function getConfig(teamId: string) {
  return prisma.discordConfig.findFirst({ where: { teamId, active: true } });
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
      title: `${isEmergency ? "🚨" : "📋"} Purchase Request ${isEmergency ? "EMERGENCY" : "Submitted"}`,
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
          title: "✅ Purchase Request Approved",
          description: `**${title}** was approved by **${approverName}**.`,
          color: COLORS.success,
        }),
      ]);
    }
    // Also post to orders channel
    await postToChannel(teamId, "channelOrders", [
      embed({ title: "✅ Request Approved", description: `**${title}** — approved by ${approverName}`, color: COLORS.success }),
    ]);
  } catch { /* best-effort */ }
}

export async function notifyPurchaseDenied(teamId: string, requestedById: string, title: string, reason?: string) {
  try {
    const discordId = await getDiscordId(requestedById);
    if (discordId) {
      await sendDM(discordId, null, [
        embed({
          title: "❌ Purchase Request Denied",
          description: `**${title}**${reason ? `\nReason: ${reason}` : ""}`,
          color: COLORS.danger,
        }),
      ]);
    }
  } catch { /* best-effort */ }
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
    const config = await getConfig(teamId);
    const channelId = config?.channelMilestones ?? config?.channelTasks;
    if (!channelId) return;

    const nextMilestone = await prisma.task.findFirst({
      where: { seasonId, isMilestone: true, status: { not: "COMPLETE" } },
      orderBy: { dueDate: "asc" },
    });

    await sendChannelMessage(channelId, null, [
      embed({
        title: "🏆 MILESTONE REACHED",
        description: [
          `✅ **${milestoneName}**`,
          `Completed by: **${completedByName}**`,
          nextMilestone?.name ? `\n🏁 Next: **${nextMilestone.name}**` : "",
        ].join("\n"),
        color: COLORS.success,
      }),
    ]);
  } catch { /* best-effort */ }
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
