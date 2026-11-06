"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import { saveFrcKeysAction } from "@/app/actions/frc-settings";

type Field = "tba" | "tbaSecret" | "nexus" | "nexusToken";

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

export function FrcSettingsForm({ sharedTbaKey, tbaKey, tbaSecret, nexusKey, nexusToken, tbaWebhook, nexusWebhookUrl, lastWebhookAt }: {
  sharedTbaKey: boolean;
  tbaKey: string | null; tbaSecret: string | null; nexusKey: string | null; nexusToken: string | null;
  tbaWebhook: { url: string; verificationCode: string | null };
  nexusWebhookUrl: string;
  lastWebhookAt: string | null;
}) {
  const router = useRouter();
  const [values, setValues] = useState({ tba: "", tbaSecret: "", nexus: "", nexusToken: "" });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (k: Field) => (v: string) => setValues((p) => ({ ...p, [k]: v }));
  const dirty = Object.values(values).some((v) => v.trim());

  const run = (fn: () => Promise<{ success: boolean; error?: string }>, done: string) => start(async () => {
    setError(null);
    const res = await fn();
    if (!res.success) { setError(res.error ?? "Couldn't save."); return; }
    toast.success(done);
    setValues({ tba: "", tbaSecret: "", nexus: "", nexusToken: "" });
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

        <div className="space-y-3 border-t border-(--color-border) pt-4">
          <p className="text-sm font-medium text-(--color-text-primary)">Webhook <span className="font-normal text-(--color-text-secondary)">(optional — instant updates)</span></p>
          <ol className="list-decimal space-y-3 pl-5 text-small text-(--color-text-secondary)">
            <li>
              In <a href="https://www.thebluealliance.com/account" target="_blank" rel="noopener noreferrer" className="text-(--color-secondary) hover:underline">myTBA → Account</a> → Webhooks, add a webhook with this URL:
              <div className="mt-1.5"><Copyable value={tbaWebhook.url} /></div>
            </li>
            <li>
              TBA sends a verification code to it. It shows here — refresh this page after adding the webhook — and you enter it back in myTBA.
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                {tbaWebhook.verificationCode
                  ? <div className="min-w-0 flex-1"><Copyable value={tbaWebhook.verificationCode} /></div>
                  : <span className="italic">No code yet.</span>}
                <Button type="button" size="sm" variant="outline" onClick={() => router.refresh()}>Check for code</Button>
              </div>
            </li>
            <li>
              Copy the <b>secret</b> myTBA shows for the webhook and paste it below — TBA signs every update with it.
            </li>
            <li>In myTBA, favorite your team with notifications on, so its updates are sent.</li>
          </ol>
          <KeyInput label="Webhook secret (from myTBA)" saved={tbaSecret} value={values.tbaSecret} onChange={set("tbaSecret")}
            onClear={() => clear("tbaSecret", "TBA webhook secret")}
            placeholder="Paste the secret myTBA made for this webhook"
            help={tbaSecret
              ? "Saved — updates signed with it are accepted. If you set this up before (when the app made the secret), paste the one myTBA shows to replace it."
              : "Until it's saved, only the verification code is accepted."} />
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
          onClick={() => run(() => saveFrcKeysAction({ tbaKey: values.tba, tbaSecret: values.tbaSecret, nexusKey: values.nexus, nexusToken: values.nexusToken }), "Saved")}>
          Save keys
        </Button>
      </div>
    </div>
  );
}
