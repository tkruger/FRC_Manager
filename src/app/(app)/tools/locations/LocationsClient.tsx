"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { createLocationAction, renameLocationAction, deleteLocationAction } from "@/app/actions/tool-locations";

interface Location { id: string; name: string; code: string; tools: number }

export function LocationsClient({ locations, canEdit }: { locations: Location[]; canEdit: boolean }) {
  const [name, setName]       = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [isPending, start]    = useTransition();

  function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await createLocationAction(name);
      if (res.success) setName("");
      else setError(res.error);
    });
  }

  function saveRename() {
    if (!editing) return;
    setError(null);
    start(async () => {
      const res = await renameLocationAction(editing.id, editing.name);
      if (res.success) setEditing(null);
      else setError(res.error);
    });
  }

  function remove(l: Location) {
    if (!confirm(`Delete ${l.name}? Its barcode stops working. Tools there keep "${l.name}" as their location text.`)) return;
    setError(null);
    start(async () => {
      const res = await deleteLocationAction(l.id);
      if (!res.success) setError(res.error);
    });
  }

  const input = "min-w-0 flex-1 rounded-md border border-(--color-border) bg-(--color-surface) text-(--color-text-primary) px-3 h-11 text-sm focus:outline-none focus:ring-2 focus:ring-(--color-primary)/40 focus:border-(--color-primary)";

  return (
    <div className="space-y-4">
      {canEdit && (
        <form onSubmit={add} className="card flex gap-2">
          <input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="New location, e.g. Red toolbox, Tote 3" maxLength={80} />
          <Button type="submit" disabled={!name.trim()} isLoading={isPending && !editing}>Add</Button>
        </form>
      )}

      {error && (
        <div className="rounded-md bg-(--color-danger)/10 border border-(--color-danger)/20 px-4 py-3 text-sm text-(--color-danger)">{error}</div>
      )}

      {locations.length === 0 ? (
        <div className="card text-center py-10 text-body text-(--color-text-secondary)">
          No locations yet.{canEdit ? " Add the places your tools live and the totes they travel in." : ""}
        </div>
      ) : (
        <ul className="card p-0 divide-y divide-(--color-border)">
          {locations.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
              {editing?.id === l.id ? (
                <div className="flex w-full gap-2">
                  <input className={input} value={editing.name} autoFocus onChange={(e) => setEditing({ id: l.id, name: e.target.value })} maxLength={80}
                    onKeyDown={(e) => { if (e.key === "Enter") saveRename(); if (e.key === "Escape") setEditing(null); }} />
                  <Button size="sm" onClick={saveRename} isLoading={isPending}>Save</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                </div>
              ) : (
                <>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-(--color-text-primary)">{l.name}</p>
                    <p className="text-small text-(--color-text-secondary)">
                      <span className="font-mono">{l.code}</span> · {l.tools} tool{l.tools === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Link href={`/tools/locations/labels?id=${l.id}`}><Button size="sm" variant="outline">Label</Button></Link>
                    {canEdit && <Button size="sm" variant="ghost" onClick={() => setEditing({ id: l.id, name: l.name })}>Rename</Button>}
                    {canEdit && <Button size="sm" variant="ghost" className="text-(--color-danger)" onClick={() => remove(l)}>Delete</Button>}
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
