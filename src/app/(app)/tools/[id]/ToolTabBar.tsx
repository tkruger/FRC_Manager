"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

interface Props {
  toolId:  string;
  canEdit: boolean;
}

export function ToolTabBar({ toolId, canEdit }: Props) {
  const pathname    = usePathname();
  const searchParams = useSearchParams();
  const tab         = searchParams.get("tab") ?? "checkout";

  const base = `/tools/${toolId}`;

  const tabs = [
    { key: "checkout", label: "Check out", href: base },
    ...(canEdit ? [{ key: "edit", label: "Edit", href: `${base}?tab=edit` }] : []),
  ];

  return (
    <div className="flex gap-0 border-b border-[--color-table-border]">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === t.key
              ? "border-[--color-primary] text-[--color-primary]"
              : "border-transparent text-[--color-text-secondary] hover:text-[--color-text-primary]"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
