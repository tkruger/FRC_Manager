import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { canEditLocations } from "@/lib/packing";
import { LocationsClient } from "./LocationsClient";

export default async function ToolLocationsPage() {
  const session = await auth();
  if (!session?.user?.teamId) redirect("/dashboard");
  const teamId = session.user.teamId;

  const [locations, tools] = await Promise.all([
    prisma.toolLocation.findMany({ where: { teamId }, orderBy: { name: "asc" }, select: { id: true, name: true, code: true } }),
    prisma.tool.groupBy({ by: ["homeLocation"], where: { teamId, retired: false, homeLocation: { not: null } }, _count: true }),
  ]);
  const counts = new Map(tools.map((t) => [t.homeLocation, t._count]));

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <PageHeader
        title="Tool locations"
        help="tools"
        breadcrumb={<><Link href="/tools" className="hover:text-(--color-primary)">Tools</Link><span className="mx-2">›</span>Locations</>}
        subtitle="Shelves, cabinets, totes and cases. Print their barcodes, then scan a tool and a location to put the tool there."
        actions={locations.length > 0 && (
          <Link href="/tools/locations/labels"><Button variant="outline" size="sm">Print all labels</Button></Link>
        )}
      />
      <LocationsClient
        locations={locations.map((l) => ({ ...l, tools: counts.get(l.name) ?? 0 }))}
        canEdit={canEditLocations(session.user.roles)}
      />
    </div>
  );
}
