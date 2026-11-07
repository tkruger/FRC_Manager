import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/PageHeader";
import { SubcategoryManager } from "./SubcategoryManager";

// Inventory → Sub-categories: the team's sub-categories of each category (sub-folders in the list)

export default async function SubcategoriesPage() {
  const session = await auth();
  if (!session?.user?.teamId) redirect("/dashboard");
  if (!session.user.roles.some((r) => ["INVENTORY_ADMIN", "HEAD_MENTOR"].includes(r))) redirect("/inventory");

  const season = await prisma.season.findFirst({ where: { teamId: session.user.teamId, isActive: true }, select: { id: true } });
  const subs = await prisma.inventorySubcategory.findMany({
    where: { teamId: session.user.teamId },
    select: { id: true, category: true, name: true, _count: { select: { items: season ? { where: { seasonId: season.id, archived: false } } : true } } },
    orderBy: { name: "asc" },
  });

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <PageHeader
        title="Sub-categories"
        breadcrumb={<><Link href="/inventory" className="hover:text-(--color-primary)">Inventory</Link><span className="mx-2">›</span>Sub-categories</>}
        subtitle="Sub-folders inside each inventory folder — e.g. Gears, Belts and Sprockets under Mechanical. An item doesn't need one."
      />
      <SubcategoryManager subcategories={subs.map((s) => ({ id: s.id, category: s.category, name: s.name, items: s._count.items }))} />
    </div>
  );
}
