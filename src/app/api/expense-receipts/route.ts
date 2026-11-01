import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/security/rate-limit";
import { MAX_RECEIPT_BYTES } from "@/lib/expense-claims";

// Upload one receipt (a photo or PDF) for an expense claim the person is filling in. It's
// kept unattached until the claim is submitted with its id; unattached receipts are removed
// by the hourly job after a day. Receipts live in the database, private to the team.

export const dynamic = "force-dynamic";

/** What the file really is, from its first bytes (the browser's type and name can't be trusted) */
function sniff(head: Uint8Array): { type: string; ext: string } | null {
  const is = (sig: number[], at = 0) => sig.every((b, i) => head[at + i] === b);
  if (is([0xff, 0xd8, 0xff])) return { type: "image/jpeg", ext: "jpg" };
  if (is([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { type: "image/png", ext: "png" };
  if (is([0x52, 0x49, 0x46, 0x46]) && is([0x57, 0x45, 0x42, 0x50], 8)) return { type: "image/webp", ext: "webp" };
  if (is([0x25, 0x50, 0x44, 0x46, 0x2d])) return { type: "application/pdf", ext: "pdf" }; // %PDF-
  return null;
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.teamId) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!await rateLimit(`receipt:user:${session.user.id}`, 40, 60 * 60)) {
    return NextResponse.json({ error: "Too many uploads. Try again later." }, { status: 429 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "No file provided." }, { status: 400 });
  if (file.size > MAX_RECEIPT_BYTES) {
    return NextResponse.json({ error: `“${file.name}” is too big — receipts can be up to ${MAX_RECEIPT_BYTES / 1024 / 1024} MB.` }, { status: 413 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniff(bytes.subarray(0, 16));
  if (!kind) return NextResponse.json({ error: `“${file.name}” isn't a photo (JPEG, PNG, WebP) or a PDF.` }, { status: 415 });

  // A tidy name: the original without its path or odd characters, with the real extension
  const base = file.name.replace(/^.*[\\/]/, "").replace(/\.[^.]*$/, "").replace(/[^\w .()-]+/g, "").trim().slice(0, 80) || "receipt";
  const receipt = await prisma.expenseReceipt.create({
    data: {
      teamId: session.user.teamId, uploadedById: session.user.id,
      fileName: `${base}.${kind.ext}`, contentType: kind.type, size: bytes.length, data: Buffer.from(bytes),
    },
    select: { id: true, fileName: true, contentType: true, size: true },
  });
  return NextResponse.json(receipt);
}
