import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { consumeAuthToken } from "@/lib/security/auth-tokens";

/**
 * From a confirmation email: confirms the account's email address, or (for an email
 * change) switches the account to the new address.
 */
export default async function VerifyEmailPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await auth();
  const next = session?.user ? { href: "/settings/profile", label: "Back to your profile" } : { href: "/login", label: "Sign in" };

  let title = "Link expired";
  let body  = "This confirmation link has expired or was already used. You can send a new one from your profile.";
  let ok    = false;

  const verify = await consumeAuthToken(token, "EMAIL_VERIFY");
  if (verify) {
    await prisma.user.update({ where: { id: verify.userId }, data: { emailVerified: new Date() } });
    [title, body, ok] = ["Email confirmed", "Thanks — your email address is confirmed.", true];
  } else {
    const change = await consumeAuthToken(token, "EMAIL_CHANGE");
    if (change?.email) {
      const taken = await prisma.user.findFirst({
        where:  { email: { equals: change.email, mode: "insensitive" }, id: { not: change.userId } },
        select: { id: true },
      });
      if (taken) {
        [title, body] = ["Email already in use", "Another account started using that address, so your email wasn't changed."];
      } else {
        await prisma.user.update({ where: { id: change.userId }, data: { email: change.email, emailVerified: new Date() } });
        [title, body, ok] = ["Email changed", `Your account's email is now ${change.email}. Use it the next time you sign in.`, true];
      }
    }
  }

  return (
    <div className="card text-center space-y-4">
      <h1 className="text-h2 text-(--color-text-primary)">{ok ? "✓ " : ""}{title}</h1>
      <p className="text-body text-(--color-text-secondary)">{body}</p>
      <Link href={next.href}><Button className="w-full">{next.label}</Button></Link>
    </div>
  );
}
