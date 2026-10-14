"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import {
  changePasswordAction, changeEmailAction, sendVerificationAction, signOutEverywhereAction,
} from "@/app/actions/account";

type Provider = "google" | "discord";
const LABEL: Record<Provider, string> = { google: "Google", discord: "Discord" };

interface Props {
  email: string;
  emailVerified: boolean;
  hasPassword: boolean;
  /** Sign-in methods this deployment offers */
  providers: Provider[];
  /** …and the ones already connected to this account */
  connected: string[];
}

type Msg = { ok: boolean; text: string } | null;

function Note({ msg }: { msg: Msg }) {
  if (!msg) return null;
  return (
    <div className={`rounded-md border px-3 py-2 text-sm ${msg.ok
      ? "bg-(--color-success)/10 border-(--color-success)/20 text-(--color-success)"
      : "bg-(--color-danger)/10 border-(--color-danger)/20 text-(--color-danger)"}`}>
      {msg.text}
    </div>
  );
}

export function AccountSecurity({ email, emailVerified, hasPassword, providers, connected }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [verifyMsg, setVerifyMsg] = useState<Msg>(null);
  const [emailMsg, setEmailMsg]   = useState<Msg>(null);
  const [pwMsg, setPwMsg]         = useState<Msg>(null);
  const [editingEmail, setEditingEmail] = useState(false);

  const result = (r: { success: true; message?: string } | { success: false; error: string }): Msg =>
    r.success ? { ok: true, text: r.message ?? "Done." } : { ok: false, text: r.error };

  function sendVerification() {
    start(async () => setVerifyMsg(result(await sendVerificationAction())));
  }

  function changeEmail(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    start(async () => {
      const r = await changeEmailAction(String(data.get("newEmail") ?? ""), String(data.get("emailPassword") ?? ""));
      setEmailMsg(result(r));
      if (r.success) setEditingEmail(false);
    });
  }

  function changePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const next = String(data.get("newPassword") ?? "");
    if (next !== String(data.get("confirmPassword") ?? "")) { setPwMsg({ ok: false, text: "The two new passwords don't match." }); return; }
    start(async () => {
      const r = await changePasswordAction(String(data.get("currentPassword") ?? ""), next);
      setPwMsg(result(r));
      if (r.success) { form.reset(); router.refresh(); }
    });
  }

  return (
    <div className="card space-y-6">
      <h2 className="text-h3 text-(--color-text-primary)">Account &amp; security</h2>

      {/* Email */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-(--color-text-primary)">Email</p>
          <span className="text-sm text-(--color-text-secondary) break-all">{email}</span>
          <Badge variant={emailVerified ? "success" : "warning"}>{emailVerified ? "Confirmed" : "Not confirmed"}</Badge>
        </div>
        {!emailVerified && (
          <div className="space-y-2">
            <p className="text-small text-(--color-text-secondary)">
              Confirm your email so it can be used to reset your password and to connect Google or Discord.
            </p>
            <Button size="sm" variant="outline" onClick={sendVerification} isLoading={pending}>Send confirmation link</Button>
          </div>
        )}
        <Note msg={verifyMsg} />
        {editingEmail ? (
          <form onSubmit={changeEmail} className="space-y-3">
            <Field label="New email" name="newEmail" type="email" autoComplete="email" required maxLength={254} />
            {hasPassword && <Field label="Current password" name="emailPassword" type="password" autoComplete="current-password" required maxLength={200} />}
            <div className="flex gap-2">
              <Button type="submit" size="sm" isLoading={pending}>Send confirmation</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setEditingEmail(false)}>Cancel</Button>
            </div>
          </form>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => { setEmailMsg(null); setEditingEmail(true); }}>Change email</Button>
        )}
        <Note msg={emailMsg} />
      </section>

      {/* Password */}
      <section className="space-y-3 border-t border-(--color-border) pt-5">
        <p className="text-sm font-medium text-(--color-text-primary)">{hasPassword ? "Change password" : "Set a password"}</p>
        {!hasPassword && (
          <p className="text-small text-(--color-text-secondary)">You sign in with Google or Discord. Add a password to sign in with your email too.</p>
        )}
        <form onSubmit={changePassword} className="space-y-3">
          {hasPassword && <Field label="Current password" name="currentPassword" type="password" autoComplete="current-password" required maxLength={200} />}
          <Field label="New password" name="newPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={200} hint="At least 8 characters. Other devices will be signed out." />
          <Field label="Type it again" name="confirmPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={200} />
          <Button type="submit" size="sm" isLoading={pending}>{hasPassword ? "Change password" : "Set password"}</Button>
        </form>
        <Note msg={pwMsg} />
      </section>

      {/* Sign-in methods */}
      {providers.length > 0 && (
        <section className="space-y-3 border-t border-(--color-border) pt-5">
          <p className="text-sm font-medium text-(--color-text-primary)">Sign-in methods</p>
          <ul className="space-y-2">
            {providers.map((p) => (
              <li key={p} className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm text-(--color-text-primary)">{LABEL[p]}</span>
                {connected.includes(p) ? (
                  <Badge variant="success">Connected</Badge>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => signIn(p, { callbackUrl: "/settings/profile" })}>Connect</Button>
                )}
              </li>
            ))}
          </ul>
          <p className="text-small text-(--color-text-secondary)">Connecting lets you sign in to this account with that service.</p>
        </section>
      )}

      {/* Sessions */}
      <section className="space-y-2 border-t border-(--color-border) pt-5">
        <p className="text-sm font-medium text-(--color-text-primary)">Signed-in devices</p>
        <p className="text-small text-(--color-text-secondary)">Lost a phone, or signed in on a shared computer? Sign out everywhere, including here.</p>
        <form action={signOutEverywhereAction}>
          <Button type="submit" size="sm" variant="outline">Sign out of all devices</Button>
        </form>
      </section>
    </div>
  );
}
