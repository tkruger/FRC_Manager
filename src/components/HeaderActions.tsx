"use client";

// The buttons at the top right of a page, the same way on every page:
//
//   computer:  [secondary] [secondary] [Primary] [⋯]   (two secondary at most; more go in ⋯)
//   phone:     [Primary] [⋯]            — right-aligned; everything else is in the ⋯ menu, so nothing wraps
//
// Pages list their actions once (as data — see HeaderItem); each is drawn as a button or a menu item
// depending on where it lands. Actions that open a dialog or a panel fire a page action (page-actions.ts)
// that the component doing the work listens for. Destructive ones go last in the menu, in red.

import * as Menu from "@radix-ui/react-dropdown-menu";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import {
  Ban, CalendarPlus, Check, Copy, Download, ExternalLink, FileUp, ListChecks, MoreHorizontal, Pencil, Plus, Printer,
  RefreshCw, Share, Share2, Truck, Tv, X, type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { firePageAction } from "@/components/page-actions";
import { shareLink } from "@/components/ShareButton";
import { exportOrdersCsv } from "@/components/orders/ExportCsvButton";

const ICONS = {
  plus: Plus, edit: Pencil, status: ListChecks, refresh: RefreshCw, download: Download, upload: FileUp, print: Printer,
  external: ExternalLink, calendar: CalendarPlus, copy: Copy, tv: Tv, truck: Truck, approve: Check, deny: X, cancel: Ban,
} satisfies Record<string, LucideIcon>;
export type HeaderIcon = keyof typeof ICONS;

export type HeaderItem = {
  label: string;
  /**
   * primary:   the page's main action — a filled button, shown on phones too (keep it to one; two at most)
   * secondary: a framed button on a computer; in the ⋯ menu on a phone
   * menu:      always in the ⋯ menu
   */
  place: "primary" | "secondary" | "menu";
  icon?: HeaderIcon;
  /** Red, and last in the menu (cancel, delete) */
  danger?: boolean;
  /** A short hint on hover */
  hint?: string;
  /** Computers only (e.g. Present on TV) */
  desktopOnly?: boolean;
} & (
  | { kind: "link"; href: string; external?: boolean }
  | { kind: "download"; href: string }
  | { kind: "action"; action: string }
  | { kind: "share"; path: string; title: string; text?: string }
  | { kind: "csv"; order?: string; view?: string }
  | { kind: "print" }
);

function useRun() {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  async function run(item: HeaderItem) {
    switch (item.kind) {
      case "link":     if (item.external) window.open(item.href, "_blank", "noopener"); else router.push(item.href); return;
      case "download": { const a = document.createElement("a"); a.href = item.href; a.download = ""; a.click(); return; }
      case "action":   firePageAction(item.action); return;
      case "share":    await shareLink(item.path, item.title, item.text); return;
      case "print":    window.print(); return;
      case "csv":      setBusy(item.label); try { await exportOrdersCsv(item); } finally { setBusy(null); } return;
    }
  }
  return { run, busy };
}

const noop = () => () => {};
/** The iPhone-style share icon on Apple devices (worked out after loading, so the server and browser agree) */
function useShareIcon(): LucideIcon {
  return useSyncExternalStore(noop, () => /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent), () => false) ? Share : Share2;
}

/** A header action as a button */
function ItemButton({ item, run, busy }: { item: HeaderItem; run: (i: HeaderItem) => void; busy: string | null }) {
  const ShareIcon = useShareIcon();
  const Icon = item.kind === "share" ? ShareIcon : item.icon ? ICONS[item.icon] : null;
  const variant = item.danger ? "danger" : item.place === "primary" ? "primary" : "outline";
  // Share is just its icon
  if (item.kind === "share") {
    return (
      <Button type="button" size="sm" variant="outline" className="px-2" aria-label={`Share ${item.title}`} title="Share a link" onClick={() => run(item)}>
        {Icon && <Icon className="h-4 w-4" aria-hidden />}
      </Button>
    );
  }
  // Plain links stay links (open in a new tab, prefetch)
  if (item.kind === "link" && !item.external) {
    return (
      <Link href={item.href} title={item.hint}>
        <Button type="button" size="sm" variant={variant}>{Icon && item.place !== "primary" && <Icon className="h-4 w-4" aria-hidden />}{item.label}</Button>
      </Link>
    );
  }
  return (
    <Button type="button" size="sm" variant={variant} title={item.hint} isLoading={busy === item.label} onClick={() => run(item)}>
      {Icon && item.place !== "primary" && <Icon className="h-4 w-4" aria-hidden />}{item.label}
    </Button>
  );
}

