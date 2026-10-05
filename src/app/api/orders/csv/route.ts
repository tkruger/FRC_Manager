import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma, PurchaseStatus } from "@/generated/prisma";
import { CSV_ITEM_SELECT, itemsToCsv } from "@/lib/orders/items";

// Download orders as CSV in the purchasing spreadsheet format, with a header row:
// #XXXX, Vendor, Part Name, Link, Unit Price, Qty, Order Notes, Order Date.
//   ?order=<id>                 one order's items
//   ?view=open|mine|all         every order on that Orders tab (active season)
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.teamId) return new Response("Unauthorized", { status: 401 });

  const params = new URL(req.url).searchParams;
  const orderId = params.get("order");
  const view    = params.get("view") ?? "open";

  let where: Prisma.PurchaseLineItemWhereInput;
  let filename: string;
  if (orderId) {
    const order = await prisma.purchaseRequest.findFirst({
      where:  { id: orderId, season: { teamId: session.user.teamId } },
      select: { id: true, title: true },
    });
    if (!order) return new Response("Not found", { status: 404 });
    where = { requestId: order.id };
    filename = `order-${slug(order.title)}`;
  } else {
    const season = await prisma.season.findFirst({ where: { teamId: session.user.teamId, isActive: true }, select: { id: true } });
    if (!season) return new Response("No active season", { status: 404 });
    where = {
      request: {
        seasonId: season.id,
        ...(view === "open" ? { status: { in: ["SUBMITTED", "APPROVED", "ORDERED", "PARTIAL_RECEIVED"] as PurchaseStatus[] } } : {}),
        ...(view === "mine" ? { requestedById: session.user.id } : {}),
      },
    };
    filename = `orders-${view}`;
  }

  const items = await prisma.purchaseLineItem.findMany({
    where,
    select:  CSV_ITEM_SELECT,
    orderBy: [{ orderNumber: "asc" }, { id: "asc" }],
  });

  return new Response(itemsToCsv(items, { header: true }) + "\n", {
    headers: {
      "Content-Type":        "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control":       "no-store",
    },
  });
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "export";
}
