// Tool and inventory photo uploads — stored in the database (like expense receipts) and shown at
// /api/photos/<id> to the team. The browser shrinks photos first (to a few hundred KB).
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/security/rate-limit";

/** What the file really is, from its first bytes (the browser's type and name can't be trusted) */
function sniffImage(head: Uint8Array): { type: string; ext: string } | null {
  const is = (sig: number[], at = 0) => sig.every((b, i) => head[at + i] === b);
  if (is([0xff, 0xd8, 0xff])) return { type: "image/jpeg", ext: "jpg" };
  if (is([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { type: "image/png", ext: "png" };
  if (is([0x52, 0x49, 0x46, 0x46]) && is([0x57, 0x45, 0x42, 0x50], 8)) return { type: "image/webp", ext: "webp" };
  return null;
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.teamId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!await rateLimit(`upload:user:${session.user.id}`, 30, 60 * 60)) {
    return NextResponse.json({ error: "Too many uploads. Try again later." }, { status: 429 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }

  if (file.size > 4 * 1024 * 1024) {
    return NextResponse.json({ error: "That photo is too big — keep it under 4 MB." }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniffImage(bytes.subarray(0, 16));
  if (!kind) {
    return NextResponse.json({ error: "Use a JPEG, PNG or WebP photo." }, { status: 400 });
  }

  // A small copy for lists (optional; a JPEG the browser made)
  const t = form.get("thumb");
  let thumb: Uint8Array<ArrayBuffer> | null = null;
  if (t instanceof File && t.size > 0 && t.size <= 300 * 1024) {
    const tb = new Uint8Array(await t.arrayBuffer());
    if (sniffImage(tb.subarray(0, 16))?.type === "image/jpeg") thumb = tb;
  }

  // The type comes from the bytes, never from the upload
  const photo = await prisma.storedPhoto.create({
    data:   { teamId: session.user.teamId, uploadedById: session.user.id, contentType: kind.type, size: bytes.length, data: Buffer.from(bytes), thumb },
    select: { id: true },
  });
  return NextResponse.json({ url: `/api/photos/${photo.id}` });
}
