import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// Look up a tool by its asset tag (encoded in the QR code)
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const code = req.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.json({ error: "Missing code" }, { status: 400 });

  // Try matching by asset tag first, then by tool ID (allows QR codes that
  // contain either the asset tag text or the tool's DB id)
  const tool = await prisma.tool.findFirst({
    where: {
      teamId: session.user.teamId,
      retired: false,
      OR: [
        { assetTag: { equals: code, mode: "insensitive" } },
        { id: code },
      ],
    },
    select: {
      id: true,
      name: true,
      assetTag: true,
      condition: true,
      quantityOwned: true,
      checkouts: {
        where: { returnedAt: null },
        select: { id: true, quantity: true, user: { select: { name: true } } },
      },
    },
  });

  if (!tool) {
    return NextResponse.json({ error: `No tool found with code "${code}"` }, { status: 404 });
  }

  const checkedOut = tool.checkouts.reduce((s, c) => s + c.quantity, 0);
  return NextResponse.json({
    id: tool.id,
    name: tool.name,
    assetTag: tool.assetTag,
    condition: tool.condition,
    available: tool.quantityOwned - checkedOut,
    quantityOwned: tool.quantityOwned,
    checkouts: tool.checkouts,
  });
}
