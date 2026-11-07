// Tool and inventory photos. New ones are stored in the database (like expense receipts) and shown at
// /api/photos/<id> to their team; older ones may still be on Vercel Blob. Server-only.

import { del } from "@vercel/blob";
import { prisma } from "@/lib/prisma";

const STORED = /^\/api\/photos\/([a-z0-9]{20,40})$/i;

/** The stored photo's id in an address like /api/photos/<id> */
export const storedPhotoId = (url: string | null | undefined) => (url ? STORED.exec(url)?.[1] ?? null : null);

const isBlobUrl = (url: string) => {
  try { const u = new URL(url); return u.protocol === "https:" && u.hostname.endsWith(".public.blob.vercel-storage.com"); } catch { return false; }
};

/**
 * A photo address a tool or item may point to: one of this team's stored photos, or an older Vercel
 * Blob upload. Returns it (normalized), or null for anything else.
 */
export async function acceptPhotoUrl(url: unknown, teamId: string): Promise<string | null> {
  if (typeof url !== "string" || !url) return null;
  const id = storedPhotoId(url);
  if (id) {
    const ok = await prisma.storedPhoto.count({ where: { id, teamId } });
    return ok ? `/api/photos/${id}` : null;
  }
  return isBlobUrl(url) ? new URL(url).toString() : null;
}

/** Remove a photo that was just replaced or removed, unless something else still shows it (best-effort) */
export async function deletePhotoQuietly(url: string | null | undefined): Promise<void> {
  if (!url) return;
  try {
    const inUse = (await prisma.tool.count({ where: { image: url } })) + (await prisma.baseInventoryItem.count({ where: { image: url } }));
    if (inUse > 0) return;
    const id = storedPhotoId(url);
    if (id) await prisma.storedPhoto.deleteMany({ where: { id } });
    else if (isBlobUrl(url) && process.env.BLOB_READ_WRITE_TOKEN) await del(url);
  } catch (e) {
    console.warn("[photos] delete failed:", e instanceof Error ? e.message : e);
  }
}

/** Uploads younger than this are left alone — the form they belong to may still be open */
const GRACE_MS = 24 * 60 * 60 * 1000;

/** Stored photos no tool or inventory item points to (older than a day). Returns how many were removed. */
export async function sweepUnusedStoredPhotos(): Promise<number> {
  const [tools, items] = await Promise.all([
    prisma.tool.findMany({ where: { image: { startsWith: "/api/photos/" } }, select: { image: true } }),
    prisma.baseInventoryItem.findMany({ where: { image: { startsWith: "/api/photos/" } }, select: { image: true } }),
  ]);
  const used = [...new Set([...tools, ...items].map((r) => storedPhotoId(r.image)).filter((x): x is string => !!x))];
  const res = await prisma.storedPhoto.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - GRACE_MS) }, id: { notIn: used } },
  });
  return res.count;
}
