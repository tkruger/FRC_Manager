"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { acceptInviteAsCurrentUserAction, acceptInviteWithNewAccountAction } from "@/app/actions/invites";

/** Signed out: create an account from the invite (or sign in to an existing one). */
export function InviteSignup({ token, email, teamNumber }: { token: string; email: string | null; teamNumber: number }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const back = `/invite/${token}`;

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const data = new FormData(e.currentTarget);
    start(async () => {
      const res = await acceptInviteWithNewAccountAction(token, {
        name: data.get("name"), email: email ?? data.get("email"), password: data.get("password"),
      });
      if (!res.success) { setError(res.error); return; }
      router.push("/dashboard");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="space-y-4">
        {error && <div className="rounded-md bg-(--color-danger)/10 px-3 py-2 text-sm text-(--color-danger)">{error}</div>}
        <Field label="Your name" name="name" required autoComplete="name" />
        {email
          ? <Field label="Email" name="email" type="email" value={email} readOnly hint="This invite is for this address" />
          : <Field label="Email" name="email" type="email" required autoComplete="email" />}
        <Field label="Password" name="password" type="password" required minLength={8} autoComplete="new-password" hint="At least 8 characters" />
        <Button type="submit" className="w-full" isLoading={pending}>Create account &amp; join Team {teamNumber}</Button>
      </form>

      <div className="space-y-2 text-center">
        <p className="text-small text-(--color-text-secondary)">Already have an account?</p>
        <div className="flex flex-col gap-2">
          <Link href={`/login?callbackUrl=${encodeURIComponent(back)}`}><Button variant="outline" className="w-full">Sign in</Button></Link>
          <Button type="button" variant="outline" className="w-full" onClick={() => signIn("google", { callbackUrl: back })}>
            Continue with Google
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Signed in, not on a team yet: one tap to join. */
export function JoinTeamButton({ token, teamNumber }: { token: string; teamNumber: number }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2">
      {error && <div className="rounded-md bg-(--color-danger)/10 px-3 py-2 text-sm text-(--color-danger)">{error}</div>}
      <Button
        className="w-full"
        isLoading={pending}
        onClick={() => start(async () => {
          const res = await acceptInviteAsCurrentUserAction(token);
          if (!res.success) { setError(res.error); return; }
          router.push("/dashboard");
          router.refresh();
        })}
      >
        Join Team {teamNumber}
      </Button>
    </div>
  );
}
