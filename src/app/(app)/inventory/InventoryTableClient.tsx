"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Table, TableHead, TableBody, Th, Td, Tr } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import { groupKey, isPartial, stockText } from "@/lib/inventory/units";
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
  image: string | null;
  stockTag: string | null;
  amountLeft: string | null;
  /** Retired — shown only when retired items are revealed */
  archived: boolean;
}

interface Props {
  items:        Item[];
  robots:       { id: string; displayName: string }[];
  emptyMessage: string;
  canAdd:       boolean;
  /** "Show retired items" link, when there are any */
  retiredToggle?: { showing: boolean; count: number; href: string };
}

function stockVariant(item: Item): "danger" | "warning" | "success" | "info" {
  if (isPartial(item)) return item.currentStock > 0 ? "info" : "danger";
  if (item.currentStock === 0) return "danger";
  if (item.minStockThreshold > 0 && item.currentStock <= item.minStockThreshold) return "warning";
  return "success";
}

/** A small photo of the material (a placeholder square when there's none) */
function Thumb({ src, name }: { src: string | null; name: string }) {
  return src
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={src} alt={name} className="h-10 w-10 shrink-0 rounded-md border border-(--color-border) object-cover" />
    : <span aria-hidden className="h-10 w-10 shrink-0 rounded-md border border-dashed border-(--color-border)" />;
}

/**
 * Inventory, grouped like tools: entries with the same name — the full stock and its partial pieces —
 * sit together under one heading with what's on hand in total. A material with one entry is just a row.
 */
