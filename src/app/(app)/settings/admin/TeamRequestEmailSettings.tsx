"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { saveTeamRequestEmailAction, sendTeamRequestTestEmailAction } from "@/app/actions/admin";

type Settings = { subject: string; body: string; autoSend: boolean };

const FIELD = "w-full rounded-md border border-(--color-border) bg-(--color-surface) px-3 py-2 text-sm text-(--color-text-primary) focus:border-(--color-primary) focus:outline-none focus:ring-2 focus:ring-(--color-primary)/20";

/** Super admins edit the Head Mentor check email sent to whoever registers a new team */
export function TeamRequestEmailSettings({ saved, defaults, placeholders }: {
  saved: Settings;
  defaults: Settings;
  placeholders: readonly { key: string; help: string }[];
}) {
  const router = useRouter();
  const [form, setForm] = useState<Settings>(saved);
  const [open, setOpen] = useState(false);
  const [saving, startSave] = useTransition();
  const [testing, startTest] = useTransition();
  const changed = form.subject !== saved.subject || form.body !== saved.body || form.autoSend !== saved.autoSend;
  const isDefault = form.subject === defaults.subject && form.body === defaults.body;

  function save() {
    startSave(async () => {
      const res = await saveTeamRequestEmailAction(form);
      if (!res.success) { toast.error(res.error); return; }
      toast.success(res.message ?? "Saved");
      router.refresh();
    });
  }
  function test() {
    startTest(async () => {
      const res = await sendTeamRequestTestEmailAction({ subject: form.subject, body: form.body });
      if (!res.success) { toast.error(res.error); return; }
      toast.success(res.message ?? "Test sent");
    });
  }

  return (
    <section className="card space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-h3 text-(--color-text-primary)">Head Mentor check email</h2>
          <p className="text-small text-(--color-text-secondary)">
            Asks whoever registers a new team if they&apos;re its Head Mentor. Super admins are on CC and get the replies.
            {" "}{saved.autoSend ? "Sent automatically when a team registers, and from Send / Resend above." : "Only sent from Send / Resend above."}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setOpen((o) => !o)} aria-expanded={open}>{open ? "Close" : "Edit email"}</Button>
      </div>

      {open && (
        <div className="space-y-4">
          <label className="flex items-start gap-2.5 text-sm text-(--color-text-primary) cursor-pointer">
            <input type="checkbox" checked={form.autoSend} onChange={(e) => setForm({ ...form, autoSend: e.target.checked })} className="mt-0.5 h-4 w-4 shrink-0 accent-(--color-primary)" />
            <span>Send it automatically when someone registers a new team</span>
          </label>

          <div>
            <label htmlFor="treq-subject" className="block text-sm font-medium text-(--color-text-primary) mb-1.5">Subject</label>
            <input id="treq-subject" value={form.subject} maxLength={200} onChange={(e) => setForm({ ...form, subject: e.target.value })} className={`${FIELD} h-10`} />
          </div>

          <div>
            <label htmlFor="treq-body" className="block text-sm font-medium text-(--color-text-primary) mb-1.5">Text</label>
            <textarea id="treq-body" value={form.body} maxLength={5000} rows={12} onChange={(e) => setForm({ ...form, body: e.target.value })} className={`${FIELD} font-mono leading-relaxed`} />
            <p className="mt-1.5 text-small text-(--color-text-secondary)">
              Plain text — a blank line starts a new paragraph. Fill-ins:{" "}
              {placeholders.map((p, i) => (
                <span key={p.key}>{i > 0 && ", "}<code className="rounded bg-(--color-surface-raised) px-1 text-(--color-text-primary)">{p.key}</code> {p.help}</span>
              ))}.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={save} isLoading={saving} disabled={!changed || testing}>Save</Button>
            <Button size="sm" variant="outline" onClick={test} isLoading={testing} disabled={saving}>Send me a test</Button>
            {changed && <Button size="sm" variant="ghost" onClick={() => setForm(saved)} disabled={saving}>Discard changes</Button>}
            {!isDefault && (
              <Button size="sm" variant="ghost" disabled={saving}
                onClick={() => { if (confirm("Put back the original subject and text? (Save to keep it.)")) setForm({ ...form, subject: defaults.subject, body: defaults.body }); }}>
                Reset to original
              </Button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
