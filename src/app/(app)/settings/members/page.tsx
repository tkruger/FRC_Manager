import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { ROLE_LABELS } from "@/lib/rbac";
import { ApproveDialog } from "./ApproveDialog";
import { DenyButton } from "./DenyButton";
import { MemberRoleEditor } from "./MemberRoleEditor";
import { AccessCodeForm } from "./AccessCodeForm";
import type { Role } from "@/generated/prisma";

export default async function MembersPage() {
  const session = await auth();
  if (!session?.user?.teamId) redirect("/dashboard");

  const isAdmin = session.user.roles.includes("HEAD_MENTOR" as any);
  if (!isAdmin) redirect("/dashboard");

  const [team, users] = await Promise.all([
    prisma.team.findUnique({ where: { id: session.user.teamId }, select: { teamNumber: true, name: true, accessCode: true } }),
    prisma.user.findMany({
      where: { teamId: session.user.teamId },
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
        <h1 className="text-h1 text-[--color-text-primary]">Team members</h1>
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
              <div key={u.id} className="flex items-start justify-between gap-4 py-3 border-b border-[--color-border] last:border-0">
                <div className="min-w-0">
                  <p className="font-medium text-[--color-text-primary]">{u.name}</p>
                  <p className="text-small text-[--color-text-secondary]">{u.email}</p>
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
        <h2 className="text-h2 text-[--color-text-primary] mb-3">Active members ({active.length})</h2>
        <div className="card divide-y divide-[--color-border]">
          {active.map((u) => (
            <div key={u.id} className="flex items-center justify-between gap-4 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-[--color-text-primary] truncate">{u.name}</p>
                  {u.id === session.user.id && (
                    <span className="text-xs text-[--color-text-secondary]">(you)</span>
                  )}
                </div>
                <p className="text-small text-[--color-text-secondary]">{u.email}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="flex gap-1 flex-wrap justify-end max-w-[200px]">
                  {u.roles.map((r) => (
                    <Badge key={r.role} variant="info">{ROLE_LABELS[r.role as Role]}</Badge>
                  ))}
                </div>
                {u.id !== session.user.id && (
                  <MemberRoleEditor userId={u.id} currentRoles={u.roles.map((r) => r.role as Role)} />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Suspended / Denied */}
      {other.length > 0 && (
        <div>
          <h2 className="text-h2 text-[--color-text-primary] mb-3">Inactive</h2>
          <div className="card divide-y divide-[--color-border]">
            {other.map((u) => (
              <div key={u.id} className="flex items-center justify-between gap-4 py-3">
                <div>
                  <p className="font-medium text-[--color-text-primary]">{u.name}</p>
                  <p className="text-small text-[--color-text-secondary]">{u.email}</p>
                </div>
                <Badge variant={statusVariant(u.status)}>{u.status}</Badge>
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
