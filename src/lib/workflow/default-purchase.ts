import type { WorkflowDef } from "./types";

/**
 * Built-in purchase workflow. Used by teams that haven't customised theirs, and
 * by requests created before workflows were configurable (workflowDefinitionId = null).
 * Mirrors the original hard-coded process, plus role checks on every step.
 */
export const DEFAULT_PURCHASE_WORKFLOW: WorkflowDef = {
  schemaVersion: 1,
  trigger: {
    autoReorder: true,
    notifyRoles: [],
  },
  steps: [
    {
      key: "budget-approval",
      type: "approval",
      name: "Budget approval",
      description: "Small routine purchases skip this step and are approved automatically.",
      roles: ["BUDGET_MANAGER", "HEAD_MENTOR"],
      when: {
        match: "any",
        rules: [
          { field: "total",    op: "gt", value: 50 },
          { field: "priority", op: "eq", value: "EMERGENCY" },
        ],
      },
      allowSelfApproval: true,
      notify:  { roles: ["BUDGET_MANAGER", "HEAD_MENTOR"], requester: true, discord: true },
      effects: {},
    },
    {
      key: "order",
      type: "order",
      name: "Place order",
      description: "Order from the vendor and record the confirmation number and actual total.",
      roles: ["BUDGET_MANAGER", "INVENTORY_ADMIN", "HEAD_MENTOR"],
      notify:  { roles: ["BUDGET_MANAGER", "INVENTORY_ADMIN"], requester: true, discord: false },
      effects: { recordCommitment: true },
    },
    {
      key: "receive",
      type: "receive",
      name: "Receive & stock",
      description: "Confirm the delivery arrived. Quantities are added to linked inventory items.",
      roles: ["INVENTORY_ADMIN", "BUILD_LEAD", "BUDGET_MANAGER", "HEAD_MENTOR"],
      notify:  { roles: [], requester: true, discord: false },
      effects: { addStock: true, recordExpense: true },
    },
  ],
};
