"use client";

import { Fragment, useOptimistic, useRef, useState, useSyncExternalStore, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Folder, FolderOpen, GripVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableHead, Th, Td } from "@/components/ui/table";
import { toast } from "@/components/ui/toast";
import { ZoomablePhoto } from "@/components/ui/PhotoViewer";
import { cn, formatCurrency } from "@/lib/utils";
import { groupKey, isPartial, stockText } from "@/lib/inventory/units";
import { CATEGORY_OPTIONS, CLOSED_FOLDERS_COOKIE, TYPE_OPTIONS, categoryLabel, typeLabel } from "@/lib/inventory/categories";
import { moveToCategoryAction } from "@/app/actions/inventory";
import { useFinePointer, useTouchDrag } from "../tasks/useTouchDrag";
import { AcquireButton } from "./AcquireButton";
import type { SubcategoryOption } from "./CategoryFields";

interface Item {
  id: string;
  name: string;
  partNumber: string | null;
  category: string;
  subcategoryId: string | null;
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
  items:         Item[];
  robots:        { id: string; displayName: string }[];
  /** The team's sub-categories (sub-folders) */
  subcategories: SubcategoryOption[];
  emptyMessage:  string;
  /** May sort items into folders (drag them between folders) */
  canSort:       boolean;
  /** "Show retired items" link, when there are any */
  retiredToggle?: { showing: boolean; count: number; href: string };
  /** Folders this person closed (from their cookie) */
  initialClosed: string[];
}

/** The location filter's choice for entries with no location */
const NO_LOCATION = "\u0000none";

/** A drop target / folder key: the category, or category|sub-category id for a sub-folder */
const folderKey = (category: string, subId?: string | null) => (subId ? `${category}|${subId}` : category);
const parseKey = (key: string) => { const [category, subId] = key.split("|"); return { category, subId: subId ?? null }; };

/** Remember the closed folders (read by the page on the next visit) */
function writeClosedCookie(closed: Set<string>) {
  document.cookie = `${CLOSED_FOLDERS_COOKIE}=${encodeURIComponent(JSON.stringify([...closed]))}; path=/inventory; max-age=31536000; samesite=lax`;
}

function stockVariant(item: Item): "danger" | "warning" | "success" | "info" {
  if (isPartial(item)) return item.currentStock > 0 ? "info" : "danger";
  if (item.currentStock === 0) return "danger";
  if (item.minStockThreshold > 0 && item.currentStock <= item.minStockThreshold) return "warning";
  return "success";
}

/** A small photo of the material — tap it to see it full screen (a placeholder square when there's none) */
function Thumb({ src, name }: { src: string | null; name: string }) {
  return src
    ? <ZoomablePhoto src={src} alt={name} thumb className="h-10 w-10 shrink-0 rounded-md border border-(--color-border)" imgClassName="h-full w-full object-cover" />
    : <span aria-hidden className="h-10 w-10 shrink-0 rounded-md border border-dashed border-(--color-border)" />;
}

/** What a material has on hand in total: "10 foot + 2 partial" */
function groupStock(list: Item[]) {
  const full = list.filter((i) => !isPartial(i)).reduce((s, i) => s + i.currentStock, 0);
  const partials = list.filter(isPartial).reduce((s, i) => s + i.currentStock, 0);
  const unit = list.find((i) => !isPartial(i))?.unitOfMeasure.toLowerCase() ?? "";
  return [full > 0 || !partials ? `${full} ${unit}` : null, partials ? `${partials} partial` : null].filter(Boolean).join(" + ");
}

/**
 * A phone card's tappable area: opens `href` like a link, but isn't one. Holding a real link makes
 * iPhones start their own long-press (link preview, dragging the link) and pause the page until the
 * finger moves — so touch-and-hold to sort took seconds to pick a card up. (Task cards work the same way.)
 */
