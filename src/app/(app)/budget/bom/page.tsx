import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Table, TableHead, TableBody, Th, Td, Tr } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import { AddBomItemDialog } from "./AddBomItemDialog";
import { BomItemActions } from "./BomItemActions";
import { RobotSwitcher } from "./RobotSwitcher";
import { getActiveRobotId } from "@/app/actions/robot-context";

export default async function BomPage({ searchParams }: { searchParams: Promise<{ robotId?: string }> }) {
  const { robotId: selectedRobotId } = await searchParams;
  const session = await auth();
  if (!session?.user?.teamId) redirect("/dashboard");

  const [activeSeason, cookieRobotId] = await Promise.all([
    prisma.season.findFirst({
      where: { teamId: session.user.teamId, isActive: true },
      include: { robots: { where: { archived: false }, orderBy: { createdAt: "asc" } } },
    }),
    getActiveRobotId(),
  ]);

  if (!activeSeason) redirect("/settings/season");

  const effectiveRobotId = selectedRobotId ?? cookieRobotId ?? undefined;
  const compBot = activeSeason.robots.find((r) => r.role === "COMPETITION") ?? activeSeason.robots[0];
  const robot = effectiveRobotId
    ? activeSeason.robots.find((r) => r.id === effectiveRobotId) ?? compBot
    : compBot;

  if (!robot) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-h1 text-[--color-text-primary] mb-4">Robot BOM</h1>
        <div className="card">
          <p className="text-body text-[--color-text-secondary]">
            No robots found. <Link href="/settings/season" className="text-[--color-secondary] hover:underline">Add a robot</Link> first.
          </p>
        </div>
      </div>
    );
  }

  const bomItems = await prisma.bomItem.findMany({
    where: { robotId: robot.id },
    orderBy: [{ subsystem: "asc" }, { partName: "asc" }],
  });

  const totalFmv = bomItems.reduce((s, i) => s + (i.totalFmv ?? 0), 0);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <nav className="text-small text-[--color-text-secondary] mb-1">
            <Link href="/budget" className="hover:text-[--color-primary]">Budget</Link>
            <span className="mx-2">›</span>Robot BOM
          </nav>
          <h1 className="text-h1 text-[--color-text-primary]">Robot BOM — {robot.displayName}</h1>
          <p className="text-body text-[--color-text-secondary] mt-1">
            {bomItems.length} line items · Total FMV: <strong>{formatCurrency(totalFmv)}</strong>
          </p>
        </div>
        <div className="flex gap-2 items-center">
          {activeSeason.robots.length > 1 && (
            <RobotSwitcher robots={activeSeason.robots} currentId={robot.id} />
          )}
          <AddBomItemDialog robotId={robot.id} />
          <a
            href={`/api/bom-export?robotId=${robot.id}`}
            download
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-[--color-border] text-sm font-medium text-[--color-text-primary] hover:bg-[--color-surface-overlay] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Export CSV
          </a>
        </div>
      </div>

      {/* BOM table */}
      {bomItems.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-body text-[--color-text-secondary] mb-4">No BOM items yet.</p>
          <AddBomItemDialog robotId={robot.id} />
        </div>
      ) : (
        <Table>
          <TableHead>
            <tr>
              <Th>Part</Th>
              <Th>Subsystem</Th>
              <Th>Source</Th>
              <Th right>Qty</Th>
              <Th right>Unit FMV</Th>
              <Th right>Total FMV</Th>
              <Th />
            </tr>
          </TableHead>
          <TableBody>
            {bomItems.map((item) => (
              <Tr key={item.id}>
                <Td>
                  <p className="font-medium">{item.partName}</p>
                  {item.partNumber && <p className="text-mono text-[--color-text-secondary]">{item.partNumber}</p>}
                </Td>
                <Td>{item.subsystem?.replace(/_/g, " ") ?? "—"}</Td>
                <Td>
                  <Badge variant={item.source === "KOP" ? "info" : item.source === "FIRST_CHOICE" ? "success" : "neutral"}>
                    {item.source.replace(/_/g, " ")}
                  </Badge>
                </Td>
                <Td right>{item.quantity}</Td>
                <Td right>{item.unitFmv != null ? formatCurrency(item.unitFmv) : "—"}</Td>
                <Td right>{item.totalFmv != null ? formatCurrency(item.totalFmv) : "—"}</Td>
                <Td>
                  <BomItemActions itemId={item.id} />
                </Td>
              </Tr>
            ))}
            <Tr>
              <Td colSpan={5} className="text-right font-medium text-[--color-text-secondary]">Total FMV</Td>
              <Td right className="font-bold text-[--color-text-primary]">{formatCurrency(totalFmv)}</Td>
              <Td />
            </Tr>
          </TableBody>
        </Table>
      )}
    </div>
  );
}
