"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import { newTbaWebhookSecretAction, removeTbaWebhookAction, saveFrcKeysAction } from "@/app/actions/frc-settings";

type Field = "tba" | "nexus" | "nexusToken";

function Copyable({ value }: { value: string }) {
  return (
    <div className="flex items-center gap-2">
      <code className="min-w-0 flex-1 truncate rounded bg-(--color-surface-overlay) px-2 py-1.5 text-xs text-(--color-text-primary)">{value}</code>
      <Button type="button" size="sm" variant="outline"
        onClick={() => navigator.clipboard.writeText(value).then(() => toast.success("Copied"), () => toast.error("Couldn't copy"))}>
        Copy
      </Button>
    </div>
  );
}

function KeyInput({ label, help, saved, value, onChange, onClear, placeholder }: {
  label: string; help: React.ReactNode; saved: string | null; value: string; placeholder: string;
  onChange: (v: string) => void; onClear: () => void;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="flex items-center justify-between gap-2 text-sm font-medium text-(--color-text-primary)">
        {label}
        {saved && (
          <span className="flex items-center gap-2 text-xs font-normal text-(--color-text-secondary)">
            Saved ({saved})
            <button type="button" onClick={onClear} className="text-(--color-danger) hover:underline">Remove</button>
          </span>
        )}
      </span>
      <input type="password" autoComplete="off" value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={saved ? "Leave blank to keep the saved one" : placeholder}
        className="h-10 w-full rounded-md border border-(--color-border) bg-(--color-surface) px-3 text-sm text-(--color-text-primary) focus:border-(--color-primary) focus:outline-none" />
      <span className="block text-small text-(--color-text-secondary)">{help}</span>
    </label>
  );
}

