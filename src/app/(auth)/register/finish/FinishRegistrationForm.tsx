"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { finishRegistrationAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";

export function FinishRegistrationForm({ name }: { name: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(finishRegistrationAction, null);
  const [showCode, setShowCode] = useState(false);

  useEffect(() => {
    if (!state?.success) return;
    router.push(state.activated ? "/dashboard" : state.newTeam ? "/pending?team=new" : "/pending");
    router.refresh();
  }, [state, router]);

  const errors = (!state?.success && state?.fieldErrors) ? state.fieldErrors : {};

  return (
    <div className="space-y-4">
      {state && !state.success && !state.fieldErrors && (
        <div className="rounded-md bg-(--color-danger)/10 border border-(--color-danger)/20 px-4 py-3 text-sm text-(--color-danger)">
          {state.error}
        </div>
      )}

      <form action={action} className="space-y-4">
        <Field label="Full name" name="name" type="text" autoComplete="name" required defaultValue={name} error={errors.name?.[0]} />
        <Field label="FRC Team Number" name="teamNumber" type="number" inputMode="numeric" required placeholder="e.g. 254" error={errors.teamNumber?.[0]} />

        <div>
          <button type="button" className="text-small text-(--color-secondary) hover:underline" onClick={() => setShowCode((v) => !v)}>
            {showCode ? "Hide" : "Have a team access code?"}
          </button>
          {showCode && (
            <Field label="Access code" name="accessCode" type="text" placeholder="Team access code" className="mt-2"
              hint="If your mentor gave you a code, entering it approves your account right away." />
          )}
        </div>

        <div>
          <label htmlFor="registrationNote" className="block text-sm font-medium text-(--color-text-primary) mb-1.5">
            Message to admin <span className="font-normal text-(--color-text-secondary)">(optional)</span>
          </label>
          <textarea
            id="registrationNote"
            name="registrationNote"
            rows={2}
            placeholder="e.g. I'm a new student joining the 2026 season"
            className="flex w-full rounded-md border border-(--color-border) bg-(--color-surface) px-3 py-2 text-sm text-(--color-text-primary) placeholder:text-(--color-text-disabled) focus:border-(--color-primary) focus:outline-none focus:ring-2 focus:ring-(--color-primary)/20 resize-none"
          />
        </div>

        <Button type="submit" className="w-full" isLoading={pending}>Continue</Button>
      </form>

      <p className="text-center text-small text-(--color-text-secondary)">
        Wrong account?{" "}
        <button type="button" className="text-(--color-secondary) hover:underline font-medium" onClick={() => signOut({ callbackUrl: "/login" })}>
          Sign out
        </button>
      </p>
    </div>
  );
}
