"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import QRCode from "react-qr-code";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { ToolImageCapture } from "@/components/ui/ToolImageCapture";
import { addPartialPieceAction, updateItemImageAction } from "@/app/actions/inventory";
import { usePageAction } from "@/components/page-actions";
import { escapeHtml } from "@/lib/html";

/** A photo of the material — so people know what they're looking for */
export function PhotoPanel({ itemId, url, canEdit }: { itemId: string; url: string | null; canEdit: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <section className="card space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-h3 text-(--color-text-primary)">Photo</h2>
        {pending && <span className="text-small text-(--color-text-secondary)">Saving…</span>}
      </div>
      {canEdit ? (
        <ToolImageCapture name="imageUrl" defaultUrl={url}
          onUrl={(u) => start(async () => {
            const res = await updateItemImageAction(itemId, u);
            if (!res.success) toast.error(res.error ?? "Couldn't save the photo.");
            router.refresh();
          })} />
      ) : url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="w-full max-h-72 rounded-lg border border-(--color-border) object-contain" />
      ) : (
        <p className="text-small text-(--color-text-secondary)">No photo yet.</p>
      )}
    </section>
  );
}

/**
 * The label for the stock: a QR code with the item's code (INV-0001). Stick it on the bin, the sheet or
 * the offcut; scanning it (Tools → Scan) opens this item. The header's "Print label" fires `action`.
 */
export function LabelPanel({ itemId, name, code, detail, action }: { itemId: string; name: string; code: string | null; detail?: string | null; action?: string }) {
  const value = code ?? itemId;
  const svgId = `stock-qr-${itemId}`;

  function print() {
    const win = window.open("", "_blank", "width=400,height=520");
    if (!win) { toast.error("Allow pop-ups to print the label."); return; }
    // The QR code is our own SVG; the text is escaped (it's user-editable)
    const svg = document.getElementById(svgId)?.outerHTML ?? "";
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Label — ${escapeHtml(name)}</title>
<style>body{margin:0;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;padding:24px}
svg{width:180px;height:180px}h1{font-size:14px;font-weight:700;margin:12px 0 4px;text-align:center}p{font-size:11px;color:#555;margin:0;text-align:center}
.code{font-family:monospace}@media print{@page{margin:0}}</style></head>
<body>${svg}<h1>${escapeHtml(name)}</h1>${detail ? `<p>${escapeHtml(detail)}</p>` : ""}<p class="code">${escapeHtml(value)}</p>
<script>window.onload=()=>{window.print();window.close();}</script></body></html>`);
    win.document.close();
  }
  usePageAction(action, print);

  return (
    <section className="card space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-h3 text-(--color-text-primary)">Label</h2>
        <Button type="button" size="sm" variant="outline" onClick={print}>Print label</Button>
      </div>
      <div className="flex flex-col items-center gap-2 py-1">
        <div className="rounded-lg bg-white p-3"><QRCode id={svgId} value={value} size={140} level="M" /></div>
        <p className="font-mono text-sm text-(--color-text-primary)">{value}</p>
        <p className="text-center text-small text-(--color-text-secondary)">Stick it on the stock — scanning it (Tools → Scan) opens this item.</p>
      </div>
    </section>
  );
}

/** Add a part-used piece of this item (an offcut, a part-used spool) — opened from the header */
export function PartialPieceDialog({ itemId, itemName, location, fullStock, action }: {
  itemId: string; itemName: string; location: string | null; fullStock: number | null; action: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [take, setTake] = useState(false);
  const [pending, start] = useTransition();
  usePageAction(action, () => { setError(null); setTake(false); setOpen(true); });

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    start(async () => {
      const res = await addPartialPieceAction(itemId, {
        amountLeft: f.get("amountLeft"), storageLocation: f.get("storageLocation") || undefined,
        notes: f.get("notes") || undefined, pieces: f.get("pieces") || 1, takeFromStock: take,
      });
      if (!res.success) { setError(res.error ?? "Couldn't add it."); return; }
      setOpen(false);
      toast.success("Partial piece added — add a photo and print its label");
      router.push(`/inventory/${res.id}`);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent title="Add a partial piece" description={`A part-used piece of ${itemName} — it's listed with the full stock, with its own label.`}>
        <form onSubmit={submit} className="space-y-4">
          {error && <div className="rounded-md bg-(--color-danger)/10 px-3 py-2 text-sm text-(--color-danger)">{error}</div>}
          <Field label="Amount left" name="amountLeft" required maxLength={120} placeholder="e.g. about 18 in, half a sheet" autoFocus />
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2"><Field label="Where it is" name="storageLocation" defaultValue={location ?? ""} placeholder="e.g. Offcut rack" /></div>
            <Field label="Pieces" name="pieces" type="number" min="1" max="50" defaultValue={1} />
          </div>
          <Field label="Notes" name="notes" placeholder="Optional — e.g. has two holes drilled" />
          {fullStock != null && fullStock > 0 && (
            <label className="flex items-start gap-2 text-sm text-(--color-text-primary) cursor-pointer">
              <input type="checkbox" className="mt-0.5" checked={take} onChange={(e) => setTake(e.target.checked)} />
              <span>It was cut from a full one — take 1 off the full stock ({fullStock} now)</span>
            </label>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
            <Button type="submit" isLoading={pending}>Add piece</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
