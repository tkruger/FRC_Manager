// Limits on what a team can upload into the database (tool and inventory photos, expense
// receipts). Each person already has an hourly limit; these stop one account — or a few — from
// filling the database for everyone. Server-only.

import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/security/rate-limit";

/** Uploads a team can make in a day (photos and receipts together) */
const TEAM_UPLOADS_PER_DAY = 300;
/** Everything a team can keep stored (photos and receipts together) */
export const TEAM_STORAGE_BYTES = 2 * 1024 * 1024 * 1024;

/** Why the team can't upload this file right now, or null when it can */
export async function teamUploadProblem(teamId: string, bytes: number): Promise<string | null> {
  if (!await rateLimit(`upload:team:${teamId}`, TEAM_UPLOADS_PER_DAY, 24 * 60 * 60)) {
    return "Your team has uploaded a lot today. Try again tomorrow.";
  }
  const [photos, receipts] = await Promise.all([
    prisma.storedPhoto.aggregate({ where: { teamId }, _sum: { size: true } }),
    prisma.expenseReceipt.aggregate({ where: { teamId }, _sum: { size: true } }),
  ]);
  const used = (photos._sum.size ?? 0) + (receipts._sum.size ?? 0);
  if (used + bytes > TEAM_STORAGE_BYTES) {
    return "Your team's photo and receipt storage is full. Remove photos you no longer need, or ask the FRC Manager admins for more room.";
  }
  return null;
}

/** Largest picture accepted, in pixels per side and in total (a 48 MP phone photo is about 8000 × 6000) */
const MAX_SIDE = 10_000;
const MAX_PIXELS = 50_000_000;

/**
 * Width and height from a JPEG, PNG or WebP file's header, or null when they can't be read.
 * (The file type has already been checked from its first bytes.)
 */
export function imageSize(b: Uint8Array, type: string): { width: number; height: number } | null {
  const u16be = (i: number) => (b[i] << 8) | b[i + 1];
  const u32be = (i: number) => ((b[i] << 24) >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3];
  const u16le = (i: number) => b[i] | (b[i + 1] << 8);
  const u24le = (i: number) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);

  if (type === "image/png") {
    if (b.length < 24) return null;
    return { width: u32be(16), height: u32be(20) };
  }
  if (type === "image/webp") {
    if (b.length < 30) return null;
    const chunk = String.fromCharCode(b[12], b[13], b[14], b[15]);
    if (chunk === "VP8X") return { width: u24le(24) + 1, height: u24le(27) + 1 };
    if (chunk === "VP8L") {
      const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24);
      return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
    }
    if (chunk === "VP8 ") return { width: u16le(26) & 0x3fff, height: u16le(28) & 0x3fff };
    return null;
  }
  if (type === "image/jpeg") {
    // Walk the segments to the frame header (SOF0–SOF15, apart from DHT, JPG and DAC)
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) return null;
      const marker = b[i + 1];
      if (marker === 0xff) { i++; continue; }
      if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) { i += 2; continue; }
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: u16be(i + 5), width: u16be(i + 7) };
      }
      if (marker === 0xd9 || marker === 0xda) return null; // end of image / image data before a frame header
      i += 2 + u16be(i + 2);
    }
    return null;
  }
  return null;
}

/** Whether a picture's size is one a phone or desktop could have taken (not a decompression bomb) */
export function sensibleImage(b: Uint8Array, type: string): boolean {
  const s = imageSize(b, type);
  return !!s && s.width > 0 && s.height > 0 && s.width <= MAX_SIDE && s.height <= MAX_SIDE && s.width * s.height <= MAX_PIXELS;
}
