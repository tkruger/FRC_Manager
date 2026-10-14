"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { resetPasswordAction } from "@/app/actions/account";

export function ResetPasswordForm({ token }: { token: string }) {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone]   = useState<string | null>(null);
  const [pending, start]  = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const password = String(data.get("password") ?? "");
    if (password !== String(data.get("confirm") ?? "")) { setError("The two passwords don't match."); return; }
    setError(null);
    start(async () => {
      const res = await resetPasswordAction(token, password);
      if (res.success) setDone(res.message ?? "Password changed.");
      else setError(res.error);
    });
  }

  if (done) {
    return (
      <div className="space-y-4">
        <div className="rounded-md bg-(--color-success)/10 border border-(--color-success)/20 px-4 py-3 text-sm text-(--color-success)">{done}</div>
        <Link href="/login"><Button className="w-full">Sign in</Button></Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <div className="rounded-md bg-(--color-danger)/10 border border-(--color-danger)/20 px-4 py-3 text-sm text-(--color-danger)">{error}</div>}
      <Field label="New password" name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={200} hint="At least 8 characters" />
      <Field label="Type it again" name="confirm" type="password" autoComplete="new-password" required minLength={8} maxLength={200} />
      <Button type="submit" className="w-full" isLoading={pending}>Change password</Button>
    </form>
  );
}
