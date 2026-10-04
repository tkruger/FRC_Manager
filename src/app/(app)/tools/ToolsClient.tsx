"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ToolDialog, type ToolTab } from "./ToolDialog";
import { CheckinButton } from "./CheckinButton";
import { CONDITION_BADGE, isAvailable, type ToolRow } from "./tool-helpers";

interface Props {
  tools:         ToolRow[];
  canEdit:       boolean;
  currentUserId: string;
  myCertNames:   string[];
  /** Server time (ms) — keeps rendering pure when marking overdue checkouts */
  now:           number;
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function ToolsClient({ tools, canEdit, currentUserId, myCertNames, now }: Props) {
  const [search, setSearch] = useState("");
  const [open, setOpen]     = useState<{ id: string; tab: ToolTab } | null>(null);

  const q = search.trim().toLowerCase();
  const displayed = q
    ? tools.filter((t) =>
        t.name.toLowerCase().includes(q) ||
        (t.assetTag ?? "").toLowerCase().includes(q) ||
        (t.homeLocation ?? "").toLowerCase().includes(q))
    : tools;

  // Identical tools (same name) are grouped under one card
  const groups = useMemo(() => {
    const map = new Map<string, ToolRow[]>();
    for (const t of displayed) {
      const key = t.name.trim().toLowerCase();
      map.set(key, [...(map.get(key) ?? []), t]);
    }
    return [...map.values()]
      .map((g) => g.sort((a, b) => (a.assetTag ?? "").localeCompare(b.assetTag ?? "", undefined, { numeric: true })))
      .sort((a, b) => a[0].name.localeCompare(b[0].name));
  }, [displayed]);

  const selected = open ? tools.find((t) => t.id === open.id) ?? null : null;

  return (
    <>
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name, tag or location…"
        className="w-full sm:max-w-sm rounded-md border border-(--color-border) bg-(--color-surface) text-(--color-text-primary) px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-(--color-primary)/40 focus:border-(--color-primary)"
      />

      {groups.length === 0 && (
        <div className="card text-center py-10 text-body text-(--color-text-secondary)">No tools match “{search}”.</div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {groups.map((group) => {
          const first = group[0];
          const free  = group.filter(isAvailable).length;
          return (
            <section key={first.id} className="card p-0 overflow-hidden">
              <header className="flex flex-wrap items-start justify-between gap-2 px-4 pt-4 pb-3 border-b border-(--color-border)">
                <div className="min-w-0">
                  <h3 className="text-h3 text-(--color-text-primary) truncate">{first.name}</h3>
                  <p className="text-small text-(--color-text-secondary)">
                    {first.toolType.replace(/_/g, " ").toLowerCase()}
                    {group.length > 1 ? ` · ${group.length} tools` : ""}
                    {first.homeLocation ? ` · ${first.homeLocation}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {first.requiresCertification && (
                    <Badge variant="warning">{first.certificationName ?? "Cert required"}</Badge>
                  )}
                  <Badge variant={free > 0 ? "success" : "danger"}>
                    {group.length === 1 ? (free ? "Available" : "Unavailable") : `${free} of ${group.length} available`}
                  </Badge>
                </div>
              </header>

              <ul className="divide-y divide-(--color-border)">
                {group.map((t) => {
                  const c = t.checkout;
                  const overdue = c && new Date(c.expectedReturn).getTime() < now;
                  const mine = c?.userId === currentUserId;
                  return (
                    <li key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5">
                      <button
                        onClick={() => setOpen({ id: t.id, tab: "details" })}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left group"
                      >
                        <span className="font-mono text-xs font-semibold text-(--color-secondary) group-hover:text-(--color-primary) whitespace-nowrap">
                          {t.assetTag ?? "no tag"}
                        </span>
                        <Badge variant={CONDITION_BADGE[t.condition] ?? "neutral"}>{t.condition.replace(/_/g, " ").toLowerCase()}</Badge>
                        <span className={`min-w-0 truncate text-small ${overdue ? "text-(--color-danger) font-medium" : "text-(--color-text-secondary)"}`}>
                          {c ? `${mine ? "You" : c.userName} · due ${shortDate(c.expectedReturn)}${overdue ? " (overdue)" : ""}` : ""}
                        </span>
                      </button>
                      <div className="flex gap-1.5">
                        {c ? (
                          (mine || canEdit) && <CheckinButton checkoutId={c.id} toolName={`${t.name} ${t.assetTag ?? ""}`.trim()} />
                        ) : isAvailable(t) ? (
                          <Button size="sm" variant="outline" onClick={() => setOpen({ id: t.id, tab: "checkout" })}>Check out</Button>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      {selected && open && (
        <ToolDialog
          key={selected.id}
          tool={selected}
          initialTab={open.tab}
          canEdit={canEdit}
          currentUserId={currentUserId}
          hasCert={!selected.requiresCertification || !selected.certificationName || myCertNames.includes(selected.certificationName)}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
}
