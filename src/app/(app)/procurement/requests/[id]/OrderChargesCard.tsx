"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/utils";
import { setOrderChargesAction } from "@/app/actions/orders";

export interface VendorItem { id: string; ref: string; name: string; total: number }
export interface VendorOrder { id: string | null; orderNumber: string | null; tax: number; shipping: number; itemIds: string[] }
export interface Vendor {
  /** "" for items with no vendor */
  name:   string;
  items:  VendorItem[];
  /** Usually one; more when some items were ordered separately (out of stock) */
  orders: VendorOrder[];
}

interface Props {
  requestId: string;
  vendors: Vendor[];
  /** The Buyer (or captains) once the order is approved */
  canChange: boolean;
  /** Not approved yet — say when it gets filled in */
  beforeApproval: boolean;
}

interface Draft { id: string | null; orderNumber: string; tax: string; shipping: string }

const cols = "sm:grid-cols-[minmax(0,1fr)_6rem_7rem_7rem_6rem]";
const inputCls = "w-full min-w-0 rounded-md border border-(--color-border) bg-(--color-surface) text-(--color-text-primary) px-2.5 py-1.5 text-sm text-right tabular-nums focus:border-(--color-primary) focus:outline-none";

const toText = (n: number) => (n ? n.toFixed(2) : "");
const toNumber = (s: string) => {
  const n = Number((s || "0").replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : NaN;
};

/** Each vendor's orders: the vendor's order number, tax and shipping — split when items ship separately */
export function OrderChargesCard({ requestId, vendors, canChange, beforeApproval }: Props) {
  const router = useRouter();
  const initialOrders = () => Object.fromEntries(vendors.map((v) => [v.name, v.orders.map((o) => ({ id: o.id, orderNumber: o.orderNumber ?? "", tax: toText(o.tax), shipping: toText(o.shipping) }))]));
  const initialItems = () => Object.fromEntries(vendors.flatMap((v) => v.orders.flatMap((o, i) => o.itemIds.map((id) => [id, i]))));
  const [editing, setEditing] = useState(false);
  const [orders, setOrders]   = useState<Record<string, Draft[]>>(initialOrders);
  const [itemOrder, setItemOrder] = useState<Record<string, number>>(initialItems);
  const [error, setError]     = useState<string | null>(null);
  const [pending, start]      = useTransition();

  const sum = (f: (o: VendorOrder) => number) => vendors.reduce((s, v) => s + v.orders.reduce((t, o) => t + f(o), 0), 0);
  const itemsTotal = vendors.reduce((s, v) => s + v.items.reduce((t, i) => t + i.total, 0), 0);
  const tax = sum((o) => o.tax), shipping = sum((o) => o.shipping);
  const anything = tax + shipping > 0 || vendors.some((v) => v.orders.some((o) => o.orderNumber) || v.orders.length > 1);

  function cancel() {
    setOrders(initialOrders()); setItemOrder(initialItems());
    setError(null); setEditing(false);
  }

  function save() {
    const payload = vendors.map((v) => ({
      vendorName: v.name,
      orders: (orders[v.name] ?? []).map((o, i) => ({
        id: o.id ?? undefined, vendorOrderNumber: o.orderNumber, tax: toNumber(o.tax), shipping: toNumber(o.shipping),
        itemIds: v.items.filter((it) => (itemOrder[it.id] ?? 0) === i).map((it) => it.id),
      })),
    }));
    const bad = payload.flatMap((v) => v.orders.map((o) => ({ v, o }))).find(({ o }) => !(o.tax >= 0) || !(o.shipping >= 0));
    if (bad) { setError(`Enter the tax and shipping for ${bad.v.vendorName || "items with no vendor"} as amounts (0 or more).`); return; }
    const emptySplit = payload.find((v) => v.orders.length > 1 && v.orders.some((o) => o.itemIds.length === 0));
    if (emptySplit) { setError(`Each ${emptySplit.vendorName || "no-vendor"} order needs at least one item — pick which items go on it, or remove it.`); return; }
    setError(null);
    start(async () => {
      const res = await setOrderChargesAction({ requestId, vendors: payload });
      if (!res.success) { setError(res.error); return; }
      toast.success("Vendor orders saved");
      setEditing(false);
      router.refresh();
    });
  }

  const setField = (vendor: string, i: number, field: keyof Omit<Draft, "id">, value: string) =>
    setOrders((m) => ({ ...m, [vendor]: m[vendor].map((o, j) => (j === i ? { ...o, [field]: value } : o)) }));
  const split = (vendor: string) =>
    setOrders((m) => ({ ...m, [vendor]: [...m[vendor], { id: null, orderNumber: "", tax: "", shipping: "" }] }));
  const removeOrder = (v: Vendor, i: number) => {
    setOrders((m) => ({ ...m, [v.name]: m[v.name].filter((_, j) => j !== i) }));
    // Its items go back to the first order; later orders move up one
    setItemOrder((m) => Object.fromEntries(Object.entries(m).map(([id, n]) => [id, !v.items.some((it) => it.id === id) ? n : n === i ? 0 : n > i ? n - 1 : n])));
  };

  return (
    <section className="card space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="text-h3 text-(--color-text-primary)">Vendor orders</h2>
          <p className="text-small text-(--color-text-secondary) mt-0.5">
            Per vendor: the vendor&apos;s order number (for following up with them), tax and shipping. Some items out of
            stock? <b>Split</b> them onto a second order with that vendor. Tax counts toward the items&apos; budget categories; shipping goes to Shipping.
            {!canChange && (beforeApproval ? " The Buyer adds these when ordering, once the order is approved." : " Added by the Buyer when ordering.")}
          </p>
        </div>
        {canChange && !editing && <Button size="sm" variant="outline" onClick={() => setEditing(true)}>{anything ? "Change" : "Add"}</Button>}
      </div>

      {error && <div className="text-sm text-(--color-danger) bg-(--color-danger)/10 rounded px-3 py-2">{error}</div>}

      <div className="text-sm">
        <div className={`hidden sm:grid ${cols} gap-x-3 pb-1.5 text-label text-(--color-text-secondary)`}>
          <span>Vendor</span><span className="text-right">Items</span><span className="text-right">Tax</span><span className="text-right">Shipping</span><span className="text-right">Total</span>
        </div>
        <ul className="divide-y divide-(--color-border) border-y border-(--color-border) sm:border-b-0">
          {vendors.map((v) => {
            const drafts = orders[v.name] ?? [];
            const list = editing ? drafts : v.orders.map((o) => ({ id: o.id, orderNumber: o.orderNumber ?? "", tax: toText(o.tax), shipping: toText(o.shipping) }));
            const several = list.length > 1;
            const itemsOn = (i: number) => v.items.filter((it) => (editing ? itemOrder[it.id] ?? 0 : v.orders[i]?.itemIds.includes(it.id) ? i : -1) === i);
            const what = v.name || "items with no vendor";
            return (
              <li key={v.name} className="py-2 space-y-2">
                {list.map((o, i) => {
                  const its = itemsOn(i);
                  const subtotal = its.reduce((s, it) => s + it.total, 0);
                  const rowTax = toNumber(o.tax) || 0, rowShip = toNumber(o.shipping) || 0;
                  return (
                    <div key={o.id ?? `new-${i}`} className={`grid grid-cols-4 ${cols} gap-x-3 gap-y-1 items-center ${several ? "rounded-md bg-(--color-surface-overlay)/60 px-2 py-1.5" : ""}`}>
                      <span className="col-span-4 sm:col-span-1 min-w-0 text-(--color-text-primary)">
                        <span className="block truncate">
                          {v.name || <span className="text-(--color-text-secondary)">No vendor</span>}
                          {several && <span className="text-(--color-text-secondary)"> — order {i + 1}</span>}
                          <span className="text-(--color-text-secondary)"> · {its.length} item{its.length === 1 ? "" : "s"}</span>
                        </span>
                        {editing ? (
                          <span className="mt-1 flex gap-2">
                            <input className={inputCls.replace("text-right tabular-nums", "text-left")} placeholder="Vendor order # (optional)" value={o.orderNumber} maxLength={100}
                              onChange={(e) => setField(v.name, i, "orderNumber", e.target.value)} aria-label={`Order number from ${what}${several ? `, order ${i + 1}` : ""}`} />
                            {i > 0 && <Button type="button" size="sm" variant="outline" onClick={() => removeOrder(v, i)}>Remove</Button>}
                          </span>
                        ) : (
                          <>
                            {o.orderNumber && <span className="block text-small text-(--color-text-secondary)">Order # <span className="font-mono text-(--color-text-primary) select-all">{o.orderNumber}</span></span>}
                            {several && <span className="block text-small text-(--color-text-secondary) truncate">{its.map((it) => it.ref).join(", ")}</span>}
                          </>
                        )}
                      </span>
                      <Amount label="Items">{formatCurrency(subtotal)}</Amount>
                      <Amount label="Tax">
                        {editing
                          ? <input className={inputCls} inputMode="decimal" placeholder="0.00" value={o.tax} onChange={(e) => setField(v.name, i, "tax", e.target.value)} aria-label={`Tax for ${what}`} />
                          : rowTax ? formatCurrency(rowTax) : "—"}
                      </Amount>
                      <Amount label="Shipping">
                        {editing
                          ? <input className={inputCls} inputMode="decimal" placeholder="0.00" value={o.shipping} onChange={(e) => setField(v.name, i, "shipping", e.target.value)} aria-label={`Shipping for ${what}`} />
                          : rowShip ? formatCurrency(rowShip) : "—"}
                      </Amount>
                      <Amount label="Total" strong>{formatCurrency(subtotal + rowTax + rowShip)}</Amount>
                    </div>
                  );
                })}

                {/* Splitting: which of the vendor's items go on which order */}
                {editing && several && (
                  <div className="space-y-1.5 rounded-md border border-dashed border-(--color-border) px-3 py-2">
                    <p className="text-small font-medium text-(--color-text-primary)">Which order is each item on?</p>
                    {v.items.map((it) => (
                      <label key={it.id} className="flex flex-wrap items-center justify-between gap-2 text-small">
                        <span className="min-w-0 truncate text-(--color-text-primary)"><span className="mr-1.5 font-mono text-xs text-(--color-text-secondary)">{it.ref}</span>{it.name}</span>
                        <select className="rounded-md border border-(--color-border) bg-(--color-surface) px-2 py-1 text-sm text-(--color-text-primary)"
                          value={itemOrder[it.id] ?? 0} onChange={(e) => setItemOrder((m) => ({ ...m, [it.id]: Number(e.target.value) }))}>
                          {drafts.map((d, j) => <option key={j} value={j}>Order {j + 1}{d.orderNumber ? ` (#${d.orderNumber})` : ""}</option>)}
                        </select>
                      </label>
                    ))}
                  </div>
                )}
                {editing && v.items.length > 1 && drafts.length < 10 && (
                  <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => split(v.name)}>
                    + Split {v.name || "these"} items onto another order
                  </Button>
                )}
              </li>
            );
          })}
          {!editing && (vendors.length > 1 || vendors.some((v) => v.orders.length > 1)) && (
            <li className={`grid grid-cols-4 ${cols} gap-x-3 gap-y-1 py-2 items-center font-medium`}>
              <span className="col-span-4 sm:col-span-1 text-(--color-text-primary)">{vendors.length > 1 ? "All vendors" : "All orders"}</span>
              <Amount label="Items">{formatCurrency(itemsTotal)}</Amount>
              <Amount label="Tax">{tax ? formatCurrency(tax) : "—"}</Amount>
              <Amount label="Shipping">{shipping ? formatCurrency(shipping) : "—"}</Amount>
              <Amount label="Total" strong>{formatCurrency(itemsTotal + tax + shipping)}</Amount>
            </li>
          )}
        </ul>
      </div>

      {editing && (
        <div className="flex gap-2">
          <Button size="sm" onClick={save} isLoading={pending}>Save</Button>
          <Button size="sm" variant="outline" onClick={cancel} disabled={pending}>Cancel</Button>
        </div>
      )}
    </section>
  );
}

/** A number in a vendor row — labeled above it on a phone, under the column header otherwise */
function Amount({ label, strong, children }: { label: string; strong?: boolean; children: React.ReactNode }) {
  return (
    <span className={`min-w-0 text-right tabular-nums text-(--color-text-primary) ${strong ? "font-medium" : ""}`}>
      <span className="block sm:hidden text-label font-normal text-(--color-text-secondary)">{label}</span>
      {children}
    </span>
  );
}

