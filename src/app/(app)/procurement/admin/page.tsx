import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ORDER_ADMIN_ROLES } from "@/lib/orders/constants";
import { ITEM_ROW_SELECT, toItemRow } from "@/lib/orders/rows";
import { ItemsTable } from "@/components/orders/ItemsTable";
import { PageTitle } from "@/components/PageHeader";
import { CsvExport } from "./CsvExport";

// Team Admin workspace: approved items to purchase, tracking links, deliveries.
export default async function OrderAdminPage() {
  const session = await auth();
  if (!session?.user?.teamId) redirect("/dashboard");
  if (!session.user.roles.some((r) => ORDER_ADMIN_ROLES.includes(r))) redirect("/procurement");

  const team = { request: { season: { teamId: session.user.teamId } } };
  const [toOrder, ordered] = await Promise.all([
    prisma.purchaseLineItem.findMany({
      where:   { ...team, status: "TO_ORDER" },
      select:  ITEM_ROW_SELECT,
      orderBy: { orderNumber: "asc" },
    }),
    prisma.purchaseLineItem.findMany({
      where:   { ...team, status: "ORDERED" },
      select:  { ...ITEM_ROW_SELECT, orderedAt: true },
      orderBy: [{ orderedAt: "asc" }, { orderNumber: "asc" }],
    }),
  ]);

  const newCount = toOrder.filter((i) => !i.exportedAt).length;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div>
        <nav className="text-small text-(--color-text-secondary) mb-1">
          <Link href="/procurement" className="hover:text-(--color-primary)">Orders</Link>
          <span className="mx-2">›</span>Team Admin
        </nav>
        <PageTitle help="purchasing">Team Admin</PageTitle>
        <p className="text-body text-(--color-text-secondary) mt-1">
          Approved items to purchase. Add a tracking link to mark items ordered — one link can cover several items that ship together.
        </p>
      </div>

      <CsvExport newCount={newCount} totalCount={toOrder.length} />

      <section className="space-y-3">
        <h2 className="text-h2 text-(--color-text-primary)">To order <span className="text-small font-normal text-(--color-text-secondary)">({toOrder.length})</span></h2>
        <ItemsTable items={toOrder.map(toItemRow)} canTrack canOverride showOrder emptyText="Nothing waiting to be ordered." />
      </section>

      <section className="space-y-3">
        <h2 className="text-h2 text-(--color-text-primary)">Ordered — on the way <span className="text-small font-normal text-(--color-text-secondary)">({ordered.length})</span></h2>
        <ItemsTable items={ordered.map(toItemRow)} canTrack canOverride showOrder emptyText="Nothing in transit." />
      </section>
    </div>
  );
}
