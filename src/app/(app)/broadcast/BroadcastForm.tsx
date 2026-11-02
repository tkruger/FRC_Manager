"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { sendBroadcastAction } from "@/app/actions/broadcast";
import { BROADCAST_GROUPS } from "@/lib/broadcast-groups";

type Counts = Record<string, { people: number; emails: number }>;
interface Server { audience: "STUDENT" | "PARENT"; label: string; unavailable: string | null; channel: string | null; guild: string | null }

const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

function Check({ checked, onChange, disabled, children }: { checked: boolean; onChange: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <label className={`flex items-start gap-3 rounded-md border px-3 py-2 text-sm ${disabled ? "opacity-50" : "cursor-pointer hover:bg-(--color-surface-overlay)"} ${checked ? "border-(--color-primary)" : "border-(--color-border)"}`}>
      <input type="checkbox" className="mt-0.5 rounded" checked={checked} onChange={onChange} disabled={disabled} />
      <span className="min-w-0">{children}</span>
    </label>
  );
}

export function BroadcastForm({ counts, servers }: { counts: Counts; servers: Server[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [groups, setGroups] = useState<string[]>([]);
  const [emailGroups, setEmailGroups] = useState<string[]>([]);
  const [discord, setDiscord] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const people = groups.reduce((s, g) => s + (counts[g]?.people ?? 0), 0);
  const emails = emailGroups.reduce((s, g) => s + (counts[g]?.emails ?? 0), 0);
  const ready = title.trim() && body.trim() && (groups.length || emailGroups.length || discord.length);

  function send() {
    const parts = [
      groups.length && `${people} ${people === 1 ? "person" : "people"} in the app with a push notification`,
      emailGroups.length && `${emails} by email`,
      discord.length && `${discord.length} Discord server${discord.length === 1 ? "" : "s"}`,
    ].filter(Boolean);
    if (!confirm(`Send "${title.trim()}" to ${parts.join(", ")}?`)) return;
    setError(null);
    start(async () => {
      const res = await sendBroadcastAction({ title, body, groups, emailGroups, discord });
      if (!res.success) { setError(res.error); return; }
      const c = res.counts;
      toast.success(`Sent — ${c.inApp} in the app (${c.pushed} pushes), ${c.emailed} emails, ${c.discord} Discord post${c.discord === 1 ? "" : "s"}`);
      setTitle(""); setBody(""); setGroups([]); setEmailGroups([]); setDiscord([]);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {error && <div className="text-sm text-(--color-danger) bg-(--color-danger)/10 rounded px-3 py-2">{error}</div>}

      <section className="card space-y-4">
        <label className="block space-y-1.5">
          <span className="block text-sm font-medium text-(--color-text-primary)">Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="e.g. Build session moved to Saturday"
            className="h-10 w-full rounded-md border border-(--color-border) bg-(--color-surface) px-3 text-sm text-(--color-text-primary) focus:border-(--color-primary) focus:outline-none" />
        </label>
        <label className="block space-y-1.5">
          <span className="block text-sm font-medium text-(--color-text-primary)">Message</span>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={8} maxLength={4000}
            placeholder="What everyone needs to know…"
            className="w-full rounded-md border border-(--color-border) bg-(--color-surface) px-3 py-2 text-sm text-(--color-text-primary) focus:border-(--color-primary) focus:outline-none" />
          <span className="block text-small text-(--color-text-secondary)">
            The push shows the start; opening it shows the whole message. {body.length}/4000
          </span>
        </label>
      </section>

      <section className="card space-y-3">
        <div>
          <h2 className="text-h3 text-(--color-text-primary)">1. Who gets it in the app</h2>
          <p className="text-small text-(--color-text-secondary)">A notification and a push to their phones.</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {BROADCAST_GROUPS.map((g) => (
            <Check key={g.id} checked={groups.includes(g.id)} onChange={() => setGroups((l) => toggle(l, g.id))}>
              <b>{g.label}</b> <span className="text-(--color-text-secondary)">({counts[g.id]?.people ?? 0})</span>
              <span className="block text-xs text-(--color-text-secondary)">{g.hint}</span>
            </Check>
          ))}
        </div>
      </section>

      <section className="card space-y-3">
        <div>
          <h2 className="text-h3 text-(--color-text-primary)">2. Post on Discord</h2>
          <p className="text-small text-(--color-text-secondary)">In each server&apos;s announcements channel (or its general channel).</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {servers.map((s) => (
            <Check key={s.audience} checked={discord.includes(s.audience)} disabled={!!s.unavailable} onChange={() => setDiscord((l) => toggle(l, s.audience))}>
              <b>{s.label}</b>{s.guild && <span className="text-(--color-text-secondary)"> · {s.guild}</span>}
              <span className="block text-xs text-(--color-text-secondary)">{s.unavailable ?? s.channel}</span>
            </Check>
          ))}
        </div>
      </section>

      <section className="card space-y-3">
        <div>
          <h2 className="text-h3 text-(--color-text-primary)">3. Also email</h2>
          <p className="text-small text-(--color-text-secondary)">From the team&apos;s email if it&apos;s set up.</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {BROADCAST_GROUPS.map((g) => (
            <Check key={g.id} checked={emailGroups.includes(g.id)} onChange={() => setEmailGroups((l) => toggle(l, g.id))}>
              <b>{g.label}</b> <span className="text-(--color-text-secondary)">({counts[g.id]?.emails ?? 0} emails)</span>
            </Check>
          ))}
        </div>
      </section>

      <Button onClick={send} disabled={!ready} isLoading={pending}>Send broadcast</Button>
    </div>
  );
}
