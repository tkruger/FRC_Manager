import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.teamId) return new NextResponse("Unauthorized", { status: 401 });

  const robotId = req.nextUrl.searchParams.get("robotId");
  if (!robotId) return new NextResponse("Missing robotId", { status: 400 });

  const robot = await prisma.robot.findFirst({
    where: { id: robotId, season: { teamId: session.user.teamId } },
    select: { displayName: true },
  });
  if (!robot) return new NextResponse("Not found", { status: 404 });

  const items = await prisma.bomItem.findMany({
    where: { robotId },
    orderBy: [{ subsystem: "asc" }, { partName: "asc" }],
  });

  await prisma.bomExport.create({
    data: { robotId, exportedById: session.user.id, format: "CSV" },
  });

  const headers = [
    "Part Name",
    "Part Number",
    "Subsystem",
    "Quantity",
    "Unit FMV ($)",
    "Total FMV ($)",
    "Source",
    "Notes",
  ];

  function escapeCell(val: string | number | boolean | null | undefined): string {
    const s = String(val ?? "");
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  }

  const rows = items.map((item) => [
    item.partName,
    item.partNumber ?? "",
    item.subsystem?.replace(/_/g, " ") ?? "",
    item.quantity,
    item.unitFmv ?? "",
    item.totalFmv ?? "",
    item.source.replace(/_/g, " "),
    item.notes ?? "",
  ]);

  const totalFmv = items.reduce((s, i) => s + (i.totalFmv ?? 0), 0);
  rows.push([]);
  rows.push(["TOTAL FMV", "", "", "", "", totalFmv.toFixed(2), "", ""]);

  const csvLines = [
    `# FRC Robot BOM — ${robot.displayName}`,
    `# Exported: ${new Date().toISOString()}`,
    "",
    headers.map(escapeCell).join(","),
    ...rows.map((row) => row.map(escapeCell).join(",")),
  ];

  const csv = csvLines.join("\r\n");
  const filename = `bom-${robot.displayName.replace(/\s+/g, "-").toLowerCase()}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
