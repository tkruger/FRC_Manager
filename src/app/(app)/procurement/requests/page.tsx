import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableHead, TableBody, Th, Td, Tr } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/utils";
import { statusBadgeVariant, statusLabel, priorityBadgeVariant } from "@/lib/procurement-helpers";

export default async function AllRequestsPage() {
  const session = await auth();
  if (!session?.user?.teamId) redirect("/dashboard");

  const activeSeason = await prisma.season.findFirst({
    where: { teamId: session.user.teamId, isActive: true },
  });
  if (!activeSeason) redirect("/settings/season");

  const requests = await prisma.purchaseRequest.findMany({
    where: { seasonId: activeSeason.id },
    include: {
      requestedBy: { select: { name: true } },
      preferredVendor: { select: { name: true } },
    },
    orderBy: [{ submittedAt: "desc" }],
  });

  const statusOrder = ["SUBMITTED", "APPROVED", "ORDERED", "PARTIAL_RECEIVED", "RECEIVED", "DENIED", "CANCELLED", "DRAFT"];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <nav className="text-small text-[--color-text-secondary] mb-1">
            <Link href="/procurement" className="hover:text-[--color-primary]">Procurement</Link>
            <span className="mx-2">›</span>All requests
          </nav>
          <h1 className="text-h1 text-[--color-text-primary]">All requests</h1>
          <p className="text-body text-[--color-text-secondary] mt-0.5">{requests.length} total this season</p>
        </div>
        <Link href="/procurement/requests/new">
          <Button size="sm">+ New request</Button>
        </Link>
      </div>

      {requests.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-body text-[--color-text-secondary] mb-4">No purchase requests yet.</p>
          <Link href="/procurement/requests/new"><Button>Submit first request</Button></Link>
        </div>
      ) : (
        <Table>
          <TableHead>
            <tr>
              <Th>Request</Th>
              <Th>Priority</Th>
              <Th>Sub-team</Th>
              <Th>Vendor</Th>
              <Th>Status</Th>
              <Th right>Est. total</Th>
              <Th>Submitted</Th>
            </tr>
          </TableHead>
          <TableBody>
            {requests.map((r) => (
              <Tr key={r.id}>
                <Td>
                  <Link href={`/procurement/requests/${r.id}`}
                    className="font-medium text-[--color-text-primary] hover:text-[--color-primary]">
                    {r.title}
                  </Link>
                  <p className="text-small text-[--color-text-secondary]">by {r.requestedBy.name}</p>
                </Td>
                <Td><Badge variant={priorityBadgeVariant(r.priority)}>{r.priority}</Badge></Td>
                <Td>{r.subTeam?.replace("_", " ") ?? "—"}</Td>
                <Td>{r.preferredVendor?.name ?? "—"}</Td>
                <Td><Badge variant={statusBadgeVariant(r.status)}>{statusLabel(r.status)}</Badge></Td>
                <Td right>{formatCurrency(r.estimatedTotal)}</Td>
                <Td>{formatDate(r.submittedAt)}</Td>
              </Tr>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