function CardLink({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) {
  const router = useRouter();
  return (
    <div role="link" tabIndex={0} className={cn("cursor-pointer", className)}
      onClick={() => router.push(href)}
      onKeyDown={(e) => { if (e.key === "Enter") router.push(href); }}
      onTouchStart={() => router.prefetch(href)}>
      {children}
    </div>
  );
}

const selectCls = "rounded-md border border-(--color-border) bg-(--color-surface) text-(--color-text-primary) px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-(--color-primary)/40 focus:border-(--color-primary)";

type Group = Item[];
interface SubFolder { id: string; name: string; key: string; groups: Group[] }
interface FolderNode { value: string; label: string; subs: SubFolder[]; emptySubs: SubFolder[]; loose: Group[]; count: number }

/**
 * Inventory in folders by category, and sub-folders by sub-category (an item doesn't need one). Inside,
 * entries with the same name — the full stock and its partial pieces — are one material: a row you can
 * open to see its entries. Editors sort items by dragging them to another folder or sub-folder (on
 * phones: touch and hold, then drag); the whole material moves together.
 */
export function InventoryTableClient({ items, robots, subcategories, emptyMessage, canSort, retiredToggle, initialClosed }: Props) {
  const [search, setSearch] = useState("");
  const [location, setLocation] = useState("");
  const [type, setType] = useState("");
  const [closed, setClosed] = useState<Set<string>>(() => new Set(initialClosed));
  /** Materials opened to show their entries (closed by default) */
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [dragging, setDragging] = useState<string | null>(null);
  // Phones get the cards, computers the table — only the one on screen is drawn (both until it's known)
  const wide = useSyncExternalStore(
    (onChange) => { const mq = window.matchMedia("(min-width: 640px)"); mq.addEventListener("change", onChange); return () => mq.removeEventListener("change", onChange); },
    () => window.matchMedia("(min-width: 640px)").matches,
    () => null,
  );
  const [, startMove] = useTransition();

  // Moved items show in their new folder straight away
  const [shown, moveShown] = useOptimistic(items, (state, m: { key: string; category: string; subId: string | null }) =>
    state.map((i) => (groupKey(i.name) === m.key ? { ...i, category: m.category, subcategoryId: m.subId } : i)));

  // Closed folders are remembered in a cookie, so the page arrives with them closed
  function saveClosed(next: Set<string>) {
    writeClosedCookie(next);
    return next;
  }
  function toggleFolder(key: string) {
    const next = new Set(closed);
    if (!next.delete(key)) next.add(key);
    setClosed(saveClosed(next));
  }
  /** Close every folder and sub-folder, or open them all */
  function setAllFolders(close: boolean) {
    setClosed(saveClosed(new Set(close ? [...CATEGORY_OPTIONS.map((c) => c.value), ...subcategories.map((s) => folderKey(s.category, s.id))] : [])));
  }
  function toggleGroup(key: string) {
    setOpenGroups((prev) => { const next = new Set(prev); if (!next.delete(key)) next.add(key); return next; });
  }

  /** Move the material `itemId` belongs to into a folder or sub-folder (mouse and touch dragging both end here) */
  function move(itemId: string, target: string) {
    const item = shown.find((i) => i.id === itemId);
    const { category, subId } = parseKey(target);
    if (!canSort || !item || (item.category === category && (item.subcategoryId ?? null) === subId)) return;
    const where = subId ? `${categoryLabel(category)} › ${subcategories.find((s) => s.id === subId)?.name ?? ""}` : categoryLabel(category);
    startMove(async () => {
      moveShown({ key: groupKey(item.name), category, subId });
      const res = await moveToCategoryAction(itemId, category, subId);
      if (res.success) toast.success(`Moved ${item.name} to ${where}`);
      else toast.error(res.error ?? "Couldn't move it.");
    });
  }

  // Phones and tablets: touch and hold an item, then drag it to a folder
  const listRef = useRef<HTMLDivElement>(null);
  /** Mark the folder under the pointer (data-over — styled below) */
  const overRef = useRef<string | null>(null);
  function setOver(key: string | null) {
    if (overRef.current === key) return;
    overRef.current = key;
    const root = listRef.current;
    if (!root) return;
    root.querySelectorAll("[data-over]").forEach((el) => el.removeAttribute("data-over"));
    if (key) root.querySelectorAll(`[data-inv-folder="${CSS.escape(key)}"]`).forEach((el) => el.setAttribute("data-over", ""));
  }
  const touch = useTouchDrag({
    onStart:  (id) => setDragging(id),
    onOver:   (key) => setOver(key),
    onDrop:   (id, key) => { setDragging(null); setOver(null); if (key) move(id, key); },
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
  // (A sub-folder sits inside its folder on phones: the innermost target takes the drop)
  const dropTarget = (key: string) => ({
    "data-inv-folder": key,
    ...(mouseDrag ? {
      onDragOver: (e: React.DragEvent) => { if (!dragging) return; e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = "move"; setOver(key); },
      onDragLeave: (e: React.DragEvent) => { if (!e.currentTarget.contains(e.relatedTarget as Node) && overRef.current === key) setOver(null); },
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const id = e.dataTransfer.getData("text/plain") || dragging;
        setDragging(null); setOver(null);
        if (id) move(id, key);
      },
    } : {}),
  });

  // Filters
  const locations = [...new Set(items.map((i) => i.storageLocation?.trim()).filter((v): v is string => !!v))]
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
  const hasUnplaced = items.some((i) => !i.storageLocation?.trim());
  const q = search.trim().toLowerCase();
  const filtering = !!(q || location || type);
  const subName = new Map(subcategories.map((s) => [s.id, s.name]));
  const displayed = shown.filter((i) =>
    (!q || [i.name, i.partNumber, i.storageLocation, i.stockTag, i.amountLeft, i.subcategoryId && subName.get(i.subcategoryId)].some((v) => (v || "").toLowerCase().includes(q))) &&
    (!location || (location === NO_LOCATION ? !i.storageLocation?.trim() : i.storageLocation?.trim() === location)) &&
    (!type || i.itemType === type));

  // Materials (same-name groups); full stock first, then partial pieces. A material sits where its first entry is filed.
  const groupMap = new Map<string, Item[]>();
  for (const i of displayed) groupMap.set(groupKey(i.name), [...(groupMap.get(groupKey(i.name)) ?? []), i]);
  for (const list of groupMap.values()) list.sort((a, b) => Number(isPartial(a)) - Number(isPartial(b)) || a.name.localeCompare(b.name));
  const byName = (a: Group, b: Group) => a[0].name.localeCompare(b[0].name);
  const all = [...groupMap.values()];

  const folders: FolderNode[] = CATEGORY_OPTIONS.map((c) => {
    const inCat = all.filter((list) => list[0].category === c.value);
    const known = subcategories.filter((s) => s.category === c.value);
    const subs = known.map((s) => ({ id: s.id, name: s.name, key: folderKey(c.value, s.id), groups: inCat.filter((l) => l[0].subcategoryId === s.id).sort(byName) }));
    const loose = inCat.filter((l) => !known.some((s) => s.id === l[0].subcategoryId)).sort(byName);
    // Empty sub-folders show while dragging, as places to drop — after the others, so nothing shifts
    return { value: c.value, label: c.label, subs: subs.filter((s) => s.groups.length > 0), emptySubs: dragging ? subs.filter((s) => s.groups.length === 0) : [], loose, count: inCat.length };
  });
  // Empty folders show while dragging too, at the end
  const visible = [...folders.filter((f) => f.count > 0), ...(dragging ? folders.filter((f) => f.count === 0) : [])];
  const isOpen = (key: string) => filtering || !closed.has(key);
  const isGroupOpen = (list: Group) => filtering || openGroups.has(groupKey(list[0].name));

  // A piece opens its full-stock item's page, scrolled to it (that's where pieces are managed)
  const parentOf = (list: Group) => list.find((x) => !isPartial(x) && !x.archived) ?? list.find((x) => !isPartial(x)) ?? null;
  const hrefOf = (item: Item) => {
    const parent = isPartial(item) ? groupMap.get(groupKey(item.name))?.find((x) => !isPartial(x) && !x.archived) : null;
    return parent ? `/inventory/${parent.id}#piece-${item.id}` : `/inventory/${item.id}`;
  };
  const groupHref = (list: Group) => `/inventory/${(parentOf(list) ?? list[0]).id}`;
  const detailOf = (item: Item, inGroup: boolean) =>
    [isPartial(item) && item.amountLeft && `${item.amountLeft} left`, item.partNumber && !inGroup && item.partNumber, item.stockTag].filter(Boolean).join(" · ") || "—";

  const folderHeader = (key: string, label: string, count: number, opts: { phone: boolean; sub?: boolean; warn?: boolean }) => {
    const open = isOpen(key);
    const Icon = open && count ? FolderOpen : Folder;
    return (
      <button type="button" onClick={() => toggleFolder(key)} disabled={filtering} aria-expanded={open}
        className={cn("flex w-full items-center gap-2 text-left", opts.phone ? "px-4 py-3" : "py-2.5", !opts.phone && (opts.sub ? "pl-10 pr-4" : "px-4"))}>
        <ChevronRight aria-hidden className={cn("h-4 w-4 shrink-0 text-(--color-text-secondary) transition-transform", open && count && "rotate-90", filtering && "invisible")} />
        <Icon aria-hidden className={cn("shrink-0", opts.sub ? "h-3.5 w-3.5" : "h-4 w-4", opts.warn ? "text-(--color-warning)" : opts.sub ? "text-(--color-secondary)" : "text-(--color-primary)")} />
        <span className={cn("text-(--color-text-primary)", opts.sub ? "font-medium" : "font-semibold")}>{label}</span>
        <span className="text-small text-(--color-text-secondary)">{count || (dragging ? "drop here" : 0)}</span>
      </button>
    );
  };

  /** The open / close toggle of a material with several entries */
  const groupToggle = (list: Group) => {
    const open = isGroupOpen(list);
    return (
      <button type="button" onClick={() => toggleGroup(groupKey(list[0].name))} disabled={filtering} aria-expanded={open}
        aria-label={open ? `Hide the entries of ${list[0].name}` : `Show the ${list.length} entries of ${list[0].name}`}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-(--color-text-secondary) hover:bg-(--color-surface-overlay) hover:text-(--color-text-primary) disabled:opacity-40">
        <ChevronRight aria-hidden className={cn("h-4 w-4 transition-transform", open && "rotate-90")} />
      </button>
    );
  };

  // ── Computers ──
  const row = (item: Item, inGroup: boolean, indent: boolean) => (
    <tr key={item.id} {...dragSource(item.id)}
      className={cn("frc-tr group transition-colors", item.archived && "opacity-60", dragging === item.id && "opacity-40", mouseDrag && "cursor-grab")}>
      <Td className="whitespace-normal">
        <div className={cn("flex items-center gap-3", indent && "pl-6", inGroup && "pl-14")}>
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

  const groupRows = (list: Group, indent: boolean) => {
    if (list.length === 1) return row(list[0], false, indent);
    const first = list[0];
    const locs = [...new Set(list.map((i) => i.storageLocation).filter(Boolean))];
    return (
      <Fragment key={groupKey(first.name)}>
        <tr {...dragSource(first.id)} className={cn("frc-tr group transition-colors", dragging === first.id && "opacity-40", mouseDrag && "cursor-grab")}>
          <Td className="whitespace-normal">
            <span className={cn("flex items-center gap-3", indent && "pl-6")}>
              {mouseDrag && <GripVertical aria-hidden className="-ml-2 h-4 w-4 shrink-0 text-(--color-text-disabled) opacity-0 group-hover:opacity-100" />}
              <Thumb src={list.find((i) => i.image)?.image ?? null} name={first.name} />
              <Link href={groupHref(list)} draggable={false} className="min-w-0">
                <span className="block font-medium text-(--color-secondary) group-hover:text-(--color-primary) group-hover:underline transition-colors">{first.name}</span>
                <span className="block text-small text-(--color-text-secondary)">{list.length} entries{first.partNumber ? ` · ${first.partNumber}` : ""}</span>
              </Link>
              {groupToggle(list)}
            </span>
          </Td>
          <Td><span className="text-(--color-text-secondary)">{typeLabel(first.itemType)}</span></Td>
          <Td right><span className="text-sm font-medium text-(--color-text-primary) whitespace-nowrap">{groupStock(list)}</span></Td>
          <Td />
          <Td className="whitespace-normal">{locs.length ? locs.join(", ") : "—"}</Td>
          <Td /><Td />
        </tr>
        {isGroupOpen(list) && list.map((i) => row(i, true, indent))}
      </Fragment>
    );
  };

  // ── Phones ──
  const groupCard = (list: Group) => {
    const first = list[0];
    const many = list.length > 1;
    return (
      <li key={groupKey(first.name)} {...touchSource(first.id)}
        className={cn("card p-0 overflow-hidden", canSort && "select-none [-webkit-touch-callout:none] [&_*]:[-webkit-user-drag:none]", dragging === first.id && "opacity-40")}>
        {many ? (
          <>
            <div className="flex items-center gap-3 px-4 py-3">
              <Thumb src={list.find((i) => i.image)?.image ?? null} name={first.name} />
              <CardLink href={groupHref(list)} className="min-w-0 flex-1">
                <span className="block break-words font-medium text-(--color-secondary)">{first.name}</span>
                <span className="block text-small text-(--color-text-secondary)">{groupStock(list)} · {list.length} entries</span>
              </CardLink>
              {groupToggle(list)}
            </div>
            {isGroupOpen(list) && (
              <ul className="divide-y divide-(--color-border) border-t border-(--color-border) bg-(--color-surface-overlay)">
                {list.map((item) => entry(item, true))}
              </ul>
            )}
          </>
        ) : (
          <ul>{entry(first, false)}</ul>
        )}
      </li>
    );
  };
  const entry = (item: Item, inGroup: boolean) => (
    <li key={item.id} className={cn("flex items-center gap-3 px-4 py-3", item.archived && "opacity-60")}>
      <Thumb src={item.image} name={item.name} />
      <CardLink href={hrefOf(item)} className="min-w-0 flex-1">
        <span className="block break-words font-medium text-(--color-secondary)">
          {inGroup ? (isPartial(item) ? "Partial piece" : "Full stock") : item.name}
        </span>
        <span className="block break-words text-small text-(--color-text-secondary)">
          {[isPartial(item) && item.amountLeft && `${item.amountLeft} left`, item.storageLocation, item.stockTag].filter(Boolean).join(" · ")}
        </span>
        <span className="mt-1 block"><Badge variant={stockVariant(item)}>{stockText(item)}</Badge></span>
      </CardLink>
    </li>
  );
  const highlight = "data-[over]:border-(--color-primary) data-[over]:bg-(--color-primary)/10 data-[over]:ring-2 data-[over]:ring-(--color-primary)/40";
  const subFolderCard = (s: SubFolder) => (
    <section key={s.key} {...dropTarget(s.key)}
      className={cn("rounded-lg border border-(--color-border) bg-(--color-surface)/40 transition-colors", highlight)}>
      {folderHeader(s.key, s.name, s.groups.length, { phone: true, sub: true })}
      {isOpen(s.key) && s.groups.length > 0 && (
        <ul className="space-y-3 px-2 pb-2">{s.groups.map(groupCard)}</ul>
      )}
    </section>
  );

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
      {displayed.length > 0 && (
        <div className="-mt-3 flex items-start justify-between gap-3">
          <p className="text-small text-(--color-text-secondary)">
            {canSort && <>
              <span className="sm:hidden">To sort an item, touch and hold it, then drag it onto a folder.</span>
              <span className="hidden sm:inline">To sort an item, drag it onto a folder. Its partial pieces move with it.</span>
            </>}
          </p>
          {/* While filtering, every folder with a match is open */}
          {!filtering && (() => {
            const anyOpen = visible.some((f) => f.count > 0 && isOpen(f.value));
            const Icon = anyOpen ? Folder : FolderOpen;
            return (
              <button type="button" onClick={() => setAllFolders(anyOpen)}
                className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-sm font-medium text-(--color-secondary) hover:underline">
                <Icon aria-hidden className="h-4 w-4" />{anyOpen ? "Close all folders" : "Open all folders"}
              </button>
            );
          })()}
        </div>
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
        {/* Phones: a folder per category, sub-folders inside, a card per material */}
        {wide !== true && <div className="space-y-3 sm:hidden">
          {visible.map((f) => (
            <section key={f.value} {...dropTarget(f.value)}
              className={cn("rounded-xl border border-(--color-border) bg-(--color-surface-raised) transition-colors", highlight)}>
              {folderHeader(f.value, f.label, f.count, { phone: true, warn: f.value === "UNCATEGORIZED" })}
              {isOpen(f.value) && (f.subs.length > 0 || f.loose.length > 0 || f.emptySubs.length > 0) && (
                <div className="space-y-3 px-3 pb-3">
                  {f.subs.map(subFolderCard)}
                  {f.loose.length > 0 && <ul className="space-y-3">{f.loose.map(groupCard)}</ul>}
                  {f.emptySubs.map(subFolderCard)}
                </div>
              )}
            </section>
          ))}
        </div>}

        {/* Computers: one table — a section per folder and sub-folder */}
        {wide !== false && <div className="hidden sm:block">
          <Table>
            <TableHead>
              <tr>
                <Th>Item</Th><Th>Type</Th>
                <Th right>Stock</Th><Th right>Min</Th><Th>Location</Th>
                <Th right>Unit cost</Th><Th>Action</Th>
              </tr>
            </TableHead>
            {visible.map((f) => {
              const open = isOpen(f.value);
              const body = "group/f divide-y divide-(--color-table-border) border-t border-(--color-table-border) bg-(--color-surface) transition-colors data-[over]:bg-(--color-primary)/10";
              const header = (cls: string) => cn(cls, "group-data-[over]/f:bg-(--color-primary)/15");
              const bar = "p-0 group-data-[over]/f:shadow-[inset_3px_0_0_var(--color-primary)]";
              const subBody = (s: SubFolder) => (
                <tbody key={s.key} {...dropTarget(s.key)} className={body}>
                  <tr className={header("bg-(--color-surface-overlay)")}>
                    <td colSpan={7} className={bar}>{folderHeader(s.key, s.name, s.groups.length, { phone: false, sub: true })}</td>
                  </tr>
                  {isOpen(s.key) && s.groups.map((l) => groupRows(l, true))}
                </tbody>
              );
              return (
                <Fragment key={f.value}>
                  <tbody {...dropTarget(f.value)} className={body}>
                    <tr className={header("bg-(--color-surface-raised)")}>
                      <td colSpan={7} className={bar}>
                        {folderHeader(f.value, f.label, f.count, { phone: false, warn: f.value === "UNCATEGORIZED" })}
                      </td>
                    </tr>
                  </tbody>
                  {open && f.subs.map(subBody)}
                  {open && f.loose.length > 0 && (
                    <tbody {...dropTarget(f.value)} className={body}>
                      {f.loose.map((l) => groupRows(l, false))}
                    </tbody>
                  )}
                  {open && f.emptySubs.map(subBody)}
                </Fragment>
              );
            })}
          </Table>
        </div>}
        </div>
      )}
    </>
  );
}
