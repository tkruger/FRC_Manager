"use client";

import { Fragment, useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ChevronRight, Folder, FolderOpen, GripVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableHead, Th, Td } from "@/components/ui/table";
import { toast } from "@/components/ui/toast";
import { ZoomablePhoto } from "@/components/ui/PhotoViewer";
import { cn, formatCurrency } from "@/lib/utils";
import { groupKey, isPartial, stockText } from "@/lib/inventory/units";
import { CATEGORY_OPTIONS, TYPE_OPTIONS, categoryLabel, typeLabel } from "@/lib/inventory/categories";
import { moveToCategoryAction } from "@/app/actions/inventory";
import { useFinePointer, useTouchDrag } from "../tasks/useTouchDrag";
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
  /** May sort items into folders (drag them between folders) */
  canSort:      boolean;
  /** "Show retired items" link, when there are any */
  retiredToggle?: { showing: boolean; count: number; href: string };
}

/** The location filter's choice for entries with no location */
const NO_LOCATION = "\u0000none";
/** Which folders are closed, kept per browser */
const COLLAPSED_KEY = "frc:inventory-folders-closed";

function stockVariant(item: Item): "danger" | "warning" | "success" | "info" {
  if (isPartial(item)) return item.currentStock > 0 ? "info" : "danger";
  if (item.currentStock === 0) return "danger";
  if (item.minStockThreshold > 0 && item.currentStock <= item.minStockThreshold) return "warning";
  return "success";
}

/** A small photo of the material — tap it to see it full screen (a placeholder square when there's none) */
function Thumb({ src, name }: { src: string | null; name: string }) {
  return src
    ? <ZoomablePhoto src={src} alt={name} className="h-10 w-10 shrink-0 rounded-md border border-(--color-border)" imgClassName="h-full w-full object-cover" />
    : <span aria-hidden className="h-10 w-10 shrink-0 rounded-md border border-dashed border-(--color-border)" />;
}

const selectCls = "rounded-md border border-(--color-border) bg-(--color-surface) text-(--color-text-primary) px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-(--color-primary)/40 focus:border-(--color-primary)";

/**
 * Inventory in folders by category. Inside a folder, entries with the same name — the full stock and
 * its partial pieces — sit together under one heading, like tools. Editors sort items by dragging them
 * to another folder (on phones: touch and hold, then drag); the whole material moves together.
 */
