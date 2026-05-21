import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { EditBaseItemForm } from "./EditBaseItemForm";

function stockVariant(current: number, min: number): "danger" | "warning" | "success" {
  if (current === 0) return "danger";
  if (min > 0 && current <= min) return "warning";
  return "success";
}

export default async function InventoryItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.teamId) redirect("/dashboard");

  const [item, vendors] = await Promise.all([
    prisma.baseInventoryItem.findFirst({
      where: { id, season: { teamId: session.user.teamId } },
    }),
    prisma.vendor.findMany({
      where: { teamId: session.user.teamId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  if (!item) notFound();

  const canEdit = session.user.roles.some((r) => ["INVENTORY_ADMIN", "HEAD_MENTOR"].includes(r));

  const recentAcquisitions = await prisma.inUseInventoryItem.findMany({
    where: { baseItemId: id },
    include: { robot: { select: { displayName: true } } },
    orderBy: { dateAdded: "desc" },
    take: 5,
  });

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Breadcrumb */}
      <nav className="text-small text-[--color-text-secondary]">
        <Link href="/inventory" className="hover:text-[--color-primary]">Inventory</Link>
        <span className="mx-2">›</span>
        <span className="text-[--color-text-primary]">{item.name}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-h1 text-[--color-text-primary]">{item.name}</h1>
          <div className="flex gap-2 mt-2 flex-wrap">
            <Badge variant={stockVariant(item.currentStock, item.minStockThreshold)}>
              {item.currentStock} {item.unitOfMeasure.toLowerCase()} in stock
            </Badge>
            <Badge variant="neutral">{item.category.replace(/_/g, " ")}</Badge>
            {item.isKopItem && <Badge variant="info">KOP</Badge>}
            {item.isFirstChoiceItem && <Badge variant="info">FIRST Choice</Badge>}
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Current stock",    value: `${item.currentStock} ${item.unitOfMeasure.toLowerCase()}` },
          { label: "Min threshold",    value: item.minStockThreshold > 0 ? `${item.minStockThreshold} ${item.unitOfMeasure.toLowerCase()}` : "Not set" },
          { label: "Unit cost",        value: item.unitCost != null ? formatCurrency(item.unitCost) : "—" },
          { label: "Reorder qty",      value: item.reorderQuantity ?? "—" },
          { label: "Supplier",         value: item.preferredSupplier ?? "—" },
          { label: "Lead time",        value: item.supplierLeadDays ? `${item.supplierLeadDays} days` : "—" },
          { label: "Storage location", value: item.storageLocation ?? "—" },
          { label: "Part number",      value: item.partNumber ?? "—" },
        ].map((m) => (
          <div key={m.label} className="card py-2.5">
            <p className="text-label text-[--color-text-secondary]">{m.label}</p>
            <p className="text-sm font-medium text-[--color-text-primary] mt-0.5">{String(m.value)}</p>
          </div>
        ))}
      </div>

      {/* Description */}
      {item.description && (
        <div className="card">
          <p className="text-label text-[--color-text-secondary] mb-1">Description</p>
          <p className="text-body text-[--color-text-primary]">{item.description}</p>
        </div>
      )}

      {/* Recent acquisitions */}
      {recentAcquisitions.length > 0 && (
        <div className="card">
          <h2 className="text-h3 text-[--color-text-primary] mb-3">Recent acquisitions</h2>
          <div className="space-y-2">
            {recentAcquisitions.map((a) => (
              <div key={a.id} className="flex items-center justify-between py-1.5 border-b border-[--color-border] last:border-0">
                <div>
                  <p className="text-sm text-[--color-text-primary]">
                    {a.quantity} {item.unitOfMeasure.toLowerCase()}
                    {a.subsystem && <span className="ml-1 text-[--color-text-secondary]">→ {a.subsystem.replace(/_/g, " ")}</span>}
                    {a.robot && <span className="ml-1 text-[--color-text-secondary]">({a.robot.displayName})</span>}
                  </p>
                  <p className="text-small text-[--color-text-secondary]">
                    {new Date(a.dateAdded).toLocaleDateString()}
                  </p>
                </div>
                <Badge variant="neutral">{a.currentLocation ?? "—"}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edit form — editors only */}
      {canEdit && (
        <div className="card space-y-4">
          <h2 className="text-h3 text-[--color-text-primary]">Edit item</h2>
          <EditBaseItemForm key={item.updatedAt.toISOString()} vendors={vendors} item={{
            id:                item.id,
            name:              item.name,
            partNumber:        item.partNumber,
            category:          item.category,
            itemType:          item.itemType,
            description:       item.description,
            unitOfMeasure:     item.unitOfMeasure,
            currentStock:      item.currentStock,
            minStockThreshold: item.minStockThreshold,
            reorderQuantity:   item.reorderQuantity,
            preferredSupplier: item.preferredSupplier,
            supplierLeadDays:  item.supplierLeadDays,
            unitCost:          item.unitCost,
            fairMarketValue:   item.fairMarketValue,
            storageLocation:   item.storageLocation,
            isKopItem:         item.isKopItem,
            isFirstChoiceItem: item.isFirstChoiceItem,
            notes:             item.notes,
          }} />
        </div>
      )}
    </div>
  );
}
