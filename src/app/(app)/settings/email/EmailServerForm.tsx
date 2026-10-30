"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import { MAIL_PORTS, MAIL_PROVIDERS, PROVIDER_BY_ID, type MailSecurity } from "@/lib/email-providers";
import {
  removeEmailServerAction, saveEmailServerAction, sendTestEmailAction, setEmailServerEnabledAction,
} from "@/app/actions/email-server";

interface Saved {
  provider: string; host: string; port: number; security: MailSecurity;
  username: string; fromName: string | null; fromEmail: string; enabled: boolean;
  lastSentAt: string | null; lastError: string | null; lastErrorAt: string | null;
}

const inputCls = "h-10 w-full rounded-md border border-(--color-border) bg-(--color-surface) px-3 text-sm text-(--color-text-primary) focus:border-(--color-primary) focus:outline-none";
const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export function EmailServerForm({ saved, teamNumber }: { saved: Saved | null; teamNumber: number | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(!saved);
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState(() => ({
    provider: saved?.provider ?? "gmail",
    host: saved?.host ?? PROVIDER_BY_ID.gmail.host,
    port: saved?.port ?? PROVIDER_BY_ID.gmail.port,
    security: saved?.security ?? PROVIDER_BY_ID.gmail.security,
    username: saved?.username ?? "",
    password: "",
    fromName: saved?.fromName ?? (teamNumber ? `FRC Team ${teamNumber}` : ""),
    fromEmail: saved?.fromEmail ?? "",
  }));
  const provider = PROVIDER_BY_ID[f.provider] ?? PROVIDER_BY_ID.custom;
  const custom = f.provider === "custom";
  const set = (k: keyof typeof f, v: string | number) => setF((x) => ({ ...x, [k]: v }));

  function pickProvider(id: string) {
    const p = PROVIDER_BY_ID[id];
    setF((x) => ({ ...x, provider: id, ...(id === "custom" ? {} : { host: p.host, port: p.port, security: p.security }) }));
  }

  function act(fn: () => Promise<{ success: boolean; error?: string }>, done: string, after?: () => void) {
    setError(null);
    start(async () => {
      const res = await fn();
      if (!res.success) { setError(res.error ?? "Something went wrong."); return; }
      toast.success(done);
      after?.();
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {saved && !editing && (
        <section className="card space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-h3 text-(--color-text-primary)">Sending as</h2>
              <p className="text-sm text-(--color-text-primary) break-all">{saved.fromName ? `${saved.fromName} <${saved.fromEmail}>` : saved.fromEmail}</p>
              <p className="text-small text-(--color-text-secondary)">{PROVIDER_BY_ID[saved.provider]?.label ?? "Mail server"} · {saved.host}:{saved.port}</p>
            </div>
            <Badge variant={saved.enabled ? "success" : "neutral"}>{saved.enabled ? "In use" : "Paused — using FRC Manager's email"}</Badge>
          </div>
          {saved.lastError && (!saved.lastSentAt || (saved.lastErrorAt && saved.lastErrorAt > saved.lastSentAt)) && (
            <div className="rounded-md bg-(--color-danger)/10 px-3 py-2 text-sm text-(--color-danger)">
              Last problem{saved.lastErrorAt ? ` (${when(saved.lastErrorAt)})` : ""}: {saved.lastError} FRC Manager&apos;s email sent those messages instead.
            </div>
          )}
          {saved.lastSentAt && <p className="text-small text-(--color-text-secondary)">Last sent {when(saved.lastSentAt)}.</p>}
          {error && <p className="text-sm text-(--color-danger)">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" isLoading={pending} onClick={() => {
              setError(null);
              start(async () => {
                const res = await sendTestEmailAction();
                if (!res.success) { setError(res.error); router.refresh(); return; }
                toast.success(`Test email sent to ${res.to}`);
                router.refresh();
              });
            }}>Send me a test email</Button>
            <Button size="sm" variant="outline" disabled={pending} onClick={() => setEditing(true)}>Change settings</Button>
            <Button size="sm" variant="outline" disabled={pending}
              onClick={() => act(() => setEmailServerEnabledAction(!saved.enabled), saved.enabled ? "Paused — FRC Manager's email is used" : "The team's email is in use again")}>
              {saved.enabled ? "Pause" : "Resume"}
            </Button>
            <Button size="sm" variant="ghost" disabled={pending}
              onClick={() => { if (confirm("Remove the team's mail server? Emails will come from FRC Manager again.")) act(removeEmailServerAction, "Removed — emails come from FRC Manager", () => setEditing(true)); }}>
              Remove
            </Button>
          </div>
        </section>
      )}

      {editing && (
        <form className="card space-y-4" onSubmit={(e) => {
          e.preventDefault();
          act(() => saveEmailServerAction({ ...f, port: Number(f.port), password: f.password || undefined }), "Connected and saved", () => { setEditing(false); set("password", ""); });
        }}>
          <h2 className="text-h3 text-(--color-text-primary)">{saved ? "Change the mail server" : "Connect a mail account"}</h2>
          {error && <div className="rounded-md bg-(--color-danger)/10 px-3 py-2 text-sm text-(--color-danger)">{error}</div>}

          <label className="block space-y-1.5">
            <span className="block text-sm font-medium text-(--color-text-primary)">Email provider</span>
            <select className={inputCls} value={f.provider} onChange={(e) => pickProvider(e.target.value)}>
              {MAIL_PROVIDERS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </label>

          <div className={custom ? "grid gap-3 sm:grid-cols-[1fr_7rem_10rem]" : "hidden"}>
            <label className="block space-y-1.5">
              <span className="block text-sm font-medium text-(--color-text-primary)">Server</span>
              <input className={inputCls} value={f.host} onChange={(e) => set("host", e.target.value)} placeholder="smtp.example.com" required />
            </label>
            <label className="block space-y-1.5">
              <span className="block text-sm font-medium text-(--color-text-primary)">Port</span>
              <select className={inputCls} value={f.port} onChange={(e) => set("port", Number(e.target.value))}>
                {MAIL_PORTS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
            <label className="block space-y-1.5">
              <span className="block text-sm font-medium text-(--color-text-primary)">Security</span>
              <select className={inputCls} value={f.security} onChange={(e) => set("security", e.target.value)}>
                <option value="ssl">SSL/TLS</option>
                <option value="starttls">STARTTLS</option>
              </select>
            </label>
          </div>
          {!custom && <p className="text-small text-(--color-text-secondary)">Server {f.host}, port {f.port} ({f.security === "ssl" ? "SSL/TLS" : "STARTTLS"}).</p>}

          <label className="block space-y-1.5">
            <span className="block text-sm font-medium text-(--color-text-primary)">Username</span>
            <input className={inputCls} value={f.username} autoComplete="off" required placeholder="team1234@gmail.com"
              onChange={(e) => { const v = e.target.value; setF((x) => ({ ...x, username: v, fromEmail: !x.fromEmail || x.fromEmail === x.username ? v : x.fromEmail })); }} />
            <span className="block text-xs text-(--color-text-secondary)">Usually the full email address.</span>
          </label>
          <label className="block space-y-1.5">
            <span className="block text-sm font-medium text-(--color-text-primary)">Password</span>
            <input className={inputCls} type="password" value={f.password} autoComplete="new-password" required={!saved}
              placeholder={saved ? "Leave blank to keep the saved password" : ""} onChange={(e) => set("password", e.target.value)} />
            <span className="block text-xs text-(--color-text-secondary)">
              {provider.passwordHelp}{" "}
              {provider.helpUrl && <a href={provider.helpUrl} target="_blank" rel="noopener noreferrer" className="text-(--color-secondary) hover:underline">How to get one ↗</a>}
              {" "}It&apos;s stored encrypted and never shown again.
            </span>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="block text-sm font-medium text-(--color-text-primary)">From name</span>
              <input className={inputCls} value={f.fromName} onChange={(e) => set("fromName", e.target.value)} placeholder="FRC Team 1234" maxLength={100} />
            </label>
            <label className="block space-y-1.5">
              <span className="block text-sm font-medium text-(--color-text-primary)">From email</span>
              <input className={inputCls} type="email" value={f.fromEmail} onChange={(e) => set("fromEmail", e.target.value)} required />
            </label>
          </div>
          <p className="text-xs text-(--color-text-secondary)">The From email must be the account&apos;s own address or an alias it&apos;s allowed to send as (in Gmail: Settings → Accounts → Send mail as).</p>

          <div className="flex flex-wrap gap-2">
            <Button type="submit" isLoading={pending}>Connect and save</Button>
            {saved && <Button type="button" variant="ghost" disabled={pending} onClick={() => { setEditing(false); setError(null); }}>Cancel</Button>}
          </div>
          <p className="text-xs text-(--color-text-secondary)">Saving logs in to the server to check the settings; nothing is sent.</p>
        </form>
      )}
    </div>
  );
}
