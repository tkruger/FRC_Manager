"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency } from "@/lib/utils";
import { createOrderAction, editOrderAction, lookupProductAction } from "@/app/actions/orders";
import { toast } from "@/components/ui/toast";
import { IMPORTANCE_OPTIONS } from "@/lib/orders/constants";
import { SUBTEAM_OPTIONS } from "@/lib/schedule-helpers";

interface Item {
  key:        number;
  /** Existing item (edit mode) */
  id?:        string;
  /** Its item ID or draft ID, shown on the card */
  ref?:       string;
  link:       string;
  vendorName: string;
  name:       string;
  partNumber: string;
  unitCost:   string;
  quantity:   string;
  subTeam:    string;
  importance: string;
  reasoning:  string;
  notes:      string;
  lookup:     "idle" | "loading" | "done" | "failed";
}

const inputCls =
  "w-full rounded-md border border-(--color-border) bg-(--color-surface) text-(--color-text-primary) px-2.5 py-2 text-sm focus:border-(--color-primary) focus:outline-none";

let nextKey = 1;
function blankItem(defaults?: Partial<Item>): Item {
  return {
    key: nextKey++, link: "", vendorName: "", name: "", partNumber: "", unitCost: "", quantity: "1",
    subTeam: defaults?.subTeam ?? "", importance: "ROUTINE", reasoning: "", notes: "", lookup: "idle",
  };
}

/** Values for editing an existing order */
export interface OrderFormEdit {
  requestId: string;
  name:      string;
  items:     Omit<Item, "key" | "lookup">[];
  /** Arrived items: shown, but can't be changed or removed */
  locked:    { ref: string; name: string; quantity: number }[];
}

