import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ScanClient } from "./ScanClient";

export default async function ToolScanPage() {
  const session = await auth();
  if (!session?.user?.teamId) redirect("/dashboard");

  const locations = await prisma.toolLocation.findMany({
    where:   { teamId: session.user.teamId },
    select:  { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="max-w-md mx-auto px-4 py-8 space-y-6">
      <div>
        <nav className="text-small text-(--color-text-secondary) mb-1">
          <Link href="/tools" className="hover:text-(--color-primary)">Tools</Link>
          <span className="mx-2">›</span>Scan
        </nav>
        <h1 className="text-h1 text-(--color-text-primary)">Scan</h1>
        <p className="text-body text-(--color-text-secondary) mt-1">
          Point your camera at a tool&apos;s or location&apos;s barcode to check out, check in, or put tools away.
        </p>
      </div>
      <ScanClient locations={locations} />
    </div>
  );
}
