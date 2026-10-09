import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { ROLE_LABELS } from "@/lib/rbac";
import { ApproveDialog } from "./ApproveDialog";
import { DenyButton } from "./DenyButton";
import { MemberRoleEditor } from "./MemberRoleEditor";
import { DeleteMemberButton } from "./DeleteMemberButton";
import { AccessCodeForm } from "./AccessCodeForm";
import type { Role } from "@/generated/prisma";
import { PageTitle } from "@/components/PageHeader";

export default async function MembersPage() {
  const session = await auth();
  if (!session?.user?.teamId) redirect("/dashboard");

  const isAdmin = session.user.roles.some((r) => ["HEAD_MENTOR", "TEAM_LEADERSHIP"].includes(r));
  if (!isAdmin) redirect("/dashboard");

  const [team, users] = await Promise.all([
    prisma.team.findUnique({ where: { id: session.user.teamId }, select: { teamNumber: true, name: true, accessCode: true } }),
    prisma.user.findMany({
      // Deleted members (kept only for history) don't appear here
      where: { teamId: session.user.teamId, deletedAt: null },
      include: { roles: true },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    }),
  ]);

  const pending  = users.filter((u) => u.status === "PENDING");
  const active   = users.filter((u) => u.status === "ACTIVE");
  const other    = users.filter((u) => u.status === "SUSPENDED" || u.status === "DENIED");

  function statusVariant(status: string): "warning" | "success" | "neutral" | "danger" {
    if (status === "PENDING")   return "warning";
    if (status === "ACTIVE")    return "success";
    if (status === "SUSPENDED") return "danger";
    return "neutral";
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <PageTitle help="roles">Team members</PageTitle>
        <p className="text-body text-[--color-text-secondary] mt-1">
          Team {team?.teamNumber} — {team?.name}
        </p>
      </div>

      {/* Pending approval */}
      {pending.length > 0 && (
        <div className="card border-l-4 border-l-[--color-warning]">
          <h2 className="text-h3 text-[--color-text-primary] mb-4">
            Pending approval
            <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-[--color-warning] text-white text-xs font-bold">
              {pending.length}
            </span>
          </h2>
          <div className="space-y-4">
            {pending.map((u) => (
              <div key={u.id} className="flex flex-col gap-3 py-3 border-b border-(--color-border) last:border-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="min-w-0">
                  <p className="font-medium text-[--color-text-primary]">{u.name}</p>
                  <p className="text-small text-[--color-text-secondary] break-all">{u.email}</p>
                  <p className="text-small text-[--color-text-secondary]">Requested {formatDate(u.createdAt)}</p>
                  {u.registrationNote && (
                    <p className="mt-1 text-small text-[--color-text-primary] italic">
                      &ldquo;{u.registrationNote}&rdquo;
                    </p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <ApproveDialog userId={u.id} userName={u.name} />
                  <DenyButton userId={u.id} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {pending.length === 0 && (
        <div className="card">
          <p className="text-small text-[--color-text-secondary]">No pending approvals.</p>
        </div>
      )}

      {/* Active members */}
      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
          <h2 className="text-h2 text-(--color-text-primary)">Active members ({active.length})</h2>
          <span className="flex flex-wrap items-center gap-4">
            <Link href="/settings/invites" className="text-sm font-medium text-(--color-secondary) hover:underline">Invite people</Link>
            <Link href="/settings/roles" className="text-sm font-medium text-(--color-secondary) hover:underline">What can each role do? →</Link>
          </span>
        </div>
        <div className="card divide-y divide-(--color-border)">
          {active.map((u) => (
            // Name + email with Edit roles beside them; the roles wrap underneath at any width
            <div key={u.id} className="space-y-2 py-3 first:pt-0 last:pb-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-(--color-text-primary) break-words">
                    {u.name}
                    {u.id === session.user.id && (
                      <span className="ml-2 text-xs font-normal text-(--color-text-secondary)">(you)</span>
                    )}
                  </p>
                  <p className="text-small text-(--color-text-secondary) break-all">{u.email}</p>
                </div>
                {u.id !== session.user.id && (
                  <div className="flex shrink-0 items-center gap-3">
                    <DeleteMemberButton userId={u.id} name={u.name} />
                    <MemberRoleEditor userId={u.id} currentRoles={u.roles.map((r) => r.role as Role)} />
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {u.roles.map((r) => (
                  <Badge key={r.role} variant="info">{ROLE_LABELS[r.role as Role]}</Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Suspended / Denied */}
      {other.length > 0 && (
        <div>
          <h2 className="text-h2 text-[--color-text-primary] mb-3">Inactive</h2>
          <div className="card divide-y divide-(--color-border)">
            {other.map((u) => (
              <div key={u.id} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="font-medium text-[--color-text-primary]">{u.name}</p>
                  <p className="text-small text-[--color-text-secondary] break-all">{u.email}</p>
                </div>
                <span className="flex shrink-0 items-center gap-3">
                  <Badge variant={statusVariant(u.status)}>{u.status}</Badge>
                  <DeleteMemberButton userId={u.id} name={u.name} />
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Access code */}
      <div className="card">
        <h2 className="text-h3 text-[--color-text-primary] mb-1">Team access code</h2>
        <p className="text-small text-[--color-text-secondary] mb-4">
          Members who enter this code at registration are auto-approved with the Team Member role.
          Useful for onboarding large groups at once.
        </p>
        <AccessCodeForm currentCode={team?.accessCode ?? ""} />
      </div>
    </div>
  );
}
