"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BarcodeScanner } from "@/components/ui/BarcodeScanner";
import { PageTitle } from "@/components/PageHeader";
import { groupKey, packProgress } from "@/lib/packing";
import {
  packScanAction, packToolAction, tickPackItemAction, setPackEntryLocationAction,
  unpackEntryAction, finishPackingAction, deletePackSessionAction,
} from "@/app/actions/packing";
import { useViewOnly } from "@/components/access/ViewOnly";

interface Item { id: string; toolName: string | null; label: string | null; quantity: number; notes: string | null }
interface Entry {
  id: string;
  itemId: string | null;
  tool: { id: string; name: string; assetTag: string | null } | null;
  location: { id: string; name: string } | null;
  packedBy: string | null;
  packedAt: string;
}
interface Tool { id: string; name: string; assetTag: string | null }
interface Location { id: string; name: string; code: string }

interface Props {
  sessionId: string;
  title: string;
  subtitle: string;
  finished: boolean;
  manager: boolean;
  items: Item[];
  entries: Entry[];
  tools: Tool[];
  locations: Location[];
}

type LogLine = { text: string; tone: "ok" | "info" | "error" };

const selectCls = "h-9 max-w-[11rem] rounded-md border border-(--color-border) bg-(--color-surface) text-(--color-text-primary) px-2 text-sm focus:outline-none focus:ring-2 focus:ring-(--color-primary)/40";

