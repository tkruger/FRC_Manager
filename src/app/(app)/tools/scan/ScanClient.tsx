"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BarcodeScanner } from "@/components/ui/BarcodeScanner";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { checkoutToolAction, checkinToolAction } from "@/app/actions/tools";

interface ScannedTool {
  id: string;
  name: string;
  assetTag: string | null;
  condition: string;
  available: number;
  quantityOwned: number;
  checkouts: { id: string; quantity: number; user: { name: string } }[];
}

const CONDITION_OPTIONS = [
  { value: "EXCELLENT",    label: "Excellent — like new" },
  { value: "GOOD",         label: "Good — minor wear" },
  { value: "FAIR",         label: "Fair — noticeable wear" },
  { value: "NEEDS_REPAIR", label: "Needs repair" },
];

export function ScanClient() {
  const router = useRouter();
  const [scanning, setScanning]     = useState(true);
  const [tool, setTool]             = useState<ScannedTool | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionDone, setActionDone]   = useState<string | null>(null);
  const [checkinId, setCheckinId]     = useState<string | null>(null);
  const [returnCondition, setReturnCondition] = useState("GOOD");
  const [isPending, startTransition]  = useTransition();

  async function handleScan(code: string) {
    setScanning(false);
    setLookupError(null);
    try {
      const res = await fetch(`/api/tools/scan?code=${encodeURIComponent(code)}`);
      const data = await res.json();
      if (!res.ok) { setLookupError(data.error ?? "Tool not found."); return; }
      setTool(data);
    } catch {
      setLookupError("Network error — check your connection.");
    }
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
    setTool(null);
    setLookupError(null);
    setActionError(null);
    setActionDone(null);
    setCheckinId(null);
    setScanning(true);
  }

  // ── Done screen ──────────────────────────────────────────────────────────
  if (actionDone) {
    return (
      <div className="card text-center space-y-4">
        <div className="text-4xl">✅</div>
        <p className="text-body font-medium text-[--color-text-primary]">{actionDone}</p>
        <div className="flex gap-3 justify-center">
          <Button onClick={reset}>Scan another</Button>
          <Button variant="outline" onClick={() => router.push("/tools")}>Done</Button>
        </div>
      </div>
    );
  }

  // ── Scanner view ─────────────────────────────────────────────────────────
  if (scanning) {
    return (
      <div className="space-y-4">
        <BarcodeScanner onScan={handleScan} onClose={() => router.push("/tools")} />
        <p className="text-center text-small text-[--color-text-secondary]">
          QR codes should contain the tool&apos;s asset tag or ID.
          <br />
          <a href="/tools" className="text-[--color-secondary] hover:underline">Browse all tools instead →</a>
        </p>
      </div>
    );
  }

  // ── Lookup error ─────────────────────────────────────────────────────────
  if (lookupError) {
    return (
      <div className="card space-y-4">
        <div className="rounded-md bg-[--color-danger]/10 border border-[--color-danger]/20 px-4 py-3 text-sm text-[--color-danger]">
          {lookupError}
        </div>
        <Button onClick={reset} className="w-full">Try again</Button>
      </div>
    );
  }

  // ── Tool found — choose action ───────────────────────────────────────────
  if (tool) {
    return (
      <div className="space-y-4">
        {/* Tool summary */}
        <div className="card space-y-2">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-h3 text-[--color-text-primary]">{tool.name}</p>
              {tool.assetTag && <p className="text-mono text-[--color-text-secondary]">{tool.assetTag}</p>}
            </div>
            <Badge variant={tool.available > 0 ? "success" : "danger"}>
              {tool.available > 0 ? `${tool.available} available` : "All checked out"}
            </Badge>
          </div>
        </div>

        {actionError && (
          <div className="rounded-md bg-[--color-danger]/10 border border-[--color-danger]/20 px-4 py-3 text-sm text-[--color-danger]">
            {actionError}
          </div>
        )}

        {/* Check out */}
        {tool.available > 0 && !checkinId && (
          <div className="card space-y-3">
            <p className="text-h3 text-[--color-text-primary]">Check out</p>
            <form onSubmit={handleCheckout} className="space-y-3">
              <input type="hidden" name="quantity" value="1" />
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
        {tool.checkouts.length > 0 && (
          <div className="card space-y-3">
            <p className="text-h3 text-[--color-text-primary]">Check in</p>
            <div className="space-y-2">
              {tool.checkouts.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCheckinId(c.id)}
                  className={`w-full text-left rounded-md border px-4 py-3 transition-colors ${
                    checkinId === c.id
                      ? "border-[--color-primary] bg-[--color-primary]/8"
                      : "border-[--color-border] hover:border-[--color-primary]/50"
                  }`}
                >
                  <p className="text-sm font-medium text-[--color-text-primary]">
                    Checked out by {c.user.name}
                  </p>
                  <p className="text-small text-[--color-text-secondary]">
                    {c.quantity} unit{c.quantity !== 1 ? "s" : ""}
                  </p>
                </button>
              ))}
            </div>

            {checkinId && (
              <div className="space-y-3 pt-2 border-t border-[--color-border]">
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

        <Button variant="outline" onClick={reset} className="w-full">
          Scan a different tool
        </Button>
      </div>
    );
  }

  return null;
}
