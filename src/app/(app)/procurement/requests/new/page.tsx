import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { NewRequestForm } from "./NewRequestForm";

export default async function NewRequestPage() {
  const session = await auth();
  if (!session?.user?.teamId) redirect("/dashboard");

  const [activeSeason, vendors] = await Promise.all([
    prisma.season.findFirst({ where: { teamId: session.user.teamId, isActive: true } }),
    prisma.vendor.findMany({
      where: { teamId: session.user.teamId },
      orderBy: [{ preferred: "desc" }, { name: "asc" }],
      select: { id: true, name: true, preferred: true },
    }),
  ]);

  if (!activeSeason) redirect("/settings/season");

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-h1 text-[--color-text-primary] mb-1">New purchase request</h1>
      <p className="text-body text-[--color-text-secondary] mb-6">
        Requests under $50 are auto-approved. Emergency requests notify budget managers immediately.
      </p>
      <NewRequestForm vendors={vendors} />
    </div>
  );
}
