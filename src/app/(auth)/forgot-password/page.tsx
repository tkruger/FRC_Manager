"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { requestPasswordResetAction } from "@/app/actions/account";

export default function ForgotPasswordPage() {
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email") ?? "");
    start(async () => {
      const res = await requestPasswordResetAction(email);
      setResult(res.success ? { ok: true, text: res.message ?? "Check your email." } : { ok: false, text: res.error });
    });
  }

  return (
    <div className="card">
      <h1 className="text-h2 text-(--color-text-primary) mb-1">Reset your password</h1>
      <p className="text-small text-(--color-text-secondary) mb-6">
        Enter your account&apos;s email and we&apos;ll send you a link to choose a new password.
      </p>

      {result && (
        <div className={`mb-4 rounded-md border px-4 py-3 text-sm ${result.ok
          ? "bg-(--color-success)/10 border-(--color-success)/20 text-(--color-success)"
          : "bg-(--color-danger)/10 border-(--color-danger)/20 text-(--color-danger)"}`}>
          {result.text}
        </div>
      )}

      {!result?.ok && (
        <form onSubmit={submit} className="space-y-4">
          <Field label="Email" name="email" type="email" autoComplete="email" required maxLength={254} placeholder="you@example.com" />
          <Button type="submit" className="w-full" isLoading={pending}>Send reset link</Button>
        </form>
      )}

      <p className="mt-6 text-center text-small text-(--color-text-secondary)">
        <Link href="/login" className="text-(--color-secondary) hover:underline font-medium">Back to sign in</Link>
      </p>
    </div>
  );
}
