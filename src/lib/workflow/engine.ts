// Purchase workflow engine — the single place that moves a purchase request
// between steps. Server-only: imported by server actions and server components.
// Pure step/permission rules live in ./rules.

import { prisma } from "@/lib/prisma";
import type { Prisma, PurchaseStatus, Role, NotificationType } from "@/generated/prisma";
import { notifyTeam, createNotification } from "@/lib/notifications";
import {
  notifyPurchaseSubmitted,
  notifyPurchaseApproved,
  notifyPurchaseDenied,
  notifyPurchaseProgress,
} from "@/lib/discord-notify";
import { DEFAULT_PURCHASE_WORKFLOW } from "./default-purchase";
import { resolveCurrentStep, availableActions, type WorkflowAction } from "./rules";
import {
  parseWorkflow,
  evaluateCondition,
  describeCondition,
  STEP_STATUS,
  type WorkflowDef,
  type WorkflowStep,
  type ConditionSubject,
} from "./types";

type Tx = Prisma.TransactionClient;

export type { WorkflowAction, AvailableAction } from "./rules";
export { resolveCurrentStep, availableActions, canActOnStep } from "./rules";

export interface Actor {
  id:     string;
  name:   string | null | undefined;
  roles:  Role[];
  teamId: string;
}

export interface ActiveWorkflow {
  id:        string | null; // null = built-in default
  version:   number;        // 0 = built-in default
  def:       WorkflowDef;
  createdAt: Date | null;
  createdBy: string | null;
}

// ── Loading definitions ─────────────────────────────────────────────────────

export async function getActiveWorkflow(teamId: string): Promise<ActiveWorkflow> {
  const row = await prisma.workflowDefinition.findFirst({
    where:   { teamId, kind: "PURCHASE", isActive: true },
    include: { createdBy: { select: { name: true } } },
    orderBy: { version: "desc" },
  });
  if (!row) {
    return { id: null, version: 0, def: DEFAULT_PURCHASE_WORKFLOW, createdAt: null, createdBy: null };
  }
  return {
    id:        row.id,
    version:   row.version,
    def:       safeParse(row.definition),
    createdAt: row.createdAt,
    createdBy: row.createdBy?.name ?? null,
  };
}

function safeParse(json: unknown): WorkflowDef {
  try {
    return parseWorkflow(json);
  } catch {
    // A stored definition that no longer validates should never strand requests.
    return DEFAULT_PURCHASE_WORKFLOW;
  }
}

export async function definitionFor(workflowDefinitionId: string | null): Promise<WorkflowDef> {
  if (!workflowDefinitionId) return DEFAULT_PURCHASE_WORKFLOW;
  const row = await prisma.workflowDefinition.findUnique({ where: { id: workflowDefinitionId } });
  return row ? safeParse(row.definition) : DEFAULT_PURCHASE_WORKFLOW;
}

// ── Request state ───────────────────────────────────────────────────────────

interface RequestState {
  id:                   string;
  title:                string;
  status:               PurchaseStatus;
  currentStepKey:       string | null;
  requestedById:        string;
  priority:             string;
  subTeam:              string | null;
  budgetCategory:       string | null;
  estimatedTotal:       number | null;
  workflowDefinitionId: string | null;
}

const STATE_SELECT = {
  id: true, title: true, status: true, currentStepKey: true, requestedById: true,
  priority: true, subTeam: true, budgetCategory: true, estimatedTotal: true,
  workflowDefinitionId: true,
} as const;

function subjectOf(r: RequestState): ConditionSubject {
  return {
    total:          r.estimatedTotal ?? 0,
    priority:       r.priority,
    subTeam:        r.subTeam,
    budgetCategory: r.budgetCategory,
  };
}

// ── Events ──────────────────────────────────────────────────────────────────

