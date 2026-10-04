import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Table, TableHead, TableBody, Th, Td, Tr } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import { statusBadgeVariant, statusLabel } from "@/lib/procurement-helpers";
import { ReorderButton } from "./ReorderButton";
import { OrderNewItemDialog } from "./OrderNewItemDialog";
import { AddInventoryItemDialog } from "./AddInventoryItemDialog";
import { InventoryTableClient } from "./InventoryTableClient";
import { HelpLink } from "@/components/HelpLink";

// Roles that may see the Low stock and Order queue tabs
const RESTRICTED_TAB_ROLES = ["HEAD_MENTOR", "TEAM_LEADERSHIP", "BUILD_LEAD", "INVENTORY_ADMIN"];

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ view?: string; category?: string }> }) {
  const { view, category } = await searchParams;
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
          where: { baseItem: { seasonId: activeSeason.id }, status: { in: ["PENDING", "APPROVED", "ORDERED"] } },
          include: {
            baseItem: { select: { name: true, preferredSupplier: true, unitCost: true } },
            purchaseRequest: { select: { id: true, status: true } },
          },
          orderBy: { createdAt: "asc" },
        })
      : Promise.resolve([]),
    prisma.vendor.findMany({
      where: { teamId: session.user.teamId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const lowStock  = items.filter((i) => i.currentStock <= i.minStockThreshold && i.minStockThreshold > 0);
  const displayed = view === "low-stock" ? lowStock
                  : view === "reorder"   ? items.filter((i) => reorderRequests.some((r) => r.baseItemId === i.id))
                  : items;

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
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-h1 text-[--color-text-primary] flex items-center gap-2">Base Inventory <HelpLink topic="inventory" /></h1>
          <p className="text-body text-[--color-text-secondary] mt-0.5">{items.length} items · {activeSeason.name}</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <OrderNewItemDialog />
          {canManageInventory && <AddInventoryItemDialog vendors={vendors} />}
        </div>
      </div>

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
              Order queue ({reorderRequests.length})
            </Link>
          </>
        )}
      </div>

      {/* Order queue summary card */}
      {view === "reorder" && (
        <div className="card space-y-2">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-h3 text-(--color-text-primary)">Order queue</h2>
              <p className="text-small text-(--color-text-secondary)">
                Everything that needs ordering or is on its way. Items land here when stock falls to their minimum
                or when someone orders them, and stay until the delivery is received.
              </p>
            </div>
            <OrderNewItemDialog variant="primary" />
          </div>
          {reorderRequests.length === 0 && (
            <p className="text-small text-(--color-text-secondary)">Nothing is waiting to be ordered.</p>
          )}
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
                {r.purchaseRequest ? (
                  <Link href={`/procurement/requests/${r.purchaseRequest.id}`} className="flex items-center gap-2 hover:underline">
                    <Badge variant={statusBadgeVariant(r.purchaseRequest.status)}>{statusLabel(r.purchaseRequest.status)}</Badge>
                    <span className="text-small text-[--color-secondary]">View request</span>
                  </Link>
                ) : (
                  <Badge variant="warning">Needs a request</Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* All items tab — client component with inline search */}
      {!view && (
        <InventoryTableClient
          items={items}
          robots={seasons_robots}
          emptyMessage="No items found."
          canAdd={canManageInventory}
        />
      )}

      {/* Restricted tabs (Low stock / Order queue) — server-rendered, no search */}
      {view && (
        displayed.length === 0 ? (
          <div className="card text-center py-12">
            <p className="text-body text-[--color-text-secondary]">
              {view === "low-stock" ? "No items are below their minimum threshold." : "The order queue is empty."}
            </p>
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
                return (
                  <Tr key={item.id} className="group">
                    <Td>
                      <Link href={`/inventory/${item.id}`}
                        className="font-medium text-[--color-secondary] hover:underline group-hover:text-[--color-primary] transition-colors">
                        {item.name}
                      </Link>
                      {item.partNumber && <p className="text-mono text-[--color-text-secondary]">{item.partNumber}</p>}
                    </Td>
                    <Td><Link href={`/inventory/${item.id}`} className="block text-[--color-text-secondary] group-hover:text-[--color-text-primary]">{item.category.replace(/_/g, " ")}</Link></Td>
                    <Td><Link href={`/inventory/${item.id}`} className="block text-[--color-text-secondary] group-hover:text-[--color-text-primary]">{item.itemType.replace(/_/g, " ")}</Link></Td>
                    <Td right>
                      <Badge variant={stockVariant(item)}>{item.currentStock} {item.unitOfMeasure.toLowerCase()}</Badge>
                    </Td>
                    <Td right className="text-[--color-text-secondary]">{item.minStockThreshold}</Td>
                    <Td>{item.storageLocation ?? "—"}</Td>
                    <Td right>{formatCurrency(item.unitCost)}</Td>
                    <Td>
                      {pendingReorder?.purchaseRequest ? (
                        <Link href={`/procurement/requests/${pendingReorder.purchaseRequest.id}`}
                          className="text-sm font-medium text-[--color-secondary] hover:underline whitespace-nowrap">
                          On request &rarr;
                        </Link>
                      ) : (
                        <ReorderButton
                          itemId={item.id}
                          itemName={item.name}
                          reorderQty={pendingReorder?.requestedQty ?? item.reorderQuantity ?? 1}
                          unitCost={item.unitCost}
                          supplier={item.preferredSupplier}
                        />
                      )}
                    </Td>
                  </Tr>
                );
              })}
            </TableBody>
          </Table>
        )
      )}
    </div>
  );
}
