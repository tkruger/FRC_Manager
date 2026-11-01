"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { DISCORD_ADMIN_ROLES } from "@/lib/rbac";
import type { DiscordAudience } from "@/generated/prisma";
import { explainDiscordError } from "@/lib/discord";
import { ActionError, userMessage } from "@/lib/action-error";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.teamId) throw new ActionError("Not authenticated.");
  if (!session.user.roles.some((r) => DISCORD_ADMIN_ROLES.includes(r)))
    throw new ActionError("Only Head Mentors, Team Leadership and Integration admins can manage Discord settings.");
  return session;
}

/** Which of the team's servers: the students' (default) or the parents' */
const audienceOf = (v: unknown): DiscordAudience => (v === "PARENT" ? "PARENT" : "STUDENT");

const ConfigSchema = z.object({
  guildId:              z.string().max(300).min(1),
  channelBuildAlerts:   z.string().max(300).optional(),
  channelOrders:        z.string().max(300).optional(),
  channelInventory:     z.string().max(300).optional(),
  channelTasks:         z.string().max(300).optional(),
  channelSafety:        z.string().max(300).optional(),
  channelGeneral:       z.string().max(300).optional(),
  channelMilestones:    z.string().max(300).optional(),
  channelVolunteers:    z.string().max(300).optional(),
  dailySummaryEnabled:  z.coerce.boolean().optional(),
  dailySummaryChannel:  z.string().max(300).optional(),
  dailySummaryTime:     z.string().max(300).optional(),
  publicReadEnabled:    z.coerce.boolean().optional(),
});

export async function saveDiscordConfigAction(
  _prev: { success: boolean; error?: string } | null,
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  let session;
  try { session = await requireAdmin(); } catch (e) { return { success: false, error: userMessage(e) }; }

  const parsed = ConfigSchema.safeParse({
    guildId:             formData.get("guildId"),
    channelBuildAlerts:  formData.get("channelBuildAlerts") || undefined,
    channelOrders:       formData.get("channelOrders") || undefined,
    channelInventory:    formData.get("channelInventory") || undefined,
    channelTasks:        formData.get("channelTasks") || undefined,
    channelSafety:       formData.get("channelSafety") || undefined,
    channelGeneral:      formData.get("channelGeneral") || undefined,
    channelMilestones:   formData.get("channelMilestones") || undefined,
    channelVolunteers:   formData.get("channelVolunteers") || undefined,
    dailySummaryEnabled: formData.get("dailySummaryEnabled") === "on",
    dailySummaryChannel: formData.get("dailySummaryChannel") || undefined,
    dailySummaryTime:    formData.get("dailySummaryTime") || undefined,
    publicReadEnabled:   formData.get("publicReadEnabled") === "on",
  });

  if (!parsed.success) return { success: false, error: "Please fill in all required fields." };
  const d = parsed.data;
  const audience = audienceOf(formData.get("audience"));
  const teamId = session.user.teamId!;

  // One server can't be both the students' and the parents'
  const other = await prisma.discordConfig.findFirst({ where: { teamId, guildId: d.guildId, active: true, audience: { not: audience } } });
  if (other) return { success: false, error: `That server is already connected as the ${other.audience === "PARENT" ? "parent" : "student"} server. Use a different server for each.` };

  await prisma.discordConfig.upsert({
    where:  { teamId_audience: { teamId, audience } },
    create: { teamId, audience, ...d, active: true },
    update: { ...d, active: true },
  });

  revalidatePath("/settings/discord");
  return { success: true };
}

export async function disconnectDiscordAction(audienceIn: string = "STUDENT"): Promise<{ success: boolean }> {
  let session;
  try { session = await requireAdmin(); } catch { return { success: false }; }

  await prisma.discordConfig.updateMany({
    where: { teamId: session.user.teamId!, audience: audienceOf(audienceIn) },
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
export async function sendDiscordTestAction(audienceIn: string = "STUDENT"): Promise<{ success: true; channel: string } | { success: false; error: string }> {
  let session;
  try { session = await requireAdmin(); } catch (e) { return { success: false, error: userMessage(e) }; }

  const config = await prisma.discordConfig.findUnique({ where: { teamId_audience: { teamId: session.user.teamId!, audience: audienceOf(audienceIn) } } });
  if (!config) return { success: false, error: "Connect a Discord server first." };

  const { discordRequest, sendChannelMessage } = await import("@/lib/discord");
  try {
    let channelId =
      config.channelGeneral || config.channelVolunteers || config.channelBuildAlerts || config.channelOrders || config.channelTasks ||
      config.channelInventory || config.channelSafety || config.channelMilestones || config.dailySummaryChannel || null;
    if (!channelId) {
      const guild = await discordRequest(`/guilds/${config.guildId}`);
      channelId = guild?.system_channel_id ?? null;
    }
    if (!channelId) return { success: false, error: "No channel to post in — add a channel ID below (General is used first)." };

    await sendChannelMessage(channelId, TEST_MESSAGE);
    const channel = await discordRequest(`/channels/${channelId}`).catch(() => null);
    return { success: true, channel: channel?.name ? `#${channel.name}` : `channel ${channelId}` };
  } catch (e) {
    return { success: false, error: explainDiscordError(e instanceof Error ? e.message : String(e)) };
  }
}
