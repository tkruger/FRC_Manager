"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency } from "@/lib/utils";
import { addTrackingAction, markArrivedAction, setItemStatusAction } from "@/app/actions/orders";
import { ITEM_STATUSES, ITEM_STATUS_INFO, formatItemId, type ItemStatus } from "@/lib/orders/constants";

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
  /** Team Admin / captains: add tracking links */
  canTrack:    boolean;
  /** Team Admin / captains: set any status */
  canOverride: boolean;
  /** Show which order each item belongs to (Team Admin page) */
  showOrder?:  boolean;
  emptyText?:  string;
}

const IMPORTANCE_BADGE: Record<string, "neutral" | "warning" | "danger"> = {
  ROUTINE: "neutral", URGENT: "warning", EMERGENCY: "danger",
};

const inputCls =
  "rounded-md border border-(--color-border) bg-(--color-surface) text-(--color-text-primary) px-2.5 py-1.5 text-sm focus:border-(--color-primary) focus:outline-none";

export function ItemsTable({ items, canTrack, canOverride, showOrder, emptyText = "No items." }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [panel, setPanel]       = useState<null | "tracking" | "status">(null);
  const [url, setUrl]           = useState("");
  const [label, setLabel]       = useState("");
  const [status, setStatus]     = useState<ItemStatus>("ORDERED");
  const [msg, setMsg]           = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start]        = useTransition();

  const chosen = items.filter((i) => selected.has(i.id));
  const canArriveChosen = chosen.some((i) => i.status === "TO_ORDER" || i.status === "ORDERED");
  const allSelected = items.length > 0 && selected.size === items.length;

  function toggle(id: string) {
    setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  function run(fn: () => Promise<{ success: boolean; error?: string; count?: number }>, done: string) {
    setMsg(null);
    start(async () => {
      const res = await fn();
      if (!res.success) { setMsg({ ok: false, text: res.error ?? "Something went wrong." }); return; }
      setMsg({ ok: true, text: `${done} — ${res.count} item${res.count === 1 ? "" : "s"}.` });
      setSelected(new Set());
      setPanel(null);
      setUrl(""); setLabel("");
      router.refresh();
    });
  }

  if (items.length === 0) {
    return <div className="card text-center py-8 text-body text-(--color-text-secondary)">{emptyText}</div>;
  }

  return (
    <div className="space-y-3">
      {/* Selection / bulk actions */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm text-(--color-text-secondary) cursor-pointer">
          <input
            type="checkbox"
            className="accent-(--color-primary)"
            checked={allSelected}
            onChange={() => setSelected(allSelected ? new Set() : new Set(items.map((i) => i.id)))}
          />
          {selected.size ? `${selected.size} selected` : "Select all"}
        </label>
        {selected.size > 0 && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={!canArriveChosen || pending}
              title={canArriveChosen ? undefined : "Only approved items (To order / Ordered) can arrive"}
              onClick={() => {
                if (confirm(`Mark ${chosen.length} item${chosen.length === 1 ? "" : "s"} arrived? They'll be added to inventory.`)) {
                  run(() => markArrivedAction([...selected]), "Marked arrived and added to inventory");
                }
              }}>
              Mark arrived
            </Button>
            {canTrack && <Button size="sm" variant="secondary" onClick={() => setPanel(panel === "tracking" ? null : "tracking")}>Add tracking link</Button>}
            {canOverride && <Button size="sm" variant="outline" onClick={() => setPanel(panel === "status" ? null : "status")}>Set status</Button>}
          </div>
        )}
      </div>

      {panel === "tracking" && selected.size > 0 && (
        <form
          className="card flex flex-wrap items-end gap-2"
          onSubmit={(e) => { e.preventDefault(); run(() => addTrackingAction([...selected], url, label), "Tracking added, items marked Ordered"); }}
        >
          <label className="flex-1 min-w-48 space-y-1">
            <span className="block text-sm font-medium text-(--color-text-primary)">Tracking link</span>
            <input className={cn(inputCls, "w-full")} type="url" required placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
          </label>
          <label className="w-40 space-y-1">
            <span className="block text-sm font-medium text-(--color-text-primary)">Label</span>
            <input className={cn(inputCls, "w-full")} placeholder="e.g. REV box 1" value={label} onChange={(e) => setLabel(e.target.value)} />
          </label>
          <Button type="submit" size="sm" isLoading={pending}>Save for {selected.size} item{selected.size === 1 ? "" : "s"}</Button>
        </form>
      )}

      {panel === "status" && selected.size > 0 && (
        <div className="card flex flex-wrap items-end gap-2">
          <label className="space-y-1">
            <span className="block text-sm font-medium text-(--color-text-primary)">New status</span>
            <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value as ItemStatus)}>
              {ITEM_STATUSES.map((s) => <option key={s} value={s}>{ITEM_STATUS_INFO[s].label}</option>)}
            </select>
          </label>
          <Button size="sm" isLoading={pending} onClick={() => {
            if (status === "ARRIVED" && !confirm("Arrived items are added to inventory. Continue?")) return;
            run(() => setItemStatusAction([...selected], status), `Status set to ${ITEM_STATUS_INFO[status].label}`);
          }}>
            Apply to {selected.size} item{selected.size === 1 ? "" : "s"}
          </Button>
          <p className="text-small text-(--color-text-secondary) w-full">Arrived items can&apos;t be changed back — their stock has been added.</p>
        </div>
      )}

      {msg && <p className={`text-sm ${msg.ok ? "text-(--color-success)" : "text-(--color-danger)"}`}>{msg.text}</p>}

      <ul className="card p-0 divide-y divide-(--color-border) overflow-hidden">
        {items.map((i) => {
          const info = ITEM_STATUS_INFO[i.status];
          const total = (i.unitCost ?? 0) * i.quantity;
          return (
            <li key={i.id} className={cn("flex gap-3 px-3 py-3 sm:px-4", selected.has(i.id) && "bg-(--color-primary)/5")}>
              <input
                type="checkbox"
                aria-label={`Select item ${formatItemId(i.orderNumber)}`}
                className="mt-1 accent-(--color-primary)"
                checked={selected.has(i.id)}
                onChange={() => toggle(i.id)}
              />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <p className="min-w-0 text-sm text-(--color-text-primary)">
                    <span className="font-mono text-xs font-semibold text-(--color-text-secondary) mr-2">{formatItemId(i.orderNumber)}</span>
                    {i.link ? (
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
                  {showOrder && (
                    <> · <Link href={`/procurement/requests/${i.requestId}`} className="text-(--color-secondary) hover:underline">{i.orderName}</Link></>
                  )}
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
                  {i.tracking && (
                    <a href={i.tracking.url} target="_blank" rel="noopener noreferrer" className="text-small text-(--color-secondary) hover:underline">
                      Track{i.tracking.label ? `: ${i.tracking.label}` : " package"} ↗
                    </a>
                  )}
                  {i.status === "TO_ORDER" && i.exportedAt && <span className="text-xs text-(--color-text-secondary)">in spreadsheet</span>}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
