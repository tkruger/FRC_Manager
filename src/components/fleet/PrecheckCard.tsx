"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { updatePrecheckAction } from "@/app/actions/safety";
import { PRECHECK_HOME, PRECHECK_STATUSES, PRECHECK_STATUS_INFO, isPrecheckUrl, type PrecheckStatusValue } from "@/lib/precheck";
import { formatDate } from "@/lib/utils";

export interface PrecheckRobot {
  id:          string;
  name:        string;
  url:         string | null;
  status:      PrecheckStatusValue;
  updatedAt:   string | null;
  updatedBy:   string | null;
}

const inputCls =
  "w-full rounded-md border border-(--color-border) bg-(--color-surface) text-(--color-text-primary) px-2.5 py-2 text-sm focus:border-(--color-primary) focus:outline-none";

/** One robot's official self-inspection: its PRECHECK link and where it stands. */
export function PrecheckCard({ robot, showName = true }: { robot: PrecheckRobot; showName?: boolean }) {
  const router = useRouter();
  const [url, setUrl]       = useState(robot.url ?? "");
  const [pending, start]    = useTransition();
  const info = PRECHECK_STATUS_INFO[robot.status];
  const urlChanged = url.trim() !== (robot.url ?? "");

  function save(input: { url?: string | null; status?: string }, done: string) {
    start(async () => {
      const res = await updatePrecheckAction(robot.id, input);
      if (!res.success) { toast.error(res.error); return; }
      toast.success(done);
      router.refresh();
    });
  }

  return (
    <div className="card space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {showName && <p className="text-sm font-semibold text-(--color-text-primary) truncate">{robot.name}</p>}
          <Badge variant={info.badge}>PRECHECK: {info.label}</Badge>
        </div>
        <a href={robot.url ?? PRECHECK_HOME} target="_blank" rel="noopener noreferrer">
          <Button type="button" variant="outline" size="sm">
            {robot.url ? "Open PRECHECK" : "Start PRECHECK"} <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </Button>
        </a>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <label className="block space-y-1.5">
          <span className="block text-small font-medium text-(--color-text-secondary)">PRECHECK link</span>
          <div className="flex gap-2">
            <input
              className={inputCls}
              type="url"
              inputMode="url"
              placeholder="https://precheck.frc.nexus/…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            {urlChanged && (
              <Button type="button" size="sm" isLoading={pending}
                disabled={!!url.trim() && !isPrecheckUrl(url)}
                onClick={() => save({ url: url.trim() || null }, url.trim() ? "PRECHECK link saved" : "PRECHECK link removed")}>
                Save
              </Button>
            )}
          </div>
        </label>
        <label className="block space-y-1.5">
          <span className="block text-small font-medium text-(--color-text-secondary)">Status</span>
          <select
            className={`${inputCls} sm:w-40`}
            value={robot.status}
            disabled={pending}
            onChange={(e) => save({ status: e.target.value }, `PRECHECK marked ${PRECHECK_STATUS_INFO[e.target.value as PrecheckStatusValue].label.toLowerCase()}`)}
          >
            {PRECHECK_STATUSES.map((s) => <option key={s} value={s}>{PRECHECK_STATUS_INFO[s].label}</option>)}
          </select>
        </label>
      </div>

      {url.trim() && !isPrecheckUrl(url) && (
        <p className="text-small text-(--color-danger)">That doesn&apos;t look like a PRECHECK link — it should start with https://precheck.frc.nexus/</p>
      )}
      {robot.updatedAt && (
        <p className="text-xs text-(--color-text-secondary)">
          Updated {formatDate(robot.updatedAt)}{robot.updatedBy && ` by ${robot.updatedBy}`}
        </p>
      )}
    </div>
  );
}
