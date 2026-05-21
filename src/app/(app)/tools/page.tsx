import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Table, TableHead, TableBody, Th, Td, Tr } from "@/components/ui/table";
import { formatDate } from "@/lib/utils";
import { CheckinButton } from "./CheckinButton";
import { AddToolDialog } from "./AddToolDialog";
import { Button } from "@/components/ui/button";
import { ToolsClient } from "./ToolsClient";

const TOOL_EDIT_ROLES = ["INVENTORY_ADMIN", "BUILD_LEAD", "TEAM_LEADERSHIP", "HEAD_MENTOR"];

export default async function ToolsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams;
  const session = await auth();
  if (!session?.user?.teamId) redirect("/dashboard");

  const canEdit = session.user.roles.some((r) => TOOL_EDIT_ROLES.includes(r));

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
    { key: undefined,           label: "All tools" },
    { key: "checked-out",       label: `Checked out (${activeCheckouts.length})` },
    { key: "overdue",           label: `Overdue (${overdue.length})` },
    { key: "needs-maintenance", label: "Needs maintenance" },
  ];

  const filtered = view === "checked-out"
    ? tools.filter((t) => activeCheckouts.some((c) => c.toolId === t.id))
    : view === "overdue"
    ? tools.filter((t) => overdue.some((c) => c.toolId === t.id))
    : view === "needs-maintenance"
    ? tools.filter((t) => ["NEEDS_REPAIR", "OUT_OF_SERVICE", "OUT_FOR_MAINTENANCE"].includes(t.condition))
    : tools;

  // Serialize dates for client component
  const serializedCheckouts = activeCheckouts.map((c) => ({
    id:             c.id,
    toolId:         c.toolId,
    quantity:       c.quantity,
    expectedReturn: c.expectedReturn.toISOString(),
    user:           c.user,
  }));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-h1 text-[--color-text-primary]">Tools</h1>
          <p className="text-body text-[--color-text-secondary] mt-0.5">{tools.length} tools in catalog</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/tools/scan">
            <Button variant="secondary" size="sm" className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z" />
              </svg>
              Scan
            </Button>
          </Link>
          <AddToolDialog />
        </div>
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
        <ToolsClient
          tools={filtered}
          activeCheckouts={serializedCheckouts}
          canEdit={canEdit}
        />
      )}

      {/* Checked out summary */}
      {activeCheckouts.length > 0 && !view && (
        <div className="card">
          <h2 className="text-h2 text-[--color-text-primary] mb-3">Checked out</h2>
          <Table>
            <TableHead>
              <tr><Th>Tool</Th><Th>Who</Th><Th>Expected return</Th><Th>Status</Th><Th>Action</Th></tr>
            </TableHead>
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

