import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { EditBaseItemForm } from "./EditBaseItemForm";
import { RetireItemButton } from "./RetireItemButton";
import { LabelPanel, PartialPieceDialog, PhotoPanel } from "./StockPanels";
import { PiecesStrip } from "./PiecesStrip";
import { AcquireButton } from "../AcquireButton";
import { isViewOnly } from "@/lib/access/read-only";
import { PageHeader } from "@/components/PageHeader";
import { isPartial, stockText } from "@/lib/inventory/units";

function stockVariant(current: number, min: number, partial: boolean): "danger" | "warning" | "success" | "info" {
  if (partial) return current > 0 ? "info" : "danger";
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
      where:   { id, season: { teamId: session.user.teamId } },
      include: { retiredBy: { select: { name: true } } },
    }),
    prisma.vendor.findMany({
      where: { teamId: session.user.teamId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  if (!item) notFound();

  const canEdit = session.user.roles.some((r) => ["INVENTORY_ADMIN", "HEAD_MENTOR"].includes(r));
  const partial = isPartial(item);
  // The rest of its group: the same material by name (full stock and partial pieces)
  const siblings = await prisma.baseInventoryItem.findMany({
    where:   { seasonId: item.seasonId, archived: false, id: { not: item.id }, name: { equals: item.name.trim(), mode: "insensitive" } },
    orderBy: [{ unitOfMeasure: "asc" }, { createdAt: "asc" }],
    select:  { id: true, name: true, unitOfMeasure: true, currentStock: true, amountLeft: true, storageLocation: true, stockTag: true, image: true },
  });
  // The full-stock item is the parent; its partial pieces are managed on its page
  const parent = partial ? siblings.find((x) => x.unitOfMeasure !== "PARTIAL") ?? null : null;
  const fullStock = partial ? parent : item;
  const pieces = partial ? [] : siblings.filter((x) => x.unitOfMeasure === "PARTIAL" && x.currentStock > 0);
  // A piece without a full-stock item (only offcuts left) still lists the others
  const looseGroup = partial && !parent ? siblings : [];
  const robots = await prisma.robot.findMany({ where: { seasonId: item.seasonId, archived: false }, select: { id: true, displayName: true } });
  const canUse = !item.archived && item.currentStock > 0 && !isViewOnly(session.user.roles);

  const recentAcquisitions = await prisma.inUseInventoryItem.findMany({
    where: { baseItemId: id },
    include: { robot: { select: { displayName: true } } },
    orderBy: { dateAdded: "desc" },
    take: 5,
  });

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Retired: out of the inventory until restored */}
      {item.archived && (
        <div className="card py-3 px-4 border-l-4" style={{ borderLeftColor: "var(--color-warning)" }}>
          <p className="text-sm text-(--color-text-primary)">
            <span className="font-semibold">Retired</span>
            <span className="text-(--color-text-secondary)">
              {item.retiredAt && ` on ${formatDate(item.retiredAt)}`}{item.retiredBy && ` by ${item.retiredBy.name}`} —
              it isn&apos;t part of the inventory, low stock or the order queue.
            </span>
          </p>
        </div>
      )}

      <PageHeader
        breadcrumb={<><Link href="/inventory" className="hover:text-(--color-primary)">Inventory</Link><span className="mx-2">›</span><span className="text-(--color-text-primary)">{item.name}</span></>}
        title={partial ? <>{item.name} <span className="font-normal text-(--color-text-secondary)">— partial piece</span></> : item.name}
        help="inventory"
        subtitle={<span className="flex gap-2 pt-1 flex-wrap">
          <Badge variant={stockVariant(item.currentStock, item.minStockThreshold, partial)}>{stockText(item)}{partial ? "" : " in stock"}</Badge>
          {pieces.length > 0 && <Badge variant="info">{pieces.length} partial piece{pieces.length === 1 ? "" : "s"}</Badge>}
          {partial && item.amountLeft && <Badge variant="info">{item.amountLeft} left</Badge>}
          <Badge variant="neutral">{item.category.replace(/_/g, " ")}</Badge>
          {item.stockTag && <Badge variant="neutral">{item.stockTag}</Badge>}
          {item.isKopItem && <Badge variant="info">KOP</Badge>}
          {item.isFirstChoiceItem && <Badge variant="info">FIRST Choice</Badge>}
        </span>}
        items={[
          // Pieces are added on the full-stock item (or on a piece when there's none)
          canEdit && !item.archived && !parent && { kind: "action", place: "primary", label: "+ Add a partial piece", action: "inventory:add-partial" },
          parent && { kind: "link", place: "secondary", label: "All pieces", href: `/inventory/${parent.id}#piece-${item.id}` },
          canUse && { kind: "action", place: "secondary", label: "Use on Robot", action: "inventory:use" },
          { kind: "action", place: "secondary", icon: "print", label: "Print label", action: "inventory:print-label" },
          pieces.length > 0 && { kind: "link", place: "menu", icon: "print", label: "Print piece labels", href: `/inventory/labels?ids=${pieces.map((p) => p.id).join(",")}` },
          { kind: "link", place: "menu", label: "Scan labels", href: "/tools/scan" },
          canEdit && { kind: "action", place: "menu", danger: !item.archived, label: item.archived ? "Restore item" : "Retire item", action: "inventory:retire" },
        ]}
        actions={<>
          {canEdit && <RetireItemButton itemId={item.id} itemName={item.name} retired={item.archived} action="inventory:retire" />}
          {canUse && <AcquireButton itemId={item.id} itemName={item.name} robots={robots} maxQty={item.currentStock} action="inventory:use" />}
          {canEdit && !item.archived && !parent && <PartialPieceDialog itemId={item.id} itemName={item.name} location={item.storageLocation}
            fullStock={fullStock && fullStock.unitOfMeasure !== "PARTIAL" ? fullStock.currentStock : null} action="inventory:add-partial" />}
        </>}
      />

      {parent && (
        <div className="card flex flex-wrap items-center justify-between gap-3 border-l-4 border-l-(--color-info) py-3">
          <p className="text-sm text-(--color-text-primary)">
            A partial piece of <b>{parent.name}</b> — its pieces are managed together on the full-stock item.
          </p>
          <Link href={`/inventory/${parent.id}#piece-${item.id}`} className="text-sm font-medium text-(--color-secondary) hover:underline">Go to all pieces →</Link>
        </div>
      )}

      {/* Partial pieces: scroll through them and manage each one */}
      {!partial && (pieces.length > 0 || canEdit) && (
        <section id="pieces" className="card space-y-3 scroll-mt-24">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-h3 text-(--color-text-primary)">Partial pieces <span className="text-small font-normal text-(--color-text-secondary)">({pieces.length})</span></h2>
            {pieces.length > 1 && <span className="text-small text-(--color-text-secondary)">Scroll for more →</span>}
          </div>
          <PiecesStrip name={item.name} canEdit={canEdit} robots={robots}
            pieces={pieces.map((p) => ({ id: p.id, code: p.stockTag ?? p.id, amountLeft: p.amountLeft, storageLocation: p.storageLocation, image: p.image, count: p.currentStock }))} />
        </section>
      )}

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Current stock",    value: stockText(item) },
          partial
            ? { label: "Amount left",   value: item.amountLeft ?? "—" }
            : { label: "Min threshold", value: item.minStockThreshold > 0 ? `${item.minStockThreshold} ${item.unitOfMeasure.toLowerCase()}` : "Not set" },
          { label: "Unit cost",        value: item.unitCost != null ? formatCurrency(item.unitCost) : "—" },
          { label: "Reorder qty",      value: item.reorderQuantity ?? "—" },
          { label: "Supplier",         value: item.preferredSupplier ?? "—" },
          { label: "Lead time",        value: item.supplierLeadDays ? `${item.supplierLeadDays} days` : "—" },
          { label: "Storage location", value: item.storageLocation ?? "—" },
          { label: "Part number",      value: item.partNumber ?? "—" },
        ].map((m) => (
          <div key={m.label} className="card py-2.5">
            <p className="text-label text-(--color-text-secondary)">{m.label}</p>
            <p className="text-sm font-medium text-(--color-text-primary) mt-0.5">{String(m.value)}</p>
          </div>
        ))}
      </div>

      {/* Photo and label */}
      <div className="grid items-start gap-4 sm:grid-cols-2">
        <PhotoPanel url={item.image} name={item.name} canEdit={canEdit} />
        <LabelPanel itemId={item.id} name={item.name} code={item.stockTag} detail={partial ? (item.amountLeft ? `Partial — ${item.amountLeft} left` : "Partial piece") : null} action="inventory:print-label" />
      </div>

      {/* The rest of this material: the full stock and its partial pieces */}
      {looseGroup.length > 0 && (
        <section className="card space-y-2">
          <h2 className="text-h3 text-(--color-text-primary)">Other pieces</h2>
          <ul className="divide-y divide-(--color-border)">
            {looseGroup.map((x) => (
              <li key={x.id}>
                <Link href={`/inventory/${x.id}`} className="flex items-center gap-3 py-2 hover:text-(--color-primary)">
                  {x.image
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={x.image} alt="" className="h-9 w-9 rounded-md border border-(--color-border) object-cover" />
                    : <span aria-hidden className="h-9 w-9 rounded-md border border-dashed border-(--color-border)" />}
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-(--color-text-primary)">{x.unitOfMeasure === "PARTIAL" ? `Partial piece${x.amountLeft ? ` — ${x.amountLeft} left` : ""}` : "Full stock"}</span>
                    <span className="block text-small text-(--color-text-secondary)">{[stockText(x), x.storageLocation, x.stockTag].filter(Boolean).join(" · ")}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Description */}
      {item.description && (
        <div className="card">
          <p className="text-label text-(--color-text-secondary) mb-1">Description</p>
          <p className="text-body text-(--color-text-primary)">{item.description}</p>
        </div>
      )}

      {/* Recent acquisitions */}
      {recentAcquisitions.length > 0 && (
        <div className="card">
          <h2 className="text-h3 text-(--color-text-primary) mb-3">Recent acquisitions</h2>
          <div className="space-y-2">
            {recentAcquisitions.map((a) => (
              <div key={a.id} className="flex items-center justify-between py-1.5 border-b border-(--color-border) last:border-0">
                <div>
                  <p className="text-sm text-(--color-text-primary)">
                    {a.quantity} {item.unitOfMeasure.toLowerCase()}
                    {a.subsystem && <span className="ml-1 text-(--color-text-secondary)">→ {a.subsystem.replace(/_/g, " ")}</span>}
                    {a.robot && <span className="ml-1 text-(--color-text-secondary)">({a.robot.displayName})</span>}
                  </p>
                  <p className="text-small text-(--color-text-secondary)">
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
          <h2 className="text-h3 text-(--color-text-primary)">Edit item</h2>
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
            amountLeft:        item.amountLeft,
            image:             item.image,
          }} />
        </div>
      )}
    </div>
  );
}
