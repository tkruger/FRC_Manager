import Link from "next/link";
import type { Prisma, PurchaseStatus } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Table, TableHead, TableBody, Th, Td } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/utils";
import { statusBadgeVariant, statusLabel } from "@/lib/procurement-helpers";
import { AllOrdersControls } from "./AllOrdersControls";

export const OPEN_STATUSES = ["SUBMITTED", "APPROVED", "ORDERED", "PARTIAL_RECEIVED"] as const;
const CLOSED_STATUSES = ["RECEIVED", "DENIED", "CANCELLED"] as const;
const LIST_STATUSES = [...OPEN_STATUSES, ...CLOSED_STATUSES] as PurchaseStatus[];
const SORTS = ["submitted", "title", "status", "requester", "total", "items"] as const;
type Sort = (typeof SORTS)[number];
const PAGE_SIZES = [25, 50, 100] as const;

export type AllOrdersParams = {
  q?: string; status?: string; by?: string; season?: string; sort?: string; dir?: string; page?: string; per?: string;
};

/** The All tab: every order as a list you can search, filter, sort and page through */
export async function AllOrdersList({ teamId, activeSeasonId, params }: { teamId: string; activeSeasonId: string; params: AllOrdersParams }) {
  const q = (params.q ?? "").trim().slice(0, 100);
  const status = params.status ?? "";
  const by = params.by ?? "";
  const seasonParam = params.season ?? "";
  const seasonId = seasonParam === "any" ? null : seasonParam || activeSeasonId;
  const sort: Sort = (SORTS as readonly string[]).includes(params.sort ?? "") ? (params.sort as Sort) : "submitted";
  const dir: "asc" | "desc" = params.dir === "asc" ? "asc" : params.dir === "desc" ? "desc" : sort === "title" || sort === "requester" ? "asc" : "desc";
  const per = (PAGE_SIZES as readonly number[]).includes(Number(params.per)) ? Number(params.per) : 25;

  const statusWhere: Prisma.PurchaseRequestWhereInput =
    status === "open"   ? { status: { in: [...OPEN_STATUSES] } } :
    status === "closed" ? { status: { in: [...CLOSED_STATUSES] } } :
    (LIST_STATUSES as string[]).includes(status) ? { status: status as PurchaseStatus } :
    { status: { in: LIST_STATUSES } };

  const contains = { contains: q, mode: "insensitive" as const };
  const where: Prisma.PurchaseRequestWhereInput = {
    season: { teamId },
    ...(seasonId ? { seasonId } : {}),
    ...statusWhere,
    ...(by ? { requestedById: by } : {}),
    ...(q ? {
      OR: [
        { title: contains },
        { orderConfirmation: contains },
        { requestedBy: { name: contains } },
        { lineItems: { some: { OR: [{ name: contains }, { vendorName: contains }, { partNumber: contains }] } } },
      ],
    } : {}),
  };

  const [orders, seasons, requesters] = await Promise.all([
    // A team's orders number in the hundreds, so sort and page here (the total is a sum over items)
    prisma.purchaseRequest.findMany({
      where,
      select: {
        id: true, title: true, status: true, submittedAt: true,
        requestedBy: { select: { name: true } },
        lineItems:   { select: { unitCost: true, quantity: true, vendorName: true } },
      },
    }),
    prisma.season.findMany({ where: { teamId }, select: { id: true, name: true }, orderBy: { startDate: "desc" } }),
    prisma.user.findMany({
      where:   { teamId, purchaseRequests: { some: seasonId ? { seasonId } : { season: { teamId } } } },
      select:  { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const rows = orders.map((o) => ({
    o,
    total:   o.lineItems.reduce((s, i) => s + (i.unitCost ?? 0) * i.quantity, 0),
    vendors: [...new Set(o.lineItems.map((i) => i.vendorName).filter(Boolean))] as string[],
  }));
  const statusOrder = (s: PurchaseStatus) => LIST_STATUSES.indexOf(s);
  const cmp: Record<Sort, (a: (typeof rows)[number], b: (typeof rows)[number]) => number> = {
    submitted: (a, b) => a.o.submittedAt.getTime() - b.o.submittedAt.getTime(),
    title:     (a, b) => a.o.title.localeCompare(b.o.title, undefined, { sensitivity: "base", numeric: true }),
    status:    (a, b) => statusOrder(a.o.status) - statusOrder(b.o.status),
    requester: (a, b) => a.o.requestedBy.name.localeCompare(b.o.requestedBy.name, undefined, { sensitivity: "base" }),
    total:     (a, b) => a.total - b.total,
    items:     (a, b) => a.o.lineItems.length - b.o.lineItems.length,
  };
  rows.sort((a, b) => {
    const c = cmp[sort](a, b) * (dir === "asc" ? 1 : -1);
    return c !== 0 ? c : b.o.submittedAt.getTime() - a.o.submittedAt.getTime();
  });

  const pages = Math.max(1, Math.ceil(rows.length / per));
  const page = Math.min(pages, Math.max(1, Math.floor(Number(params.page)) || 1));
  const shown = rows.slice((page - 1) * per, page * per);
  const shownTotal = rows.reduce((s, r) => s + r.total, 0);

  // Links that keep every other setting
  const base: Record<string, string> = { view: "all" };
  if (q) base.q = q;
  if (status) base.status = status;
  if (by) base.by = by;
  if (seasonParam) base.season = seasonParam;
  if (params.sort) base.sort = sort;
  if (params.dir) base.dir = dir;
  if (per !== 25) base.per = String(per);
  const href = (over: Record<string, string | null>) => {
    const p = { ...base, ...over };
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(p)) if (v) sp.set(k, v);
    return `/procurement?${sp.toString()}`;
  };
  const sortHref = (s: Sort) => href({ sort: s, dir: s === sort ? (dir === "asc" ? "desc" : "asc") : s === "title" || s === "requester" ? "asc" : "desc", page: null });
  const SortTh = ({ s, label, right, className }: { s: Sort; label: string; right?: boolean; className?: string }) => (
    <Th right={right} className={className}>
      <Link href={sortHref(s)} scroll={false} className={`inline-flex items-center gap-1 hover:text-(--color-text-primary) ${sort === s ? "text-(--color-text-primary)" : ""}`}
        aria-sort={sort === s ? (dir === "asc" ? "ascending" : "descending") : undefined}>
        {label}
        <span aria-hidden="true" className={sort === s ? "" : "opacity-30"}>{sort === s ? (dir === "asc" ? "↑" : "↓") : "↕"}</span>
      </Link>
    </Th>
  );
  const filtered = Boolean(q || status || by || seasonParam);

  return (
    <div className="space-y-4">
      <AllOrdersControls
        q={q} status={status} by={by} season={seasonParam} per={per} sort={sort} dir={dir}
        seasons={seasons.map((s) => ({ id: s.id, name: s.name, active: s.id === activeSeasonId }))}
        requesters={requesters}
      />

      <p className="text-small text-(--color-text-secondary)">
        {rows.length === 0 ? "No orders match." : (
          <>
            {rows.length} order{rows.length === 1 ? "" : "s"} · {formatCurrency(shownTotal)}
            {pages > 1 && <> · showing {(page - 1) * per + 1}–{Math.min(page * per, rows.length)}</>}
          </>
        )}
        {filtered && <> · <Link href="/procurement?view=all" className="text-(--color-secondary) hover:underline">Clear filters</Link></>}
      </p>

      {rows.length > 0 && (
        <Table>
          <TableHead>
            <tr>
              <SortTh s="title" label="Order" />
              <SortTh s="status" label="Status" />
              <SortTh s="requester" label="Requested by" className="hidden md:table-cell" />
              <Th className="hidden lg:table-cell">Vendors</Th>
              <SortTh s="items" label="Items" right className="hidden sm:table-cell" />
              <SortTh s="total" label="Total" right className="hidden sm:table-cell" />
              <SortTh s="submitted" label="Submitted" className="hidden sm:table-cell" />
            </tr>
          </TableHead>
          <TableBody>
            {shown.map(({ o, total, vendors }) => (
              <tr key={o.id} className="hover:bg-(--color-surface-raised) transition-colors">
                <Td className="whitespace-normal min-w-48">
                  <Link href={`/procurement/requests/${o.id}`} className="font-medium text-(--color-text-primary) hover:text-(--color-primary) hover:underline">
                    {o.title}
                  </Link>
                  {/* What the hidden columns would say, on narrow screens */}
                  <p className="text-xs text-(--color-text-secondary) md:hidden mt-0.5">
                    {o.requestedBy.name} · {formatDate(o.submittedAt)} · {o.lineItems.length} item{o.lineItems.length === 1 ? "" : "s"}
                    <span className="sm:hidden"> · <b className="font-semibold text-(--color-text-primary)">{formatCurrency(total)}</b></span>
                  </p>
                </Td>
                <Td><Badge variant={statusBadgeVariant(o.status)}>{statusLabel(o.status)}</Badge></Td>
                <Td className="hidden md:table-cell">{o.requestedBy.name}</Td>
                <Td className="hidden lg:table-cell whitespace-normal text-(--color-text-secondary)">
                  {vendors.slice(0, 2).join(", ")}{vendors.length > 2 ? ` +${vendors.length - 2}` : ""}
                </Td>
                <Td right className="hidden sm:table-cell">{o.lineItems.length}</Td>
                <Td right className="hidden sm:table-cell">{formatCurrency(total)}</Td>
                <Td className="hidden sm:table-cell text-(--color-text-secondary)">{formatDate(o.submittedAt)}</Td>
              </tr>
            ))}
          </TableBody>
        </Table>
      )}

      {pages > 1 && (
        <nav aria-label="Pages" className="flex items-center justify-between gap-3">
          <PageLink href={page > 1 ? href({ page: String(page - 1) }) : null}>← Previous</PageLink>
          <div className="flex items-center gap-1">
            {pageList(page, pages).map((p, i) => p === null ? (
              <span key={`gap${i}`} className="px-1 text-(--color-text-secondary)">…</span>
            ) : (
              <Link key={p} href={href({ page: p === 1 ? null : String(p) })} aria-current={p === page ? "page" : undefined}
                className={`hidden sm:inline-flex min-w-9 h-9 items-center justify-center rounded-md px-2 text-sm ${
                  p === page ? "bg-(--color-primary) text-white font-semibold" : "text-(--color-text-secondary) hover:bg-(--color-surface-raised) hover:text-(--color-text-primary)"
                }`}>
                {p}
              </Link>
            ))}
            <span className="sm:hidden text-small text-(--color-text-secondary)">Page {page} of {pages}</span>
          </div>
          <PageLink href={page < pages ? href({ page: String(page + 1) }) : null}>Next →</PageLink>
        </nav>
      )}
    </div>
  );
}

function PageLink({ href, children }: { href: string | null; children: React.ReactNode }) {
  const cls = "inline-flex h-9 items-center rounded-md border border-(--color-border) px-3 text-sm";
  return href
    ? <Link href={href} className={`${cls} text-(--color-text-primary) hover:border-(--color-primary)`}>{children}</Link>
    : <span className={`${cls} text-(--color-text-secondary) opacity-50`} aria-disabled="true">{children}</span>;
}

/** 1 … 4 5 [6] 7 8 … 20 */
function pageList(page: number, pages: number): (number | null)[] {
  const want = new Set([1, pages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pages));
  const sorted = [...want].sort((a, b) => a - b);
  const out: (number | null)[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push(p - sorted[i - 1] === 2 ? p - 1 : null);
    out.push(p);
  });
  return out;
}
