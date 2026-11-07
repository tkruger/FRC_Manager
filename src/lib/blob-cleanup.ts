// Older tool photos on Vercel Blob (new ones are stored in the database — see photos.ts): a daily sweep
// deletes the ones nothing uses any more. Server-only; does nothing without BLOB_READ_WRITE_TOKEN.

import { del, list } from "@vercel/blob";
import { prisma } from "@/lib/prisma";

const isOurBlob = (url: string | null | undefined): url is string => {
  if (!url) return false;
  try { return new URL(url).hostname.endsWith(".public.blob.vercel-storage.com"); } catch { return false; }
};

/** Uploads younger than this are left alone — the form they belong to may still be open */
const GRACE_MS = 24 * 60 * 60 * 1000;

/** Delete tool photos no tool or inventory item points to. Returns how many were removed. */
export async function sweepUnusedToolPhotos(): Promise<number> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return 0;
  const [tools, items] = await Promise.all([
    prisma.tool.findMany({ where: { image: { not: null } }, select: { image: true } }),
    prisma.baseInventoryItem.findMany({ where: { image: { not: null } }, select: { image: true } }),
  ]);
  const used = new Set([...tools, ...items].map((r) => r.image).filter(isOurBlob).map((u) => new URL(u).pathname));

  const cutoff = Date.now() - GRACE_MS;
  const unused: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: "tools/", cursor, limit: 1000 });
    for (const b of page.blobs) {
      if (new Date(b.uploadedAt).getTime() < cutoff && !used.has(new URL(b.url).pathname)) unused.push(b.url);
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);

  // del takes a batch of URLs
  for (let i = 0; i < unused.length; i += 100) await del(unused.slice(i, i + 100));
  return unused.length;
}
