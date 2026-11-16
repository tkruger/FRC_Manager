"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

const SELECT = "h-10 rounded-md border border-(--color-border) bg-(--color-surface) px-2.5 text-sm text-(--color-text-primary) focus:border-(--color-primary) focus:outline-none focus:ring-2 focus:ring-(--color-primary)/20";

/** Search and filters for the All tab; every change goes into the URL (so it can be shared and survives Back) */
const SORT_OPTIONS = [
  { value: "submitted:desc", label: "Newest first" },
  { value: "submitted:asc",  label: "Oldest first" },
  { value: "total:desc",     label: "Biggest total" },
  { value: "total:asc",      label: "Smallest total" },
  { value: "title:asc",      label: "Name A–Z" },
  { value: "status:asc",     label: "By status" },
];

export function AllOrdersControls({ q, status, by, season, per, sort, dir, seasons, requesters }: {
  q: string; status: string; by: string; season: string; per: number; sort: string; dir: string;
  seasons: { id: string; name: string; active: boolean }[];
  requesters: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState(q);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sortKey = `${sort}:${dir}`;

  // Follow the URL when it changes elsewhere (Clear filters, Back)
  useEffect(() => { setText(q); }, [q]);

  const apply = (changes: Record<string, string>) => {
    const sp = new URLSearchParams(params.toString());
    sp.set("view", "all");
    for (const [k, v] of Object.entries(changes)) { if (v) sp.set(k, v); else sp.delete(k); }
    sp.delete("page"); // a new filter starts back at page 1
    startTransition(() => router.replace(`${pathname}?${sp.toString()}`, { scroll: false }));
  };
  const onText = (v: string) => {
    setText(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => apply({ q: v.trim() }), 350);
  };

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center" aria-busy={pending}>
      <div className="relative flex-1 min-w-56">
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--color-text-secondary)" />
        <input
          type="search"
          value={text}
          onChange={(e) => onText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { if (timer.current) clearTimeout(timer.current); apply({ q: text.trim() }); } }}
          placeholder="Search orders, items, vendors, part numbers…"
          aria-label="Search orders"
          className={`${SELECT} w-full pl-9 pr-9 [&::-webkit-search-cancel-button]:hidden`}
        />
        {text && (
          <button type="button" onClick={() => { setText(""); if (timer.current) clearTimeout(timer.current); apply({ q: "" }); }}
            aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-(--color-text-secondary) hover:text-(--color-text-primary)">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <select aria-label="Status" value={status} onChange={(e) => apply({ status: e.target.value })} className={SELECT}>
          <option value="">Any status</option>
          <option value="open">Open</option>
          <option value="closed">Done (received, denied, canceled)</option>
          <option value="SUBMITTED">Submitted</option>
          <option value="APPROVED">Approved</option>
          <option value="ORDERED">Ordered</option>
          <option value="PARTIAL_RECEIVED">Partially received</option>
          <option value="RECEIVED">Received</option>
          <option value="DENIED">Denied</option>
          <option value="CANCELLED">Canceled</option>
        </select>
        <select aria-label="Requested by" value={by} onChange={(e) => apply({ by: e.target.value })} className={SELECT}>
          <option value="">Anyone</option>
          {requesters.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        {seasons.length > 1 && (
          <select aria-label="Season" value={season} onChange={(e) => apply({ season: e.target.value })} className={SELECT}>
            {seasons.map((s) => <option key={s.id} value={s.active ? "" : s.id}>{s.name}{s.active ? " (this season)" : ""}</option>)}
            <option value="any">All seasons</option>
          </select>
        )}
        {/* Phones don't show every column header, so sorting goes here */}
        <select aria-label="Sort" value={sortKey} onChange={(e) => { const [s, d] = e.target.value.split(":"); apply({ sort: s, dir: d }); }} className={`${SELECT} sm:hidden`}>
          {!SORT_OPTIONS.some((o) => o.value === sortKey) && <option value={sortKey}>Sorted by column</option>}
          {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select aria-label="Orders per page" value={String(per)} onChange={(e) => apply({ per: e.target.value === "25" ? "" : e.target.value })} className={`${SELECT} hidden sm:block`}>
          <option value="25">25 per page</option>
          <option value="50">50 per page</option>
          <option value="100">100 per page</option>
        </select>
      </div>
    </div>
  );
}
