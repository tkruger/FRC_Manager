import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableHead, TableBody, Th, Td, Tr } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/utils";
import { statusBadgeVariant, statusLabel, priorityBadgeVariant } from "@/lib/procurement-helpers";
import { differenceInDays } from "date-fns";

export default async function ProcurementDashboard() {
  const session = await auth();
  if (!session?.user?.teamId) redirect("/dashboard");

  const activeSeason = await prisma.season.findFirst({
    where: { teamId: session.user.teamId, isActive: true },
  });

  if (!activeSeason) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-h1 text-[--color-text-primary] mb-4">Procurement</h1>
        <div className="card">
          <p className="text-body text-[--color-text-secondary]">
            No active season configured. <Link href="/settings/season" className="text-[--color-secondary] hover:underline">Set up a season</Link> first.
          </p>
        </div>
      </div>
    );
  }

  const [requests, pendingApproval] = await Promise.all([
    prisma.purchaseRequest.findMany({
      where: {
        seasonId: activeSeason.id,
        status: { in: ["SUBMITTED", "APPROVED", "ORDERED", "PARTIAL_RECEIVED"] },
      },
      include: { requestedBy: { select: { name: true } }, preferredVendor: { select: { name: true } }, lineItems: true },
      orderBy: [{ priority: "desc" }, { submittedAt: "desc" }],
    }),
    prisma.purchaseRequest.count({
      where: { seasonId: activeSeason.id, status: "SUBMITTED" },
    }),
  ]);

  const week0 = activeSeason.week0Date;

  // Summary counts
  const counts = {
    pendingApproval,
    approved: requests.filter((r) => r.status === "APPROVED").length,
    ordered: requests.filter((r) => r.status === "ORDERED").length,
    total: requests.length,
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h1 text-[--color-text-primary]">Procurement</h1>
          <p className="text-body text-[--color-text-secondary] mt-1">{activeSeason.name}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/procurement/vendors">
            <Button variant="outline" size="sm">Vendors</Button>
          </Link>
          <Link href="/procurement/requests/new">
            <Button size="sm">+ New request</Button>
          </Link>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Pending approval", value: counts.pendingApproval, variant: counts.pendingApproval > 0 ? "warning" : "neutral" as const },
          { label: "Approved (not ordered)", value: counts.approved, variant: counts.approved > 0 ? "info" : "neutral" as const },
          { label: "Ordered (in transit)", value: counts.ordered, variant: "info" as const },
          { label: "Open requests", value: counts.total, variant: "neutral" as const },
        ].map((s) => (
          <div key={s.label} className="card">
            <p className="text-small text-[--color-text-secondary]">{s.label}</p>
            <p className="text-display text-[--color-text-primary] mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Open orders table */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-h2 text-[--color-text-primary]">Open requests</h2>
          <Link href="/procurement/requests" className="text-small text-[--color-secondary] hover:underline">View all</Link>
        </div>

        {requests.length === 0 ? (
          <div className="card text-center py-10">
            <p className="text-body text-[--color-text-secondary]">No open requests.</p>
            <Link href="/procurement/requests/new" className="mt-3 inline-block">
              <Button size="sm">Submit first request</Button>
            </Link>
          </div>
        ) : (
          <Table>
            <TableHead>
              <tr>
                <Th>Request</Th>
                <Th>Priority</Th>
                <Th>Vendor</Th>
                <Th>Status</Th>
                <Th right>Est. total</Th>
                <Th>Delivery / lead risk</Th>
                <Th />
              </tr>
            </TableHead>
            <TableBody>
              {requests.map((r) => {
                const daysToWeek0 = r.expectedDelivery
                  ? differenceInDays(week0, r.expectedDelivery)
                  : null;
                const deliveryRisk =
                  daysToWeek0 !== null && daysToWeek0 < 0
                    ? "danger"
                    : daysToWeek0 !== null && daysToWeek0 < 3
                    ? "warning"
                    : null;

                return (
                  <Tr key={r.id}>
                    <Td>
                      <Link href={`/procurement/requests/${r.id}`} className="font-medium text-[--color-text-primary] hover:text-[--color-primary]">
                        {r.title}
                      </Link>
                      <p className="text-small text-[--color-text-secondary]">by {r.requestedBy.name} · {formatDate(r.submittedAt)}</p>
                    </Td>
                    <Td>
                      <Badge variant={priorityBadgeVariant(r.priority)}>{r.priority}</Badge>
                    </Td>
                    <Td>{r.preferredVendor?.name ?? "—"}</Td>
                    <Td>
                      <Badge variant={statusBadgeVariant(r.status)}>{statusLabel(r.status)}</Badge>
                    </Td>
                    <Td right>{formatCurrency(r.estimatedTotal)}</Td>
                    <Td>
                      {r.expectedDelivery ? (
                        <span className={deliveryRisk === "danger" ? "text-[--color-danger] font-medium" : deliveryRisk === "warning" ? "text-[--color-warning] font-medium" : "text-[--color-text-secondary]"}>
                          {formatDate(r.expectedDelivery)}
                          {deliveryRisk === "danger" && " ⚠ Late"}
                          {deliveryRisk === "warning" && " ⚡ Close"}
                        </span>
                      ) : "—"}
                    </Td>
                    <Td>
                      <Link href={`/procurement/requests/${r.id}`}
                        className="text-sm text-[--color-secondary] hover:underline whitespace-nowrap">
                        View →
                      </Link>
                    </Td>
                  </Tr>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
