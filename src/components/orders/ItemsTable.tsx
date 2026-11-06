"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency } from "@/lib/utils";
import { addTrackingAction, markArrivedAction, setItemStatusAction } from "@/app/actions/orders";
import { ITEM_STATUSES, ITEM_STATUS_INFO, itemRef, type ItemStatus } from "@/lib/orders/constants";
import { useViewOnly } from "@/components/access/ViewOnly";

export interface OrderItemRow {
  id:          string;
  orderNumber: number | null;
  requestId:   string;
  orderName:   string;
  name:        string;
  vendorName:  string | null;
  partNumber:  string | null;
  link:        string | null;
  unitCost:    number | null;
  quantity:    number;
  subTeam:     string | null;
  importance:  string;
  reasoning:   string | null;
  notes:       string | null;
  status:      ItemStatus;
  tracking:    { url: string; label: string | null } | null;
  exportedAt:  string | null;
}

interface Props {
  items:       OrderItemRow[];
  /** Buyer / captains: add tracking links (with Ordered) */
  canTrack:    boolean;
  /** Buyer / captains: set any status (everyone else can only mark items arrived) */
  canOverride: boolean;
  /** Can change statuses at all here (false on a denied or canceled order) */
  canChange?:  boolean;
  /** Show which order each item belongs to (Buyer page) */
  showOrder?:  boolean;
  /**
   * The page's own "Change status" button turns the mode on (?change=status) — the order page puts it
   * next to Edit order. Without it, the list shows its own button (Buyer page).
   */
  modeFromPage?: boolean;
  emptyText?:  string;
}

const IMPORTANCE_BADGE: Record<string, "neutral" | "warning" | "danger"> = {
  ROUTINE: "neutral", URGENT: "warning", EMERGENCY: "danger",
};

const inputCls =
  "rounded-md border border-(--color-border) bg-(--color-surface) text-(--color-text-primary) px-2.5 py-1.5 text-sm focus:border-(--color-primary) focus:outline-none";

/** The page-header button that turns on Change status mode for the order's items */
export function ChangeStatusButton() {
  const params = useSearchParams();
  const pathname = usePathname();
  const on = params.get("change") === "status";
  return (
    <Link href={on ? pathname : `${pathname}?change=status`} scroll={false} replace>
      <Button variant={on ? "secondary" : "outline"} size="sm" aria-pressed={on}>Change status</Button>
    </Link>
  );
}

