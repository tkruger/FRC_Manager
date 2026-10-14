"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { OAuthButtons, OrDivider, type OAuthProvider } from "@/components/auth/OAuthButtons";

/** Where to go after signing in: the page that sent them here (same-site paths only), else the dashboard */
function returnTo(): string {
  const v = new URLSearchParams(window.location.search).get("callbackUrl");
  return v && v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\") ? v : "/dashboard";
}

/** Why an OAuth sign-in bounced back here (?error=) */
const OAUTH_ERRORS: Record<string, string> = {
  DiscordEmail: "Your Discord account needs a verified email address to sign in. Verify it in Discord (User Settings → My Account), then try again.",
  OAuthAccountNotLinked: "That email already has an FRC Manager account. Sign in with your password, or the way you signed in before.",
  AccessDenied: "Sign-in was cancelled or isn't allowed for this account.",
  OAuthCallbackError: "Sign-in didn't finish. Please try again.",
  Callback: "Sign-in didn't finish. Please try again.",
};

export function LoginForm({ providers, oauthError }: { providers: OAuthProvider[]; oauthError?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(oauthError ? OAUTH_ERRORS[oauthError] ?? "Sign-in didn't work. Please try again." : null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const data = new FormData(e.currentTarget);
    const result = await signIn("credentials", {
      email: data.get("email"),
      password: data.get("password"),
      redirect: false,
    });

    setLoading(false);
    if (result?.error) {
      setError("Invalid email or password.");
    } else {
      router.push(returnTo());
      router.refresh();
    }
  }

  return (
    <div className="card">
      <h1 className="text-h2 text-[--color-text-primary] mb-6">Sign in</h1>

      {error && (
        <div className="mb-4 rounded-md bg-[--color-danger]/10 border border-[--color-danger]/20 px-4 py-3 text-sm text-[--color-danger]">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
        />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="••••••••"
        />
        <Button type="submit" className="w-full" isLoading={loading}>
          Sign in
        </Button>
      </form>

      {providers.length > 0 && (
        <>
          <OrDivider />
          <OAuthButtons providers={providers} callbackUrl={returnTo} />
        </>
      )}

      <p className="mt-6 text-center text-small text-[--color-text-secondary]">
        {"Don't have an account? "}
        <Link href="/register" className="text-[--color-secondary] hover:underline font-medium">
          Create one
        </Link>
      </p>
    </div>
  );
}
