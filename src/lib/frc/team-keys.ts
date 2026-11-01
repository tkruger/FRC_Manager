// Each team's keys for The Blue Alliance and FRC Nexus. A team's own TBA key comes first, then the
// deployment's TBA_API_KEY as a shared fallback. Nexus keys are per team only. Server-only.

import crypto from "crypto";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { open } from "@/lib/security/secret-box";
import { tbaClient, type TbaClient } from "./tba";

const settingsFor = cache((teamId: string) =>
  prisma.teamFrcSettings.findUnique({ where: { teamId }, select: { tbaKeyEnc: true, nexusKeyEnc: true } }));

/** Where the team's TBA key comes from */
export type TbaKeySource = "team" | "shared" | null;

export const tbaKeyFor = cache(async (teamId: string): Promise<{ key: string; source: TbaKeySource } | null> => {
  const s = await settingsFor(teamId);
  const own = s?.tbaKeyEnc ? open(s.tbaKeyEnc) : null;
  if (own) return { key: own, source: "team" };
  const shared = process.env.TBA_API_KEY;
  return shared ? { key: shared, source: "shared" } : null;
});

/** A TBA client for the team, or null with no key to use */
export async function tbaFor(teamId: string): Promise<TbaClient | null> {
  const k = await tbaKeyFor(teamId);
  return k ? tbaClient(k.key) : null;
}

/** The team's Nexus key, if it added one */
export async function nexusKeyFor(teamId: string): Promise<string | null> {
  const s = await settingsFor(teamId);
  return s?.nexusKeyEnc ? open(s.nexusKeyEnc) : null;
}

/** The team's settings row (created on first use, with its private, unguessable webhook address) */
export function ensureFrcSettings(teamId: string) {
  return prisma.teamFrcSettings.upsert({
    where:  { teamId },
    create: { teamId, hookId: crypto.randomBytes(18).toString("base64url") },
    update: {},
  });
}
