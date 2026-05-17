import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StartInspectionButton } from "./StartInspectionButton";
import { CheckItemButton } from "./CheckItemButton";

export default async function InspectionPage({ searchParams }: { searchParams: Promise<{ checklistId?: string }> }) {
  const { checklistId } = await searchParams;
  const session = await auth();
  if (!session?.user?.teamId) redirect("/dashboard");

  const activeSeason = await prisma.season.findFirst({
    where: { teamId: session.user.teamId, isActive: true },
    include: { robots: { where: { archived: false, role: "COMPETITION" }, select: { id: true, displayName: true }, take: 1 } },
  });

  const robots = await prisma.robot.findMany({
    where: { season: { teamId: session.user.teamId, isActive: true }, archived: false },
    select: { id: true, displayName: true },
  });

  // Load checklist if specified
  const checklist = checklistId
    ? await prisma.inspectionChecklist.findUnique({
        where: { id: checklistId },
        include: { items: { orderBy: [{ category: "asc" }, { id: "asc" }] } },
      })
    : null;

  // Recent checklists
  const recent = await prisma.inspectionChecklist.findMany({
    where: { robotId: { in: robots.map((r) => r.id) } },
    include: { items: { select: { status: true } } },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  function passCount(items: { status: string }[]) {
    return items.filter((i) => i.status === "PASS").length;
  }

  // Group checklist items by category
  type CheckItem = NonNullable<typeof checklist>["items"][0];
  const grouped: Record<string, CheckItem[]> = {};
  if (checklist) {
    for (const item of checklist.items) {
      if (!grouped[item.category]) grouped[item.category] = [];
      grouped[item.category].push(item);
    }
  }

  const allPass = checklist && checklist.items.every((i) => i.status === "PASS");

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div>
        <nav className="text-small text-[--color-text-secondary] mb-1">
          <Link href="/safety" className="hover:text-[--color-primary]">Safety</Link>
          <span className="mx-2">›</span>Inspection
        </nav>
        <h1 className="text-h1 text-[--color-text-primary]">Pre-competition inspection</h1>
      </div>

      {/* Start new checklist */}
      {!checklist && (
        <div className="card space-y-4">
          <h2 className="text-h3 text-[--color-text-primary]">Start inspection checklist</h2>
          <StartInspectionButton robots={robots} />
        </div>
      )}

      {/* Active checklist */}
      {checklist && (
        <div className="space-y-4">
          <div className="card flex items-center justify-between">
            <div>
              <p className="text-h3 text-[--color-text-primary]">{checklist.eventName ?? "Inspection checklist"}</p>
              <p className="text-small text-[--color-text-secondary]">
                {checklist.items.filter((i) => i.status === "PASS").length} / {checklist.items.length} items passed
              </p>
            </div>
            {allPass && <Badge variant="success">Ready for inspection ✓</Badge>}
          </div>

          {Object.entries(grouped).map(([category, items]) => (
            <div key={category} className="card">
              <h3 className="text-h3 text-[--color-text-primary] mb-3">{category}</h3>
              <div className="space-y-2">
                {items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-4">
                    <p className={`text-sm flex-1 ${item.status === "PASS" ? "text-[--color-text-secondary] line-through" : "text-[--color-text-primary]"}`}>
                      {item.description}
                    </p>
                    <div className="flex gap-1 shrink-0">
                      <CheckItemButton itemId={item.id} currentStatus={item.status as any} status="PASS" label="✓" />
                      <CheckItemButton itemId={item.id} currentStatus={item.status as any} status="FAIL" label="✗" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <Link href="/safety/inspection">
            <Button variant="outline" size="sm">Start new checklist</Button>
          </Link>
        </div>
      )}

      {/* Recent checklists */}
      {recent.length > 0 && (
        <div className="card">
          <h2 className="text-h3 text-[--color-text-primary] mb-3">Recent checklists</h2>
          <div className="space-y-2">
            {recent.map((c) => {
              const passed = passCount(c.items);
              return (
                <Link key={c.id} href={`/safety/inspection?checklistId=${c.id}`}
                  className="flex items-center justify-between py-2 border-b border-[--color-border] last:border-0 hover:text-[--color-primary] transition-colors">
                  <span className="text-sm text-[--color-text-primary]">{c.eventName ?? "Unnamed"}</span>
                  <span className="text-small text-[--color-text-secondary]">{passed}/{c.items.length} passed</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
