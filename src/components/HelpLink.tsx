import Link from "next/link";
import { BookOpen } from "lucide-react";

/** Section ids on /help — keep in sync with the guide's sections. */
export type HelpTopic =
  | "getting-started" | "tasks" | "templates" | "season" | "calendar" | "inventory"
  | "purchasing" | "budget" | "tools" | "safety" | "fleet" | "notifications" | "roles" | "discord";

/** Visual of the help button, also used inside the guide when referring to it. */
export function HelpBadge({ label = "Guide" }: { label?: string }) {
  return (
    // Tinted (not solid) so it stays readable in every colour theme, light or dark
    <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-(--color-secondary)/15 px-2.5 text-xs font-semibold text-(--color-secondary) ring-1 ring-(--color-secondary)/50 shadow-sm transition-all group-hover:scale-105 group-hover:bg-(--color-secondary)/25 group-hover:shadow-md">
      <BookOpen className="h-3.5 w-3.5" aria-hidden strokeWidth={2.25} />
      {label}
    </span>
  );
}

/** Coloured "Guide" button that opens the matching section of the help guide. */
export function HelpLink({ topic, label }: { topic: HelpTopic; label?: string }) {
  return (
    <Link
      href={`/help#${topic}`}
      title={label ?? "How this page works"}
      aria-label={label ?? "Help guide for this page"}
      // The link is the tap target (44px on phones); the visible pill stays compact
      className="group inline-flex shrink-0 items-center justify-center align-middle"
    >
      <HelpBadge />
    </Link>
  );
}
