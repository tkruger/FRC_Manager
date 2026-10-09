"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { LEADERSHIP_ROLES } from "@/lib/rbac";
import { explainDiscordError } from "@/lib/discord";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.teamId) throw new Error("Not authenticated.");
  if (!session.user.roles.some((r) => LEADERSHIP_ROLES.includes(r as any)))
    throw new Error("Only Head Mentors and Team Leadership can manage Discord settings.");
  return session;
}

const ConfigSchema = z.object({
  guildId:              z.string().min(1),
  channelBuildAlerts:   z.string().optional(),
  channelOrders:        z.string().optional(),
  channelInventory:     z.string().optional(),
  channelTasks:         z.string().optional(),
  channelSafety:        z.string().optional(),
  channelGeneral:       z.string().optional(),
  channelMilestones:    z.string().optional(),
  dailySummaryEnabled:  z.coerce.boolean().optional(),
  dailySummaryChannel:  z.string().optional(),
  dailySummaryTime:     z.string().optional(),
  publicReadEnabled:    z.coerce.boolean().optional(),
});

export async function saveDiscordConfigAction(
  _prev: { success: boolean; error?: string } | null,
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  let session;
  try { session = await requireAdmin(); } catch (e: any) { return { success: false, error: e.message }; }

  const parsed = ConfigSchema.safeParse({
    guildId:             formData.get("guildId"),
    channelBuildAlerts:  formData.get("channelBuildAlerts") || undefined,
    channelOrders:       formData.get("channelOrders") || undefined,
    channelInventory:    formData.get("channelInventory") || undefined,
    channelTasks:        formData.get("channelTasks") || undefined,
    channelSafety:       formData.get("channelSafety") || undefined,
    channelGeneral:      formData.get("channelGeneral") || undefined,
    channelMilestones:   formData.get("channelMilestones") || undefined,
    dailySummaryEnabled: formData.get("dailySummaryEnabled") === "on",
    dailySummaryChannel: formData.get("dailySummaryChannel") || undefined,
    dailySummaryTime:    formData.get("dailySummaryTime") || undefined,
    publicReadEnabled:   formData.get("publicReadEnabled") === "on",
  });

  if (!parsed.success) return { success: false, error: "Please fill in all required fields." };
  const d = parsed.data;

  await prisma.discordConfig.upsert({
    where:  { teamId: session.user.teamId! },
    create: { teamId: session.user.teamId!, ...d, active: true },
    update: { ...d, active: true },
  });

  revalidatePath("/settings/discord");
  return { success: true };
}

export async function disconnectDiscordAction(): Promise<{ success: boolean }> {
  let session;
  try { session = await requireAdmin(); } catch { return { success: false }; }

  await prisma.discordConfig.updateMany({
    where: { teamId: session.user.teamId! },
    data:  { active: false },
  });

  revalidatePath("/settings/discord");
  return { success: true };
}

export async function revokeDiscordLinkAction(linkId: string): Promise<{ success: boolean }> {
  let session;
  try { session = await requireAdmin(); } catch { return { success: false }; }
  const revoked = await prisma.discordLink.updateMany({
    where: { id: linkId, user: { teamId: session.user.teamId } },
    data:  { revokedAt: new Date() },
  });
  if (revoked.count === 0) return { success: false };
  revalidatePath("/settings/discord");
  return { success: true };
}

// ── Test message ──────────────────────────────────────────────────────────────

const TEST_MESSAGE = "Thank you for installing the FRC Manager, this message means I am installed and ready to go!";


/**
 * Post a test message to the team's server: the General channel, else the first
 * configured channel, else the server's system channel.
 */
export async function sendDiscordTestAction(): Promise<{ success: true; channel: string } | { success: false; error: string }> {
  let session;
  try { session = await requireAdmin(); } catch (e: any) { return { success: false, error: e.message }; }

  const config = await prisma.discordConfig.findUnique({ where: { teamId: session.user.teamId! } });
  if (!config) return { success: false, error: "Connect a Discord server first." };

  const { discordRequest, sendChannelMessage } = await import("@/lib/discord");
  try {
    let channelId =
      config.channelGeneral || config.channelBuildAlerts || config.channelOrders || config.channelTasks ||
      config.channelInventory || config.channelSafety || config.channelMilestones || config.dailySummaryChannel || null;
    if (!channelId) {
      const guild = await discordRequest(`/guilds/${config.guildId}`);
      channelId = guild?.system_channel_id ?? null;
    }
    if (!channelId) return { success: false, error: "No channel to post in — add a channel ID below (General is used first)." };

    await sendChannelMessage(channelId, TEST_MESSAGE);
    const channel = await discordRequest(`/channels/${channelId}`).catch(() => null);
    return { success: true, channel: channel?.name ? `#${channel.name}` : `channel ${channelId}` };
  } catch (e: any) {
    return { success: false, error: explainDiscordError(String(e?.message ?? e)) };
  }
}
