import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import { LEADERSHIP_ROLES } from "@/lib/rbac";
import { getActiveWorkflow, resolveCurrentStep } from "@/lib/workflow/engine";
import { DEFAULT_PURCHASE_WORKFLOW } from "@/lib/workflow/default-purchase";
import { parseWorkflow, type WorkflowDef } from "@/lib/workflow/types";
import { WorkflowPipeline } from "@/components/workflow/WorkflowPipeline";
import { WorkflowEditor } from "./WorkflowEditor";
import { VersionHistory } from "./VersionHistory";
import { PageTitle } from "@/components/PageHeader";

export default async function WorkflowSettingsPage() {
  const session = await auth();
  if (!session?.user?.teamId) redirect("/dashboard");

  const canView = session.user.roles.some((r) => LEADERSHIP_ROLES.includes(r));
  if (!canView) redirect("/dashboard");
  const canEdit = session.user.roles.includes("HEAD_MENTOR");

  const teamId = session.user.teamId;
  const [active, versions, openRequests] = await Promise.all([
    getActiveWorkflow(teamId),
    prisma.workflowDefinition.findMany({
      where:   { teamId, kind: "PURCHASE" },
      include: { createdBy: { select: { name: true } }, _count: { select: { purchaseRequests: true } } },
      orderBy: { version: "desc" },
    }),
    prisma.purchaseRequest.findMany({
      where:  { season: { teamId, isActive: true }, status: { in: ["SUBMITTED", "APPROVED", "ORDERED", "PARTIAL_RECEIVED"] } },
      select: { status: true, currentStepKey: true, workflowDefinitionId: true },
    }),
  ]);

  // How many open requests sit on each step of the active version
  const counts: Record<string, number> = {};
  const defs = new Map<string | null, WorkflowDef>([[null, DEFAULT_PURCHASE_WORKFLOW]]);
  for (const v of versions) {
    try { defs.set(v.id, parseWorkflow(v.definition)); } catch { /* invalid rows fall back to default */ }
  }
  let onOlderVersions = 0;
  for (const r of openRequests) {
    if (r.workflowDefinitionId !== active.id) { onOlderVersions++; continue; }
    const step = resolveCurrentStep(defs.get(r.workflowDefinitionId) ?? DEFAULT_PURCHASE_WORKFLOW, r);
    if (step) counts[step.key] = (counts[step.key] ?? 0) + 1;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div>
        <nav className="text-small text-(--color-text-secondary) mb-1">
          <Link href="/settings/members" className="hover:text-(--color-primary)">Settings</Link>
          <span className="mx-2">›</span>Purchase workflow
        </nav>
        <PageTitle help="purchasing">Purchase workflow</PageTitle>
        <p className="text-body text-(--color-text-secondary) mt-1">
          Every step a stock item or purchase goes through, from running low to arriving on the shelf.
        </p>
        <p className="text-small text-(--color-text-secondary) mt-2">
          {active.id
            ? <>Version {active.version} · saved {formatDate(active.createdAt)}{active.createdBy && ` by ${active.createdBy}`}</>
            : "Using the default workflow"}
          {onOlderVersions > 0 && (
            <> · {onOlderVersions} open request{onOlderVersions === 1 ? " is" : "s are"} still following an earlier version</>
          )}
        </p>
      </div>

      {canEdit
        ? <WorkflowEditor def={active.def} counts={counts} isCustom={!!active.id} />
        : <WorkflowPipeline def={active.def} counts={counts} />}

      {versions.length > 0 && (
        <VersionHistory
          canEdit={canEdit}
          versions={versions.map((v) => ({
            id:        v.id,
            version:   v.version,
            isActive:  v.isActive,
            createdAt: v.createdAt.toISOString(),
            createdBy: v.createdBy?.name ?? null,
            requests:  v._count.purchaseRequests,
          }))}
        />
      )}
    </div>
  );
}
