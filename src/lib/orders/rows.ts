// Loading order items for the UI. Server-only.

import type { Prisma } from "@/generated/prisma";
import type { OrderItemRow } from "@/components/orders/ItemsTable";

export const ITEM_ROW_SELECT = {
  id: true, orderNumber: true, requestId: true, name: true, vendorName: true, partNumber: true,
  vendorProductUrl: true, unitCost: true, quantity: true, subTeam: true, importance: true,
  reasoning: true, notes: true, status: true, exportedAt: true,
  tracking: { select: { url: true, label: true } },
  request:  { select: { title: true } },
} satisfies Prisma.PurchaseLineItemSelect;

type ItemWithRow = Prisma.PurchaseLineItemGetPayload<{ select: typeof ITEM_ROW_SELECT }>;

export function toItemRow(i: ItemWithRow): OrderItemRow {
  return {
    id: i.id, orderNumber: i.orderNumber, requestId: i.requestId, orderName: i.request.title,
    name: i.name, vendorName: i.vendorName, partNumber: i.partNumber, link: i.vendorProductUrl,
    unitCost: i.unitCost, quantity: i.quantity, subTeam: i.subTeam, importance: i.importance,
    reasoning: i.reasoning, notes: i.notes, status: i.status,
    tracking: i.tracking, exportedAt: i.exportedAt?.toISOString() ?? null,
  };
}