export function OrderForm({ vendors, edit }: { vendors: string[]; edit?: OrderFormEdit }) {
  const router = useRouter();
  const [name, setName]   = useState(edit?.name ?? "");
  const [items, setItems] = useState<Item[]>(() =>
    edit ? edit.items.map((i) => ({ ...i, key: nextKey++, lookup: "idle" as const })) : [blankItem()]);
  const locked = edit?.locked ?? [];
  const [error, setError] = useState<string | null>(null);
  const [pending, start]  = useTransition();

  const update = (key: number, patch: Partial<Item>) =>
    setItems((list) => list.map((i) => (i.key === key ? { ...i, ...patch } : i)));

  async function fillFromLink(item: Item, link = item.link) {
    const url = link.trim();
    if (!/^https?:\/\//i.test(url)) return;
    update(item.key, { lookup: "loading" });
    const res = await lookupProductAction(url);
    if (!res.success) { update(item.key, { lookup: "failed" }); return; }
    const p = res.product;
    // Only fill fields the person hasn't typed in themselves
    setItems((list) => list.map((i) => i.key !== item.key ? i : {
      ...i,
      lookup:     p.name ? "done" : "failed",
      vendorName: i.vendorName || p.vendorName || "",
      name:       i.name || p.name || "",
      partNumber: i.partNumber || p.partNumber || "",
      unitCost:   i.unitCost || (p.unitCost != null ? p.unitCost.toFixed(2) : ""),
    }));
  }

  const total = items.reduce((s, i) => s + (Number(i.unitCost) || 0) * (Number(i.quantity) || 0), 0);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const payload = {
      name,
      items: items.map((i) => ({
        id:         i.id,
        name:       i.name,
        vendorName: i.vendorName || undefined,
        partNumber: i.partNumber || undefined,
        link:       i.link || undefined,
        unitCost:   i.unitCost === "" ? null : Number(i.unitCost),
        quantity:   Number(i.quantity),
        subTeam:    i.subTeam || null,
        importance: i.importance,
        reasoning:  i.reasoning || undefined,
        notes:      i.notes || undefined,
      })),
    };
    start(async () => {
      if (edit) {
        const res = await editOrderAction({ ...payload, requestId: edit.requestId });
        if (!res.success) { setError(res.error); return; }
        toast.success("Order saved");
        router.push(`/procurement/requests/${edit.requestId}`);
        return;
      }
      const res = await createOrderAction(payload);
      if (!res.success) { setError(res.error); return; }
      router.push(`/procurement/requests/${res.requestId}`);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {error && <div className="text-sm text-(--color-danger) bg-(--color-danger)/10 rounded px-3 py-2">{error}</div>}

      <label className="block space-y-1.5">
        <span className="block text-sm font-medium text-(--color-text-primary)">Order name <span className="text-(--color-danger)">*</span></span>
        <input className={inputCls} required maxLength={120} value={name} onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Intake prototype parts" />
      </label>

      {locked.length > 0 && (
        <div className="card space-y-2">
          <p className="text-sm font-medium text-(--color-text-primary)">Arrived — can&apos;t be changed</p>
          <ul className="text-small text-(--color-text-secondary) space-y-1">
            {locked.map((l) => (
              <li key={l.ref}><span className="font-mono text-xs mr-2">{l.ref}</span>{l.name} × {l.quantity}</li>
            ))}
          </ul>
        </div>
      )}

      <datalist id="vendor-names">{vendors.map((v) => <option key={v} value={v} />)}</datalist>

      {items.map((item, idx) => (
        <fieldset key={item.key} className="card space-y-3">
          <div className="flex items-center justify-between">
            <legend className="text-h3 text-(--color-text-primary)">
              {item.ref ? <><span className="font-mono text-sm text-(--color-text-secondary) mr-2">{item.ref}</span>{item.name || `Item ${idx + 1}`}</> : `${edit ? "New item" : "Item"} ${idx + 1}`}
            </legend>
            {(items.length > 1 || locked.length > 0) && (
              <button type="button" className="text-small text-(--color-danger) hover:underline"
                onClick={() => setItems((list) => list.filter((i) => i.key !== item.key))}>
                Remove
              </button>
            )}
          </div>

          <div className="space-y-1.5">
            <span className="block text-sm font-medium text-(--color-text-primary)">Link</span>
            <div className="flex gap-2">
              <input
                className={inputCls}
                type="url"
                placeholder="Paste a product link to fill in the details"
                value={item.link}
                onChange={(e) => update(item.key, { link: e.target.value, lookup: "idle" })}
                onPaste={(e) => {
                  const text = e.clipboardData.getData("text").trim();
                  if (/^https?:\/\//i.test(text)) setTimeout(() => fillFromLink(item, text), 0);
                }}
                onBlur={() => { if (item.lookup === "idle") fillFromLink(item); }}
              />
              <Button type="button" size="sm" variant="outline" disabled={!item.link || item.lookup === "loading"}
                onClick={() => fillFromLink(item)}>
                {item.lookup === "loading" ? "Looking…" : "Fill"}
              </Button>
            </div>
            {item.lookup === "failed" && (
              <p className="text-small text-(--color-text-secondary)">Couldn&apos;t read that page — some stores block it. Fill in the details below.</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Labeled label="Item name" required>
              <input className={inputCls} required value={item.name} onChange={(e) => update(item.key, { name: e.target.value })} />
            </Labeled>
            <Labeled label="Vendor">
              <input className={inputCls} list="vendor-names" value={item.vendorName} onChange={(e) => update(item.key, { vendorName: e.target.value })} />
            </Labeled>
            <Labeled label="Vendor part number">
              <input className={inputCls} value={item.partNumber} onChange={(e) => update(item.key, { partNumber: e.target.value })} />
            </Labeled>
            <div className="grid grid-cols-2 gap-3">
              <Labeled label="Unit cost ($)">
                <input className={inputCls} type="number" min="0" step="0.01" value={item.unitCost} onChange={(e) => update(item.key, { unitCost: e.target.value })} />
              </Labeled>
              <Labeled label="Quantity" required>
                <input className={inputCls} type="number" min="1" step="any" required value={item.quantity} onChange={(e) => update(item.key, { quantity: e.target.value })} />
              </Labeled>
            </div>
            <Labeled label="Sub-team">
              <select className={inputCls} value={item.subTeam} onChange={(e) => update(item.key, { subTeam: e.target.value })}>
                <option value="">—</option>
                {SUBTEAM_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Labeled>
            <Labeled label="Importance">
              <select className={inputCls} value={item.importance} onChange={(e) => update(item.key, { importance: e.target.value })}>
                {IMPORTANCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Labeled>
          </div>
          <Labeled label="Reasoning">
            <textarea className={cn(inputCls, "min-h-16")} rows={2} value={item.reasoning}
              onChange={(e) => update(item.key, { reasoning: e.target.value })} placeholder="Why is this needed?" />
          </Labeled>
          <Labeled label="Notes">
            <input className={inputCls} value={item.notes} onChange={(e) => update(item.key, { notes: e.target.value })}
              placeholder="Variant, color, anything the Team Admin should know" />
          </Labeled>
        </fieldset>
      ))}

      <button type="button"
        onClick={() => setItems((list) => [...list, blankItem({ subTeam: list[list.length - 1]?.subTeam })])}
        className="w-full rounded-lg border-2 border-dashed border-(--color-border) py-3 text-sm font-medium text-(--color-text-secondary) hover:border-(--color-primary) hover:text-(--color-primary) transition-colors">
        + Add another item
      </button>

      <div className="sticky bottom-16 lg:bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-(--color-surface) border border-(--color-border) p-3 shadow-lg">
        <p className="text-sm text-(--color-text-primary)">
          {items.length} item{items.length === 1 ? "" : "s"} · <b>{formatCurrency(total)}</b>
          {locked.length > 0 && <span className="text-(--color-text-secondary)"> + {locked.length} arrived</span>}
        </p>
        <div className="flex gap-2">
          {edit && (
            <Button type="button" variant="outline" onClick={() => router.push(`/procurement/requests/${edit.requestId}`)}>Cancel</Button>
          )}
          <Button type="submit" isLoading={pending}>{edit ? "Save changes" : "Submit order"}</Button>
        </div>
      </div>
    </form>
  );
}

function Labeled({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-sm font-medium text-(--color-text-primary)">
        {label}{required && <span className="ml-1 text-(--color-danger)">*</span>}
      </span>
      {children}
    </label>
  );
}
