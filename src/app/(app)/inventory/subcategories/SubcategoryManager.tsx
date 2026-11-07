"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Folder, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { CATEGORY_OPTIONS, SUGGESTED_SUBCATEGORIES } from "@/lib/inventory/categories";
import {
  addSubcategoryAction, addSuggestedSubcategoriesAction, deleteSubcategoryAction, renameSubcategoryAction,
} from "@/app/actions/inventory-subcategories";

interface Sub { id: string; category: string; name: string; items: number }

const inputCls = "min-w-0 flex-1 rounded-md border border-(--color-border) bg-(--color-surface) px-3 py-1.5 text-sm text-(--color-text-primary) placeholder:text-(--color-text-disabled) focus:border-(--color-primary) focus:outline-none";

/** Each category with its sub-categories: add, rename and remove them */
export function SubcategoryManager({ subcategories }: { subcategories: Sub[] }) {
  return (
    <div className="space-y-4">
      {CATEGORY_OPTIONS.filter((c) => c.value !== "UNCATEGORIZED").map((c) => (
        <CategoryCard key={c.value} category={c.value} label={c.label} subs={subcategories.filter((s) => s.category === c.value)} />
      ))}
    </div>
  );
}

function CategoryCard({ category, label, subs }: { category: string; label: string; subs: Sub[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pending, start] = useTransition();
  const have = new Set(subs.map((s) => s.name.toLowerCase()));
  const missing = (SUGGESTED_SUBCATEGORIES[category as keyof typeof SUGGESTED_SUBCATEGORIES] ?? []).filter((n) => !have.has(n.toLowerCase()));

  const run = (fn: () => Promise<{ success: boolean; error?: string }>, ok?: () => void) => start(async () => {
    const res = await fn();
    if (!res.success) { toast.error(res.error ?? "Couldn't save that."); return; }
    ok?.();
    router.refresh();
  });

  return (
    <section className="card space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-h3 text-(--color-text-primary)">
          <Folder aria-hidden className="h-4 w-4 text-(--color-primary)" />{label}
          <span className="text-small font-normal text-(--color-text-secondary)">{subs.length}</span>
        </h2>
        {missing.length > 0 && (
          <button type="button" disabled={pending} title={missing.join(", ")}
            onClick={() => run(() => addSuggestedSubcategoriesAction(category))}
            className="text-small font-medium text-(--color-secondary) hover:underline disabled:opacity-50">
            Add suggested ({missing.length})
          </button>
        )}
      </div>

      {subs.length > 0 ? (
        <ul className="divide-y divide-(--color-border) rounded-lg border border-(--color-border)">
          {subs.map((s) => <SubRow key={s.id} sub={s} run={run} pending={pending} />)}
        </ul>
      ) : (
        <p className="text-small text-(--color-text-secondary)">No sub-categories — items sit straight in the {label} folder.</p>
      )}

      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim()) run(() => addSubcategoryAction(category, name), () => setName("")); }}>
        <input className={inputCls} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder={`Add a sub-category of ${label}`} aria-label={`New ${label} sub-category`} />
        <Button type="submit" size="sm" variant="outline" disabled={pending || !name.trim()}><Plus className="h-4 w-4" aria-hidden /> Add</Button>
      </form>
    </section>
  );
}

function SubRow({ sub, run, pending }: {
  sub: Sub; pending: boolean;
  run: (fn: () => Promise<{ success: boolean; error?: string }>, ok?: () => void) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(sub.name);
  const save = () => { if (name.trim() === sub.name) { setEditing(false); return; } run(() => renameSubcategoryAction(sub.id, name), () => setEditing(false)); };

  return (
    <li className="flex items-center gap-2 px-3 py-2">
      {editing ? (
        <form className="flex flex-1 items-center gap-2" onSubmit={(e) => { e.preventDefault(); save(); }}>
          <input className={inputCls} value={name} maxLength={60} autoFocus onChange={(e) => setName(e.target.value)} aria-label="Name"
            onKeyDown={(e) => { if (e.key === "Escape") { setName(sub.name); setEditing(false); } }} />
          <button type="submit" disabled={pending} aria-label="Save" className="rounded-md p-1.5 text-(--color-success) hover:bg-(--color-surface-overlay)"><Check className="h-4 w-4" /></button>
          <button type="button" aria-label="Cancel" onClick={() => { setName(sub.name); setEditing(false); }} className="rounded-md p-1.5 text-(--color-text-secondary) hover:bg-(--color-surface-overlay)"><X className="h-4 w-4" /></button>
        </form>
      ) : (
        <>
          <span className="min-w-0 flex-1 break-words text-sm text-(--color-text-primary)">{sub.name}</span>
          <span className="shrink-0 text-small text-(--color-text-secondary)">{sub.items} {sub.items === 1 ? "item" : "items"}</span>
          <button type="button" aria-label={`Rename ${sub.name}`} onClick={() => setEditing(true)} className="rounded-md p-1.5 text-(--color-text-secondary) hover:bg-(--color-surface-overlay) hover:text-(--color-text-primary)"><Pencil className="h-4 w-4" /></button>
          <button type="button" aria-label={`Remove ${sub.name}`} disabled={pending}
            onClick={() => {
              const note = sub.items ? ` Its ${sub.items} ${sub.items === 1 ? "item stays" : "items stay"} in the folder, without a sub-category.` : "";
              if (confirm(`Remove ${sub.name}?${note}`)) run(() => deleteSubcategoryAction(sub.id));
            }}
            className="rounded-md p-1.5 text-(--color-danger) hover:bg-(--color-danger)/10"><Trash2 className="h-4 w-4" /></button>
        </>
      )}
    </li>
  );
}
