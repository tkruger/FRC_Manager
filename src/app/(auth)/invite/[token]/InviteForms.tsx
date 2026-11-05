"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { OAuthButtons, type OAuthProvider } from "@/components/auth/OAuthButtons";
import { acceptInviteAsCurrentUserAction, acceptInviteWithNewAccountAction } from "@/app/actions/invites";
import { TermsCheckbox } from "@/components/legal/TermsCheckbox";

/** Signed out: create an account from the invite (or sign in to an existing one). */
export function InviteSignup({ token, email, name, teamNumber, providers }: {
  token: string; email: string | null; name?: string | null; teamNumber: number; providers: OAuthProvider[];
}) {
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
        acceptTerms: data.get("acceptTerms") === "on",
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
        <Field label="Your name" name="name" required autoComplete="name" defaultValue={name ?? undefined} />
        {email
          ? <Field label="Email" name="email" type="email" value={email} readOnly hint="This invite is for this address" />
          : <Field label="Email" name="email" type="email" required autoComplete="email" />}
        <Field label="Password" name="password" type="password" required minLength={8} autoComplete="new-password" hint="At least 8 characters" />
        <TermsCheckbox />
        <Button type="submit" className="w-full" isLoading={pending}>Create account &amp; join Team {teamNumber}</Button>
      </form>

      <div className="space-y-2 text-center">
        <p className="text-small text-(--color-text-secondary)">Already have an account?</p>
        <div className="flex flex-col gap-2">
          <Link href={`/login?callbackUrl=${encodeURIComponent(back)}`}><Button variant="outline" className="w-full">Sign in</Button></Link>
          <OAuthButtons providers={providers} callbackUrl={back} />
        </div>
      </div>
    </div>
  );
}

/** Signed in, not on a team yet: one tap to join. */
export function JoinTeamButton({ token, teamNumber, needsTerms = false }: { token: string; teamNumber: number; needsTerms?: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [agreed, setAgreed] = useState(false);
  return (
    <div className="space-y-3">
      {error && <div className="rounded-md bg-(--color-danger)/10 px-3 py-2 text-sm text-(--color-danger)">{error}</div>}
      {needsTerms && <TermsCheckbox checked={agreed} onChange={setAgreed} />}
      <Button
        className="w-full"
        isLoading={pending}
        disabled={needsTerms && !agreed}
        onClick={() => start(async () => {
          const res = await acceptInviteAsCurrentUserAction(token, agreed);
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
