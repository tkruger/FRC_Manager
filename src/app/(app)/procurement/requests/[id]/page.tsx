import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Table, TableHead, TableBody, Th, Td, Tr } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/utils";
import { statusBadgeVariant, statusLabel, priorityBadgeVariant } from "@/lib/procurement-helpers";
import { RequestActions } from "./RequestActions";
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
      lineItems: { orderBy: { id: "asc" } },
    },
  });

  if (!request) notFound();

  const lineTotal = request.lineItems.reduce((s, l) => s + (l.lineTotal ?? 0), 0);
  const userRoles = session.user.roles ?? [];
  const canApprove = userRoles.some((r) => ["BUDGET_MANAGER", "HEAD_MENTOR"].includes(r));

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Breadcrumb */}
      <nav className="text-small text-[--color-text-secondary]">
        <Link href="/procurement" className="hover:text-[--color-primary]">Procurement</Link>
        <span className="mx-2">›</span>
        <span className="text-[--color-text-primary]">{request.title}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-h1 text-[--color-text-primary]">{request.title}</h1>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <Badge variant={statusBadgeVariant(request.status)}>{statusLabel(request.status)}</Badge>
            <Badge variant={priorityBadgeVariant(request.priority)}>{request.priority}</Badge>
            {request.subTeam && <Badge variant="neutral">{request.subTeam.replace("_", " ")}</Badge>}
          </div>
        </div>
        <RequestActions request={request} canApprove={canApprove} />
      </div>

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
            <p className="text-label text-[--color-text-secondary]">{m.label}</p>
            <p className="text-sm font-medium text-[--color-text-primary] mt-0.5">{m.value}</p>
          </div>
        ))}
      </div>

      {/* Justification */}
      {request.justification && (
        <div className="card">
          <p className="text-label text-[--color-text-secondary] mb-1">Justification</p>
          <p className="text-body text-[--color-text-primary]">{request.justification}</p>
        </div>
      )}

      {/* Line items */}
      <div>
        <h2 className="text-h2 text-[--color-text-primary] mb-3">Line items</h2>
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
                    {li.vendorProductUrl && (
                      <a href={li.vendorProductUrl} target="_blank" rel="noopener noreferrer"
                        className="text-small text-[--color-secondary] hover:underline truncate block max-w-xs">
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
              <Td colSpan={4} className="text-right font-medium text-[--color-text-secondary]">Total</Td>
              <Td right className="font-bold text-[--color-text-primary]">{formatCurrency(lineTotal)}</Td>
              <Td />
            </Tr>
          </TableBody>
        </Table>
      </div>

      {/* Approval notes */}
      {request.approvalNotes && (
        <div className={`card border-l-4 ${request.status === "DENIED" ? "border-l-[--color-danger]" : "border-l-[--color-success]"}`}>
          <p className="text-label text-[--color-text-secondary] mb-1">
            {request.status === "DENIED" ? "Denial reason" : "Approval notes"} — {request.approver?.name}
          </p>
          <p className="text-body text-[--color-text-primary]">{request.approvalNotes}</p>
        </div>
      )}
    </div>
  );
}
