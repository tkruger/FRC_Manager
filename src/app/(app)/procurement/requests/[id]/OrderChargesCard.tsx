"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/utils";
import { setOrderChargesAction } from "@/app/actions/orders";

interface Vendor {
  /** "" for items with no vendor */
  name: string;
  items: number;
  subtotal: number;
  tax: number;
  shipping: number;
}

interface Props {
  requestId: string;
  vendors: Vendor[];
  /** The Buyer (or captains) once the order is approved */
  canChange: boolean;
  /** Not approved yet — say when it gets filled in */
  beforeApproval: boolean;
}

const cols = "sm:grid-cols-[minmax(0,1fr)_6rem_7rem_7rem_6rem]";
const inputCls = "w-full min-w-0 rounded-md border border-(--color-border) bg-(--color-surface) text-(--color-text-primary) px-2.5 py-1.5 text-sm text-right tabular-nums focus:border-(--color-primary) focus:outline-none";

const toText = (n: number) => (n ? n.toFixed(2) : "");
const toNumber = (s: string) => {
  const n = Number((s || "0").replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : NaN;
};

/** Each vendor's tax and shipping on an order — added by the Buyer when placing it */
export function OrderChargesCard({ requestId, vendors, canChange, beforeApproval }: Props) {
  const router = useRouter();
  const initial = () => Object.fromEntries(vendors.map((v) => [v.name, { tax: toText(v.tax), shipping: toText(v.shipping) }]));
  const [editing, setEditing] = useState(false);
  const [values, setValues]   = useState(initial);
  const [error, setError]     = useState<string | null>(null);
  const [pending, start]      = useTransition();

  const items    = vendors.reduce((s, v) => s + v.subtotal, 0);
  const tax      = vendors.reduce((s, v) => s + v.tax, 0);
  const shipping = vendors.reduce((s, v) => s + v.shipping, 0);

  function cancel() {
    setValues(initial());
    setError(null);
    setEditing(false);
  }

  function save() {
    const charges = vendors.map((v) => ({ vendorName: v.name, tax: toNumber(values[v.name]?.tax), shipping: toNumber(values[v.name]?.shipping) }));
    const bad = charges.find((c) => !(c.tax >= 0) || !(c.shipping >= 0));
    if (bad) { setError(`Enter the tax and shipping for ${bad.vendorName || "items with no vendor"} as amounts (0 or more).`); return; }
    setError(null);
    start(async () => {
      const res = await setOrderChargesAction({ requestId, charges });
      if (!res.success) { setError(res.error); return; }
      toast.success("Tax and shipping saved");
      setEditing(false);
      router.refresh();
    });
  }

  const set = (vendor: string, field: "tax" | "shipping", value: string) =>
    setValues((m) => ({ ...m, [vendor]: { ...m[vendor], [field]: value } }));

  return (
    <section className="card space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-h3 text-(--color-text-primary)">Tax &amp; shipping</h2>
          <p className="text-small text-(--color-text-secondary) mt-0.5">
            Per vendor. Tax counts toward the items&apos; budget categories; shipping goes to Shipping.
            {!canChange && (beforeApproval ? " The Buyer adds these when ordering, once the order is approved." : " Added by the Buyer when ordering.")}
          </p>
        </div>
        {canChange && !editing && <Button size="sm" variant="outline" onClick={() => setEditing(true)}>{tax + shipping > 0 ? "Change" : "Add"}</Button>}
      </div>

      {error && <div className="text-sm text-(--color-danger) bg-(--color-danger)/10 rounded px-3 py-2">{error}</div>}

      {/* One row per vendor; on a phone the numbers sit in a labeled row under the name */}
      <div className="text-sm">
        <div className={`hidden sm:grid ${cols} gap-x-3 pb-1.5 text-label text-(--color-text-secondary)`}>
          <span>Vendor</span><span className="text-right">Items</span><span className="text-right">Tax</span><span className="text-right">Shipping</span><span className="text-right">Total</span>
        </div>
        <ul className="divide-y divide-(--color-border) border-y border-(--color-border) sm:border-b-0">
          {vendors.map((v) => {
            const val = values[v.name] ?? { tax: "", shipping: "" };
            const rowTax  = editing ? toNumber(val.tax) || 0 : v.tax;
            const rowShip = editing ? toNumber(val.shipping) || 0 : v.shipping;
            const what = v.name || "items with no vendor";
            return (
              <li key={v.name} className={`grid grid-cols-4 ${cols} gap-x-3 gap-y-1 py-2 items-center`}>
                <span className="col-span-4 sm:col-span-1 min-w-0 truncate text-(--color-text-primary)">
                  {v.name || <span className="text-(--color-text-secondary)">No vendor</span>}
                  <span className="text-(--color-text-secondary)"> · {v.items} item{v.items === 1 ? "" : "s"}</span>
                </span>
                <Amount label="Items">{formatCurrency(v.subtotal)}</Amount>
                <Amount label="Tax">
                  {editing
                    ? <input className={inputCls} inputMode="decimal" placeholder="0.00" value={val.tax} onChange={(e) => set(v.name, "tax", e.target.value)} aria-label={`Tax for ${what}`} />
                    : v.tax ? formatCurrency(v.tax) : "—"}
                </Amount>
                <Amount label="Shipping">
                  {editing
                    ? <input className={inputCls} inputMode="decimal" placeholder="0.00" value={val.shipping} onChange={(e) => set(v.name, "shipping", e.target.value)} aria-label={`Shipping for ${what}`} />
                    : v.shipping ? formatCurrency(v.shipping) : "—"}
                </Amount>
                <Amount label="Total" strong>{formatCurrency(v.subtotal + rowTax + rowShip)}</Amount>
              </li>
            );
          })}
          {!editing && vendors.length > 1 && (
            <li className={`grid grid-cols-4 ${cols} gap-x-3 gap-y-1 py-2 items-center font-medium`}>
              <span className="col-span-4 sm:col-span-1 text-(--color-text-primary)">All vendors</span>
              <Amount label="Items">{formatCurrency(items)}</Amount>
              <Amount label="Tax">{tax ? formatCurrency(tax) : "—"}</Amount>
              <Amount label="Shipping">{shipping ? formatCurrency(shipping) : "—"}</Amount>
              <Amount label="Total" strong>{formatCurrency(items + tax + shipping)}</Amount>
            </li>
          )}
        </ul>
      </div>

      {editing && (
        <div className="flex gap-2">
          <Button size="sm" onClick={save} isLoading={pending}>Save</Button>
          <Button size="sm" variant="ghost" onClick={cancel} disabled={pending}>Cancel</Button>
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
