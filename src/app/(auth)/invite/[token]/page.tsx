import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { findUsableInvite } from "@/lib/invites";
import { InviteSignup, JoinTeamButton } from "./InviteForms";

/** Where invite links land: join the team, approved, as a Team Member. Works signed out. */
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const usable = await findUsableInvite(token);

  if (!usable.ok) {
    return (
      <div className="card text-center space-y-4">
        <h1 className="text-h2 text-(--color-text-primary)">Invite not available</h1>
        <p className="text-body text-(--color-text-secondary)">{usable.reason}</p>
        <Link href="/login"><Button variant="outline" className="w-full">Go to sign in</Button></Link>
      </div>
    );
  }

  const { team, invite } = usable;
  const session = await auth();
  const me = session?.user?.id
    ? await prisma.user.findUnique({ where: { id: session.user.id }, select: { name: true, email: true, teamId: true, status: true } })
    : null;

  return (
    <div className="card space-y-5">
      <div className="text-center space-y-1">
        <p className="text-small text-(--color-text-secondary)">You&apos;re invited to join</p>
        <h1 className="text-h2 text-(--color-text-primary)">Team {team.teamNumber}</h1>
        <p className="text-body text-(--color-text-secondary)">{team.name}</p>
      </div>

      {me ? (
        me.teamId === team.id && me.status === "ACTIVE" ? (
          <div className="space-y-3 text-center">
            <p className="text-body text-(--color-text-primary)">You&apos;re already on this team.</p>
            <Link href="/dashboard"><Button className="w-full">Open FRC Manager</Button></Link>
          </div>
        ) : me.teamId && me.teamId !== team.id && me.status === "ACTIVE" ? (
          <div className="space-y-3 text-center">
            <p className="text-body text-(--color-text-secondary)">
              You&apos;re signed in as {me.email}, which already belongs to another team. Sign out and use a different
              account to join Team {team.teamNumber}.
            </p>
            <Link href="/dashboard"><Button variant="outline" className="w-full">Back to my team</Button></Link>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-body text-(--color-text-secondary) text-center">Signed in as {me.name} ({me.email}).</p>
            <JoinTeamButton token={token} teamNumber={team.teamNumber} />
          </div>
        )
      ) : (
        <InviteSignup token={token} email={invite.email} teamNumber={team.teamNumber} />
      )}
    </div>
  );
}
