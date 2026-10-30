"use client";

import { useState } from "react";
import Link from "next/link";
import { getChangeHistoryAction } from "@/app/actions/history";
import { ENTITY_LABELS, historyHref, type HistoryEntry } from "@/lib/audit/history";
import type { EntityType } from "@/lib/audit/changes-types";

const ACTION_TEXT = { created: "created", updated: "changed", deleted: "deleted" } as const;

function when(iso: string) {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/** Change entries: who, when, and each field from → to */
export function ChangeEntries({ entries, showItem = false }: { entries: HistoryEntry[]; showItem?: boolean }) {
  return (
    <ol className="space-y-3">
      {entries.map((e) => {
        const href = showItem ? historyHref(e) : null;
        const name = e.entityId ? e.entityLabel : `${e.entityLabel} (schedule)`;
        return (
          <li key={e.id} className="text-sm break-inside-avoid">
            <p className="text-(--color-text-primary)">
              <span className="font-medium">{e.who ?? "System"}</span>
              <span className="text-(--color-text-secondary)"> {ACTION_TEXT[e.action] ?? e.action}</span>
              {showItem && (
                <>
                  <span className="text-(--color-text-secondary)"> {ENTITY_LABELS[e.entityType].toLowerCase()} </span>
                  {href ? <Link href={href} className="font-medium hover:text-(--color-primary) underline-offset-2 hover:underline">{name}</Link> : <span className="font-medium">{name}</span>}
                </>
              )}
              <span className="text-(--color-text-secondary)"> · {when(e.at)}</span>
            </p>
            {e.changes.length > 0 && (
              <ul className="mt-1 space-y-0.5 border-l-2 border-(--color-border) pl-3">
                {e.changes.map((c, i) => (
                  <li key={i} className="text-(--color-text-secondary) wrap-break-word">
                    <span className="text-(--color-text-primary)">{c.field}:</span>{" "}
                    <span className="line-through decoration-(--color-text-secondary)/60">{c.from}</span>
                    <span aria-label="changed to"> → </span>
                    <span className="text-(--color-text-primary)">{c.to}</span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** A collapsed "History" section that loads an item's changes when opened */
export function ChangeHistory({ entityType, entityId, className = "" }: { entityType: EntityType; entityId: string; className?: string }) {
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (entries) return;
    const res = await getChangeHistoryAction(entityType, entityId);
    if (res.success) setEntries(res.entries); else setError(res.error);
  }

  return (
    <details className={`group ${className}`} onToggle={(e) => { if ((e.currentTarget as HTMLDetailsElement).open) void load(); }}>
      <summary className="cursor-pointer select-none text-sm font-medium text-(--color-text-secondary) hover:text-(--color-text-primary) list-none flex items-center gap-1.5">
        <span aria-hidden className="inline-block transition-transform group-open:rotate-90">›</span>
        History
      </summary>
      <div className="mt-2">
        {error ? <p className="text-small text-(--color-danger)">{error}</p>
          : !entries ? <p className="text-small text-(--color-text-secondary)">Loading…</p>
          : entries.length === 0 ? <p className="text-small text-(--color-text-secondary)">No changes recorded yet. (Changes are kept for a year.)</p>
          : <ChangeEntries entries={entries} />}
      </div>
    </details>
  );
}
