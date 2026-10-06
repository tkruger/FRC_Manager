import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { PageTitle } from "@/components/PageHeader";
import { OrderForm, type DraftItem } from "./OrderForm";

export default async function NewOrderPage({ searchParams }: { searchParams: Promise<{ draft?: string }> }) {
  const { draft: draftId } = await searchParams;
  const session = await auth();
  if (!session?.user?.teamId) redirect("/dashboard");

  const [activeSeason, vendors, draft] = await Promise.all([
    prisma.season.findFirst({ where: { teamId: session.user.teamId, isActive: true }, select: { id: true } }),
    prisma.vendor.findMany({
      where:   { teamId: session.user.teamId },
      orderBy: [{ preferred: "desc" }, { name: "asc" }],
      select:  { name: true },
    }),
    // Carrying on with a saved draft (only your own)
    draftId
      ? prisma.orderDraft.findFirst({ where: { id: draftId, userId: session.user.id }, select: { id: true, name: true, items: true } })
      : null,
  ]);
  if (!activeSeason) redirect("/settings/season");

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div>
        <nav className="text-small text-(--color-text-secondary) mb-1">
          <Link href="/procurement" className="hover:text-(--color-primary)">Orders</Link>
          <span className="mx-2">›</span>{draft ? "Draft" : "New order"}
        </nav>
        <PageTitle help="purchasing">{draft ? "Finish your order" : "New order"}</PageTitle>
        <p className="text-body text-(--color-text-secondary) mt-1">
          One order can hold items from several vendors and sub-teams. Once approved, the items go to the Team Admin to purchase.
        </p>
      </div>
      <OrderForm
        key={draft?.id ?? "new"}
        vendors={vendors.map((v) => v.name)}
        draft={draft ? { id: draft.id, name: draft.name, items: (Array.isArray(draft.items) ? draft.items : []) as DraftItem[] } : undefined}
      />
    </div>
  );
}
