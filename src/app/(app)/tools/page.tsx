import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Table, TableHead, TableBody, Th, Td, Tr } from "@/components/ui/table";
import { formatDate, formatCurrency } from "@/lib/utils";
import { CheckinButton } from "./CheckinButton";
import { AddToolDialog } from "./AddToolDialog";
import { Button } from "@/components/ui/button";

const CONDITION_BADGE: Record<string, "success"|"warning"|"danger"|"neutral"> = {
  EXCELLENT: "success", GOOD: "success", FAIR: "warning",
  NEEDS_REPAIR: "danger", OUT_OF_SERVICE: "danger", OUT_FOR_MAINTENANCE: "warning",
};

export default async function ToolsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams;
  const session = await auth();
  if (!session?.user?.teamId) redirect("/dashboard");

  const [tools, activeCheckouts] = await Promise.all([
    prisma.tool.findMany({
      where: { teamId: session.user.teamId, retired: false },
      orderBy: { name: "asc" },
    }),
    prisma.toolCheckout.findMany({
      where: { tool: { teamId: session.user.teamId }, returnedAt: null },
      include: {
        tool: { select: { id: true, name: true, assetTag: true } },
        user: { select: { name: true } },
      },
      orderBy: { expectedReturn: "asc" },
    }),
  ]);

  const now = new Date();
  const overdue = activeCheckouts.filter((c) => c.expectedReturn < now);

  const views = [
    { key: undefined,          label: "All tools" },
    { key: "checked-out",      label: `Checked out (${activeCheckouts.length})` },
    { key: "overdue",          label: `Overdue (${overdue.length})` },
    { key: "needs-maintenance",label: "Needs maintenance" },
  ];

  const filtered = view === "checked-out"
    ? tools.filter((t) => activeCheckouts.some((c) => c.toolId === t.id))
    : view === "overdue"
    ? tools.filter((t) => overdue.some((c) => c.toolId === t.id))
    : view === "needs-maintenance"
    ? tools.filter((t) => ["NEEDS_REPAIR","OUT_OF_SERVICE","OUT_FOR_MAINTENANCE"].includes(t.condition))
    : tools;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h1 text-[--color-text-primary]">Tools</h1>
          <p className="text-body text-[--color-text-secondary] mt-0.5">{tools.length} tools in catalog</p>
        </div>
        <AddToolDialog />
      </div>

      {/* View tabs */}
      <div className="flex gap-1 border-b border-[--color-border] overflow-x-auto">
        {views.map((v) => (
          <Link key={v.key ?? "all"} href={v.key ? `/tools?view=${v.key}` : "/tools"}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              view === v.key
                ? "border-[--color-primary] text-[--color-primary]"
                : "border-transparent text-[--color-text-secondary] hover:text-[--color-text-primary]"
            }`}>
            {v.label}
          </Link>
        ))}
      </div>

      {/* Overdue alert */}
      {overdue.length > 0 && !view && (
        <div className="rounded-md bg-[--color-danger]/10 border border-[--color-danger]/20 px-4 py-3">
          <p className="text-sm font-medium text-[--color-danger]">
            {overdue.length} tool{overdue.length !== 1 ? "s" : ""} overdue for return
          </p>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-body text-[--color-text-secondary] mb-4">No tools found.</p>
          <AddToolDialog />
        </div>
      ) : (
        <Table>
          <TableHead>
            <tr>
              <Th>Tool</Th><Th>Type</Th><Th>Qty available</Th>
              <Th>Condition</Th><Th>Location</Th><Th>Cert required</Th><Th>Action</Th>
            </tr>
          </TableHead>
          <TableBody>
            {filtered.map((t) => {
              const checkedOut = activeCheckouts.filter((c) => c.toolId === t.id).reduce((s, c) => s + c.quantity, 0);
              const available  = t.quantityOwned - checkedOut;
              const checkout   = activeCheckouts.find((c) => c.toolId === t.id);
              return (
                <Tr key={t.id}>
                  <Td>
                    <Link href={`/tools/${t.id}`} className="font-medium text-[--color-text-primary] hover:text-[--color-primary]">{t.name}</Link>
                    {t.assetTag && <p className="text-mono text-[--color-text-secondary]">{t.assetTag}</p>}
                  </Td>
                  <Td>{t.toolType.replace(/_/g, " ")}</Td>
                  <Td>
                    <span className={available === 0 ? "text-[--color-danger] font-medium" : "text-[--color-text-primary]"}>
                      {available}/{t.quantityOwned}
                    </span>
                  </Td>
                  <Td><Badge variant={CONDITION_BADGE[t.condition] ?? "neutral"}>{t.condition.replace(/_/g, " ")}</Badge></Td>
                  <Td>{t.homeLocation ?? "—"}</Td>
                  <Td>{t.requiresCertification ? <Badge variant="warning">{t.certificationName ?? "Required"}</Badge> : "—"}</Td>
                  <Td>
                    {checkout ? (
                      <CheckinButton checkoutId={checkout.id} toolName={t.name} />
                    ) : available > 0 ? (
                      <Link href={`/tools/${t.id}`}><Button variant="outline" size="sm">Check out</Button></Link>
                    ) : (
                      <span className="text-small text-[--color-text-disabled]">Unavailable</span>
                    )}
                  </Td>
                </Tr>
              );
            })}
          </TableBody>
        </Table>
      )}

      {/* Currently checked out */}
      {activeCheckouts.length > 0 && !view && (
        <div className="card">
          <h2 className="text-h2 text-[--color-text-primary] mb-3">Checked out</h2>
          <Table>
            <TableHead><tr><Th>Tool</Th><Th>Who</Th><Th>Expected return</Th><Th>Status</Th><Th>Action</Th></tr></TableHead>
            <TableBody>
              {activeCheckouts.map((c) => {
                const isOver = c.expectedReturn < now;
                return (
                  <Tr key={c.id}>
                    <Td className="font-medium">{c.tool.name}</Td>
                    <Td>{c.user.name}</Td>
                    <Td>
                      <span className={isOver ? "text-[--color-danger] font-medium" : ""}>
                        {formatDate(c.expectedReturn)}
                      </span>
                    </Td>
                    <Td>{isOver ? <Badge variant="danger">Overdue</Badge> : <Badge variant="info">Out</Badge>}</Td>
                    <Td><CheckinButton checkoutId={c.id} toolName={c.tool.name} /></Td>
                  </Tr>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
