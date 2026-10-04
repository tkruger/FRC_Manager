import Link from "next/link";

/** Section ids on /help — keep in sync with the guide's sections. */
export type HelpTopic =
  | "getting-started" | "tasks" | "templates" | "season" | "calendar" | "inventory"
  | "purchasing" | "budget" | "tools" | "safety" | "fleet" | "notifications" | "roles" | "discord";

/** Small "?" button that opens the matching section of the help guide. */
export function HelpLink({ topic, label }: { topic: HelpTopic; label?: string }) {
  return (
    <Link
      href={`/help#${topic}`}
      title={label ?? "How this page works"}
      aria-label={label ?? "Help for this page"}
      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-(--color-border-strong) text-xs font-bold text-(--color-text-secondary) align-middle transition-colors hover:border-(--color-primary) hover:text-(--color-primary)"
    >
      ?
    </Link>
  );
}
