import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FinishRegistrationForm } from "./FinishRegistrationForm";

/** After signing up with Google or Discord: say which team you're on. */
export default async function FinishRegistrationPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/register");

  const me = await prisma.user.findUnique({
    where:  { id: session.user.id },
    select: { name: true, email: true, teamId: true, status: true, accounts: { select: { provider: true } } },
  });
  if (!me) redirect("/register");
  if (me.teamId) redirect(me.status === "ACTIVE" ? "/dashboard" : "/pending");

  const via = me.accounts.some((a) => a.provider === "discord") ? "Discord" : me.accounts.some((a) => a.provider === "google") ? "Google" : null;

  return (
    <div className="card">
      <h1 className="text-h2 text-(--color-text-primary) mb-1">Finish signing up</h1>
      <p className="text-small text-(--color-text-secondary) mb-6">
        {via ? `Signed in with ${via} as ${me.email}. ` : ""}Tell us your team — enter its access code to join right away, or
        your request goes to the team&apos;s mentors to approve.
      </p>
      <FinishRegistrationForm name={me.name} />
    </div>
  );
}