async function logEvent(
  tx: Tx,
  requestId: string,
  e: { step?: WorkflowStep | null; action: string; actorId?: string | null; note?: string | null; data?: Prisma.InputJsonValue },
) {
  await tx.purchaseRequestEvent.create({
    data: {
      requestId,
      stepKey:  e.step?.key ?? null,
      stepName: e.step?.name ?? null,
      action:   e.action,
      actorId:  e.actorId ?? null,
      note:     e.note ?? null,
      data:     e.data,
    },
  });
}

// Notifications are collected during the transaction and sent after it commits.
type Outbox = (() => Promise<unknown>)[];

const ENTER_NOTIFICATION: Record<WorkflowStep["type"], { type: NotificationType; verb: string }> = {
  approval: { type: "PURCHASE_SUBMITTED", verb: "needs approval" },
  order:    { type: "PURCHASE_APPROVED",  verb: "is ready to order" },
  receive:  { type: "ORDER_RECEIVED",     verb: "is on order — confirm when it arrives" },
};

/**
 * Walk forward from `fromIndex`, skipping steps whose condition is false, and park
 * the request on the first step that applies (or complete it if none do).
 */
async function enterNextStep(tx: Tx, r: RequestState, def: WorkflowDef, fromIndex: number, teamId: string, outbox: Outbox) {
  for (let i = fromIndex; i < def.steps.length; i++) {
    const step = def.steps[i];
    if (!evaluateCondition(step.when, subjectOf(r))) {
      const cond = describeCondition(step.when);
      await logEvent(tx, r.id, {
        step,
        action: "skipped",
        note: cond ? `Skipped automatically — only required when ${cond}.` : "Skipped automatically.",
      });
      continue;
    }

    const status = STEP_STATUS[step.type];
    await tx.purchaseRequest.update({ where: { id: r.id }, data: { currentStepKey: step.key, status } });
    await syncReorders(tx, r.id, status);
    await logEvent(tx, r.id, { step, action: "entered" });

    const link = `/procurement/requests/${r.id}`;
    if (step.notify.roles.length > 0) {
      const n = ENTER_NOTIFICATION[step.type];
      const emergency = r.priority === "EMERGENCY" ? "🚨 " : "";
      outbox.push(() => notifyTeam({
        teamId,
        roles: step.notify.roles,
        type:  n.type,
        topic: "purchase.action_needed",
        bypassQuietHours: r.priority === "EMERGENCY",
        title: `${emergency}"${r.title}" ${n.verb}`,
        body:  `${step.name} · $${(r.estimatedTotal ?? 0).toFixed(2)}`,
        linkUrl: link,
      }));
    }
    if (step.notify.discord) {
      outbox.push(() => step.type === "approval"
        ? notifyPurchaseSubmitted(teamId, r.title, r.estimatedTotal ?? 0, r.priority, r.id)
        : notifyPurchaseProgress(teamId, r.title, `${step.name}: ${ENTER_NOTIFICATION[step.type].verb}`));
    }
    return;
  }

  // Ran out of steps — the workflow is complete.
  await tx.purchaseRequest.update({ where: { id: r.id }, data: { currentStepKey: null, status: "RECEIVED" } });
  await syncReorders(tx, r.id, "RECEIVED");
  await logEvent(tx, r.id, { action: "completed" });
}

