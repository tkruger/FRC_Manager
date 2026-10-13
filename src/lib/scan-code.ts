// What a scanned barcode is: a tool (asset tag or id) or a tool location (LOC-0001). Server-only.

import { prisma } from "@/lib/prisma";

export type ScannedCode =
  | { kind: "tool"; tool: { id: string; name: string; assetTag: string | null } }
  | { kind: "location"; location: { id: string; name: string; code: string } }
  | { kind: "unknown" };

export async function resolveScanCode(teamId: string, raw: string): Promise<ScannedCode> {
  const code = raw.trim();
  if (!code) return { kind: "unknown" };

  const tool = await prisma.tool.findFirst({
    where:  { teamId, retired: false, OR: [{ assetTag: { equals: code, mode: "insensitive" } }, { id: code }] },
    select: { id: true, name: true, assetTag: true },
  });
  if (tool) return { kind: "tool", tool };

  const location = await prisma.toolLocation.findFirst({
    where:  { teamId, OR: [{ code: { equals: code, mode: "insensitive" } }, { id: code }] },
    select: { id: true, name: true, code: true },
  });
  if (location) return { kind: "location", location };

  return { kind: "unknown" };
}
