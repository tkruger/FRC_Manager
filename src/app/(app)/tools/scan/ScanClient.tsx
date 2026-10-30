"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BarcodeScanner } from "@/components/ui/BarcodeScanner";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { checkoutToolAction, checkinToolAction } from "@/app/actions/tools";
import { moveToolToLocationAction } from "@/app/actions/tool-locations";
import { useViewOnly } from "@/components/access/ViewOnly";

interface ScannedTool {
  kind: "tool";
  id: string;
  name: string;
  assetTag: string | null;
  condition: string;
  homeLocation: string | null;
  /** One physical tool: free to check out or not */
  available: boolean;
  checkouts: { id: string; user: { name: string } }[];
}

interface ScannedLocation {
  kind: "location";
  id: string;
  name: string;
  code: string;
  tools: { id: string; name: string; assetTag: string | null }[];
}

type Scanned = ScannedTool | ScannedLocation;

export interface LocationOption { id: string; name: string; code: string }

const CONDITION_OPTIONS = [
  { value: "EXCELLENT",    label: "Excellent — like new" },
  { value: "GOOD",         label: "Good — minor wear" },
  { value: "FAIR",         label: "Fair — noticeable wear" },
  { value: "NEEDS_REPAIR", label: "Needs repair" },
];

/**
 * What the camera is for right now:
 *  any      — first scan: a tool (check out / in, move) or a location
 *  where    — the next scan says where the scanned tool is going
 *  putAway  — keep scanning tools into a location
 */
type Mode = { kind: "any" } | { kind: "where"; tool: ScannedTool } | { kind: "putAway"; location: ScannedLocation };

async function lookup(code: string): Promise<Scanned | { error: string }> {
  try {
    const res = await fetch(`/api/tools/scan?code=${encodeURIComponent(code)}`);
    const data = await res.json();
    if (!res.ok) return { error: data.error ?? "Not found." };
    return data as Scanned;
  } catch {
    return { error: "Network error — check your connection." };
  }
}