export function ItemsTable({ items, canTrack, canOverride, canChange = true, showOrder, modeFromPage, emptyText = "No items." }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const viewOnly = useViewOnly();
  const [localMode, setLocalMode] = useState(false);
  const changing = canChange && !viewOnly && (modeFromPage ? params.get("change") === "status" : localMode);

  // What this person can set: Buyers and captains anything; everyone else marks items arrived
  const options: ItemStatus[] = canOverride ? [...ITEM_STATUSES] : canTrack ? ["ORDERED", "ARRIVED"] : ["ARRIVED"];
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [status, setStatus]     = useState<ItemStatus>(options.includes("ORDERED") ? "ORDERED" : "ARRIVED");
  const [url, setUrl]           = useState("");
  const [label, setLabel]       = useState("");
  const [msg, setMsg]           = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start]        = useTransition();

  const allSelected = items.length > 0 && selected.size === items.length;
  const n = selected.size;
  // Ordered without the right to override: it's set by adding the tracking link
  const needsLink = status === "ORDERED" && !canOverride;

  function toggle(id: string) {
    setSelected((s) => { const next = new Set(s); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }

  function exit() {
    setSelected(new Set());
    setUrl(""); setLabel("");
    if (modeFromPage) router.replace(pathname, { scroll: false }); else setLocalMode(false);
  }

  function apply() {
    const ids = [...selected];
    if (status === "ARRIVED" && !confirm(`Mark ${n} item${n === 1 ? "" : "s"} arrived? They'll be added to inventory, and arrived items can't be changed back.`)) return;
    setMsg(null);
    start(async () => {
      const link = url.trim();
      const res = status === "ORDERED" && link && canTrack ? await addTrackingAction(ids, link, label)
        : status === "ARRIVED" && !canOverride ? await markArrivedAction(ids)
        : await setItemStatusAction(ids, status);
      if (!res.success) { setMsg({ ok: false, text: res.error ?? "Something went wrong." }); return; }
      const count = "count" in res ? res.count : ids.length;
      setMsg({ ok: true, text: `${ITEM_STATUS_INFO[status].label}${link && status === "ORDERED" ? " (with tracking)" : ""} — ${count} item${count === 1 ? "" : "s"}.` });
      exit();
      router.refresh();
    });
  }

  if (items.length === 0) {
    return <div className="card text-center py-8 text-body text-(--color-text-secondary)">{emptyText}</div>;
  }

  return (
    <div className="space-y-3">
      {/* The Buyer page has no header button: the list carries its own */}
      {!modeFromPage && canChange && !viewOnly && !changing && (
        <div className="flex justify-end">
          <Button size="sm" variant="outline" onClick={() => { setMsg(null); setLocalMode(true); }}>Change status</Button>
        </div>
      )}

      {changing && (
        <div className="card space-y-3 border-(--color-primary)/40">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-wrap items-end gap-2">
              <label className="space-y-1">
                <span className="block text-sm font-medium text-(--color-text-primary)">New status</span>
                <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value as ItemStatus)}>
                  {options.map((s) => <option key={s} value={s}>{ITEM_STATUS_INFO[s].label}</option>)}
                </select>
              </label>
              <Button size="sm" isLoading={pending} disabled={n === 0 || (needsLink && !url.trim())} onClick={apply}>Apply status</Button>
            </div>
            <Button size="sm" variant="ghost" disabled={pending} onClick={exit}>Cancel</Button>
          </div>

          {/* Ordered: the package's tracking link can go with it */}
          {status === "ORDERED" && canTrack && (
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex-1 min-w-48 space-y-1">
                <span className="block text-sm font-medium text-(--color-text-primary)">
                  Tracking link {!needsLink && <span className="font-normal text-(--color-text-secondary)">(optional)</span>}
                </span>
                <input className={cn(inputCls, "w-full")} type="url" placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
              </label>
              <label className="w-40 space-y-1">
                <span className="block text-sm font-medium text-(--color-text-primary)">Label</span>
                <input className={cn(inputCls, "w-full")} placeholder="e.g. REV box 1" value={label} onChange={(e) => setLabel(e.target.value)} />
              </label>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-(--color-border) pt-3">
            <label className="flex items-center gap-2 text-sm text-(--color-text-primary) cursor-pointer">
              <input type="checkbox" className="accent-(--color-primary)" checked={allSelected}
                onChange={() => setSelected(allSelected ? new Set() : new Set(items.map((i) => i.id)))} />
              Select all
            </label>
            <p className="text-small text-(--color-text-secondary)">
              {n === 0 ? "Tick the items to change below." : <>Your change will apply to <b className="text-(--color-text-primary)">{n} item{n === 1 ? "" : "s"}</b>.</>}
              {status === "ARRIVED" && " Arrived items are added to inventory and can't be changed back."}
            </p>
          </div>
        </div>
      )}

      {msg && <p className={`text-sm ${msg.ok ? "text-(--color-success)" : "text-(--color-danger)"}`}>{msg.text}</p>}

      <ul className="card p-0 divide-y divide-(--color-border) overflow-hidden">
        {items.map((i) => {
          const info = ITEM_STATUS_INFO[i.status];
          const total = (i.unitCost ?? 0) * i.quantity;
          const Row = changing ? "label" : "div";
          return (
            <li key={i.id} className={cn(changing && selected.has(i.id) && "bg-(--color-primary)/5")}>
              <Row className={cn("flex gap-3 px-3 py-3 sm:px-4", changing && "cursor-pointer")}>
                {changing && <input
                  type="checkbox"
                  aria-label={`Select item ${itemRef(i)}`}
                  className="mt-1 accent-(--color-primary)"
                  checked={selected.has(i.id)}
                  onChange={() => toggle(i.id)}
                />}
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <p className="min-w-0 text-sm text-(--color-text-primary)">
                      <span className="font-mono text-xs font-semibold text-(--color-text-secondary) mr-2">{itemRef(i)}</span>
                      {i.link && !changing ? (
                        <a href={i.link} target="_blank" rel="noopener noreferrer" className="font-medium text-(--color-secondary) hover:underline">
                          {i.name} ↗
                        </a>
                      ) : <span className="font-medium">{i.name}</span>}
                    </p>
                    <p className="text-sm text-(--color-text-primary) whitespace-nowrap">
                      {i.unitCost != null ? `${formatCurrency(i.unitCost)} × ${i.quantity} = ` : `× ${i.quantity} `}
                      <b>{i.unitCost != null ? formatCurrency(total) : ""}</b>
                    </p>
                  </div>
                  <p className="text-small text-(--color-text-secondary)">
                    {[i.vendorName, i.partNumber && `#${i.partNumber}`, i.subTeam?.replace(/_/g, " ").toLowerCase()].filter(Boolean).join(" · ") || "No vendor"}
                    {showOrder && !changing && (
                      <> · <Link href={`/procurement/requests/${i.requestId}`} className="text-(--color-secondary) hover:underline">{i.orderName}</Link></>
                    )}
                    {showOrder && changing && <> · {i.orderName}</>}
                  </p>
                  {(i.reasoning || i.notes) && (
                    <p className="text-small text-(--color-text-secondary)">
                      {i.reasoning && <>Why: {i.reasoning}</>}
                      {i.reasoning && i.notes && " · "}
                      {i.notes && <>Notes: {i.notes}</>}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-2 pt-0.5">
                    <Badge variant={info.badge}>{info.label}</Badge>
                    {i.importance !== "ROUTINE" && <Badge variant={IMPORTANCE_BADGE[i.importance] ?? "neutral"}>{i.importance.toLowerCase()}</Badge>}
                    {i.tracking && !changing && (
                      <a href={i.tracking.url} target="_blank" rel="noopener noreferrer" className="text-small text-(--color-secondary) hover:underline">
                        Track{i.tracking.label ? `: ${i.tracking.label}` : " package"} ↗
                      </a>
                    )}
                    {i.status === "TO_ORDER" && i.exportedAt && <span className="text-xs text-(--color-text-secondary)">in spreadsheet</span>}
                  </div>
                </div>
              </Row>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