export function PackSessionClient({ sessionId, title, subtitle, finished: isFinished, manager, items, entries, tools, locations }: Props) {
  // View-only accounts see it as if packing were finished: nothing to tick, pack or unpack
  const viewOnly = useViewOnly();
  const finished = isFinished || viewOnly;
  const router = useRouter();
  const [scanning, setScanning] = useState(false);
  const [into, setInto]         = useState<string>("");
  const [log, setLog]           = useState<LogLine[]>([]);
  const [last, setLast]         = useState<{ entryId: string; label: string; hasLocation: boolean } | null>(null);
  const [error, setError]       = useState<string | null>(null);
  const [isPending, start]      = useTransition();

  const progress = packProgress(items, entries);
  const pct = progress.needed ? Math.round((progress.packed / progress.needed) * 100) : 0;

  // Entries by tool group, ticks by item, and tools packed that aren't on the list
  const { byGroup, ticks, extras, byLocation } = useMemo(() => {
    const byGroup = new Map<string, Entry[]>();
    const ticks = new Map<string, Entry>();
    for (const e of entries) {
      if (e.tool) byGroup.set(groupKey(e.tool.name), [...(byGroup.get(groupKey(e.tool.name)) ?? []), e]);
      if (e.itemId) ticks.set(e.itemId, e);
    }
    const listed = new Set(items.filter((i) => i.toolName).map((i) => groupKey(i.toolName!)));
    const extras = entries.filter((e) => e.tool && !listed.has(groupKey(e.tool.name)));
    const byLocation = new Map<string, Entry[]>();
    for (const e of entries) {
      const k = e.location?.name ?? "";
      byLocation.set(k, [...(byLocation.get(k) ?? []), e]);
    }
    return { byGroup, ticks, extras, byLocation };
  }, [entries, items]);

  const itemTitle = (id: string | null) => items.find((i) => i.id === id)?.label ?? "Item";
  const entryLabel = (e: Entry) => (e.tool ? `${e.tool.name}${e.tool.assetTag ? ` ${e.tool.assetTag}` : ""}` : itemTitle(e.itemId));

  function say(line: LogLine) {
    setLog((l) => [line, ...l].slice(0, 12));
  }

  async function onScan(code: string) {
    const res = await packScanAction(sessionId, code, into || null);
    if (!res.success) { say({ text: res.error, tone: "error" }); return; }

    if (res.kind === "location") {
      setInto(res.location.id);
      // "Scan a tool, then where it's going": the location also applies to the tool just scanned
      if (last && !last.hasLocation) {
        const r = await setPackEntryLocationAction(last.entryId, res.location.id);
        if (r.success) {
          say({ text: `${last.label} → ${res.location.name}`, tone: "ok" });
          setLast({ ...last, hasLocation: true });
        }
      }
      say({ text: `Packing into ${res.location.name}`, tone: "info" });
      return;
    }

    const label = `${res.tool.name}${res.tool.assetTag ? ` ${res.tool.assetTag}` : ""}`;
    setLast({ entryId: res.entryId, label, hasLocation: !!res.location });
    say({
      text: res.already
        ? res.location ? `${label} already packed — in ${res.location.name}` : `${label} already packed`
        : `✓ ${label}${res.location ? ` → ${res.location.name}` : " packed — scan a location to say where it went"}`,
      tone: res.already ? "info" : "ok",
    });
  }

  function act(p: () => Promise<{ success: boolean; error?: string }>) {
    setError(null);
    start(async () => {
      const res = await p();
      if (!res.success) setError(res.error ?? "Something went wrong.");
    });
  }

  function locationPicker(e: Entry) {
    return (
      <>
        {!finished && (
          <select aria-label="Where it went" className={`${selectCls} no-print`} value={e.location?.id ?? ""}
            onChange={(ev) => act(() => setPackEntryLocationAction(e.id, ev.target.value || null))}>
            <option value="">Where?</option>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        )}
        <span className={`${finished ? "" : "hidden print:inline"} text-small text-(--color-text-secondary)`}>{e.location?.name ?? "—"}</span>
      </>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <PageTitle help="tools">{title}</PageTitle>
          <p className="text-body text-(--color-text-secondary) mt-1">
            {subtitle}{isFinished && <> · <Badge variant="neutral">Finished</Badge></>}
          </p>
        </div>
        <div className="no-print flex flex-wrap gap-2 sm:justify-end">
          <Button variant="outline" size="sm" onClick={() => window.print()}>Print</Button>
          {manager && (
            <Button variant="outline" size="sm" isLoading={isPending}
              onClick={() => act(() => finishPackingAction(sessionId, !isFinished))}>
              {isFinished ? "Reopen" : "Finish packing"}
            </Button>
          )}
          {manager && (
            <Button variant="ghost" size="sm" className="text-(--color-danger)"
              onClick={() => { if (confirm("Delete this packing list and everything ticked on it?")) act(async () => { const r = await deletePackSessionAction(sessionId); if (r.success) router.push("/tools/pack"); return r; }); }}>
              Delete
            </Button>
          )}
        </div>
      </div>

      {/* Progress */}
      <div className="card space-y-2">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-h3 text-(--color-text-primary)">{progress.packed} of {progress.needed} packed</p>
          <p className="text-small text-(--color-text-secondary)">{entries.length} scanned or ticked</p>
        </div>
        <div className="h-2 rounded-full bg-(--color-surface-overlay) overflow-hidden">
          <div className={`h-full rounded-full ${progress.done ? "bg-(--color-success)" : "bg-(--color-primary)"}`} style={{ width: `${pct}%` }} />
        </div>
      </div>

      {error && <div className="rounded-md bg-(--color-danger)/10 border border-(--color-danger)/20 px-4 py-3 text-sm text-(--color-danger)">{error}</div>}

      {/* Scanning */}
      {!finished && (
        <div className="no-print card space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm font-medium text-(--color-text-primary)" htmlFor="pack-into">Packing into</label>
            <select id="pack-into" className={selectCls} value={into} onChange={(e) => setInto(e.target.value)}>
              <option value="">No location yet</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          {scanning ? (
            <BarcodeScanner continuous onScan={onScan} onClose={() => { setScanning(false); router.refresh(); }} closeLabel="Done scanning" />
          ) : (
            <Button className="w-full" onClick={() => setScanning(true)}>Scan tools</Button>
          )}
          <p className="text-small text-(--color-text-secondary)">
            Scan a location (tote, case) first and every tool after goes into it — or scan a tool, then where it&apos;s going.
            {locations.length === 0 && " Add locations under Tools → Locations to track where things go."}
          </p>
          {log.length > 0 && (
            <ul className="space-y-1 border-t border-(--color-border) pt-2">
              {log.map((l, i) => (
                <li key={i} className={`text-sm ${l.tone === "error" ? "text-(--color-danger)" : l.tone === "ok" ? "text-(--color-success)" : "text-(--color-text-secondary)"}`}>{l.text}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Checklist */}
      <section className="space-y-3">
        <h2 className="text-h2 text-(--color-text-primary)">Checklist</h2>
        {items.length === 0 ? (
          <p className="text-body text-(--color-text-secondary)">The master pack list is empty.</p>
        ) : (
          <ul className="card p-0 divide-y divide-(--color-border) print-break-inside-auto">
            {items.map((it) => {
              const have = progress.perItem.get(it.id) ?? 0;
              const done = have >= it.quantity;
              if (!it.toolName) {
                const tick = ticks.get(it.id);
                return (
                  <li key={it.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 break-inside-avoid">
                    <label className="flex min-w-0 flex-1 items-center gap-3">
                      <input type="checkbox" checked={!!tick} disabled={finished || isPending}
                        onChange={(e) => act(() => tickPackItemAction(sessionId, it.id, e.target.checked, into || null))} />
                      <span className="min-w-0">
                        <span className={`text-sm font-medium ${done ? "text-(--color-text-secondary) line-through" : "text-(--color-text-primary)"}`}>
                          {it.quantity > 1 && `${it.quantity} × `}{it.label}
                        </span>
                        {it.notes && <span className="block text-small text-(--color-text-secondary)">{it.notes}</span>}
                      </span>
                    </label>
                    {tick && locationPicker(tick)}
                  </li>
                );
              }

              const packed = byGroup.get(groupKey(it.toolName)) ?? [];
              const packedIds = new Set(packed.map((e) => e.tool!.id));
              const unpacked = tools.filter((t) => groupKey(t.name) === groupKey(it.toolName!) && !packedIds.has(t.id));
              return (
                <li key={it.id} className="px-4 py-3 space-y-2 break-inside-avoid">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="min-w-0 flex-1">
                      <span className="text-sm font-medium text-(--color-text-primary)">{it.toolName}</span>
                      {it.notes && <span className="block text-small text-(--color-text-secondary)">{it.notes}</span>}
                    </span>
                    <Badge variant={done ? "success" : have ? "warning" : "neutral"}>{have} / {it.quantity}</Badge>
                  </div>
                  {packed.length > 0 && (
                    <ul className="space-y-1.5 pl-3 border-l-2 border-(--color-border)">
                      {packed.map((e) => (
                        <li key={e.id} className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-(--color-secondary)">{e.tool!.assetTag ?? "no tag"}</span>
                          <span className="min-w-0 flex-1 text-small text-(--color-text-secondary)">{e.packedBy ? `by ${e.packedBy}` : ""}</span>
                          {locationPicker(e)}
                          {!finished && (
                            <button className="no-print text-small text-(--color-text-secondary) hover:text-(--color-danger)" onClick={() => act(() => unpackEntryAction(e.id))}>
                              Unpack
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  {!finished && unpacked.length > 0 && have < it.quantity && (
                    <select aria-label={`Pack a ${it.toolName} without scanning`} className={`${selectCls} no-print`} value=""
                      onChange={(e) => { const id = e.target.value; if (id) act(() => packToolAction(sessionId, id, into || null)); }}>
                      <option value="">+ Pack without scanning…</option>
                      {unpacked.map((t) => <option key={t.id} value={t.id}>{t.assetTag ?? t.name}</option>)}
                    </select>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {extras.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-h2 text-(--color-text-primary)">Also packed</h2>
          <ul className="card p-0 divide-y divide-(--color-border)">
            {extras.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5">
                <span className="min-w-0 flex-1 text-sm text-(--color-text-primary)">{entryLabel(e)}</span>
                {locationPicker(e)}
                {!finished && (
                  <button className="no-print text-small text-(--color-text-secondary) hover:text-(--color-danger)" onClick={() => act(() => unpackEntryAction(e.id))}>Unpack</button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* What's in each tote — handy at the event */}
      {entries.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-h2 text-(--color-text-primary)">By location</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {[...byLocation.entries()]
              .sort(([a], [b]) => (a ? (b ? a.localeCompare(b) : -1) : 1))
              .map(([name, list]) => (
                <div key={name || "none"} className="card space-y-1.5">
                  <p className="text-h3 text-(--color-text-primary)">{name || "Location not set"}</p>
                  <ul className="space-y-0.5">
                    {list.map((e) => <li key={e.id} className="text-sm text-(--color-text-secondary)">{entryLabel(e)}</li>)}
                  </ul>
                </div>
              ))}
          </div>
        </section>
      )}

    </div>
  );
}
