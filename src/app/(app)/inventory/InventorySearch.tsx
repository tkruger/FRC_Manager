"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";

export function InventorySearch({ defaultValue }: { defaultValue?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const params = new URLSearchParams(searchParams.toString());
    if (e.target.value) {
      params.set("q", e.target.value);
    } else {
      params.delete("q");
    }
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <input
      type="search"
      defaultValue={defaultValue}
      onChange={handleChange}
      placeholder="Search items…"
      className="w-full sm:max-w-xs rounded-md border border-[--color-border] bg-[--color-surface] text-[--color-text-primary] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[--color-primary]/40 focus:border-[--color-primary]"
    />
  );
}
