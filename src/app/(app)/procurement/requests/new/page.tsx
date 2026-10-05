import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { PageTitle } from "@/components/PageHeader";
import { OrderForm } from "./OrderForm";

export default async function NewOrderPage() {
  const session = await auth();
  if (!session?.user?.teamId) redirect("/dashboard");

  const [activeSeason, vendors] = await Promise.all([
    prisma.season.findFirst({ where: { teamId: session.user.teamId, isActive: true }, select: { id: true } }),
    prisma.vendor.findMany({
      where:   { teamId: session.user.teamId },
      orderBy: [{ preferred: "desc" }, { name: "asc" }],
      select:  { name: true },
    }),
  ]);
  if (!activeSeason) redirect("/settings/season");

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div>
        <nav className="text-small text-(--color-text-secondary) mb-1">
          <Link href="/procurement" className="hover:text-(--color-primary)">Orders</Link>
          <span className="mx-2">›</span>New order
        </nav>
        <PageTitle help="purchasing">New order</PageTitle>
        <p className="text-body text-(--color-text-secondary) mt-1">
          One order can hold items from several vendors and sub-teams. Once approved, the items go to the Team Admin to purchase.
        </p>
      </div>
      <OrderForm vendors={vendors.map((v) => v.name)} />
    </div>
  );
}
