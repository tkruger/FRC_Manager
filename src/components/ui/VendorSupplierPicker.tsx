"use client";

import { useState } from "react";
import { Field } from "./field";

interface Props {
  vendors:      { id: string; name: string }[];
  defaultValue?: string | null;
  required?:    boolean;
}

export function VendorSupplierPicker({ vendors, defaultValue, required }: Props) {
  // If defaultValue matches a known vendor name → pre-select it.
  // If it's a non-empty string that doesn't match → pre-select "other" and prefill.
  const knownNames = vendors.map((v) => v.name);
  const isOther    = !!defaultValue && !knownNames.includes(defaultValue);

  const [selected,   setSelected]   = useState(isOther ? "__other__" : (defaultValue ?? ""));
  const [customText, setCustomText] = useState(isOther ? (defaultValue ?? "") : "");

  // The value written to the hidden input — what the action reads
  const supplierValue = selected === "__other__" ? customText : selected;

  return (
    <div className="space-y-2">
      <label className="block">
        <span className="text-sm font-medium text-[--color-text-primary]">
          Preferred supplier{required && <span className="text-[--color-danger] ml-0.5">*</span>}
        </span>
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="mt-1 w-full rounded-lg border border-[--color-border] bg-[--color-surface] text-[--color-text-primary] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[--color-primary]/40 focus:border-[--color-primary]"
        >
          <option value="">— None —</option>
          {vendors.map((v) => (
            <option key={v.id} value={v.name}>{v.name}</option>
          ))}
          <option value="__other__">Other (write in…)</option>
        </select>
      </label>

      {selected === "__other__" && (
        <Field
          label="Supplier name"
          name="_supplierWriteIn"
          placeholder="e.g. AndyMark, REV Robotics…"
          defaultValue={customText}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomText(e.target.value)}
        />
      )}

      {/* Hidden field that the server action reads */}
      <input type="hidden" name="preferredSupplier" value={supplierValue} />
    </div>
  );
}
