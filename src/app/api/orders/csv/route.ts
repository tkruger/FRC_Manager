import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma, PurchaseStatus } from "@/generated/prisma";
import { CSV_ITEM_SELECT, itemsToCsv } from "@/lib/orders/items";
import { verifyExportToken } from "@/lib/orders/export-token";

// Download orders as CSV in the purchasing spreadsheet format (no header row):
// #XXXX, Vendor, Part Name, Link, Unit Price, Qty, Order Notes, Order Date.
//   ?order=<id>                 one order's items
//   ?view=open|mine|all         every order on that Orders tab (active season)
//   ?token=<signed>             either of the above, without a login — used to open
//                               exports in Safari from the iPhone home-screen app

type Caller = { userId: string; teamId: string; order: string | null; view: string };

async function caller(params: URLSearchParams): Promise<Caller | null> {
  const token = params.get("token");
  if (token) {
    const scope = verifyExportToken(token);
    if (!scope) return null;
    // The token says who asked; make sure they're still an active member of that team
    const user = await prisma.user.findFirst({
      where:  { id: scope.userId, teamId: scope.teamId, status: "ACTIVE" },
      select: { id: true },
    });
    return user ? { userId: scope.userId, teamId: scope.teamId, order: scope.order ?? null, view: scope.view ?? "open" } : null;
  }
  const session = await auth();
  if (!session?.user?.teamId) return null;
  return { userId: session.user.id, teamId: session.user.teamId, order: params.get("order"), view: params.get("view") ?? "open" };
}

export async function GET(req: Request) {
  const c = await caller(new URL(req.url).searchParams);
  if (!c) {
    return new Response("This export link has expired or isn't valid. Go back to FRC Manager and tap Export CSV again.", {
      status: 401, headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  let where: Prisma.PurchaseLineItemWhereInput;
  let filename: string;
  if (c.order) {
    const order = await prisma.purchaseRequest.findFirst({
      where:  { id: c.order, season: { teamId: c.teamId } },
      select: { id: true, title: true },
    });
    if (!order) return new Response("Not found", { status: 404 });
    where = { requestId: order.id };
    filename = `order-${slug(order.title)}`;
  } else {
    const season = await prisma.season.findFirst({ where: { teamId: c.teamId, isActive: true }, select: { id: true } });
    if (!season) return new Response("No active season", { status: 404 });
    where = {
      request: {
        seasonId: season.id,
        ...(c.view === "open" ? { status: { in: ["SUBMITTED", "APPROVED", "ORDERED", "PARTIAL_RECEIVED"] as PurchaseStatus[] } } : {}),
        ...(c.view === "mine" ? { requestedById: c.userId } : {}),
      },
    };
    filename = `orders-${c.view}`;
  }

  const items = await prisma.purchaseLineItem.findMany({
    where,
    select:  CSV_ITEM_SELECT,
    orderBy: [{ orderNumber: "asc" }, { id: "asc" }],
  });

  return new Response(itemsToCsv(items) + "\n", {
    headers: {
      "Content-Type":        "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control":       "no-store",
      "Referrer-Policy":     "no-referrer",
    },
  });
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "export";
}
