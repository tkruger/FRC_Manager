import Link from "next/link";
import { Button } from "@/components/ui/button";
import { peekAuthToken } from "@/lib/security/auth-tokens";
import { ResetPasswordForm } from "./ResetPasswordForm";

/** From the "Reset your password" email: choose a new password */
export default async function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  // Checked here only to show a helpful message; the token is used up when the form is sent
  const valid = !!await peekAuthToken(token, "PASSWORD_RESET");

  if (!valid) {
    return (
      <div className="card text-center space-y-4">
        <h1 className="text-h2 text-(--color-text-primary)">Link expired</h1>
        <p className="text-body text-(--color-text-secondary)">This reset link has expired or was already used. Reset links work for 30 minutes.</p>
        <Link href="/forgot-password"><Button className="w-full">Send a new link</Button></Link>
      </div>
    );
  }

  return (
    <div className="card">
      <h1 className="text-h2 text-(--color-text-primary) mb-1">Choose a new password</h1>
      <p className="text-small text-(--color-text-secondary) mb-6">This signs you out on every other device.</p>
      <ResetPasswordForm token={token} />
    </div>
  );
}
