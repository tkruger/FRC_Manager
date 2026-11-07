"use client";

import { useState } from "react";
import { Select } from "@/components/ui/select";
import { CATEGORY_OPTIONS, DEFAULT_CATEGORY } from "@/lib/inventory/categories";

export interface SubcategoryOption { id: string; category: string; name: string }

/**
 * Category and (optional) sub-category for an item form — the sub-categories offered follow the
 * category. Sends `category` and `subcategoryId` (blank: none).
 */
export function CategoryFields({ subcategories, category, subcategoryId }: {
  subcategories: SubcategoryOption[]; category?: string; subcategoryId?: string | null;
}) {
  const [cat, setCat] = useState(category ?? DEFAULT_CATEGORY);
  const [sub, setSub] = useState(subcategoryId ?? "");
  const options = subcategories.filter((s) => s.category === cat).map((s) => ({ value: s.id, label: s.name }));
  return (
    <>
      <Select label="Category" name="category" options={[...CATEGORY_OPTIONS]} value={cat}
        onChange={(e) => { setCat(e.target.value); setSub(""); }} />
      <Select label="Sub-category" name="subcategoryId" options={options} value={options.some((o) => o.value === sub) ? sub : ""}
        onChange={(e) => setSub(e.target.value)} placeholder={options.length ? "None" : "None set up"} disabled={!options.length} />
    </>
  );
}
