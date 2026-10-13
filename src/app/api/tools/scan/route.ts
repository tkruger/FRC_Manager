import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { resolveScanCode } from "@/lib/scan-code";

// Look up a scanned code: a tool (asset tag or id) or a tool location (LOC-0001)
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const teamId = session.user.teamId;

  const code = req.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.json({ error: "Missing code" }, { status: 400 });

  const found = await resolveScanCode(teamId, code);

  if (found.kind === "location") {
    const tools = await prisma.tool.findMany({
      where:   { teamId, retired: false, homeLocation: found.location.name },
      select:  { id: true, name: true, assetTag: true },
      orderBy: [{ name: "asc" }, { assetTag: "asc" }],
    });
    return NextResponse.json({ kind: "location", ...found.location, tools });
  }

  if (found.kind !== "tool") {
    return NextResponse.json({ error: `No tool or location found with code "${code}"` }, { status: 404 });
  }

  const tool = await prisma.tool.findUniqueOrThrow({
    where:  { id: found.tool.id },
    select: {
      id: true, name: true, assetTag: true, condition: true, homeLocation: true,
      checkouts: { where: { returnedAt: null }, select: { id: true, user: { select: { name: true } } } },
    },
  });

  // Each tool record is one physical tool
  return NextResponse.json({
    kind: "tool",
    id: tool.id,
    name: tool.name,
    assetTag: tool.assetTag,
    condition: tool.condition,
    homeLocation: tool.homeLocation,
    available: tool.checkouts.length === 0 && !["OUT_OF_SERVICE", "OUT_FOR_MAINTENANCE"].includes(tool.condition),
    checkouts: tool.checkouts,
  });
}
