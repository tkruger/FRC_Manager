import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHead, TableBody, Th, Td, Tr } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import { AcquireButton } from "./AcquireButton";

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ view?: string; category?: string }> }) {
  const { view, category } = await searchParams;
  const session = await auth();
  if (!session?.user?.teamId) redirect("/dashboard");

  const activeSeason = await prisma.season.findFirst({
    where: { teamId: session.user.teamId, isActive: true },
  });
  if (!activeSeason) redirect("/settings/season");

  const [items, reorderRequests] = await Promise.all([
    prisma.baseInventoryItem.findMany({
      where: {
        seasonId: activeSeason.id,
        archived: false,
        ...(category ? { category: category as any } : {}),
      },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    }),
    prisma.reorderRequest.findMany({
      where: { baseItem: { seasonId: activeSeason.id }, status: "PENDING" },
      include: { baseItem: { select: { name: true, preferredSupplier: true, unitCost: true } } },
    }),
  ]);

  const lowStock   = items.filter((i) => i.currentStock <= i.minStockThreshold && i.minStockThreshold > 0);
  const displayed  = view === "low-stock" ? lowStock : view === "reorder" ? items.filter((i) => reorderRequests.some((r) => r.baseItemId === i.id)) : items;

  function stockVariant(item: typeof items[0]): "danger" | "warning" | "success" {
    if (item.currentStock === 0) return "danger";
    if (item.currentStock <= item.minStockThreshold) return "warning";
    return "success";
  }

  const seasons_robots = await prisma.robot.findMany({
    where: { seasonId: activeSeason.id, archived: false },
    select: { id: true, displayName: true },
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h1 text-[--color-text-primary]">Base Inventory</h1>
          <p className="text-body text-[--color-text-secondary] mt-0.5">{items.length} items · {activeSeason.name}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/inventory/base/new"><Button size="sm">+ Add item</Button></Link>
        </div>
      </div>

      {/* View tabs */}
      <div className="flex gap-1 border-b border-[--color-border]">
        {[
          { key: undefined,   label: "All items" },
          { key: "low-stock", label: `Low stock (${lowStock.length})` },
          { key: "reorder",   label: `Reorder queue (${reorderRequests.length})` },
        ].map((v) => (
          <Link key={v.key ?? "all"} href={v.key ? `/inventory?view=${v.key}` : "/inventory"}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              view === v.key ? "border-[--color-primary] text-[--color-primary]" : "border-transparent text-[--color-text-secondary] hover:text-[--color-text-primary]"
            }`}>{v.label}</Link>
        ))}
      </div>

      {/* Reorder queue */}
      {view === "reorder" && reorderRequests.length > 0 && (
        <div className="card space-y-2">
          <h2 className="text-h3 text-[--color-text-primary] mb-3">Pending reorders</h2>
          {reorderRequests.map((r) => (
            <div key={r.id} className="flex items-center justify-between py-2 border-b border-[--color-border] last:border-0">
              <div>
                <p className="text-sm font-medium text-[--color-text-primary]">{r.baseItem.name}</p>
                <p className="text-small text-[--color-text-secondary]">
                  {r.baseItem.preferredSupplier ?? "No supplier"} · Qty: {r.requestedQty}
                  {r.baseItem.unitCost ? ` · Est. ${formatCurrency(r.baseItem.unitCost * r.requestedQty)}` : ""}
                </p>
              </div>
              <Badge variant="warning">Pending</Badge>
            </div>
          ))}
        </div>
      )}

      {displayed.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-body text-[--color-text-secondary] mb-4">No items found.</p>
          <Link href="/inventory/base/new"><Button size="sm">Add item</Button></Link>
        </div>
      ) : (
        <Table>
          <TableHead>
            <tr>
              <Th>Item</Th><Th>Category</Th><Th>Type</Th>
              <Th right>Stock</Th><Th right>Min</Th><Th>Location</Th>
              <Th right>Unit cost</Th><Th>Action</Th>
            </tr>
          </TableHead>
          <TableBody>
            {displayed.map((item) => (
              <Tr key={item.id}>
                <Td>
                  <p className="font-medium text-[--color-text-primary]">{item.name}</p>
                  {item.partNumber && <p className="text-mono text-[--color-text-secondary]">{item.partNumber}</p>}
                </Td>
                <Td>{item.category.replace(/_/g, " ")}</Td>
                <Td>{item.itemType.replace(/_/g, " ")}</Td>
                <Td right>
                  <Badge variant={stockVariant(item)}>
                    {item.currentStock} {item.unitOfMeasure.toLowerCase()}
                  </Badge>
                </Td>
                <Td right className="text-[--color-text-secondary]">{item.minStockThreshold}</Td>
                <Td>{item.storageLocation ?? "—"}</Td>
                <Td right>{formatCurrency(item.unitCost)}</Td>
                <Td>
                  <AcquireButton itemId={item.id} itemName={item.name} robots={seasons_robots} maxQty={item.currentStock} />
                </Td>
              </Tr>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
