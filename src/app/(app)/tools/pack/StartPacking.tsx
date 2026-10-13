"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { startPackingAction } from "@/app/actions/packing";

interface Competition { id: string; label: string; openSessionId: string | null; upcoming: boolean }

export function StartPacking({ competitions, disabled }: { competitions: Competition[]; disabled: boolean }) {
  const router = useRouter();
  const first = competitions.find((c) => c.upcoming) ?? competitions[0];
  const [compId, setCompId] = useState(first?.id ?? "");
  const [error, setError]   = useState<string | null>(null);
  const [isPending, start]  = useTransition();

  if (competitions.length === 0) {
    return <p className="text-small text-(--color-text-secondary)">Add competitions to the active season to start packing for them.</p>;
  }

  const picked = competitions.find((c) => c.id === compId);

  function go() {
    if (picked?.openSessionId) { router.push(`/tools/pack/${picked.openSessionId}`); return; }
    setError(null);
    start(async () => {
      const res = await startPackingAction(compId);
      if (res.success) router.push(`/tools/pack/${res.sessionId}`);
      else setError(res.error);
    });
  }

  return (
    <div className="card space-y-3">
      <p className="text-h3 text-(--color-text-primary)">Start packing</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="min-w-0 flex-1">
          <Select aria-label="Competition" options={competitions.map((c) => ({ value: c.id, label: c.label }))} value={compId} onChange={(e) => setCompId(e.target.value)} />
        </div>
        <Button onClick={go} isLoading={isPending} disabled={!compId || (disabled && !picked?.openSessionId)}>
          {picked?.openSessionId ? "Open packing" : "Start packing"}
        </Button>
      </div>
      {disabled && <p className="text-small text-(--color-text-secondary)">Add something to the master pack list first.</p>}
      {error && <p className="text-small text-(--color-danger)">{error}</p>}
    </div>
  );
}
