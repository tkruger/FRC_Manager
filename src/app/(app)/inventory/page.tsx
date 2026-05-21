import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Table, TableHead, TableBody, Th, Td, Tr } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import { AcquireButton } from "./AcquireButton";
import { ReorderButton } from "./ReorderButton";
import { AddInventoryItemDialog } from "./AddInventoryItemDialog";
import { InventorySearch } from "./InventorySearch";

// Roles that may see Low Stock and Reorder Queue tabs
const RESTRICTED_TAB_ROLES = ["HEAD_MENTOR", "TEAM_LEADERSHIP", "BUILD_LEAD", "INVENTORY_ADMIN"];

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ view?: string; category?: string; q?: string }> }) {
  const { view, category, q } = await searchParams;
  const session = await auth();
  if (!session?.user?.teamId) redirect("/dashboard");

  const canSeeRestrictedTabs  = session.user.roles.some((r) => RESTRICTED_TAB_ROLES.includes(r));
  const canManageInventory    = session.user.roles.some((r) => ["INVENTORY_ADMIN", "HEAD_MENTOR"].includes(r));

  // Redirect unauthorized users away from restricted tabs
  if ((view === "low-stock" || view === "reorder") && !canSeeRestrictedTabs) {
    redirect("/inventory");
  }

  const activeSeason = await prisma.season.findFirst({
    where: { teamId: session.user.teamId, isActive: true },
  });
  if (!activeSeason) redirect("/settings/season");

  const [items, reorderRequests, vendors] = await Promise.all([
    prisma.baseInventoryItem.findMany({
      where: {
        seasonId: activeSeason.id,
        archived: false,
        ...(category ? { category: category as any } : {}),
      },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    }),
    canSeeRestrictedTabs
      ? prisma.reorderRequest.findMany({
          where: { baseItem: { seasonId: activeSeason.id }, status: "PENDING" },
          include: { baseItem: { select: { name: true, preferredSupplier: true, unitCost: true } } },
        })
      : Promise.resolve([]),
    prisma.vendor.findMany({
      where: { teamId: session.user.teamId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const lowStock  = items.filter((i) => i.currentStock <= i.minStockThreshold && i.minStockThreshold > 0);
  const qLower    = q?.trim().toLowerCase() ?? "";
  const baseList  = view === "low-stock" ? lowStock
                  : view === "reorder"   ? items.filter((i) => reorderRequests.some((r) => r.baseItemId === i.id))
                  : items;
  const displayed = qLower
    ? baseList.filter((i) =>
        i.name.toLowerCase().includes(qLower) ||
        (i.partNumber ?? "").toLowerCase().includes(qLower) ||
        (i.storageLocation ?? "").toLowerCase().includes(qLower)
      )
    : baseList;

  function stockVariant(item: typeof items[0]): "danger" | "warning" | "success" {
    if (item.currentStock === 0) return "danger";
    if (item.currentStock <= item.minStockThreshold) return "warning";
    return "success";
  }

  const seasons_robots = await prisma.robot.findMany({
    where: { seasonId: activeSeason.id, archived: false },
    select: { id: true, displayName: true },
  });

  // Build reorder request lookup for the reorder tab
  const reorderByItemId = new Map(reorderRequests.map((r) => [r.baseItemId, r]));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-h1 text-[--color-text-primary]">Base Inventory</h1>
          <p className="text-body text-[--color-text-secondary] mt-0.5">{items.length} items · {activeSeason.name}</p>
        </div>
        {canManageInventory && <AddInventoryItemDialog vendors={vendors} />}
      </div>

      <InventorySearch defaultValue={q} />

      {/* View tabs */}
      <div className="flex gap-1 border-b border-[--color-border]">
        <Link href="/inventory"
          className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
            !view ? "border-[--color-primary] text-[--color-primary]" : "border-transparent text-[--color-text-secondary] hover:text-[--color-text-primary]"
          }`}>
          All items
        </Link>

        {canSeeRestrictedTabs && (
          <>
            <Link href="/inventory?view=low-stock"
              className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                view === "low-stock" ? "border-[--color-primary] text-[--color-primary]" : "border-transparent text-[--color-text-secondary] hover:text-[--color-text-primary]"
              }`}>
              Low stock ({lowStock.length})
            </Link>

            <Link href="/inventory?view=reorder"
              className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                view === "reorder" ? "border-[--color-primary] text-[--color-primary]" : "border-transparent text-[--color-text-secondary] hover:text-[--color-text-primary]"
              }`}>
              Reorder queue ({reorderRequests.length})
            </Link>
          </>
        )}
      </div>

      {/* Reorder queue summary card */}
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
              <div className="flex items-center gap-3">
                <Badge variant="warning">Pending</Badge>
              </div>
            </div>
          ))}
        </div>
      )}

      {displayed.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-body text-[--color-text-secondary] mb-4">
            {view === "low-stock" ? "No items are below their minimum threshold." :
             view === "reorder"   ? "No pending reorder requests." :
             "No items found."}
          </p>
          {!view && canManageInventory && <AddInventoryItemDialog vendors={vendors} />}
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
            {displayed.map((item) => {
              const pendingReorder = reorderByItemId.get(item.id);
              const isRestrictedView = view === "low-stock" || view === "reorder";

              return (
                <Tr key={item.id} className="group">
                  <Td>
                    <Link
                      href={`/inventory/${item.id}`}
                      className="font-medium text-[--color-secondary] hover:underline group-hover:text-[--color-primary] transition-colors"
                    >
                      {item.name}
                    </Link>
                    {item.partNumber && <p className="text-mono text-[--color-text-secondary]">{item.partNumber}</p>}
                  </Td>
                  <Td>
                    <Link href={`/inventory/${item.id}`} className="block text-[--color-text-secondary] group-hover:text-[--color-text-primary]">
                      {item.category.replace(/_/g, " ")}
                    </Link>
                  </Td>
                  <Td>
                    <Link href={`/inventory/${item.id}`} className="block text-[--color-text-secondary] group-hover:text-[--color-text-primary]">
                      {item.itemType.replace(/_/g, " ")}
                    </Link>
                  </Td>
                  <Td right>
                    <Badge variant={stockVariant(item)}>
                      {item.currentStock} {item.unitOfMeasure.toLowerCase()}
                    </Badge>
                  </Td>
                  <Td right className="text-[--color-text-secondary]">{item.minStockThreshold}</Td>
                  <Td>{item.storageLocation ?? "—"}</Td>
                  <Td right>{formatCurrency(item.unitCost)}</Td>
                  <Td>
                    {isRestrictedView ? (
                      <ReorderButton
                        itemId={item.id}
                        itemName={item.name}
                        reorderQty={item.reorderQuantity ?? 1}
                        unitCost={item.unitCost}
                        supplier={item.preferredSupplier}
                        reorderRequestId={pendingReorder?.id}
                      />
                    ) : (
                      <AcquireButton
                        itemId={item.id}
                        itemName={item.name}
                        robots={seasons_robots}
                        maxQty={item.currentStock}
                      />
                    )}
                  </Td>
                </Tr>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