export function ScanClient({ locations }: { locations: LocationOption[] }) {
  const router = useRouter();
  const [mode, setMode]             = useState<Mode | null>({ kind: "any" });
  const [found, setFound]           = useState<Scanned | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionDone, setActionDone]   = useState<string | null>(null);
  const [checkinId, setCheckinId]     = useState<string | null>(null);
  const [returnCondition, setReturnCondition] = useState("GOOD");
  const [moveTo, setMoveTo]           = useState("");
  const [putAwayLog, setPutAwayLog]   = useState<{ text: string; ok: boolean }[]>([]);
  const [isPending, startTransition]  = useTransition();
  const viewOnly = useViewOnly();

  const tool = found?.kind === "tool" ? found : null;
  const location = found?.kind === "location" ? found : null;

  async function handleScan(code: string) {
    const current = mode;
    if (current?.kind === "putAway") return putAwayScan(current.location, code);
    setMode(null);
    setLookupError(null);
    const data = await lookup(code);
    if ("error" in data) { setLookupError(data.error); return; }

    if (current?.kind === "where") {
      if (data.kind !== "location") { setLookupError(`That's a tool (${data.name}). Scan a location barcode to say where ${current.tool.name} is going.`); setFound(current.tool); return; }
      return move(current.tool, data.id, data.name);
    }
    setFound(data);
  }

  async function putAwayScan(loc: ScannedLocation, code: string) {
    const data = await lookup(code);
    if ("error" in data) { setPutAwayLog((l) => [{ text: data.error, ok: false }, ...l]); return; }
    if (data.kind !== "tool") { setPutAwayLog((l) => [{ text: `${data.name} is a location — scan tools to put in ${loc.name}.`, ok: false }, ...l]); return; }
    const res = await moveToolToLocationAction(data.id, loc.id);
    setPutAwayLog((l) => [{ text: res.success ? res.message ?? "Moved." : res.error, ok: res.success }, ...l]);
  }

  function move(t: ScannedTool, locationId: string, locationName: string) {
    setActionError(null);
    startTransition(async () => {
      const res = await moveToolToLocationAction(t.id, locationId);
      if (res.success) setActionDone(`✓ ${t.name}${t.assetTag ? ` ${t.assetTag}` : ""} is now in ${locationName}.`);
      else { setFound(t); setActionError(res.error); }
    });
  }

  function handleCheckout(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!tool) return;
    setActionError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await checkoutToolAction(tool.id, fd);
      if (result.success) setActionDone(`✓ ${tool.name} checked out successfully.`);
      else setActionError(result.error ?? "Checkout failed.");
    });
  }

  function handleCheckin() {
    if (!checkinId) return;
    setActionError(null);
    startTransition(async () => {
      const result = await checkinToolAction(checkinId, returnCondition);
      if (result.success) setActionDone(`✓ Tool returned successfully.`);
      else setActionError("Check-in failed.");
    });
  }

  function reset() {
    setFound(null);
    setLookupError(null);
    setActionError(null);
    setActionDone(null);
    setCheckinId(null);
    setMoveTo("");
    setPutAwayLog([]);
    setMode({ kind: "any" });
  }

  // ── Done screen ──────────────────────────────────────────────────────────
  if (actionDone) {
    return (
      <div className="card text-center space-y-4">
        <div className="text-4xl">✅</div>
        <p className="text-body font-medium text-(--color-text-primary)">{actionDone}</p>
        <div className="flex gap-3 justify-center">
          <Button onClick={reset}>Scan another</Button>
          <Button variant="outline" onClick={() => router.push("/tools")}>Done</Button>
        </div>
      </div>
    );
  }

  // ── Putting tools away into one location ────────────────────────────────
  if (mode?.kind === "putAway") {
    return (
      <div className="space-y-4">
        <div className="card">
          <p className="text-small text-(--color-text-secondary)">Putting tools in</p>
          <p className="text-h3 text-(--color-text-primary)">{mode.location.name}</p>
          <p className="text-mono text-small text-(--color-text-secondary)">{mode.location.code}</p>
        </div>
        <BarcodeScanner continuous onScan={handleScan} onClose={reset} closeLabel="Done" />
        {putAwayLog.length > 0 && (
          <ul className="card space-y-1.5">
            {putAwayLog.map((l, i) => (
              <li key={i} className={`text-sm ${l.ok ? "text-(--color-success)" : "text-(--color-danger)"}`}>{l.ok ? "✓ " : ""}{l.text}</li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  // ── Scanner view ─────────────────────────────────────────────────────────
  if (mode) {
    return (
      <div className="space-y-4">
        {mode.kind === "where" && (
          <div className="card">
            <p className="text-small text-(--color-text-secondary)">Scan the location barcode for where this is going</p>
            <p className="text-h3 text-(--color-text-primary)">{mode.tool.name} {mode.tool.assetTag && <span className="text-mono text-(--color-text-secondary)">{mode.tool.assetTag}</span>}</p>
          </div>
        )}
        <BarcodeScanner
          onScan={handleScan}
          onClose={() => (mode.kind === "where" ? (setFound(mode.tool), setMode(null)) : router.push("/tools"))}
        />
        {mode.kind === "any" && (
          <p className="text-center text-small text-(--color-text-secondary)">
            Scan a tool to check it out, return it or move it — or a location to put tools there.
            <br />
            <Link href="/tools" className="text-(--color-secondary) hover:underline">Browse all tools instead →</Link>
          </p>
        )}
      </div>
    );
  }

  // ── Lookup error ─────────────────────────────────────────────────────────
  if (lookupError && !found) {
    return (
      <div className="card space-y-4">
        <div className="rounded-md bg-(--color-danger)/10 border border-(--color-danger)/20 px-4 py-3 text-sm text-(--color-danger)">
          {lookupError}
        </div>
        <Button onClick={reset} className="w-full">Try again</Button>
      </div>
    );
  }

  // ── Location found ───────────────────────────────────────────────────────
  if (location) {
    return (
      <div className="space-y-4">
        <div className="card space-y-3">
          <div>
            <p className="text-small text-(--color-text-secondary)">Location</p>
            <p className="text-h3 text-(--color-text-primary)">{location.name}</p>
            <p className="text-mono text-small text-(--color-text-secondary)">{location.code}</p>
          </div>
          {location.tools.length > 0 ? (
            <ul className="divide-y divide-(--color-border) border-t border-(--color-border)">
              {location.tools.map((t) => (
                <li key={t.id} className="flex justify-between gap-3 py-1.5 text-sm">
                  <span className="text-(--color-text-primary)">{t.name}</span>
                  <span className="font-mono text-xs text-(--color-text-secondary)">{t.assetTag ?? ""}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-small text-(--color-text-secondary)">No tools live here yet.</p>
          )}
        </div>
        <Button className="w-full" onClick={() => { setPutAwayLog([]); setMode({ kind: "putAway", location }); }}>
          Scan tools to put here
        </Button>
        <Button variant="outline" onClick={reset} className="w-full">Scan something else</Button>
      </div>
    );
  }

  // ── Tool found — choose action ───────────────────────────────────────────
  if (tool) {
    return (
      <div className="space-y-4">
        {/* Tool summary */}
        <div className="card space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-h3 text-(--color-text-primary)">{tool.name}</p>
              {tool.assetTag && <p className="text-mono text-(--color-text-secondary)">{tool.assetTag}</p>}
              {tool.homeLocation && <p className="text-small text-(--color-text-secondary)">Lives in {tool.homeLocation}</p>}
            </div>
            <Badge variant={tool.available ? "success" : "danger"}>
              {tool.available ? "Available" : tool.checkouts.length ? "Checked out" : "Unavailable"}
            </Badge>
          </div>
        </div>

        {(actionError || lookupError) && (
          <div className="rounded-md bg-(--color-danger)/10 border border-(--color-danger)/20 px-4 py-3 text-sm text-(--color-danger)">
            {actionError ?? lookupError}
          </div>
        )}

        {/* Check out */}
        {tool.available && !checkinId && !viewOnly && (
          <div className="card space-y-3">
            <p className="text-h3 text-(--color-text-primary)">Check out</p>
            <form onSubmit={handleCheckout} className="space-y-3">
              <Field
                label="Return by"
                name="expectedReturn"
                type="date"
                required
                defaultValue={new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0]}
              />
              <Field label="Intended use" name="intendedUse" placeholder="What will you use it for?" />
              <Button type="submit" className="w-full" isLoading={isPending}>
                Check out {tool.name}
              </Button>
            </form>
          </div>
        )}

        {/* Check in — show each active checkout */}
        {tool.checkouts.length > 0 && !viewOnly && (
          <div className="card space-y-3">
            <p className="text-h3 text-(--color-text-primary)">Check in</p>
            <div className="space-y-2">
              {tool.checkouts.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCheckinId(c.id)}
                  className={`w-full text-left rounded-md border px-4 py-3 transition-colors ${
                    checkinId === c.id
                      ? "border-(--color-primary) bg-(--color-primary)/8"
                      : "border-(--color-border) hover:border-(--color-primary)/50"
                  }`}
                >
                  <p className="text-sm font-medium text-(--color-text-primary)">
                    Checked out by {c.user.name}
                  </p>
                  <p className="text-small text-(--color-text-secondary)">Tap to return it</p>
                </button>
              ))}
            </div>

            {checkinId && (
              <div className="space-y-3 pt-2 border-t border-(--color-border)">
                <Select
                  label="Return condition"
                  options={CONDITION_OPTIONS}
                  value={returnCondition}
                  onChange={(e) => setReturnCondition(e.target.value)}
                />
                <Button className="w-full" onClick={handleCheckin} isLoading={isPending}>
                  Confirm return
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Move — scan where it's going, or pick */}
        {locations.length > 0 && (
          <div className="card space-y-3">
            <p className="text-h3 text-(--color-text-primary)">Move it</p>
            <Button variant="secondary" className="w-full" onClick={() => { setLookupError(null); setMode({ kind: "where", tool }); }}>
              Scan where it&apos;s going
            </Button>
            <div className="flex gap-2">
              <div className="min-w-0 flex-1">
                <Select
                  aria-label="Location"
                  options={[{ value: "", label: "…or pick a location" }, ...locations.map((l) => ({ value: l.id, label: l.name }))]}
                  value={moveTo}
                  onChange={(e) => setMoveTo(e.target.value)}
                />
              </div>
              <Button
                variant="outline"
                disabled={!moveTo}
                isLoading={isPending && !!moveTo}
                onClick={() => { const l = locations.find((x) => x.id === moveTo); if (l) move(tool, l.id, l.name); }}
              >
                Move
              </Button>
            </div>
          </div>
        )}

        <Button variant="outline" onClick={reset} className="w-full">
          Scan something else
        </Button>
      </div>
    );
  }

  return null;
}
