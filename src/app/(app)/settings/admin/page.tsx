import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { PageTitle } from "@/components/PageHeader";
import { formatDate } from "@/lib/utils";
import { TeamReviewButtons } from "./TeamReviewButtons";
import { SuperAdmins } from "./SuperAdmins";

/** Platform admin: approve teams that are new to FRC Manager, and manage super admins. */
export default async function AdminPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { isSuperAdmin: true, status: true } });
  if (!me?.isSuperAdmin || me.status !== "ACTIVE") redirect("/dashboard");

  const [pending, reviewed, admins] = await Promise.all([
    prisma.team.findMany({
      where:   { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      select:  {
        id: true, teamNumber: true, name: true, createdAt: true,
        users: { orderBy: { createdAt: "asc" }, select: { id: true, name: true, email: true, registrationNote: true, createdAt: true } },
      },
    }),
    prisma.team.findMany({
      where:   { status: { in: ["ACTIVE", "DENIED"] }, reviewedAt: { not: null } },
      orderBy: { reviewedAt: "desc" },
      take:    20,
      select:  { id: true, teamNumber: true, status: true, reviewedAt: true, reviewedBy: { select: { name: true } } },
    }),
    prisma.user.findMany({
      where:   { isSuperAdmin: true },
      orderBy: { name: "asc" },
      select:  { id: true, name: true, email: true, team: { select: { teamNumber: true } } },
    }),
  ]);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <nav className="text-small text-(--color-text-secondary) mb-1">
          <Link href="/settings/profile" className="hover:text-(--color-primary)">Settings</Link>
          <span className="mx-2">›</span>Team approvals
        </nav>
        <PageTitle>Team approvals</PageTitle>
        <p className="text-body text-(--color-text-secondary) mt-1">
          Teams new to FRC Manager wait here until a super admin approves them. Approving makes the person who
          registered the team its Head Mentor; they approve everyone else on their team.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-h2 text-(--color-text-primary)">
          Waiting for approval <span className="text-small font-normal text-(--color-text-secondary)">({pending.length})</span>
        </h2>
        {pending.length === 0 ? (
          <div className="card text-small text-(--color-text-secondary)">
            No teams are waiting. You&apos;ll get a notification when one registers.
          </div>
        ) : (
          pending.map((t) => {
            const [founder, ...others] = t.users;
            return (
              <div key={t.id} className="card space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-h3 text-(--color-text-primary)">Team {t.teamNumber}</p>
                    <p className="text-small text-(--color-text-secondary)">Registered {formatDate(t.createdAt)}</p>
                  </div>
                  <TeamReviewButtons teamId={t.id} teamNumber={t.teamNumber} founderName={founder?.name ?? null} />
                </div>
                {founder ? (
                  <div className="rounded-md bg-(--color-surface-overlay) px-3 py-2.5 text-sm space-y-0.5">
                    <p className="text-(--color-text-primary)">
                      <span className="font-medium">{founder.name}</span>
                      <span className="text-(--color-text-secondary) break-all"> · {founder.email}</span>
                    </p>
                    <p className="text-small text-(--color-text-secondary)">Becomes Head Mentor when approved</p>
                    {founder.registrationNote && (
                      <p className="text-small italic text-(--color-text-primary) pt-1">&ldquo;{founder.registrationNote}&rdquo;</p>
                    )}
                  </div>
                ) : (
                  <p className="text-small text-(--color-text-secondary)">No one is waiting to join this team.</p>
                )}
                {others.length > 0 && (
                  <p className="text-small text-(--color-text-secondary)">
                    Also waiting to join: {others.map((u) => u.name).join(", ")} — their new Head Mentor reviews them.
                  </p>
                )}
              </div>
            );
          })
        )}
      </section>

      {reviewed.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-h2 text-(--color-text-primary)">Recently reviewed</h2>
          <div className="card divide-y divide-(--color-border) p-0">
            {reviewed.map((t) => (
              <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                <span className="text-sm text-(--color-text-primary)">Team {t.teamNumber}</span>
                <span className="flex items-center gap-2 text-small text-(--color-text-secondary)">
                  <Badge variant={t.status === "ACTIVE" ? "success" : "danger"}>{t.status === "ACTIVE" ? "Approved" : "Denied"}</Badge>
                  {t.reviewedAt && formatDate(t.reviewedAt)}{t.reviewedBy && ` · ${t.reviewedBy.name}`}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <SuperAdmins
        currentUserId={session.user.id}
        admins={admins.map((a) => ({ id: a.id, name: a.name, email: a.email, teamNumber: a.team?.teamNumber ?? null }))}
      />
    </div>
  );
}
