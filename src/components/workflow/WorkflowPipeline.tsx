import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  describeCondition,
  describeRoles,
  STEP_TYPE_DISPLAY,
  type WorkflowDef,
  type WorkflowStep,
} from "@/lib/workflow/types";

// Read-only visual of a purchase workflow. No hooks, so it renders in both server
// pages and the client-side editor preview.

interface Props {
  def: WorkflowDef;
  /** Open requests currently parked on each step, keyed by step key */
  counts?: Record<string, number>;
}

const STEP_ACCENT: Record<WorkflowStep["type"], string> = {
  approval: "#B45309",
  order:    "#1D3A8A",
  receive:  "#1A7F4B",
};

export function WorkflowPipeline({ def, counts }: Props) {
  return (
    <ol className="relative space-y-3">
      <Stage
        index="start"
        accent="#64748B"
        title="Order is placed"
        badge="Trigger"
      >
        <Detail label="How">
          {def.trigger.autoReorder
            ? "Automatically: when an item's stock falls to or below its minimum, it is added to the inventory order queue. Someone then turns it into an order with one click."
            : "Automatic reorders are off — low stock does not add items to the order queue."}
          {" "}Anyone on the team can also order an item from inventory (including one that isn&apos;t tracked yet, which adds it with 0 in stock) or place an order directly.
        </Detail>
        {def.trigger.autoReorder && (
          <Detail label="Notifies">
            {def.trigger.notifyRoles.length > 0 ? describeRoles(def.trigger.notifyRoles) : "Nobody (the item just appears in the queue)"}
          </Detail>
        )}
      </Stage>

      {def.steps.map((step, i) => (
        <StepStage key={step.key} step={step} number={i + 1} count={counts?.[step.key]} />
      ))}

      <Stage index="end" accent="#1A7F4B" title="Done" badge="Complete">
        <Detail label="Result">
          The order is closed as Received.
          {def.steps.some((s) => s.effects.addStock) && " Stock levels reflect the delivery."}
          {def.steps.some((s) => s.effects.recordExpense) && " The budget shows the actual spend."}
        </Detail>
        <Detail label="Reminders">
          Whoever an order is waiting on is reminded every {hours(def.reminders.routineHours)} for routine orders and
          every {hours(def.reminders.urgentHours)} for urgent or emergency ones, until someone acts. People can opt out in their notification settings.
        </Detail>
        <Detail label="Other endings">
          Denied at an approval step, or canceled before ordering. Either way, a linked reorder goes back into the queue.
        </Detail>
      </Stage>
    </ol>
  );
}

function StepStage({ step, number, count }: { step: WorkflowStep; number: number; count?: number }) {
  const cond = describeCondition(step.when);
  const effects: string[] = [];
  if (step.effects.recordCommitment) effects.push("Logs the order total as committed spend in the budget");
  if (step.effects.addStock)         effects.push("Adds received quantities to linked inventory items");
  if (step.effects.recordExpense)    effects.push("Records the actual expense in the budget");

  const notifies: string[] = [];
  if (step.notify.roles.length > 0) notifies.push(`${describeRoles(step.notify.roles)} when it arrives here`);
  if (step.notify.requester)        notifies.push(step.type === "approval" ? "the requester when approved or denied" : "the requester when done");
  if (step.notify.discord)          notifies.push("the Discord orders channel");

  return (
    <Stage
      index={number}
      accent={STEP_ACCENT[step.type]}
      title={step.name}
      badge={STEP_TYPE_DISPLAY[step.type].label}
      description={step.description}
      aside={count != null && count > 0 && (
        <Link href="/procurement" className="text-small font-medium text-(--color-secondary) hover:underline whitespace-nowrap">
          {count} here now
        </Link>
      )}
    >
      <Detail label="Who acts">
        {STEP_TYPE_DISPLAY[step.type].verb}: {describeRoles(step.roles)}
        {!step.roles.includes("HEAD_MENTOR") && " (Head Mentor can always act)"}
        {step.type === "approval" && step.allowSelfApproval === false && ". Requesters can't approve their own order"}
      </Detail>
      <Detail label="Applies">
        {cond ? <>Only when {cond}. Otherwise <span className="font-medium">skipped automatically</span>.</> : "Always"}
      </Detail>
      <Detail label="Notifies">{notifies.length > 0 ? capitalize(notifies.join("; ")) : "Nobody"}</Detail>
      {effects.length > 0 && <Detail label="On completion">{effects.join(". ")}.</Detail>}
    </Stage>
  );
}

function Stage({
  index, accent, title, badge, description, aside, children,
}: {
  index:    number | "start" | "end";
  accent:   string;
  title:    string;
  badge:    string;
  description?: string;
  aside?:   React.ReactNode;
  children: React.ReactNode;
}) {
  const isLast = index === "end";
  return (
    <li className="relative pl-11">
      {/* Connector line to the next stage */}
      {!isLast && (
        <span aria-hidden className="absolute left-[15px] top-9 -bottom-3 w-0.5 bg-(--color-border)" />
      )}
      <span
        aria-hidden
        className="absolute left-0 top-3 flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white"
        style={{ backgroundColor: accent }}
      >
        {index === "start" ? "▶" : index === "end" ? "✓" : index}
      </span>
      <div className="card py-3 px-4 space-y-2" style={{ borderLeft: `3px solid ${accent}` }}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <h3 className="text-sm font-semibold text-(--color-text-primary)">{title}</h3>
            <span
              className="rounded px-1.5 py-0.5 text-xs font-medium"
              style={{ color: accent, backgroundColor: `color-mix(in srgb, ${accent} 12%, transparent)` }}
            >
              {badge}
            </span>
          </div>
          {aside}
        </div>
        {description && <p className="text-small text-(--color-text-secondary)">{description}</p>}
        <dl className="space-y-1.5">{children}</dl>
      </div>
    </li>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={cn("grid gap-x-3 gap-y-0.5 sm:grid-cols-[110px_1fr]")}>
      <dt className="text-small font-medium text-(--color-text-secondary)">{label}</dt>
      <dd className="text-small text-(--color-text-primary)">{children}</dd>
    </div>
  );
}

function hours(h: number) {
  return h === 24 ? "day" : h % 24 === 0 ? `${h / 24} days` : h === 1 ? "hour" : `${h} hours`;
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
