"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import { registerAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";

export default function RegisterPage() {
  const router = useRouter();
  const [state, action, pending] = useActionState(registerAction, null);
  const [showCode, setShowCode] = useState(false);

  useEffect(() => {
    if (state?.success) {
      router.push("/pending");
    }
  }, [state, router]);

  const errors = (!state?.success && state?.fieldErrors) ? state.fieldErrors : {};

  return (
    <div className="card">
      <h1 className="text-h2 text-[--color-text-primary] mb-1">Create account</h1>
      <p className="text-small text-[--color-text-secondary] mb-6">
        Your account will be reviewed by a team admin before you can access team data.
      </p>

      {state && !state.success && !state.fieldErrors && (
        <div className="mb-4 rounded-md bg-[--color-danger]/10 border border-[--color-danger]/20 px-4 py-3 text-sm text-[--color-danger]">
          {state.error}
        </div>
      )}

      <form action={action} className="space-y-4">
        <Field
          label="Full name"
          name="name"
          type="text"
          autoComplete="name"
          required
          placeholder="Alex Johnson"
          error={errors.name?.[0]}
        />
        <Field
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
          error={errors.email?.[0]}
        />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          placeholder="At least 8 characters"
          error={errors.password?.[0]}
        />
        <Field
          label="FRC Team Number"
          name="teamNumber"
          type="number"
          required
          placeholder="e.g. 254"
          error={errors.teamNumber?.[0]}
        />

        <div>
          <button
            type="button"
            className="text-small text-[--color-secondary] hover:underline"
            onClick={() => setShowCode((v) => !v)}
          >
            {showCode ? "Hide" : "Have a team access code?"}
          </button>
          {showCode && (
            <Field
              label="Access code"
              name="accessCode"
              type="text"
              placeholder="Team access code"
              className="mt-2"
              hint="If your mentor provided a code, entering it auto-approves your account."
            />
          )}
        </div>

        <div>
          <label
            htmlFor="registrationNote"
            className="block text-sm font-medium text-[--color-text-primary] mb-1.5"
          >
            Message to admin{" "}
            <span className="font-normal text-[--color-text-secondary]">(optional)</span>
          </label>
          <textarea
            id="registrationNote"
            name="registrationNote"
            rows={2}
            placeholder="e.g. I'm a new student joining the 2026 season"
            className="flex w-full rounded-md border border-[--color-border] bg-[--color-surface] px-3 py-2 text-sm text-[--color-text-primary] placeholder:text-[--color-text-disabled] focus:border-[--color-primary] focus:outline-none focus:ring-2 focus:ring-[--color-primary]/20 resize-none"
          />
        </div>

        <Button type="submit" className="w-full" isLoading={pending}>
          Create account
        </Button>
      </form>

      <p className="mt-6 text-center text-small text-[--color-text-secondary]">
        Already have an account?{" "}
        <Link href="/login" className="text-[--color-secondary] hover:underline font-medium">
          Sign in
        </Link>
      </p>
    </div>
  );
}
