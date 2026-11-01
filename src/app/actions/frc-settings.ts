"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { seal } from "@/lib/security/secret-box";
import { FRC_ADMIN_ROLES } from "@/lib/rbac";
import { checkTbaKey } from "@/lib/frc/tba";
import { ensureFrcSettings } from "@/lib/frc/team-keys";
import type { Role } from "@/generated/prisma";

type Result = { success: true; message?: string } | { success: false; error: string };

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.teamId) return null;
  if (!session.user.roles.some((r) => FRC_ADMIN_ROLES.includes(r as Role))) return null;
  return session.user.teamId;
}

/**
 * Save the team's keys. A blank field keeps what's saved; `clear` removes one. A new TBA key is
 * checked with TBA first.
 */
export async function saveFrcKeysAction(input: {
  tbaKey?: string; tbaSecret?: string; nexusKey?: string; nexusToken?: string;
  clear?: ("tba" | "tbaSecret" | "nexus" | "nexusToken")[];
}): Promise<Result> {
  const teamId = await requireAdmin();
  if (!teamId) return { success: false, error: "Only Head Mentors and Integration Admins can change these." };
  const tbaKey = input.tbaKey?.trim();
  const tbaSecret = input.tbaSecret?.trim();
  const nexusKey = input.nexusKey?.trim();
  const nexusToken = input.nexusToken?.trim();
  if ([tbaKey, tbaSecret, nexusKey, nexusToken].some((v) => v && v.length > 300)) return { success: false, error: "That's too long for a key." };
  if (tbaKey && !(await checkTbaKey(tbaKey))) {
    return { success: false, error: "The Blue Alliance didn't accept that key — check it's a Read API key from your account page." };
  }
  await ensureFrcSettings(teamId);
  const clear = new Set(input.clear ?? []);
  await prisma.teamFrcSettings.update({
    where: { teamId },
    data: {
      ...(tbaKey ? { tbaKeyEnc: seal(tbaKey) } : clear.has("tba") ? { tbaKeyEnc: null } : {}),
      // The secret myTBA made for the webhook (it signs every message with it)
      ...(tbaSecret ? { tbaWebhookSecretEnc: seal(tbaSecret) } : clear.has("tbaSecret") ? { tbaWebhookSecretEnc: null, tbaVerificationCode: null } : {}),
      ...(nexusKey ? { nexusKeyEnc: seal(nexusKey) } : clear.has("nexus") ? { nexusKeyEnc: null } : {}),
      ...(nexusToken ? { nexusWebhookTokenEnc: seal(nexusToken) } : clear.has("nexusToken") ? { nexusWebhookTokenEnc: null } : {}),
    },
  });
  revalidatePath("/settings/frc");
  revalidatePath("/settings/integrations");
  return { success: true };
}
