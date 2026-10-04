"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { restoreWorkflowVersionAction } from "@/app/actions/workflows";

interface Version {
  id:        string;
  version:   number;
  isActive:  boolean;
  createdAt: string;
  createdBy: string | null;
  requests:  number;
}

export function VersionHistory({ versions, canEdit }: { versions: Version[]; canEdit: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function restore(id: string, version: number) {
    if (!confirm(`Restore version ${version}? It will be saved as a new version and used for new requests.`)) return;
    setError(null);
    start(async () => {
      const res = await restoreWorkflowVersionAction(id);
      if (!res.success) setError(res.error);
      router.refresh();
    });
  }

  return (
    <section className="card space-y-3">
      <div>
        <h2 className="text-h3 text-[--color-text-primary]">Version history</h2>
        <p className="text-small text-[--color-text-secondary]">
          Saving creates a new version. Requests keep following the version they started on.
        </p>
      </div>
      {error && <p className="text-sm text-[--color-danger]">{error}</p>}
      <ul className="divide-y divide-[--color-border]">
        {versions.map((v) => (
          <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-medium text-[--color-text-primary]">Version {v.version}</span>
              {v.isActive && <Badge variant="success">Active</Badge>}
              <span className="text-small text-[--color-text-secondary] truncate">
                {formatDate(new Date(v.createdAt))}{v.createdBy && ` · ${v.createdBy}`} · {v.requests} request{v.requests === 1 ? "" : "s"}
              </span>
            </div>
            {canEdit && !v.isActive && (
              <Button size="sm" variant="outline" disabled={pending} onClick={() => restore(v.id, v.version)}>
                Restore
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
