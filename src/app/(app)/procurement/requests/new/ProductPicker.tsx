"use client";

import { useMemo, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency } from "@/lib/utils";
import type { ProductChoice } from "@/lib/orders/lookup";

/**
 * A product link that sells several things (a WCP parts page, a product with sizes):
 * pick one or more to add. The first fills the item you pasted into; the rest are added after it.
 */
export function ProductPicker({
  open, vendorName, choices, onCancel, onPick,
}: {
  open:       boolean;
  vendorName: string | null;
  choices:    ProductChoice[];
  onCancel:   () => void;
  onPick:     (picked: ProductChoice[]) => void;
}) {
  const [query, setQuery]       = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const shown = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    return choices.filter((c) => {
      const text = `${c.label} ${c.partNumber ?? ""}`.toLowerCase();
      return words.every((w) => text.includes(w));
    });
  }, [choices, query]);

  function toggle(url: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(url)) next.delete(url); else next.add(url);
      return next;
    });
  }

  const picked = choices.filter((c) => selected.has(c.url));

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent
        title="Which product?"
        description={`This ${vendorName ?? ""} page has ${choices.length} products. Pick one or more — each becomes its own item.`}
        className="sm:max-w-2xl"
      >
        <div className="space-y-3">
          <input
            autoFocus
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter, e.g. 24t falcon"
            className="w-full rounded-md border border-(--color-border) bg-(--color-surface) text-(--color-text-primary) px-3 py-2 text-sm focus:border-(--color-primary) focus:outline-none"
          />

          <ul className="max-h-[55vh] overflow-y-auto rounded-md border border-(--color-border) divide-y divide-(--color-border)">
            {shown.length === 0 && (
              <li className="px-3 py-6 text-center text-small text-(--color-text-secondary)">Nothing matches “{query}”.</li>
            )}
            {shown.map((c) => {
              const on = selected.has(c.url);
              return (
                <li key={c.url}>
                  <label className={cn("flex cursor-pointer items-start gap-3 px-3 py-2.5 transition-colors", on ? "bg-(--color-primary)/10" : "hover:bg-(--color-surface-overlay)")}>
                    <input type="checkbox" checked={on} onChange={() => toggle(c.url)} className="mt-1 accent-(--color-primary)" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-(--color-text-primary)">{c.label}</span>
                      {c.partNumber && <span className="block font-mono text-xs text-(--color-text-secondary)">{c.partNumber}</span>}
                    </span>
                    <span className="shrink-0 text-sm font-medium text-(--color-text-primary)">
                      {c.unitCost != null ? formatCurrency(c.unitCost) : "—"}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-small text-(--color-text-secondary)">{picked.length} selected</p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
              <Button type="button" disabled={picked.length === 0} onClick={() => { onPick(picked); setSelected(new Set()); setQuery(""); }}>
                Add {picked.length > 1 ? `${picked.length} items` : "item"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
