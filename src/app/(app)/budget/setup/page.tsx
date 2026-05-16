import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { BudgetSetupForm } from "./BudgetSetupForm";

export default async function BudgetSetupPage() {
  const session = await auth();
  if (!session?.user?.teamId) redirect("/dashboard");

  const activeSeason = await prisma.season.findFirst({
    where: { teamId: session.user.teamId, isActive: true },
  });
  if (!activeSeason) redirect("/settings/season");

  const existing = await prisma.budget.findUnique({
    where: { seasonId: activeSeason.id },
    include: { categories: true },
  });

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div>
        <nav className="text-small text-[--color-text-secondary] mb-1">
          <Link href="/budget" className="hover:text-[--color-primary]">Budget</Link>
          <span className="mx-2">›</span>Setup
        </nav>
        <h1 className="text-h1 text-[--color-text-primary]">Budget setup</h1>
        <p className="text-body text-[--color-text-secondary] mt-1">
          Configure total budget and allocations for {activeSeason.name}.
        </p>
      </div>
      <BudgetSetupForm existing={existing} />
    </div>
  );
}
