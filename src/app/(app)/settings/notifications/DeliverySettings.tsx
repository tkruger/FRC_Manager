"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { saveDeliverySettingsAction, setTeamTimezoneAction } from "@/app/actions/notification-settings";
import { toast } from "@/components/ui/toast";

interface Props {
  quietHoursStart:    number;
  quietHoursEnd:      number;
  timezone:           string | null;
  teamTimezone:       string | null;
  fallbackTimezone:   string;
  canSetTeamTimezone: boolean;
}

const selectCls =
  "rounded-md border border-(--color-border) bg-(--color-surface) text-(--color-text-primary) px-2.5 py-2 text-sm";

function hourLabel(h: number) {
  const suffix = h < 12 ? "AM" : "PM";
  return `${h % 12 === 0 ? 12 : h % 12}:00 ${suffix}`;
}

function zones(): string[] {
  try {
    return (Intl as unknown as { supportedValuesOf(k: string): string[] }).supportedValuesOf("timeZone");
  } catch {
    return [];
  }
}

export function DeliverySettings(p: Props) {
  const router = useRouter();
  const [start, setStart]   = useState(p.quietHoursStart);
  const [end, setEnd]       = useState(p.quietHoursEnd);
  const [tz, setTz]         = useState(p.timezone ?? "");
  const [teamTz, setTeamTz] = useState(p.teamTimezone ?? "");
  const [msg, setMsg]       = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, run]      = useTransition();
  const allZones = zones();
  const effectiveTeam = p.teamTimezone ?? p.fallbackTimezone;

  function save() {
    setMsg(null);
    run(async () => {
      const res = await saveDeliverySettingsAction({ quietHoursStart: start, quietHoursEnd: end, timezone: tz || null });
      setMsg(res.success ? null : { ok: false, text: res.error });
      if (res.success) toast.success("Notification settings saved");
      router.refresh();
    });
  }

  function saveTeam() {
    setMsg(null);
    run(async () => {
      const res = await setTeamTimezoneAction(teamTz);
      setMsg(res.success ? null : { ok: false, text: res.error });
      if (res.success) toast.success("Team time zone saved");
      router.refresh();
    });
  }

  return (
    <section className="card space-y-4">
      <div>
        <h2 className="text-h3 text-(--color-text-primary)">Quiet hours &amp; time zone</h2>
        <p className="text-small text-(--color-text-secondary) mt-0.5">
          No push notifications during quiet hours; reminders wait until they end. Emergency purchase
          requests and serious safety incidents still come through. Daily digests arrive around 8 AM.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1.5">
          <span className="block text-sm font-medium text-(--color-text-primary)">Quiet from</span>
          <select className={selectCls} value={start} onChange={(e) => setStart(Number(e.target.value))}>
            {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
          </select>
        </label>
        <label className="space-y-1.5">
          <span className="block text-sm font-medium text-(--color-text-primary)">until</span>
          <select className={selectCls} value={end} onChange={(e) => setEnd(Number(e.target.value))}>
            {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
          </select>
        </label>
        <label className="space-y-1.5 min-w-0 flex-1">
          <span className="block text-sm font-medium text-(--color-text-primary)">My time zone</span>
          <select className={`${selectCls} w-full`} value={tz} onChange={(e) => setTz(e.target.value)}>
            <option value="">Same as team ({effectiveTeam})</option>
            {allZones.map((z) => <option key={z} value={z}>{z}</option>)}
          </select>
        </label>
        <Button onClick={save} isLoading={pending}>Save</Button>
      </div>
      {start === end && <p className="text-small text-(--color-text-secondary)">Quiet hours are off.</p>}

      {p.canSetTeamTimezone && (
        <div className="pt-3 border-t border-(--color-border) space-y-2">
          <p className="text-sm font-medium text-(--color-text-primary)">Team time zone</p>
          <p className="text-small text-(--color-text-secondary)">
            Meeting times are in this zone, and it&apos;s the default for anyone who hasn&apos;t set their own.
          </p>
          <div className="flex flex-wrap gap-2">
            <select className={`${selectCls} min-w-0 flex-1`} value={teamTz} onChange={(e) => setTeamTz(e.target.value)}>
              {!p.teamTimezone && <option value="">Not set (using {p.fallbackTimezone})</option>}
              {allZones.map((z) => <option key={z} value={z}>{z}</option>)}
            </select>
            <Button variant="outline" onClick={saveTeam} disabled={pending || !teamTz || teamTz === p.teamTimezone}>
              Save team zone
            </Button>
          </div>
        </div>
      )}

      {msg && <p className={`text-sm ${msg.ok ? "text-(--color-success)" : "text-(--color-danger)"}`}>{msg.text}</p>}
    </section>
  );
}
