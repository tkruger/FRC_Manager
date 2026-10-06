// Pure workflow rules — no database access, safe to import anywhere (and to test).

import type { PurchaseStatus } from "@/generated/prisma";
import type { WorkflowDef, WorkflowStep, WorkflowRole } from "./types";

export type WorkflowAction = "approve" | "deny" | "order" | "receive" | "cancel";

interface StepState {
  status:         PurchaseStatus;
  currentStepKey: string | null;
}

interface ActorRef {
  id:    string;
  roles: WorkflowRole[];
}

const TERMINAL: PurchaseStatus[] = ["RECEIVED", "DENIED", "CANCELLED", "DRAFT"];

/**
 * The step a request is currently waiting on. Requests created before workflows
 * existed have no currentStepKey, so derive it from their status.
 */
export function resolveCurrentStep(def: WorkflowDef, r: StepState): WorkflowStep | null {
  if (TERMINAL.includes(r.status)) return null;
  if (r.currentStepKey) {
    const step = def.steps.find((s) => s.key === r.currentStepKey);
    if (step) return step;
  }
  const type =
    r.status === "SUBMITTED" ? "approval" :
    r.status === "APPROVED"  ? "order"    :
    r.status === "ORDERED" || r.status === "PARTIAL_RECEIVED" ? "receive" : null;
  return type ? def.steps.find((s) => s.type === type) ?? null : null;
}

// ── Permissions ─────────────────────────────────────────────────────────────

export function canActOnStep(step: WorkflowStep, actor: ActorRef, requestedById: string): boolean {
  const isHeadMentor = actor.roles.includes("HEAD_MENTOR");
  if (!isHeadMentor && !step.roles.some((r) => actor.roles.includes(r))) return false;
  if (step.type === "approval" && step.allowSelfApproval === false && actor.id === requestedById && !isHeadMentor) {
    return false;
  }
  return true;
}

export interface AvailableAction {
  action:  WorkflowAction;
  stepKey: string;
  label:   string;
}

export function availableActions(
  def: WorkflowDef,
  r: StepState & { requestedById: string },
  actor: ActorRef,
): AvailableAction[] {
  const step = resolveCurrentStep(def, r);
  if (!step) return [];
  const actions: AvailableAction[] = [];
  const canAct = canActOnStep(step, actor, r.requestedById);

  if (step.type === "approval" && canAct) {
    actions.push({ action: "approve", stepKey: step.key, label: "Approve" });
    actions.push({ action: "deny",    stepKey: step.key, label: "Deny" });
  }
  // Order and receive steps complete on their own from item statuses: tracking links
  // move items to Ordered, and marking items arrived moves them to Arrived.

  // Canceling is possible until the order is placed: by the requester, anyone who
  // can act on the current step, or a Head Mentor.
  if (step.type !== "receive" && (canAct || actor.id === r.requestedById || actor.roles.includes("HEAD_MENTOR"))) {
    actions.push({ action: "cancel", stepKey: step.key, label: "Cancel order" });
  }
  return actions;
}


/**
 * Who can edit an open order: anyone who can approve it or order it (the roles on the
 * workflow's approval and order steps), and Head Mentors.
 */
export function canEditOrder(def: WorkflowDef, r: StepState, roles: WorkflowRole[]): boolean {
  if (TERMINAL.includes(r.status)) return false;
  if (roles.includes("HEAD_MENTOR")) return true;
  return def.steps
    .filter((s) => s.type === "approval" || s.type === "order")
    .some((s) => s.roles.some((role) => roles.includes(role)));
}
