import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress";
import { Table, TableHead, TableBody, Th, Td, Tr } from "@/components/ui/table";
import { formatWeight, formatCurrency, formatDate } from "@/lib/utils";
import { WeightLogger } from "./WeightLogger";

const ROBOT_WEIGHT_LIMIT = 115;

const SUBSYSTEM_ORDER = ["DRIVETRAIN","INTAKE","SHOOTER","CLIMBER","ELECTRICAL","PNEUMATICS","FRAME","CONTROLS","BUMPERS","OTHER"];

export default async function RobotDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.teamId) redirect("/dashboard");

  const robot = await prisma.robot.findFirst({
    where: { id, season: { teamId: session.user.teamId } },
    include: {
      season: { select: { name: true, kickoffDate: true, week0Date: true } },
      inUseItems: {
        where: { status: { in: ["INSTALLED_ROBOT","INSTALLED_PRACTICE","IN_USE","AVAILABLE"] } },
        select: { id: true, name: true, subsystem: true, quantity: true, unitWeight: true, status: true, currentLocation: true },
        orderBy: { subsystem: "asc" },
      },
      bomItems: {
        select: { id: true, partName: true, subsystem: true, quantity: true, unitFmv: true, totalFmv: true, source: true },
        orderBy: { subsystem: "asc" },
      },
      weightSnaps: { orderBy: { createdAt: "desc" }, take: 10 },
      tasks: { where: { status: { not: "COMPLETE" } }, select: { id: true, name: true, status: true, dueDate: true }, orderBy: { dueDate: "asc" }, take: 5 },
    },
  });

  if (!robot) notFound();

  // Weight by subsystem
  const latestWeight = robot.weightSnaps[0]?.weight;
  const installedItems = robot.inUseItems.filter((i) => i.status === "INSTALLED_ROBOT" || i.status === "INSTALLED_PRACTICE");
  const calculatedWeight = installedItems.reduce((s, i) => s + (i.unitWeight ?? 0) * i.quantity, 0);
  const displayWeight = latestWeight ?? calculatedWeight;

  const weightBySubsystem: Record<string, number> = {};
  for (const item of installedItems) {
    const sub = item.subsystem ?? "OTHER";
    weightBySubsystem[sub] = (weightBySubsystem[sub] ?? 0) + (item.unitWeight ?? 0) * item.quantity;
  }

  const bomFmv = robot.bomItems.reduce((s, b) => s + (b.totalFmv ?? 0), 0);

  const weightLimit = robot.weightTarget ?? ROBOT_WEIGHT_LIMIT;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Breadcrumb */}
      <nav className="text-small text-[--color-text-secondary]">
        <Link href="/fleet" className="hover:text-[--color-primary]">Fleet</Link>
        <span className="mx-2">›</span>
        <span className="text-[--color-text-primary]">{robot.displayName}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-h1 text-[--color-text-primary]">{robot.displayName}</h1>
          <p className="text-body text-[--color-text-secondary] mt-1">
            {robot.season.name} · {robot.role.replace("_", " ")}
          </p>
          {robot.description && <p className="text-small text-[--color-text-secondary] mt-1">{robot.description}</p>}
        </div>
        <div className="flex gap-2">
          <Link href={`/budget/bom?robotId=${robot.id}`}>
            <Button variant="outline" size="sm">BOM</Button>
          </Link>
          <Link href={`/schedule/tasks?robotId=${robot.id}`}>
            <Button variant="outline" size="sm">Tasks</Button>
          </Link>
        </div>
      </div>

      {/* Weight + BOM summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card space-y-3">
          <h2 className="text-h3 text-[--color-text-primary]">Weight</h2>
          <ProgressBar
            value={displayWeight}
            max={weightLimit}
            sublabel={`${formatWeight(displayWeight)} / ${formatWeight(weightLimit)}`}
            warnAt={90} dangerAt={98}
          />
          {latestWeight == null && calculatedWeight === 0 && (
            <p className="text-small text-[--color-warning]">No weight data. Log a snapshot or add installed items with weights.</p>
          )}
          <WeightLogger robotId={robot.id} />
        </div>

        <div className="card space-y-3">
          <h2 className="text-h3 text-[--color-text-primary]">Bill of Materials</h2>
          <p className="text-body text-[--color-text-primary]">{formatCurrency(bomFmv)} total FMV</p>
          <Link href={`/budget/bom?robotId=${robot.id}`}>
            <Button variant="outline" size="sm">View &amp; edit BOM</Button>
          </Link>
        </div>
      </div>

      {/* Weight by subsystem */}
      {Object.keys(weightBySubsystem).length > 0 && (
        <div className="card">
          <h2 className="text-h3 text-[--color-text-primary] mb-4">Weight by subsystem</h2>
          <div className="space-y-3">
            {SUBSYSTEM_ORDER.filter((s) => weightBySubsystem[s] > 0).map((sub) => (
              <ProgressBar
                key={sub}
                value={weightBySubsystem[sub]}
                max={weightLimit}
                label={sub.replace("_", " ")}
                sublabel={formatWeight(weightBySubsystem[sub])}
                warnAt={50} dangerAt={70}
              />
            ))}
          </div>
        </div>
      )}

      {/* Weight history */}
      {robot.weightSnaps.length > 0 && (
        <div className="card">
          <h2 className="text-h3 text-[--color-text-primary] mb-3">Weight history</h2>
          <Table>
            <TableHead><tr><Th>Date</Th><Th right>Weight (lbs)</Th><Th>Notes</Th></tr></TableHead>
            <TableBody>
              {robot.weightSnaps.map((s) => (
                <Tr key={s.id}>
                  <Td>{formatDate(s.createdAt)}</Td>
                  <Td right className="font-medium">{s.weight.toFixed(1)}</Td>
                  <Td>{s.notes ?? "—"}</Td>
                </Tr>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Open tasks */}
      {robot.tasks.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-h3 text-[--color-text-primary]">Open tasks</h2>
            <Link href={`/schedule/tasks?robotId=${robot.id}`} className="text-small text-[--color-secondary] hover:underline">All</Link>
          </div>
          <div className="space-y-2">
            {robot.tasks.map((t) => (
              <Link key={t.id} href={`/schedule/tasks/${t.id}`}
                className="flex items-center justify-between py-2 border-b border-[--color-border] last:border-0 hover:text-[--color-primary] transition-colors">
                <span className="text-sm text-[--color-text-primary]">{t.name}</span>
                <span className="text-small text-[--color-text-secondary]">{t.dueDate ? formatDate(t.dueDate) : "No due date"}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
