import { formatCurrency } from "@/lib/utils";

export interface TimelineEntry {
  id:       string;
  action:   string;
  stepName: string | null;
  actor:    string | null;
  note:     string | null;
  data:     Record<string, unknown> | null;
  at:       string;
}

interface Upcoming {
  name:      string;
  who:       string;
  willSkip:  boolean;
  condition: string | null;
}

const DOT: Record<string, string> = {
  created:   "#64748B",
  entered:   "#B45309",
  skipped:   "#94A3B8",
  approve:   "#1A7F4B",
  deny:      "#C1121F",
  order:     "#1D3A8A",
  receive:   "#1A7F4B",
  cancel:    "#64748B",
  effect:    "#0891B2",
  completed: "#1A7F4B",
};

function headline(e: TimelineEntry): string {
  const who = e.actor ?? "Someone";
  switch (e.action) {
    case "created":   return `${who} submitted the order`;
    case "entered":   return `Waiting on ${e.stepName}`;
    case "skipped":   return `${e.stepName} skipped`;
    case "approve":   return `${who} approved (${e.stepName})`;
    case "deny":      return `${who} denied the order (${e.stepName})`;
    case "order": {
      const conf  = e.data?.orderConfirmation ? ` · #${e.data.orderConfirmation}` : "";
      const total = typeof e.data?.actualTotal === "number" ? ` · ${formatCurrency(e.data.actualTotal)}` : "";
      return `${who} placed the order${conf}${total}`;
    }
    case "receive":   return `${who} confirmed delivery`;
    case "cancel":    return `${who} canceled the order`;
    case "effect":    return e.note ?? "Updated";
    case "completed": return "Order complete";
    default:          return e.action;
  }
}

function when(iso: string) {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function RequestTimeline({ entries, upcoming }: { entries: TimelineEntry[]; upcoming: Upcoming[] }) {
  return (
    <ol className="card space-y-0 py-2">
      {entries.map((e) => (
        <li key={e.id} className="relative flex gap-3 py-2">
          <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: DOT[e.action] ?? "#64748B" }} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <p className={`text-sm ${e.action === "effect" ? "text-(--color-text-secondary)" : "font-medium text-(--color-text-primary)"}`}>
                {headline(e)}
              </p>
              <time className="text-xs text-(--color-text-secondary) whitespace-nowrap">{when(e.at)}</time>
            </div>
            {e.note && e.action !== "effect" && (
              <p className="text-small text-(--color-text-secondary) mt-0.5">{e.note}</p>
            )}
          </div>
        </li>
      ))}
      {upcoming.map((u) => (
        <li key={u.name} className="flex gap-3 py-2 opacity-60">
          <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full border-2 border-(--color-border)" />
          <div className="min-w-0">
            <p className="text-sm text-(--color-text-primary)">
              Then: {u.name}
              {u.willSkip && <span className="text-(--color-text-secondary)"> — will be skipped</span>}
            </p>
            <p className="text-small text-(--color-text-secondary)">
              {u.willSkip && u.condition ? `Only required when ${u.condition}` : u.who}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
