import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// A tool or inventory photo, to the team it belongs to (stored in the database, like receipts).
// A photo never changes (a new one gets a new id), so browsers may keep it.

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.teamId) return new NextResponse("Sign in first.", { status: 401 });

  const p = await prisma.storedPhoto.findFirst({ where: { id, teamId: session.user.teamId }, select: { contentType: true, data: true } });
  if (!p) return new NextResponse("Not found.", { status: 404 });

  return new NextResponse(new Uint8Array(p.data), {
    headers: {
      "Content-Type": p.contentType,
      "Content-Disposition": "inline",
      // Private (only this browser), and it never changes
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
