import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Table, TableHead, TableBody, Th, Td, Tr } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { SeedVendorsButton } from "./SeedVendorsButton";
import { AddVendorDialog } from "./AddVendorDialog";

export default async function VendorsPage() {
  const session = await auth();
  if (!session?.user?.teamId) redirect("/dashboard");

  const vendors = await prisma.vendor.findMany({
    where: { teamId: session.user.teamId },
    orderBy: [{ preferred: "desc" }, { name: "asc" }],
  });

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h1 text-[--color-text-primary]">Vendors</h1>
          <p className="text-body text-[--color-text-secondary] mt-1">{vendors.length} vendor{vendors.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex gap-2">
          {vendors.length === 0 && <SeedVendorsButton />}
          <AddVendorDialog />
        </div>
      </div>

      {vendors.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-body text-[--color-text-secondary] mb-4">No vendors yet.</p>
          <SeedVendorsButton label="Import FRC vendor list" />
        </div>
      ) : (
        <Table>
          <TableHead>
            <tr>
              <Th>Vendor</Th>
              <Th>Lead time</Th>
              <Th>FRC discount / notes</Th>
              <Th>Contact</Th>
              <Th>Status</Th>
            </tr>
          </TableHead>
          <TableBody>
            {vendors.map((v) => (
              <Tr key={v.id}>
                <Td>
                  <div>
                    <p className="font-medium text-[--color-text-primary]">{v.name}</p>
                    {v.website && (
                      <a href={v.website} target="_blank" rel="noopener noreferrer"
                        className="text-small text-[--color-secondary] hover:underline">
                        {v.website.replace(/^https?:\/\//, "")}
                      </a>
                    )}
                  </div>
                </Td>
                <Td>{v.typicalLeadDays != null ? `${v.typicalLeadDays} days` : "—"}</Td>
                <Td className="max-w-xs">
                  <p className="truncate text-small text-[--color-text-secondary]">
                    {v.frcDiscount || v.notes || "—"}
                  </p>
                </Td>
                <Td>{v.primaryContact || "—"}</Td>
                <Td>
                  {v.preferred
                    ? <Badge variant="success">Preferred</Badge>
                    : <Badge variant="neutral">Standard</Badge>}
                </Td>
              </Tr>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
