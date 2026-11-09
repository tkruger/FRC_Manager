import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { isViewOnly } from "@/lib/access/read-only";
import { ViewOnlyNotice } from "@/components/access/ViewOnly";
import Link from "next/link";
import { PageTitle } from "@/components/PageHeader";
import { formatCurrency, formatDate } from "@/lib/utils";
import { canEditDraft } from "@/lib/orders/drafts";
import { OrderForm, type DraftItem } from "./OrderForm";
import { DraftCollaborators } from "./DraftCollaborators";
import { unusedBudgetCategories } from "@/lib/budget-unused";

export default async function NewOrderPage({ searchParams }: { searchParams: Promise<{ draft?: string }> }) {
  const { draft: draftId } = await searchParams;
  const session = await auth();
  if (!session?.user?.teamId) redirect("/dashboard");
  if (isViewOnly(session.user.roles)) return <ViewOnlyNotice what="New order" />;

  const [activeSeason, vendors, draft] = await Promise.all([
    prisma.season.findFirst({ where: { teamId: session.user.teamId, isActive: true }, select: { id: true } }),
    prisma.vendor.findMany({
      where:   { teamId: session.user.teamId },
      orderBy: [{ preferred: "desc" }, { name: "asc" }],
      select:  { name: true },
    }),
    // A saved draft — any of the team's (it's shared); editing is for its maker and collaborators
    draftId
      ? prisma.orderDraft.findFirst({
          where:  { id: draftId, teamId: session.user.teamId },
          select: {
            id: true, name: true, items: true, budgetCategory: true, updatedAt: true, userId: true,
            user: { select: { name: true } },
            lastEditedBy: { select: { name: true } },
            collaborators: { select: { userId: true, user: { select: { name: true } } }, orderBy: { addedAt: "asc" } },
          },
        })
      : null,
  ]);
  if (!activeSeason) redirect("/settings/season");

  const me = session.user.id;
  const editable = draft ? canEditDraft(draft, me) : true;
  const isMaker = draft?.userId === me;
  const items = (draft && Array.isArray(draft.items) ? draft.items : []) as DraftItem[];

  // Someone else's draft: shown, not edited
  if (draft && !editable) {
    const total = items.reduce((s, i) => s + (Number(i.unitCost) || 0) * (Number(i.quantity) || 0), 0);
    const people = [draft.user.name, ...draft.collaborators.map((c) => c.user.name)];
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div>
          <nav className="text-small text-(--color-text-secondary) mb-1">
            <Link href="/procurement" className="hover:text-(--color-primary)">Orders</Link>
            <span className="mx-2">›</span><Link href="/procurement?view=drafts" className="hover:text-(--color-primary)">Drafts</Link>
          </nav>
          <PageTitle help="purchasing">{draft.name}</PageTitle>
          <p className="text-body text-(--color-text-secondary) mt-1">
            A draft by {draft.user.name}{people.length > 1 ? `, with ${people.slice(1).join(", ")}` : ""} · saved {formatDate(draft.updatedAt)}
            {draft.lastEditedBy && draft.lastEditedBy.name !== draft.user.name ? ` by ${draft.lastEditedBy.name}` : ""}
          </p>
        </div>
        <div className="rounded-lg border border-(--color-border) bg-(--color-surface-overlay) px-4 py-3 text-sm text-(--color-text-primary)">
          You can see this draft, but only {draft.user.name} and the people they invite can change or submit it. Ask {draft.user.name.split(" ")[0]} to invite you if you want to help.
        </div>
        <div className="card p-0">
          <ul className="divide-y divide-(--color-border)">
            {items.filter((i) => i.name?.trim()).map((i, n) => (
              <li key={n} className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="break-words text-sm font-medium text-(--color-text-primary)">{i.name}</p>
                  <p className="text-small text-(--color-text-secondary)">{[i.vendorName, i.partNumber].filter(Boolean).join(" · ") || "—"}</p>
                </div>
                <p className="shrink-0 text-sm text-(--color-text-primary)">
                  {i.quantity || 1} × {i.unitCost ? formatCurrency(Number(i.unitCost)) : "—"}
                </p>
              </li>
            ))}
            {items.every((i) => !i.name?.trim()) && <li className="px-4 py-6 text-center text-small text-(--color-text-secondary)">No items yet.</li>}
          </ul>
          <div className="flex justify-between border-t border-(--color-border) px-4 py-3 text-sm font-semibold text-(--color-text-primary)">
            <span>Total</span><span>{formatCurrency(total)}</span>
          </div>
        </div>
      </div>
    );
  }

  // Teammates who could be invited (the draft's maker manages that)
  const teammates = draft && isMaker
    ? await prisma.user.findMany({
        where:   { teamId: session.user.teamId, status: "ACTIVE", id: { not: me } },
        select:  { id: true, name: true, roles: { select: { role: true } } },
        orderBy: { name: "asc" },
      })
    : [];

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div>
        <nav className="text-small text-(--color-text-secondary) mb-1">
          <Link href="/procurement" className="hover:text-(--color-primary)">Orders</Link>
          <span className="mx-2">›</span>{draft ? "Draft" : "New order"}
        </nav>
        <PageTitle help="purchasing">{draft ? (isMaker ? "Finish your order" : `Finish ${draft.user.name.split(" ")[0]}'s order`) : "New order"}</PageTitle>
        <p className="text-body text-(--color-text-secondary) mt-1">
          One order can hold items from several vendors and sub-teams. Once approved, the items go to the Buyer to purchase.
        </p>
      </div>
      {draft && (
        <DraftCollaborators
          draftId={draft.id}
          maker={{ id: draft.userId, name: draft.user.name }}
          collaborators={draft.collaborators.map((c) => ({ id: c.userId, name: c.user.name }))}
          canManage={isMaker}
          me={me}
          // Parents (view-only accounts) can't work on orders
          teammates={teammates.filter((t) => !isViewOnly(t.roles.map((r) => r.role))).map((t) => ({ id: t.id, name: t.name }))}
          lastSaved={{ at: draft.updatedAt.toISOString(), by: draft.lastEditedBy?.name ?? null }}
        />
      )}
      <OrderForm
        key={draft?.id ?? "new"}
        unusedCategories={await unusedBudgetCategories(session.user.teamId)}
        vendors={vendors.map((v) => v.name)}
        draft={draft ? { id: draft.id, name: draft.name, budgetCategory: draft.budgetCategory, items } : undefined}
      />
    </div>
  );
}
