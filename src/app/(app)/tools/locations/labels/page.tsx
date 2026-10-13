import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LocationLabels } from "./LocationLabels";

/** Printable barcode labels for one location (?id=) or all of them */
export default async function LocationLabelsPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  const session = await auth();
  if (!session?.user?.teamId) redirect("/dashboard");

  const locations = await prisma.toolLocation.findMany({
    where:   { teamId: session.user.teamId, ...(id ? { id } : {}) },
    orderBy: { name: "asc" },
    select:  { id: true, name: true, code: true },
  });

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <nav className="no-print text-small text-(--color-text-secondary)">
        <Link href="/tools" className="hover:text-(--color-primary)">Tools</Link>
        <span className="mx-2">›</span>
        <Link href="/tools/locations" className="hover:text-(--color-primary)">Locations</Link>
        <span className="mx-2">›</span>Labels
      </nav>
      <LocationLabels locations={locations} />
    </div>
  );
}
