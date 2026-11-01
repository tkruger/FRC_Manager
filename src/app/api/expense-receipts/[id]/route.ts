import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canReviewClaims } from "@/lib/expense-claims";

// A receipt, to the people allowed to see it: whoever uploaded it, the claim's submitter, and
// Treasurers and Head Mentors on the same team. ?download=1 saves it instead of showing it.

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.teamId) return new NextResponse("Sign in first.", { status: 401 });

  const r = await prisma.expenseReceipt.findFirst({
    where:  { id, teamId: session.user.teamId },
    select: { fileName: true, contentType: true, data: true, uploadedById: true, claim: { select: { submittedById: true } } },
  });
  const mine = r && (r.uploadedById === session.user.id || r.claim?.submittedById === session.user.id);
  if (!r || !(mine || canReviewClaims(session.user.roles))) return new NextResponse("Not found.", { status: 404 });

  const download = new URL(request.url).searchParams.get("download") === "1";
  return new NextResponse(new Uint8Array(r.data), {
    headers: {
      "Content-Type": r.contentType,
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${r.fileName.replace(/"/g, "")}"`,
      // Private: never cached by shared caches
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

/** Remove a receipt that isn't on a submitted claim yet (the uploader changed their mind) */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.teamId) return new NextResponse("Sign in first.", { status: 401 });
  await prisma.expenseReceipt.deleteMany({ where: { id, uploadedById: session.user.id, claimId: null } });
  return NextResponse.json({ ok: true });
}
