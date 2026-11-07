import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/PageHeader";
import { isPartial } from "@/lib/inventory/units";
import { StockLabels } from "./StockLabels";

/** Printable QR labels for the inventory — every item, or the ones picked (?ids=a,b) */
export default async function InventoryLabelsPage({ searchParams }: { searchParams: Promise<{ ids?: string }> }) {
  const session = await auth();
  if (!session?.user?.teamId) redirect("/dashboard");
  const { ids } = await searchParams;
  const season = await prisma.season.findFirst({ where: { teamId: session.user.teamId, isActive: true }, select: { id: true } });
  if (!season) redirect("/settings/season");

  const items = await prisma.baseInventoryItem.findMany({
    where:   { seasonId: season.id, archived: false, ...(ids ? { id: { in: ids.split(",").slice(0, 500) } } : {}) },
    orderBy: [{ name: "asc" }, { unitOfMeasure: "asc" }],
    select:  { id: true, name: true, stockTag: true, unitOfMeasure: true, amountLeft: true, storageLocation: true },
  });

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="no-print">
        <PageHeader
          breadcrumb={<><Link href="/inventory" className="hover:text-(--color-primary)">Inventory</Link><span className="mx-2">›</span>Labels</>}
          title="Inventory labels"
          help="inventory"
          subtitle="Stick each one on its bin, sheet or offcut — scanning it (Tools → Scan) opens the item."
        />
      </div>
      <StockLabels labels={items.map((i) => ({
        id: i.id, name: i.name, code: i.stockTag ?? i.id,
        detail: isPartial(i) ? (i.amountLeft ? `Partial — ${i.amountLeft} left` : "Partial piece") : i.storageLocation,
      }))} />
    </div>
  );
}