export function InventoryTableClient({ items, robots, emptyMessage, canSort, retiredToggle }: Props) {
  const [search, setSearch] = useState("");
  const [location, setLocation] = useState("");
  const [type, setType] = useState("");
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [, startMove] = useTransition();

  // Moved items show in their new folder straight away
  const [shown, moveShown] = useOptimistic(items, (state, m: { key: string; category: string }) =>
    state.map((i) => (groupKey(i.name) === m.key ? { ...i, category: m.category } : i)));

  // Closed folders are remembered (read after the first render, so it matches the server's)
  useEffect(() => {
    const t = setTimeout(() => {
      try { const v = JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? "[]"); if (Array.isArray(v)) setClosed(new Set(v)); } catch { /* not available */ }
    }, 0);
    return () => clearTimeout(t);
  }, []);
  function toggleFolder(cat: string) {
    setClosed((prev) => {
      const next = new Set(prev);
      if (!next.delete(cat)) next.add(cat);
      try { localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...next])); } catch { /* not available */ }
      return next;
    });
  }

  /** Move the material `itemId` belongs to into `category` (mouse and touch dragging both end here) */
  function move(itemId: string, category: string) {
    const item = shown.find((i) => i.id === itemId);
    if (!canSort || !item || item.category === category) return;
    startMove(async () => {
      moveShown({ key: groupKey(item.name), category });
      const res = await moveToCategoryAction(itemId, category);
      if (res.success) toast.success(`Moved ${item.name} to ${categoryLabel(category)}`);
      else toast.error(res.error ?? "Couldn't move it.");
    });
  }

  // Phones and tablets: touch and hold an item, then drag it to a folder
  const listRef = useRef<HTMLDivElement>(null);
  const touch = useTouchDrag({
    onStart:  (id) => setDragging(id),
    onOver:   (cat) => setOver(cat),
    onDrop:   (id, cat) => { setDragging(null); setOver(null); if (cat) move(id, cat); },
    onCancel: () => { setDragging(null); setOver(null); },
  }, listRef, "inv-folder");
  const mouseDrag = useFinePointer() && canSort;

  // Mouse and trackpad: the browser's drag and drop
  const dragSource = (id: string) => mouseDrag ? {
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", id);
      setTimeout(() => setDragging(id), 0);
    },
    onDragEnd: () => { setDragging(null); setOver(null); },
  } : {};
  const touchSource = (id: string) => canSort ? {
    onTouchStart: (e: React.TouchEvent<HTMLElement>) => touch.begin(id, e.currentTarget, e),
    // No long-press menu — holding an item picks it up
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  } : {};
  const dropTarget = (cat: string) => ({
    "data-inv-folder": cat,
    ...(mouseDrag ? {
      onDragOver: (e: React.DragEvent) => { if (!dragging) return; e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (over !== cat) setOver(cat); },
      onDragLeave: (e: React.DragEvent) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver((o) => (o === cat ? null : o)); },
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        const id = e.dataTransfer.getData("text/plain") || dragging;
        setDragging(null); setOver(null);
        if (id) move(id, cat);
      },
    } : {}),
  });

  // Filters
  const locations = [...new Set(items.map((i) => i.storageLocation?.trim()).filter((v): v is string => !!v))]
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
  const hasUnplaced = items.some((i) => !i.storageLocation?.trim());
  const q = search.trim().toLowerCase();
  const filtering = !!(q || location || type);
  const displayed = shown.filter((i) =>
    (!q || [i.name, i.partNumber, i.storageLocation, i.stockTag, i.amountLeft].some((v) => (v ?? "").toLowerCase().includes(q))) &&
    (!location || (location === NO_LOCATION ? !i.storageLocation?.trim() : i.storageLocation?.trim() === location)) &&
    (!type || i.itemType === type));

  // Materials (same-name groups) in list order; full stock first, then partial pieces
  const groups = new Map<string, Item[]>();
  for (const i of displayed) groups.set(groupKey(i.name), [...(groups.get(groupKey(i.name)) ?? []), i]);
  for (const list of groups.values()) list.sort((a, b) => Number(isPartial(a)) - Number(isPartial(b)) || a.name.localeCompare(b.name));
  // Folders: a material sits in its full stock's category
  const folders = CATEGORY_OPTIONS.map((c) => ({
    ...c,
    groups: [...groups.values()].filter((list) => list[0].category === c.value).sort((a, b) => a[0].name.localeCompare(b[0].name)),
  }));
  // Empty folders show while dragging, as places to drop — at the end, so nothing shifts under the pointer
  const visible = [...folders.filter((f) => f.groups.length > 0), ...(dragging ? folders.filter((f) => f.groups.length === 0) : [])];
  const isOpen = (cat: string) => filtering || !closed.has(cat);

  // A piece opens its full-stock item's page, scrolled to it (that's where pieces are managed)
  const hrefOf = (item: Item) => {
    const parent = isPartial(item) ? groups.get(groupKey(item.name))?.find((x) => !isPartial(x) && !x.archived) : null;
    return parent ? `/inventory/${parent.id}#piece-${item.id}` : `/inventory/${item.id}`;
  };
  const detailOf = (item: Item, inGroup: boolean) =>
    [isPartial(item) && item.amountLeft && `${item.amountLeft} left`, item.partNumber && !inGroup && item.partNumber, item.stockTag].filter(Boolean).join(" · ") || "—";

  const folderHeader = (f: (typeof folders)[number], phone: boolean) => {
    const open = isOpen(f.value);
    const Icon = open && f.groups.length ? FolderOpen : Folder;
    return (
      <button type="button" onClick={() => toggleFolder(f.value)} disabled={filtering} aria-expanded={open}
        className={cn("flex w-full items-center gap-2 text-left", phone ? "px-4 py-3" : "px-4 py-2.5")}>
        <ChevronRight aria-hidden className={cn("h-4 w-4 shrink-0 text-(--color-text-secondary) transition-transform", open && f.groups.length && "rotate-90", filtering && "invisible")} />
        <Icon aria-hidden className={cn("h-4 w-4 shrink-0", f.value === "UNCATEGORIZED" ? "text-(--color-warning)" : "text-(--color-primary)")} />
        <span className="font-semibold text-(--color-text-primary)">{f.label}</span>
        <span className="text-small text-(--color-text-secondary)">{f.groups.length || (dragging ? "drop here" : 0)}</span>
      </button>
    );
  };

  const row = (item: Item, inGroup: boolean) => (
    <tr key={item.id} {...dragSource(item.id)}
      className={cn("frc-tr group transition-colors", item.archived && "opacity-60", dragging === item.id && "opacity-40", mouseDrag && "cursor-grab")}>
      <Td className="whitespace-normal">
        <div className={cn("flex items-center gap-3", inGroup && "pl-6")}>
          {mouseDrag && <GripVertical aria-hidden className="-ml-2 h-4 w-4 shrink-0 text-(--color-text-disabled) opacity-0 group-hover:opacity-100" />}
          <Thumb src={item.image} name={item.name} />
          <Link href={hrefOf(item)} draggable={false} className="min-w-0">
            <span className="block font-medium text-(--color-secondary) group-hover:text-(--color-primary) group-hover:underline transition-colors">
              {inGroup ? (isPartial(item) ? "Partial piece" : "Full stock") : item.name}
              {item.archived && <Badge variant="neutral" className="ml-2 text-xs">Retired</Badge>}
            </span>
            <span className="block text-small text-(--color-text-secondary)">{detailOf(item, inGroup)}</span>
          </Link>
        </div>
      </Td>
      <Td><span className="text-(--color-text-secondary)">{typeLabel(item.itemType)}</span></Td>
      <Td right><Badge variant={stockVariant(item)}>{stockText(item)}</Badge></Td>
      <Td right className="text-(--color-text-secondary)">{isPartial(item) ? "—" : item.minStockThreshold}</Td>
      <Td>{item.storageLocation ?? "—"}</Td>
      <Td right>{formatCurrency(item.unitCost)}</Td>
      <Td>
        {!item.archived && item.currentStock > 0 && (
          <AcquireButton itemId={item.id} itemName={item.name} robots={robots} maxQty={item.currentStock} />
        )}
      </Td>
    </tr>
  );

  const groupRows = (list: Item[]) => {
    if (list.length === 1) return row(list[0], false);
    const first = list[0];
    const full = list.filter((i) => !isPartial(i)).reduce((s, i) => s + i.currentStock, 0);
    const partials = list.filter(isPartial).reduce((s, i) => s + i.currentStock, 0);
    const unit = list.find((i) => !isPartial(i))?.unitOfMeasure.toLowerCase() ?? "";
    return (
      <Fragment key={groupKey(first.name)}>
        <tr {...dragSource(first.id)} className={cn("group bg-(--color-surface-overlay)", dragging === first.id && "opacity-40", mouseDrag && "cursor-grab")}>
          <Td className="whitespace-normal">
            <span className="flex items-center gap-3">
              {mouseDrag && <GripVertical aria-hidden className="-ml-2 h-4 w-4 shrink-0 text-(--color-text-disabled) opacity-0 group-hover:opacity-100" />}
              <Thumb src={list.find((i) => i.image)?.image ?? null} name={first.name} />
              <span className="min-w-0">
                <span className="block font-semibold text-(--color-text-primary)">{first.name}</span>
                <span className="block text-small text-(--color-text-secondary)">{list.length} entries{first.partNumber ? ` · ${first.partNumber}` : ""}</span>
              </span>
            </span>
          </Td>
          <Td><span className="text-(--color-text-secondary)">{typeLabel(first.itemType)}</span></Td>
          <Td right>
            <span className="text-sm font-medium text-(--color-text-primary) whitespace-nowrap">
              {[full > 0 || !partials ? `${full} ${unit}` : null, partials ? `${partials} partial` : null].filter(Boolean).join(" + ")}
            </span>
          </Td>
          <Td /><Td /><Td /><Td />
        </tr>
        {list.map((i) => row(i, true))}
      </Fragment>
    );
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search items, labels, locations…"
          className={cn(selectCls, "w-full sm:max-w-xs")}
        />
        <div className="grid w-full grid-cols-2 gap-3 sm:flex sm:w-auto">
          <select aria-label="Location" value={location} onChange={(e) => setLocation(e.target.value)} className={cn(selectCls, "min-w-0 sm:max-w-56")}>
            <option value="">All locations</option>
            {locations.map((l) => <option key={l} value={l}>{l}</option>)}
            {hasUnplaced && <option value={NO_LOCATION}>No location</option>}
          </select>
          <select aria-label="Item type" value={type} onChange={(e) => setType(e.target.value)} className={cn(selectCls, "min-w-0")}>
            <option value="">All types</option>
            {TYPE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{typeLabel(t.value)}</option>)}
          </select>
        </div>
        {filtering && (
          <button type="button" onClick={() => { setSearch(""); setLocation(""); setType(""); }}
            className="text-sm text-(--color-secondary) hover:underline">Clear filters</button>
        )}
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
      {canSort && displayed.length > 0 && (
        <p className="-mt-3 text-small text-(--color-text-secondary)">
          <span className="sm:hidden">To sort an item, touch and hold it, then drag it onto a folder.</span>
          <span className="hidden sm:inline">To sort an item, drag it onto a folder. Its partial pieces move with it.</span>
        </p>
      )}

      {displayed.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-body text-(--color-text-secondary)">
            {filtering ? "No items match these filters." : emptyMessage}
          </p>
        </div>
      ) : (
        // After a touch drag, the lifted finger isn't also a tap on the item
        <div ref={listRef} onClickCapture={(e) => { if (touch.justDragged.current) { e.preventDefault(); e.stopPropagation(); } }}>
        {/* Phones: a folder per category, a card per material */}
        <div className="space-y-3 sm:hidden">
          {visible.map((f) => (
            <section key={f.value} {...dropTarget(f.value)}
              className={cn("rounded-xl border transition-colors",
                over === f.value ? "border-(--color-primary) bg-(--color-primary)/10 ring-2 ring-(--color-primary)/40" : "border-(--color-border) bg-(--color-surface-raised)")}>
              {folderHeader(f, true)}
              {isOpen(f.value) && f.groups.length > 0 && (
                <ul className="space-y-3 px-3 pb-3">
                  {f.groups.map((list) => (
                    <li key={groupKey(list[0].name)} {...touchSource(list[0].id)}
                      className={cn("card p-0 overflow-hidden", canSort && "select-none [-webkit-touch-callout:none]", dragging === list[0].id && "opacity-40")}>
                      {list.length > 1 && (
                        <div className="flex items-center gap-3 border-b border-(--color-border) bg-(--color-surface-overlay) px-4 py-3">
                          <Thumb src={list.find((i) => i.image)?.image ?? null} name={list[0].name} />
                          <span className="min-w-0">
                            <span className="block break-words font-semibold text-(--color-text-primary)">{list[0].name}</span>
                            <span className="block text-small text-(--color-text-secondary)">{typeLabel(list[0].itemType)} · {list.length} entries</span>
                          </span>
                        </div>
                      )}
                      <ul className="divide-y divide-(--color-border)">
                        {list.map((item) => (
                          <li key={item.id} className={cn("flex items-center gap-3 px-4 py-3", item.archived && "opacity-60")}>
                            <Thumb src={item.image} name={item.name} />
                            <Link href={hrefOf(item)} draggable={false} className="min-w-0 flex-1">
                              <span className="block break-words font-medium text-(--color-secondary)">
                                {list.length > 1 ? (isPartial(item) ? "Partial piece" : "Full stock") : item.name}
                              </span>
                              <span className="block break-words text-small text-(--color-text-secondary)">
                                {[isPartial(item) && item.amountLeft && `${item.amountLeft} left`, item.storageLocation, item.stockTag].filter(Boolean).join(" · ")}
                              </span>
                              <span className="mt-1 block"><Badge variant={stockVariant(item)}>{stockText(item)}</Badge></span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        {/* Computers: one table, a section per folder */}
        <div className="hidden sm:block">
          <Table>
            <TableHead>
              <tr>
                <Th>Item</Th><Th>Type</Th>
                <Th right>Stock</Th><Th right>Min</Th><Th>Location</Th>
                <Th right>Unit cost</Th><Th>Action</Th>
              </tr>
            </TableHead>
            {visible.map((f) => (
              <tbody key={f.value} {...dropTarget(f.value)}
                className={cn("divide-y divide-(--color-table-border) border-t border-(--color-table-border) transition-colors",
                  over === f.value ? "bg-(--color-primary)/10" : "bg-(--color-surface)")}>
                <tr className={cn(over === f.value ? "bg-(--color-primary)/15" : "bg-(--color-surface-raised)")}>
                  <td colSpan={7} className={cn("p-0", over === f.value && "shadow-[inset_3px_0_0_var(--color-primary)]")}>{folderHeader(f, false)}</td>
                </tr>
                {isOpen(f.value) && f.groups.map(groupRows)}
              </tbody>
            ))}
          </Table>
        </div>
        </div>
      )}
    </>
  );
}
