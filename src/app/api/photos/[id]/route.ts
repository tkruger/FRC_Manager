import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// A tool or inventory photo, to the team it belongs to (stored in the database, like receipts).
// A photo never changes (a new one gets a new id), so browsers may keep it.

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.teamId) return new NextResponse("Sign in first.", { status: 401 });

  // ?size=thumb: the small copy for lists (a JPEG), when there is one
  const where = { id, teamId: session.user.teamId };
  if (new URL(request.url).searchParams.get("size") === "thumb") {
    const t = await prisma.storedPhoto.findFirst({ where, select: { thumb: true } });
    if (!t) return new NextResponse("Not found.", { status: 404 });
    if (t.thumb) return image(t.thumb, "image/jpeg");
  }
  const p = await prisma.storedPhoto.findFirst({ where, select: { contentType: true, data: true } });
  if (!p) return new NextResponse("Not found.", { status: 404 });
  return image(p.data, p.contentType);
}

function image(bytes: Uint8Array, contentType: string) {
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": "inline",
      // Private (only this browser), and it never changes
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
