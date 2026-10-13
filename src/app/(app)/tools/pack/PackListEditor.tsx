"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { addPackItemAction, updatePackItemAction, deletePackItemAction, movePackItemAction, type PackItemInput } from "@/app/actions/packing";
import { groupKey } from "@/lib/packing";

interface Item { id: string; toolName: string | null; label: string | null; quantity: number; notes: string | null }

const input = "w-full rounded-md border border-(--color-border) bg-(--color-surface) text-(--color-text-primary) px-3 h-11 text-sm focus:outline-none focus:ring-2 focus:ring-(--color-primary)/40 focus:border-(--color-primary)";

function ItemForm({ initial, toolNames, onSave, onCancel, saveLabel }: {
  initial?: Item;
  toolNames: string[];
  onSave: (v: PackItemInput) => Promise<boolean>;
  onCancel?: () => void;
  saveLabel: string;
}) {
  const [kind, setKind]         = useState<"tool" | "other">(initial ? (initial.toolName ? "tool" : "other") : toolNames.length ? "tool" : "other");
  const [toolName, setToolName] = useState(initial?.toolName ?? "");
  const [label, setLabel]       = useState(initial?.label ?? "");
  const [quantity, setQuantity] = useState(String(initial?.quantity ?? 1));
  const [notes, setNotes]       = useState(initial?.notes ?? "");
  const [isPending, start]      = useTransition();

  // Keep a group that no longer has tools selectable while editing
  const names = initial?.toolName && !toolNames.some((n) => groupKey(n) === groupKey(initial.toolName!)) ? [initial.toolName, ...toolNames] : toolNames;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const ok = await onSave({ toolName: kind === "tool" ? toolName : null, label: kind === "other" ? label : null, quantity: Number(quantity), notes });
      if (ok && !initial) { setToolName(""); setLabel(""); setQuantity("1"); setNotes(""); }
    });
  }

  const ready = kind === "tool" ? !!toolName : !!label.trim();

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex gap-1 rounded-md bg-(--color-surface-overlay) p-1 w-fit" role="radiogroup" aria-label="Kind of item">
        {(["tool", "other"] as const).map((k) => (
          <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)}
            className={`rounded px-3 py-1.5 text-sm font-medium ${kind === k ? "bg-(--color-surface) text-(--color-text-primary) shadow-sm" : "text-(--color-text-secondary)"}`}>
            {k === "tool" ? "Tool group" : "Other item"}
          </button>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_6rem]">
        {kind === "tool" ? (
          names.length ? (
            <Select aria-label="Tool group" placeholder="Pick a tool group…" options={names.map((n) => ({ value: n, label: n }))} value={toolName} onChange={(e) => setToolName(e.target.value)} />
          ) : (
            <p className="text-small text-(--color-text-secondary) self-center">No tools yet — add tools first, or use Other item.</p>
          )
        ) : (
          <input className={input} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Battery cart, Spare bumpers" maxLength={120} aria-label="Item" />
        )}
        <input className={input} type="number" inputMode="numeric" min={1} max={99} value={quantity} onChange={(e) => setQuantity(e.target.value)} aria-label="How many" />
      </div>
      <input className={input} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" maxLength={300} aria-label="Notes" />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={!ready} isLoading={isPending}>{saveLabel}</Button>
        {onCancel && <Button type="button" size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>}
      </div>
    </form>
  );
}

export function PackListEditor({ items, toolNames, groupSizes, canEdit }: {
  items: Item[];
  toolNames: string[];
  groupSizes: Record<string, number>;
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [, start]             = useTransition();

  async function run(p: Promise<{ success: boolean; error?: string }>) {
    setError(null);
    const res = await p;
    if (!res.success) setError(res.error ?? "Something went wrong.");
    return res.success;
  }

  return (
    <div className="space-y-4">
      {error && <div className="rounded-md bg-(--color-danger)/10 border border-(--color-danger)/20 px-4 py-3 text-sm text-(--color-danger)">{error}</div>}

      {items.length === 0 ? (
        <div className="card text-center py-8 text-body text-(--color-text-secondary)">
          The pack list is empty.{canEdit ? " Add the tools and other things every competition needs." : ""}
        </div>
      ) : (
        <ul className="card p-0 divide-y divide-(--color-border)">
          {items.map((it, i) => {
            const have = it.toolName ? groupSizes[groupKey(it.toolName)] ?? 0 : null;
            return (
              <li key={it.id} className="px-4 py-3">
                {editing === it.id ? (
                  <ItemForm initial={it} toolNames={toolNames} saveLabel="Save" onCancel={() => setEditing(null)}
                    onSave={async (v) => { const ok = await run(updatePackItemAction(it.id, v)); if (ok) setEditing(null); return ok; }} />
                ) : (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-(--color-text-primary)">
                        {it.quantity > 1 && <span className="text-(--color-text-secondary)">{it.quantity} × </span>}
                        {it.toolName ?? it.label}
                      </p>
                      <p className="text-small text-(--color-text-secondary)">
                        {it.toolName ? "Tool group — scan to pack" : "Tick off by hand"}
                        {have !== null && have < it.quantity && <span className="text-(--color-warning)"> · the team only has {have}</span>}
                        {it.notes ? ` · ${it.notes}` : ""}
                      </p>
                    </div>
                    {canEdit && (
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" aria-label="Move up" disabled={i === 0} onClick={() => start(async () => { await run(movePackItemAction(it.id, "up")); })}>↑</Button>
                        <Button size="icon" variant="ghost" aria-label="Move down" disabled={i === items.length - 1} onClick={() => start(async () => { await run(movePackItemAction(it.id, "down")); })}>↓</Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditing(it.id)}>Edit</Button>
                        <Button size="sm" variant="ghost" className="text-(--color-danger)"
                          onClick={() => { if (confirm(`Remove ${it.toolName ?? it.label} from the pack list?`)) start(async () => { await run(deletePackItemAction(it.id)); }); }}>
                          Remove
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {canEdit && (
        <div className="card space-y-3">
          <p className="text-h3 text-(--color-text-primary)">Add to the list</p>
          <ItemForm toolNames={toolNames} saveLabel="Add" onSave={(v) => run(addPackItemAction(v))} />
        </div>
      )}
    </div>
  );
}