export function HeaderActions({ items }: { items: HeaderItem[] }) {
  const { run, busy } = useRun();
  if (items.length === 0) return null;
  const primary = items.filter((i) => i.place === "primary");
  // A computer shows two secondary buttons at most (besides Share); the rest go in ⋯, in the order given
  const allSecondary = items.filter((i) => i.place === "secondary");
  const visible = new Set(allSecondary.filter((i) => i.kind !== "share").slice(0, 2));
  const secondary = allSecondary.filter((i) => i.kind === "share" || visible.has(i));
  const overflow = allSecondary.filter((i) => i.kind !== "share" && !visible.has(i));
  const share = secondary.filter((i) => i.kind === "share");
  // With no main action and just one other button, a phone shows that button rather than a menu of one
  const others = secondary.filter((i) => i.kind !== "share" && !i.desktopOnly);
  const loneOnPhone = primary.length === 0 && others.length === 1 && overflow.length === 0 && items.every((i) => i.place !== "menu") ? others[0] : null;
  // ⋯ on a computer: menu items. On a phone: the secondary ones too (except share, which is just an icon).
  const byDanger = (a: HeaderItem, b: HeaderItem) => Number(!!a.danger) - Number(!!b.danger);
  const menuDesktop = [...overflow, ...items.filter((i) => i.place === "menu")].sort(byDanger);
  const menuPhone = [...secondary.filter((i) => i.kind !== "share" && i !== loneOnPhone), ...overflow, ...items.filter((i) => i.place === "menu")].filter((i) => !i.desktopOnly).sort(byDanger);

  return (
    <div className="flex flex-nowrap items-center justify-end gap-2 sm:flex-wrap">
      {share.map((i) => <ItemButton key={i.label} item={i} run={run} busy={busy} />)}
      {secondary.filter((i) => i.kind !== "share").map((i) => (
        <span key={i.label} className={i === loneOnPhone ? "inline-flex" : "hidden sm:inline-flex"}><ItemButton item={i} run={run} busy={busy} /></span>
      ))}
      {primary.map((i) => (
        <span key={i.label} className={cn("inline-flex", i.desktopOnly && "hidden sm:inline-flex")}><ItemButton item={i} run={run} busy={busy} /></span>
      ))}
      {menuDesktop.length > 0 && <span className="hidden sm:inline-flex"><MoreMenu items={menuDesktop} run={run} /></span>}
      {menuPhone.length > 0 && <span className="inline-flex sm:hidden"><MoreMenu items={menuPhone} run={run} /></span>}
    </div>
  );
}

function MoreMenu({ items, run }: { items: HeaderItem[]; run: (i: HeaderItem) => void }) {
  const ShareIcon = useShareIcon();
  const firstDanger = items.findIndex((i) => i.danger);
  return (
    <Menu.Root modal={false}>
      <Menu.Trigger asChild>
        <Button type="button" size="sm" variant="outline" className="px-2" aria-label="More actions" title="More">
          <MoreHorizontal className="h-4 w-4" aria-hidden />
        </Button>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content align="end" sideOffset={6} collisionPadding={12}
          // Solid — never see-through (the theme's raised surfaces are)
          className="z-50 min-w-52 rounded-lg border border-(--color-border-strong) bg-(--color-surface) p-1 shadow-2xl">
          {items.map((i, n) => {
            const Icon = i.kind === "share" ? ShareIcon : i.icon ? ICONS[i.icon] : null;
            return (
              <div key={i.label}>
                {n === firstDanger && n > 0 && <Menu.Separator className="my-1 h-px bg-(--color-border)" />}
                <Menu.Item
                  onSelect={() => run(i)}
                  className={cn(
                    "flex cursor-pointer select-none items-center gap-2.5 rounded-md px-2.5 py-2 text-sm outline-none",
                    "data-highlighted:bg-(--color-surface-overlay)",
                    i.danger ? "text-(--color-danger)" : "text-(--color-text-primary)",
                  )}
                >
                  {Icon ? <Icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden /> : <span className="w-4" />}
                  {i.label}
                  {i.kind === "link" && i.external && <ExternalLink className="ml-auto h-3.5 w-3.5 opacity-60" aria-hidden />}
                </Menu.Item>
              </div>
            );
          })}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
