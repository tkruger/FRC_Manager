import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { PageTitle } from "@/components/PageHeader";
import { definitionFor, canEditOrder, canResubmitOrder } from "@/lib/workflow/engine";
import { itemRef } from "@/lib/orders/constants";
import { OrderForm } from "../../new/OrderForm";

export default async function EditOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.teamId) redirect("/dashboard");

  const [order, vendors] = await Promise.all([
    prisma.purchaseRequest.findFirst({
      where:  { id, season: { teamId: session.user.teamId } },
      select: {
        id: true, title: true, status: true, currentStepKey: true, workflowDefinitionId: true, budgetCategory: true, requestedById: true,
        approvalNotes: true,
        lineItems: {
          orderBy: [{ orderNumber: "asc" }, { id: "asc" }],
          select: { id: true, orderNumber: true, status: true, name: true, vendorName: true, partNumber: true,
            vendorProductUrl: true, unitCost: true, quantity: true, subTeam: true, importance: true, reasoning: true, notes: true, budgetCategory: true },
        },
      },
    }),
    prisma.vendor.findMany({
      where:   { teamId: session.user.teamId },
      orderBy: [{ preferred: "desc" }, { name: "asc" }],
      select:  { name: true },
    }),
  ]);
  if (!order) notFound();

  // Same rules as the server action: open orders — approvers, orderers and Head Mentors;
  // denied or canceled ones (fix and resubmit) — also the person who placed it
  const def = await definitionFor(order.workflowDefinitionId);
  const resubmit = order.status === "DENIED" || order.status === "CANCELLED";
  const allowed = resubmit
    ? canResubmitOrder(def, order, { id: session.user.id, roles: session.user.roles })
    : canEditOrder(def, order, session.user.roles);
  if (!allowed) redirect(`/procurement/requests/${order.id}`);

  const open   = order.lineItems.filter((l) => l.status !== "ARRIVED");
  const locked = order.lineItems.filter((l) => l.status === "ARRIVED");

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div>
        <nav className="text-small text-(--color-text-secondary) mb-1">
          <Link href="/procurement" className="hover:text-(--color-primary)">Orders</Link>
          <span className="mx-2">›</span>
          <Link href={`/procurement/requests/${order.id}`} className="hover:text-(--color-primary)">{order.title}</Link>
          <span className="mx-2">›</span>{resubmit ? "Fix and resubmit" : "Edit"}
        </nav>
        <PageTitle help="purchasing">{resubmit ? "Fix and resubmit" : "Edit order"}</PageTitle>
        <p className="text-body text-(--color-text-secondary) mt-1">
          {resubmit
            ? <>This order was {order.status === "DENIED" ? "denied" : "canceled"}{order.approvalNotes ? <> — &ldquo;{order.approvalNotes}&rdquo;</> : ""}. Correct it, then resubmit: it goes through approval again from the start.</>
            : <>Change, add or remove items. New items {order.status === "SUBMITTED" ? "wait for approval with the rest of the order" : "go straight to the Buyer's To order list"}.</>}
        </p>
      </div>
      <OrderForm
        vendors={vendors.map((v) => v.name)}
        edit={{
          requestId: order.id,
          name:      order.title,
          // Older orders have none yet — the form asks for one
          budgetCategory: order.budgetCategory ?? "",
          items: open.map((l) => ({
            id:         l.id,
            ref:        itemRef(l),
            link:       l.vendorProductUrl ?? "",
            vendorName: l.vendorName ?? "",
            name:       l.name,
            partNumber: l.partNumber ?? "",
            unitCost:   l.unitCost != null ? l.unitCost.toFixed(2) : "",
            quantity:   String(l.quantity),
            subTeam:    l.subTeam ?? "",
            importance: l.importance,
            reasoning:  l.reasoning ?? "",
            notes:      l.notes ?? "",
            budgetCategory: l.budgetCategory ?? "",
          })),
          locked: locked.map((l) => ({ ref: itemRef(l), name: l.name, quantity: l.quantity })),
          resubmit,
        }}
      />
    </div>
  );
}
