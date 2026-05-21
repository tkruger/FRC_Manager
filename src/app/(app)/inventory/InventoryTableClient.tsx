"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Table, TableHead, TableBody, Th, Td, Tr } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import { AcquireButton } from "./AcquireButton";

interface Item {
  id: string;
  name: string;
  partNumber: string | null;
  category: string;
  itemType: string;
  currentStock: number;
  minStockThreshold: number;
  unitOfMeasure: string;
  storageLocation: string | null;
  unitCost: number | null;
  reorderQuantity: number | null;
  preferredSupplier: string | null;
}

interface Props {
  items:        Item[];
  robots:       { id: string; displayName: string }[];
  emptyMessage: string;
  canAdd:       boolean;
}

function stockVariant(item: Item): "danger" | "warning" | "success" {
  if (item.currentStock === 0) return "danger";
  if (item.minStockThreshold > 0 && item.currentStock <= item.minStockThreshold) return "warning";
  return "success";
}

export function InventoryTableClient({ items, robots, emptyMessage, canAdd }: Props) {
  const [search, setSearch] = useState("");

  const displayed = search.trim()
    ? items.filter((i) =>
        i.name.toLowerCase().includes(search.toLowerCase()) ||
        (i.partNumber ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (i.storageLocation ?? "").toLowerCase().includes(search.toLowerCase())
      )
    : items;

  return (
    <div className="space-y-3">
      {/* Search — same style as tools */}
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search items…"
        className="w-full sm:max-w-xs rounded-md border border-[--color-border] bg-[--color-surface] text-[--color-text-primary] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[--color-primary]/40 focus:border-[--color-primary]"
      />

      {displayed.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-body text-[--color-text-secondary]">
            {search.trim() ? `No items match "${search}"` : emptyMessage}
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
            {displayed.map((item) => (
              <Tr key={item.id} className="group">
                <Td>
                  <Link
                    href={`/inventory/${item.id}`}
                    className="font-medium text-[--color-secondary] hover:underline group-hover:text-[--color-primary] transition-colors"
                  >
                    {item.name}
                  </Link>
                  {item.partNumber && (
                    <p className="text-mono text-[--color-text-secondary]">{item.partNumber}</p>
                  )}
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
                  <AcquireButton
                    itemId={item.id}
                    itemName={item.name}
                    robots={robots}
                    maxQty={item.currentStock}
                  />
                </Td>
              </Tr>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