/** Keep reorder-queue entries linked to this request in step with it. */
async function syncReorders(tx: Tx, requestId: string, status: PurchaseStatus) {
  if (status === "DENIED" || status === "CANCELLED") {
    // Request didn't go ahead — the item still needs restocking, so return it to the queue.
    await tx.reorderRequest.updateMany({
      where: { purchaseRequestId: requestId },
      data:  { status: "PENDING", purchaseRequestId: null, resolvedAt: null },
    });
    return;
  }
  const reorderStatus =
    status === "APPROVED" ? "APPROVED" :
    status === "ORDERED"  ? "ORDERED"  :
    status === "RECEIVED" ? "RECEIVED" : null;
  if (!reorderStatus) return;
  await tx.reorderRequest.updateMany({
    where: { purchaseRequestId: requestId },
    data:  { status: reorderStatus, resolvedAt: reorderStatus === "RECEIVED" ? new Date() : null },
  });
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Called once, right after a purchase request row is created. Pins the team's
 * active workflow version to the request and moves it to its first step.
 */
export async function startWorkflow(requestId: string, actor: Actor): Promise<void> {
  const active = await getActiveWorkflow(actor.teamId);
  const outbox: Outbox = [];

  await prisma.$transaction(async (tx) => {
    const r = await tx.purchaseRequest.update({
      where:  { id: requestId },
      data:   { workflowDefinitionId: active.id, status: "SUBMITTED" },
      select: STATE_SELECT,
    });
    await logEvent(tx, requestId, {
      action:  "created",
      actorId: actor.id,
      note:    active.id ? `Following workflow version ${active.version}.` : "Following the default workflow.",
    });
    await enterNextStep(tx, r, active.def, 0, actor.teamId, outbox);
  });

  await flush(outbox);
}

export interface ActionInput {
  note?:              string;
  orderConfirmation?: string;
  actualTotal?:       number;
  expectedDelivery?:  Date;
}

export type ActionResult = { success: true } | { success: false; error: string };

export async function performAction(
  requestId: string,
  stepKey: string,
  action: WorkflowAction,
  actor: Actor,
  input: ActionInput = {},
): Promise<ActionResult> {
  const r = await prisma.purchaseRequest.findFirst({
    where:  { id: requestId, season: { teamId: actor.teamId } },
    select: STATE_SELECT,
  });
  if (!r) return { success: false, error: "Request not found." };

  const def  = await definitionFor(r.workflowDefinitionId);
  const step = resolveCurrentStep(def, r);
  if (!step || step.key !== stepKey) {
    return { success: false, error: "This request has already moved on. Refresh to see its current state." };
  }
  if (!availableActions(def, r, actor).some((a) => a.action === action)) {
    return { success: false, error: "You don't have permission to do that at this step." };
  }

  const stepIndex = def.steps.findIndex((s) => s.key === step.key);
  const outbox: Outbox = [];
  const link = `/procurement/requests/${r.id}`;

  try {
    await prisma.$transaction(async (tx) => {
      // Optimistic lock: only proceed if nobody else advanced the request meanwhile.
      const claimed = await tx.purchaseRequest.updateMany({
        where: { id: r.id, status: r.status, currentStepKey: r.currentStepKey },
        data:  { currentStepKey: step.key },
      });
      if (claimed.count === 0) throw new StaleError();

      switch (action) {
        case "approve": {
          await tx.purchaseRequest.update({
            where: { id: r.id },
            data:  { approverId: actor.id, approvalNotes: input.note || null },
          });
          await logEvent(tx, r.id, { step, action: "approve", actorId: actor.id, note: input.note });
          if (step.notify.requester) {
            outbox.push(() => createNotification({
              topic: "purchase.my_requests", userId: r.requestedById, type: "PURCHASE_APPROVED",
              title: `${step.name} approved: "${r.title}"`, linkUrl: link,
            }));
          }
          if (step.notify.discord) {
            outbox.push(() => notifyPurchaseApproved(actor.teamId, r.requestedById, r.title, actor.name ?? "Mentor"));
          }
          await enterNextStep(tx, r, def, stepIndex + 1, actor.teamId, outbox);
          break;
        }

        case "deny": {
          await tx.purchaseRequest.update({
            where: { id: r.id },
            data:  { status: "DENIED", currentStepKey: null, approverId: actor.id, approvalNotes: input.note || null },
          });
          await syncReorders(tx, r.id, "DENIED");
          await logEvent(tx, r.id, { step, action: "deny", actorId: actor.id, note: input.note });
          if (step.notify.requester) {
            outbox.push(() => createNotification({
              topic: "purchase.my_requests", userId: r.requestedById, type: "PURCHASE_DENIED",
              title: `Purchase request denied: "${r.title}"`, body: input.note || undefined, linkUrl: link,
            }));
          }
          if (step.notify.discord) {
            outbox.push(() => notifyPurchaseDenied(actor.teamId, r.requestedById, r.title, input.note));
          }
          break;
        }

        case "order": {
          await tx.purchaseRequest.update({
            where: { id: r.id },
            data: {
              orderDate:         new Date(),
              orderConfirmation: input.orderConfirmation || null,
              actualTotal:       input.actualTotal ?? null,
              expectedDelivery:  input.expectedDelivery ?? null,
            },
          });
          await logEvent(tx, r.id, {
            step, action: "order", actorId: actor.id, note: input.note,
            data: {
              orderConfirmation: input.orderConfirmation ?? null,
              actualTotal:       input.actualTotal ?? null,
              expectedDelivery:  input.expectedDelivery?.toISOString() ?? null,
            },
          });
          if (step.effects.recordCommitment) {
            await recordSpend(tx, r, step, actor.id, input.actualTotal ?? r.estimatedTotal ?? 0, true);
          }
          if (step.notify.requester) {
            outbox.push(() => createNotification({
              topic: "purchase.my_requests", userId: r.requestedById, type: "PURCHASE_APPROVED",
              title: `Ordered: "${r.title}"`,
              body:  input.expectedDelivery ? `Expected ${input.expectedDelivery.toLocaleDateString()}` : undefined,
              linkUrl: link,
            }));
          }
          await enterNextStep(tx, r, def, stepIndex + 1, actor.teamId, outbox);
          break;
        }

        case "receive": {
          await tx.purchaseRequest.update({ where: { id: r.id }, data: { receivedDate: new Date() } });
          await logEvent(tx, r.id, { step, action: "receive", actorId: actor.id, note: input.note });
          if (step.effects.addStock) await addStock(tx, r.id, step, actor.id);
          if (step.effects.recordExpense) {
            const full = await tx.purchaseRequest.findUniqueOrThrow({ where: { id: r.id }, select: { actualTotal: true } });
            await recordSpend(tx, r, step, actor.id, full.actualTotal ?? r.estimatedTotal ?? 0, false);
          }
          if (step.notify.requester) {
            outbox.push(() => createNotification({
              topic: "purchase.my_requests", userId: r.requestedById, type: "ORDER_RECEIVED",
              title: `Delivered: "${r.title}"`, linkUrl: link,
            }));
          }
          await enterNextStep(tx, r, def, stepIndex + 1, actor.teamId, outbox);
          break;
        }

        case "cancel": {
          await tx.purchaseRequest.update({ where: { id: r.id }, data: { status: "CANCELLED", currentStepKey: null } });
          await syncReorders(tx, r.id, "CANCELLED");
          await logEvent(tx, r.id, { step, action: "cancel", actorId: actor.id, note: input.note });
          if (actor.id !== r.requestedById) {
            outbox.push(() => createNotification({
              topic: "purchase.my_requests", userId: r.requestedById, type: "PURCHASE_DENIED",
              title: `Purchase request cancelled: "${r.title}"`, body: input.note || undefined, linkUrl: link,
            }));
          }
          break;
        }
      }
    });
  } catch (e) {
    if (e instanceof StaleError) {
      return { success: false, error: "This request was just updated by someone else. Refresh to see its current state." };
    }
    throw e;
  }

  await flush(outbox);
  return { success: true };
}

/** For callers without a UI snapshot (e.g. Discord commands): act on whatever step the request is on now. */
export async function performCurrentStepAction(
  requestId: string,
  action: WorkflowAction,
  actor: Actor,
  input: ActionInput = {},
): Promise<ActionResult & { stepName?: string }> {
  const r = await prisma.purchaseRequest.findFirst({
    where:  { id: requestId, season: { teamId: actor.teamId } },
    select: STATE_SELECT,
  });
  if (!r) return { success: false, error: "Request not found." };
  const step = resolveCurrentStep(await definitionFor(r.workflowDefinitionId), r);
  if (!step) return { success: false, error: "This request is already closed." };
  const result = await performAction(requestId, step.key, action, actor, input);
  return { ...result, stepName: step.name };
}

/** One-line description of where a request is now, e.g. "Waiting on: Budget approval". */
export async function describeRequestState(requestId: string): Promise<string> {
  const r = await prisma.purchaseRequest.findUnique({ where: { id: requestId }, select: STATE_SELECT });
  if (!r) return "Unknown";
  const step = resolveCurrentStep(await definitionFor(r.workflowDefinitionId), r);
  return step ? `Waiting on: ${step.name}` : r.status.replace(/_/g, " ").toLowerCase();
}

class StaleError extends Error {}

async function flush(outbox: Outbox) {
  // Best-effort: a failed notification must never undo a completed step.
  await Promise.allSettled(outbox.map((send) => send()));
}

// ── Effects ─────────────────────────────────────────────────────────────────

async function addStock(tx: Tx, requestId: string, step: WorkflowStep, actorId: string) {
  const lines = await tx.purchaseLineItem.findMany({
    where:  { requestId },
    select: { id: true, name: true, quantity: true, baseItemId: true },
  });
  const added: { item: string; qty: number }[] = [];
  for (const li of lines) {
    await tx.purchaseLineItem.update({ where: { id: li.id }, data: { qtyReceived: li.quantity } });
    if (!li.baseItemId) continue;
    await tx.baseInventoryItem.update({
      where: { id: li.baseItemId },
      data:  { currentStock: { increment: li.quantity } },
    });
    added.push({ item: li.name, qty: li.quantity });
  }
  await logEvent(tx, requestId, {
    step, action: "effect", actorId,
    note: added.length > 0
      ? `Added to inventory: ${added.map((a) => `${a.qty} × ${a.item}`).join(", ")}.`
      : "No line items are linked to inventory items, so stock was not changed.",
    data: { effect: "addStock", added },
  });
}

/**
 * Committed spend is logged when the order is placed and converted to an actual
 * expense on delivery, so the budget shows money that is already spoken for.
 */
async function recordSpend(tx: Tx, r: RequestState, step: WorkflowStep, actorId: string, amount: number, commitment: boolean) {
  const request = await tx.purchaseRequest.findUniqueOrThrow({
    where:  { id: r.id },
    select: { seasonId: true, preferredVendor: { select: { name: true } } },
  });
  const budget = await tx.budget.findUnique({
    where:   { seasonId: request.seasonId },
    include: { categories: { select: { id: true, type: true } } },
  });
  if (!budget) {
    await logEvent(tx, r.id, {
      step, action: "effect", actorId,
      note: "No budget is set up for this season, so the spend was not recorded.",
      data: { effect: commitment ? "recordCommitment" : "recordExpense", skipped: true },
    });
    return;
  }

  const categoryId = budget.categories.find((c) => c.type === r.budgetCategory)?.id ?? null;
  const existing = await tx.expense.findFirst({ where: { purchaseRequestId: r.id, budgetId: budget.id } });
  const data = {
    amount,
    isCommitment: commitment,
    date:         new Date(),
    vendor:       request.preferredVendor?.name ?? null,
    description:  `Purchase: ${r.title}`,
    categoryId,
  };

  if (existing) {
    await tx.expense.update({ where: { id: existing.id }, data });
  } else {
    await tx.expense.create({ data: { ...data, budgetId: budget.id, purchaseRequestId: r.id } });
  }
  await logEvent(tx, r.id, {
    step, action: "effect", actorId,
    note: commitment
      ? `$${amount.toFixed(2)} logged as committed spend in the budget.`
      : `$${amount.toFixed(2)} recorded as an expense in the budget.`,
    data: { effect: commitment ? "recordCommitment" : "recordExpense", amount },
  });
}
