import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Table, TableHead, TableBody, Th, Td, Tr } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/utils";
import { statusBadgeVariant, statusLabel, priorityBadgeVariant } from "@/lib/procurement-helpers";
import { definitionFor, resolveCurrentStep, availableActions } from "@/lib/workflow/engine";
import { describeCondition, describeRoles, evaluateCondition } from "@/lib/workflow/types";
import { RequestActions } from "./RequestActions";
import { RequestTimeline, type TimelineEntry } from "./RequestTimeline";
import Link from "next/link";

export default async function RequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.teamId) redirect("/dashboard");

  const request = await prisma.purchaseRequest.findFirst({
    where: { id, season: { teamId: session.user.teamId } },
    include: {
      requestedBy: { select: { name: true, email: true } },
      approver: { select: { name: true } },
      preferredVendor: { select: { name: true, website: true } },
      lineItems: { orderBy: { id: "asc" }, include: { baseItem: { select: { id: true, name: true } } } },
      events: { orderBy: { createdAt: "asc" }, include: { actor: { select: { name: true } } } },
    },
  });

  if (!request) notFound();

  const def         = await definitionFor(request.workflowDefinitionId);
  const currentStep = resolveCurrentStep(def, request);
  const actions     = availableActions(def, request, { id: session.user.id, roles: session.user.roles });
  const linkedStock = request.lineItems.filter((li) => li.baseItem).length;

  // Steps still ahead of the current one, with whether they'll apply to this request
  const currentIndex = currentStep ? def.steps.findIndex((s) => s.key === currentStep.key) : -1;
  const subject = {
    total: request.estimatedTotal ?? 0, priority: request.priority,
    subTeam: request.subTeam, budgetCategory: request.budgetCategory,
  };
  const upcoming = currentStep
    ? def.steps.slice(currentIndex + 1).map((s) => ({
        name:      s.name,
        who:       describeRoles(s.roles),
        willSkip:  !evaluateCondition(s.when, subject),
        condition: describeCondition(s.when),
      }))
    : [];

  // Requests from before workflows were tracked have no events — show what we know
  const timeline: TimelineEntry[] = request.events.length > 0
    ? request.events.map((e) => ({
        id: e.id, action: e.action, stepName: e.stepName, actor: e.actor?.name ?? null,
        note: e.note, data: e.data as Record<string, unknown> | null, at: e.createdAt.toISOString(),
      }))
    : [{
        id: "legacy", action: "created", stepName: null, actor: request.requestedBy.name,
        note: "Submitted before step-by-step history was recorded.", data: null, at: request.submittedAt.toISOString(),
      }];

  const lineTotal = request.lineItems.reduce((s, l) => s + (l.lineTotal ?? 0), 0);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Breadcrumb */}
      <nav className="text-small text-(--color-text-secondary)">
        <Link href="/procurement" className="hover:text-(--color-primary)">Procurement</Link>
        <span className="mx-2">›</span>
        <span className="text-(--color-text-primary)">{request.title}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-h1 text-(--color-text-primary)">{request.title}</h1>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <Badge variant={statusBadgeVariant(request.status)}>{statusLabel(request.status)}</Badge>
            <Badge variant={priorityBadgeVariant(request.priority)}>{request.priority}</Badge>
            {request.subTeam && <Badge variant="neutral">{request.subTeam.replace("_", " ")}</Badge>}
          </div>
        </div>
        <RequestActions
          requestId={request.id}
          actions={actions}
          estimatedTotal={request.estimatedTotal}
          linkedStockLines={linkedStock}
        />
      </div>

      {/* Where it is now */}
      {currentStep && (
        <div className="card py-3 px-4 border-l-4" style={{ borderLeftColor: "var(--color-warning)" }}>
          <p className="text-sm text-(--color-text-primary)">
            <span className="font-semibold">Waiting on: {currentStep.name}</span>
            <span className="text-(--color-text-secondary)"> — {describeRoles(currentStep.roles)}</span>
          </p>
          {actions.length === 0 && (
            <p className="text-small text-(--color-text-secondary) mt-0.5">Nothing for you to do here right now.</p>
          )}
        </div>
      )}

      {/* Meta grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Requested by", value: request.requestedBy.name },
          { label: "Submitted", value: formatDate(request.submittedAt) },
          { label: "Vendor", value: request.preferredVendor?.name ?? "Any" },
          { label: "Est. total", value: formatCurrency(request.estimatedTotal) },
          ...(request.status === "ORDERED" || request.status === "RECEIVED" ? [
            { label: "Order confirmation", value: request.orderConfirmation ?? "—" },
            { label: "Actual total", value: formatCurrency(request.actualTotal) },
            { label: "Expected delivery", value: formatDate(request.expectedDelivery) },
            { label: "Received date", value: formatDate(request.receivedDate) },
          ] : []),
        ].map((m) => (
          <div key={m.label} className="card py-3">
            <p className="text-label text-(--color-text-secondary)">{m.label}</p>
            <p className="text-sm font-medium text-(--color-text-primary) mt-0.5">{m.value}</p>
          </div>
        ))}
      </div>

      {/* Justification */}
      {request.justification && (
        <div className="card">
          <p className="text-label text-(--color-text-secondary) mb-1">Justification</p>
          <p className="text-body text-(--color-text-primary)">{request.justification}</p>
        </div>
      )}

      {/* Progress */}
      <div>
        <h2 className="text-h2 text-(--color-text-primary) mb-3">Progress</h2>
        <RequestTimeline entries={timeline} upcoming={upcoming} />
      </div>

      {/* Line items */}
      <div>
        <h2 className="text-h2 text-(--color-text-primary) mb-3">Line items</h2>
        <Table>
          <TableHead>
            <tr>
              <Th>Item</Th>
              <Th>Part #</Th>
              <Th right>Qty</Th>
              <Th right>Unit cost</Th>
              <Th right>Total</Th>
              <Th>BOM</Th>
            </tr>
          </TableHead>
          <TableBody>
            {request.lineItems.map((li) => (
              <Tr key={li.id}>
                <Td>
                  <div>
                    <p className="font-medium">{li.name}</p>
                    {li.baseItem && (
                      <Link href={`/inventory/${li.baseItem.id}`} className="text-small text-(--color-secondary) hover:underline block">
                        Restocks inventory item
                      </Link>
                    )}
                    {li.vendorProductUrl && (
                      <a href={li.vendorProductUrl} target="_blank" rel="noopener noreferrer"
                        className="text-small text-(--color-secondary) hover:underline truncate block max-w-xs">
                        Product link
                      </a>
                    )}
                  </div>
                </Td>
                <Td mono>{li.partNumber ?? "—"}</Td>
                <Td right>{li.quantity}</Td>
                <Td right>{formatCurrency(li.unitCost)}</Td>
                <Td right>{formatCurrency(li.lineTotal)}</Td>
                <Td>{li.goesOnRobotBom ? <Badge variant="info">BOM</Badge> : "—"}</Td>
              </Tr>
            ))}
            <Tr>
              <Td colSpan={4} className="text-right font-medium text-(--color-text-secondary)">Total</Td>
              <Td right className="font-bold text-(--color-text-primary)">{formatCurrency(lineTotal)}</Td>
              <Td />
            </Tr>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