export function InventoryTableClient({ items, robots, emptyMessage, retiredToggle }: Props) {
  const [search, setSearch] = useState("");

  const q = search.trim().toLowerCase();
  const displayed = q
    ? items.filter((i) => [i.name, i.partNumber, i.storageLocation, i.stockTag, i.amountLeft].some((v) => (v ?? "").toLowerCase().includes(q)))
    : items;

  // Groups in list order; full stock first, then partial pieces
  const groups = new Map<string, Item[]>();
  for (const i of displayed) groups.set(groupKey(i.name), [...(groups.get(groupKey(i.name)) ?? []), i]);
  for (const list of groups.values()) list.sort((a, b) => Number(isPartial(a)) - Number(isPartial(b)));
  // A piece opens its full-stock item's page, scrolled to it (that's where pieces are managed)
  const hrefOf = (item: Item) => {
    const parent = isPartial(item) ? groups.get(groupKey(item.name))?.find((x) => !isPartial(x) && !x.archived) : null;
    return parent ? `/inventory/${parent.id}#piece-${item.id}` : `/inventory/${item.id}`;
  };

  const row = (item: Item, inGroup: boolean) => (
    <Tr key={item.id} className={item.archived ? "group opacity-60" : "group"}>
      <Td>
        <Link href={hrefOf(item)} className={`flex items-center gap-3 ${inGroup ? "pl-6" : ""}`}>
          <Thumb src={item.image} name={item.name} />
          <span className="min-w-0">
            <span className="block font-medium text-(--color-secondary) group-hover:text-(--color-primary) group-hover:underline transition-colors">
              {inGroup ? (isPartial(item) ? "Partial piece" : "Full stock") : item.name}
              {item.archived && <Badge variant="neutral" className="ml-2 text-xs">Retired</Badge>}
            </span>
            <span className="block text-small text-(--color-text-secondary)">
              {[isPartial(item) && item.amountLeft && `${item.amountLeft} left`, item.partNumber && !inGroup && item.partNumber, item.stockTag]
                .filter(Boolean).join(" · ") || "—"}
            </span>
          </span>
        </Link>
      </Td>
      <Td><span className="text-(--color-text-secondary)">{item.category.replace(/_/g, " ")}</span></Td>
      <Td right><Badge variant={stockVariant(item)}>{stockText(item)}</Badge></Td>
      <Td right className="text-(--color-text-secondary)">{isPartial(item) ? "—" : item.minStockThreshold}</Td>
      <Td>{item.storageLocation ?? "—"}</Td>
      <Td right>{formatCurrency(item.unitCost)}</Td>
      <Td>
        {!item.archived && item.currentStock > 0 && (
          <AcquireButton itemId={item.id} itemName={item.name} robots={robots} maxQty={item.currentStock} />
        )}
      </Td>
    </Tr>
  );

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search items, labels, locations…"
          className="w-full sm:max-w-xs rounded-md border border-(--color-border) bg-(--color-surface) text-(--color-text-primary) px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-(--color-primary)/40 focus:border-(--color-primary)"
        />
        {retiredToggle && (
          <Link href={retiredToggle.href} scroll={false}
            className="inline-flex items-center gap-2 text-sm text-(--color-text-secondary) hover:text-(--color-text-primary)">
            <span aria-hidden className={`flex h-4 w-4 items-center justify-center rounded border text-[10px] ${retiredToggle.showing ? "border-(--color-primary) bg-(--color-primary) text-white" : "border-(--color-border-strong)"}`}>
              {retiredToggle.showing ? "✓" : ""}
            </span>
            Show retired items ({retiredToggle.count})
          </Link>
        )}
      </div>

      {displayed.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-body text-(--color-text-secondary)">
            {search.trim() ? `No items match "${search}"` : emptyMessage}
          </p>
        </div>
      ) : (
        <>
        {/* Phones: one card per material — its entries inside */}
        <ul className="space-y-3 sm:hidden">
          {[...groups.values()].map((list) => (
            <li key={groupKey(list[0].name)} className="card p-0 overflow-hidden">
              {list.length > 1 && (
                <div className="flex items-center gap-3 border-b border-(--color-border) bg-(--color-surface-overlay) px-4 py-3">
                  <Thumb src={list.find((i) => i.image)?.image ?? null} name={list[0].name} />
                  <span className="min-w-0">
                    <span className="block font-semibold text-(--color-text-primary)">{list[0].name}</span>
                    <span className="block text-small text-(--color-text-secondary)">{list[0].category.replace(/_/g, " ")} · {list.length} entries</span>
                  </span>
                </div>
              )}
              <ul className="divide-y divide-(--color-border)">
                {list.map((item) => (
                  <li key={item.id} className={item.archived ? "opacity-60" : ""}>
                    <Link href={hrefOf(item)} className="flex items-center gap-3 px-4 py-3">
                      <Thumb src={item.image} name={item.name} />
                      <span className="min-w-0 flex-1">
                        <span className="block break-words font-medium text-(--color-secondary)">
                          {list.length > 1 ? (isPartial(item) ? "Partial piece" : "Full stock") : item.name}
                        </span>
                        <span className="block break-words text-small text-(--color-text-secondary)">
                          {[isPartial(item) && item.amountLeft && `${item.amountLeft} left`, item.storageLocation, item.stockTag].filter(Boolean).join(" · ")}
                        </span>
                        <span className="mt-1 block"><Badge variant={stockVariant(item)}>{stockText(item)}</Badge></span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
        <div className="hidden sm:block">
        <Table>
          <TableHead>
            <tr>
              <Th>Item</Th><Th>Category</Th>
              <Th right>Stock</Th><Th right>Min</Th><Th>Location</Th>
              <Th right>Unit cost</Th><Th>Action</Th>
            </tr>
          </TableHead>
          <TableBody>
            {[...groups.values()].map((list) => {
              if (list.length === 1) return row(list[0], false);
              const first = list[0];
              const full = list.filter((i) => !isPartial(i)).reduce((s, i) => s + i.currentStock, 0);
              const partials = list.filter(isPartial).reduce((s, i) => s + i.currentStock, 0);
              const unit = list.find((i) => !isPartial(i))?.unitOfMeasure.toLowerCase() ?? "";
              return (
                <Fragment key={groupKey(first.name)}>
                  <Tr className="bg-(--color-surface-overlay)">
                    <Td>
                      <span className="flex items-center gap-3">
                        <Thumb src={list.find((i) => i.image)?.image ?? null} name={first.name} />
                        <span className="min-w-0">
                          <span className="block font-semibold text-(--color-text-primary)">{first.name}</span>
                          <span className="block text-small text-(--color-text-secondary)">{list.length} entries{first.partNumber ? ` · ${first.partNumber}` : ""}</span>
                        </span>
                      </span>
                    </Td>
                    <Td><span className="text-(--color-text-secondary)">{first.category.replace(/_/g, " ")}</span></Td>
                    <Td right>
                      <span className="text-sm font-medium text-(--color-text-primary) whitespace-nowrap">
                        {[full > 0 || !partials ? `${full} ${unit}` : null, partials ? `${partials} partial` : null].filter(Boolean).join(" + ")}
                      </span>
                    </Td>
                    <Td /><Td /><Td /><Td />
                  </Tr>
                  {list.map((i) => row(i, true))}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
        </div>
        </>
      )}
    </>
  );
}
