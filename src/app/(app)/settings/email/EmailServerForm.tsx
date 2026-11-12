"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import { MAIL_PORTS, MAIL_PROVIDERS, PROVIDER_BY_ID, type MailSecurity } from "@/lib/email-providers";
import {
  removeEmailServerAction, saveEmailServerAction, saveGmailSenderAction, saveMailLimitsAction, saveServiceAccountAction,
  sendTestEmailAction, setEmailServerEnabledAction,
} from "@/app/actions/email-server";

interface Saved {
  provider: string;
  /** "smtp", "gmail_api" or "google_sa" */
  method: string;
  /** The Google account (or, for a service account, the one mailbox it sends as) */
  googleEmail: string | null;
  serviceAccountEmail: string | null;
  hourlyLimit: number; dailyLimit: number;
  usage: { hour: { used: number; resetsAt: string | null }; day: { used: number; resetsAt: string | null } };
  host: string | null; port: number | null; security: MailSecurity;
  username: string | null; fromName: string | null; fromEmail: string; enabled: boolean;
  lastSentAt: string | null; lastError: string | null; lastErrorAt: string | null;
}

const inputCls = "h-10 w-full rounded-md border border-(--color-border) bg-(--color-surface) px-3 text-sm text-(--color-text-primary) focus:border-(--color-primary) focus:outline-none";
const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export function EmailServerForm({ saved, teamNumber, googleAvailable, maxHourly, maxDaily }: {
  saved: Saved | null; teamNumber: number | null; googleAvailable: boolean; maxHourly: number; maxDaily: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(!saved);
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState(() => ({
    provider: saved?.provider ?? "gmail",
    host: saved?.host ?? "",
    port: saved?.port ?? 587,
    security: saved?.security ?? ("starttls" as MailSecurity),
    username: saved?.username ?? "",
    password: "",
    fromName: saved?.fromName ?? (teamNumber ? `FRC Team ${teamNumber}` : ""),
    fromEmail: saved?.fromEmail ?? "",
  }));
  const provider = PROVIDER_BY_ID[f.provider] ?? PROVIDER_BY_ID.custom;
  const custom = f.provider === "custom";
  const google = !!provider.google;
  const sa = !!provider.serviceAccount;
  const gmailSaved = saved?.method === "gmail_api";
  const saSaved = saved?.method === "google_sa";
  const googleSaved = gmailSaved || saSaved;
  // Service account form
  const [saKey, setSaKey] = useState("");
  const [saKeyName, setSaKeyName] = useState<string | null>(null);
  const [saSender, setSaSender] = useState(saSaved ? saved?.googleEmail ?? "" : "");
  const [limits, setLimits] = useState({ hourly: saved?.hourlyLimit ?? 250, daily: saved?.dailyLimit ?? 1000 });
  const [sender, setSender] = useState({ fromName: saved?.fromName ?? "", fromEmail: saved?.fromEmail ?? "" });
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
              <p className="text-small text-(--color-text-secondary)">
                {saSaved ? `Google Workspace service account ${saved.serviceAccountEmail ?? ""}, sending as ${saved.googleEmail}`
                  : gmailSaved ? `Gmail, connected with Google as ${saved.googleEmail ?? saved.fromEmail}`
                  : `${PROVIDER_BY_ID[saved.provider]?.label ?? "Mail server"} · ${saved.host}:${saved.port}`}
              </p>
            </div>
            <Badge variant={saved.enabled ? "success" : "neutral"}>{saved.enabled ? "In use" : "Paused — team emails aren't sent"}</Badge>
          </div>
          {saved.lastError && (!saved.lastSentAt || (saved.lastErrorAt && saved.lastErrorAt > saved.lastSentAt)) && (
            <div className="rounded-md bg-(--color-danger)/10 px-3 py-2 text-sm text-(--color-danger)">
              Last problem{saved.lastErrorAt ? ` (${when(saved.lastErrorAt)})` : ""}: {saved.lastError} Those emails weren&apos;t sent.
            </div>
          )}
          {saved.lastSentAt && <p className="text-small text-(--color-text-secondary)">Last sent {when(saved.lastSentAt)}.</p>}
          {googleSaved && (
            <form className="grid gap-3 border-t border-(--color-border) pt-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end" onSubmit={(e) => {
              e.preventDefault();
              act(() => saveGmailSenderAction(sender), "Sender saved");
            }}>
              <label className="block space-y-1.5">
                <span className="block text-sm font-medium text-(--color-text-primary)">From name</span>
                <input className={inputCls} value={sender.fromName} onChange={(e) => setSender((x) => ({ ...x, fromName: e.target.value }))} maxLength={100} placeholder="FRC Team 1234" />
              </label>
              <label className="block space-y-1.5">
                <span className="block text-sm font-medium text-(--color-text-primary)">From email</span>
                <input className={inputCls} type="email" value={sender.fromEmail} onChange={(e) => setSender((x) => ({ ...x, fromEmail: e.target.value }))} required />
              </label>
              <Button type="submit" size="sm" variant="outline" disabled={pending}>Save sender</Button>
              <p className="text-xs text-(--color-text-secondary) sm:col-span-3">
                The account&apos;s own address, or an alias it can send as (Gmail → Settings → Accounts → Send mail as).
              </p>
            </form>
          )}
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
            <Button size="sm" variant="outline" disabled={pending} onClick={() => setEditing(true)}>{saSaved ? "Change key or mailbox" : gmailSaved ? "Change account" : "Change settings"}</Button>
            <Button size="sm" variant="outline" disabled={pending}
              onClick={() => act(() => setEmailServerEnabledAction(!saved.enabled), saved.enabled ? "Paused — team emails aren't sent until you resume" : "The team's email is in use again")}>
              {saved.enabled ? "Pause" : "Resume"}
            </Button>
            <Button size="sm" variant="danger" disabled={pending}
              onClick={() => { if (confirm("Remove the team's email? Team emails stop until it's set up again.")) act(removeEmailServerAction, "Removed — team emails are off", () => setEditing(true)); }}>
              Remove
            </Button>
          </div>
        </section>
      )}

      {saved && (
        <section className="card space-y-3">
          <div>
            <h2 className="text-h3 text-(--color-text-primary)">Sending limits</h2>
            <p className="text-small text-(--color-text-secondary)">
              A guard against misuse: past either limit, no more team emails go out until it resets, and Head Mentors and Integration Admins are told.
            </p>
          </div>
          <p className="text-sm text-(--color-text-primary)">
            This hour: <b>{saved.usage.hour.used}</b> of {saved.hourlyLimit} · Last day: <b>{saved.usage.day.used}</b> of {saved.dailyLimit}
          </p>
          <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); act(() => saveMailLimitsAction(limits), "Limits saved"); }}>
            <label className="block space-y-1.5">
              <span className="block text-sm font-medium text-(--color-text-primary)">Per hour</span>
              <input className={`${inputCls} w-28`} type="number" min={1} max={maxHourly} value={limits.hourly} onChange={(e) => setLimits((x) => ({ ...x, hourly: Number(e.target.value) }))} />
            </label>
            <label className="block space-y-1.5">
              <span className="block text-sm font-medium text-(--color-text-primary)">Per day</span>
              <input className={`${inputCls} w-28`} type="number" min={1} max={maxDaily} value={limits.daily} onChange={(e) => setLimits((x) => ({ ...x, daily: Number(e.target.value) }))} />
            </label>
            <Button type="submit" size="sm" variant="outline" disabled={pending}>Save limits</Button>
          </form>
        </section>
      )}

      {editing && (
        <form className="card space-y-4" onSubmit={(e) => {
          e.preventDefault();
          if (google) return;
          if (sa) {
            act(() => saveServiceAccountAction({ key: saKey || undefined, sender: saSender, fromName: f.fromName, fromEmail: f.fromEmail || undefined }),
              "Checked with Google and saved", () => { setEditing(false); setSaKey(""); setSaKeyName(null); });
            return;
          }
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

          {sa ? (
            <div className="space-y-4">
              <p className="rounded-md bg-(--color-surface-overlay) p-3 text-sm text-(--color-text-primary)">
                For a Google Workspace: a service account with <b>domain-wide delegation</b> for <code>gmail.send</code> only, sending as one mailbox
                (for example <code>notifications@</code>). <a href="/help/integrations#workspace" className="text-(--color-secondary) hover:underline">How to set it up</a>
              </p>
              <label className="block space-y-1.5">
                <span className="block text-sm font-medium text-(--color-text-primary)">Key file</span>
                <input type="file" accept=".json,application/json,text/plain" className="block w-full text-sm text-(--color-text-secondary)"
                  onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; setSaKey(await file.text()); setSaKeyName(file.name); }} />
                <textarea className="w-full rounded-md border border-(--color-border) bg-(--color-surface) px-3 py-2 font-mono text-xs text-(--color-text-primary) focus:border-(--color-primary) focus:outline-none"
                  rows={3} value={saKeyName ? "" : saKey} onChange={(e) => { setSaKey(e.target.value); setSaKeyName(null); }} disabled={!!saKeyName}
                  placeholder={saKeyName ? `${saKeyName} chosen` : saSaved ? "Or paste the JSON (or its base64) — leave empty to keep the saved key" : "Or paste the JSON, or the same JSON base64-encoded"} />
                <span className="block text-xs text-(--color-text-secondary)">Stored encrypted and never shown again.</span>
              </label>
              <label className="block space-y-1.5">
                <span className="block text-sm font-medium text-(--color-text-primary)">Send as (Workspace mailbox)</span>
                <input className={inputCls} type="email" required value={saSender} onChange={(e) => setSaSender(e.target.value)} placeholder="notifications@yourteam.org" />
                <span className="block text-xs text-(--color-text-secondary)">FRC Manager only ever sends as this mailbox.</span>
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1.5">
                  <span className="block text-sm font-medium text-(--color-text-primary)">From name</span>
                  <input className={inputCls} value={f.fromName} onChange={(e) => set("fromName", e.target.value)} placeholder="FRC Team 1234" maxLength={100} />
                </label>
                <label className="block space-y-1.5">
                  <span className="block text-sm font-medium text-(--color-text-primary)">From email <span className="font-normal text-(--color-text-secondary)">(optional alias)</span></span>
                  <input className={inputCls} type="email" value={f.fromEmail} onChange={(e) => set("fromEmail", e.target.value)} placeholder="The mailbox itself" />
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" isLoading={pending}>Check and save</Button>
                {saved && <Button type="button" variant="outline" disabled={pending} onClick={() => { setEditing(false); setError(null); }}>Cancel</Button>}
              </div>
              <p className="text-xs text-(--color-text-secondary)">Saving asks Google for permission to send as the mailbox; nothing is sent.</p>
            </div>
          ) : google ? (
            <div className="space-y-3 rounded-md bg-(--color-surface-overlay) p-3">
              <p className="text-sm text-(--color-text-primary)">
                Sign in with the team&apos;s Google account and allow FRC Manager to <b>send email</b> as it — nothing else (it can&apos;t read the mailbox).
                Works with Gmail and Google Workspace accounts.
              </p>
              {googleAvailable
                ? <a href="/api/integrations/gmail/start" className="inline-flex h-10 items-center gap-2 rounded-md bg-(--color-primary) px-4 text-sm font-semibold text-white hover:opacity-90">Connect with Google</a>
                : <p className="text-sm text-(--color-danger)">Google sign-in isn&apos;t set up for this site yet (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).</p>}
              {saved && <Button type="button" variant="outline" disabled={pending} onClick={() => { setEditing(false); setError(null); }}>Cancel</Button>}
            </div>
          ) : (<>
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
            {saved && <Button type="button" variant="outline" disabled={pending} onClick={() => { setEditing(false); setError(null); }}>Cancel</Button>}
          </div>
          <p className="text-xs text-(--color-text-secondary)">Saving logs in to the server to check the settings; nothing is sent.</p>
          </>)}
        </form>
      )}
    </div>
  );
}