export function FrcSettingsForm({ sharedTbaKey, tbaKey, nexusKey, nexusToken, tbaWebhook, nexusWebhookUrl, lastWebhookAt }: {
  sharedTbaKey: boolean;
  tbaKey: string | null; nexusKey: string | null; nexusToken: string | null;
  tbaWebhook: { url: string; secret: string | null; verificationCode: string | null };
  nexusWebhookUrl: string;
  lastWebhookAt: string | null;
}) {
  const router = useRouter();
  const [values, setValues] = useState({ tba: "", nexus: "", nexusToken: "" });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (k: Field) => (v: string) => setValues((p) => ({ ...p, [k]: v }));
  const dirty = Object.values(values).some((v) => v.trim());

  const run = (fn: () => Promise<{ success: boolean; error?: string }>, done: string) => start(async () => {
    setError(null);
    const res = await fn();
    if (!res.success) { setError(res.error ?? "Couldn't save."); return; }
    toast.success(done);
    setValues({ tba: "", nexus: "", nexusToken: "" });
    router.refresh();
  });
  const clear = (k: Field, what: string) => {
    if (confirm(`Remove the saved ${what}?`)) run(() => saveFrcKeysAction({ clear: [k] }), `${what[0].toUpperCase()}${what.slice(1)} removed`);
  };

  return (
    <div className="space-y-6">
      {error && <div className="text-sm text-(--color-danger) bg-(--color-danger)/10 rounded px-3 py-2">{error}</div>}

      {/* ── The Blue Alliance ── */}
      <section className="card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-h3 text-(--color-text-primary)">The Blue Alliance</h2>
          {tbaKey ? <Badge variant="success">Your key</Badge> : sharedTbaKey ? <Badge variant="info">Using the app&apos;s shared key</Badge> : <Badge variant="neutral">Not set up</Badge>}
        </div>
        <KeyInput label="Read API key" saved={tbaKey} value={values.tba} onChange={set("tba")} onClear={() => clear("tba", "TBA key")}
          placeholder="Paste your TBA Read API key"
          help={<>Free: sign in at <a href="https://www.thebluealliance.com/account" target="_blank" rel="noopener noreferrer" className="text-(--color-secondary) hover:underline">thebluealliance.com/account</a> → Read API Keys → add one.{!tbaKey && sharedTbaKey && " Until you add one, the app's shared key is used."}</>} />

        <div className="space-y-2 border-t border-(--color-border) pt-4">
          <p className="text-sm font-medium text-(--color-text-primary)">Webhook <span className="font-normal text-(--color-text-secondary)">(optional — instant updates)</span></p>
          {tbaWebhook.secret ? (
            <>
              <p className="text-small text-(--color-text-secondary)">
                In <a href="https://www.thebluealliance.com/account" target="_blank" rel="noopener noreferrer" className="text-(--color-secondary) hover:underline">myTBA → Account</a> → Webhooks,
                add a webhook with this URL and secret, then favorite your team (with notifications on) in myTBA.
              </p>
              <span className="block text-xs text-(--color-text-secondary)">URL</span>
              <Copyable value={tbaWebhook.url} />
              <span className="block text-xs text-(--color-text-secondary)">Secret</span>
              <Copyable value={tbaWebhook.secret} />
              {tbaWebhook.verificationCode
                ? <><span className="block text-xs text-(--color-text-secondary)">Verification code from TBA — paste it back into myTBA to finish</span><Copyable value={tbaWebhook.verificationCode} /></>
                : <p className="text-small text-(--color-text-secondary)">After you add it, TBA sends a verification code — refresh this page to see it here.</p>}
              <div className="flex flex-wrap gap-2 pt-1">
                <Button type="button" size="sm" variant="outline" disabled={pending}
                  onClick={() => confirm("Make a new secret? The webhook in myTBA stops working until you update it.") && run(newTbaWebhookSecretAction, "New secret made")}>
                  New secret
                </Button>
                <Button type="button" size="sm" variant="ghost" disabled={pending}
                  onClick={() => confirm("Stop accepting TBA webhook messages?") && run(removeTbaWebhookAction, "Webhook turned off")}>
                  Turn off
                </Button>
              </div>
            </>
          ) : (
            <Button type="button" size="sm" variant="outline" isLoading={pending} onClick={() => run(newTbaWebhookSecretAction, "Webhook ready")}>
              Set up a TBA webhook
            </Button>
          )}
        </div>
      </section>

      {/* ── FRC Nexus ── */}
      <section className="card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-h3 text-(--color-text-primary)">FRC Nexus</h2>
          {nexusKey ? <Badge variant="success">Connected</Badge> : <Badge variant="neutral">Not set up</Badge>}
        </div>
        <p className="text-small text-(--color-text-secondary)">
          &quot;Now queuing&quot; alerts at events that use Nexus. Without it, the next-match alert comes about 20 minutes before the
          match&apos;s predicted time.
        </p>
        <KeyInput label="API key" saved={nexusKey} value={values.nexus} onChange={set("nexus")} onClear={() => clear("nexus", "Nexus key")}
          placeholder="Paste your Nexus API key"
          help={<>Get one at <a href="https://frc.nexus/api" target="_blank" rel="noopener noreferrer" className="text-(--color-secondary) hover:underline">frc.nexus/api</a>.</>} />
        <div className="space-y-2 border-t border-(--color-border) pt-4">
          <p className="text-sm font-medium text-(--color-text-primary)">Webhook <span className="font-normal text-(--color-text-secondary)">(optional — instant &quot;Now queuing&quot;)</span></p>
          <p className="text-small text-(--color-text-secondary)">Register this URL at frc.nexus/api for your team number, then paste the token Nexus gives you below.</p>
          <Copyable value={nexusWebhookUrl} />
        </div>
        <KeyInput label="Webhook token" saved={nexusToken} value={values.nexusToken} onChange={set("nexusToken")} onClear={() => clear("nexusToken", "Nexus webhook token")}
          placeholder="Paste the token from Nexus" help="Nexus sends it with each update, so the app knows it's really Nexus." />
      </section>

      {lastWebhookAt && (
        <p className="text-small text-(--color-text-secondary)">Last webhook message: {new Date(lastWebhookAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</p>
      )}

      <div className="flex gap-2">
        <Button type="button" disabled={!dirty} isLoading={pending}
          onClick={() => run(() => saveFrcKeysAction({ tbaKey: values.tba, nexusKey: values.nexus, nexusToken: values.nexusToken }), "Saved")}>
          Save keys
        </Button>
      </div>
    </div>
  );
}
