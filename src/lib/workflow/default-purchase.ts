import type { WorkflowDef } from "./types";

/**
 * Built-in purchase workflow. Used by teams that haven't customized theirs, and
 * by requests created before workflows were configurable (workflowDefinitionId = null).
 * Mirrors the original hard-coded process, plus role checks on every step.
 */
export const DEFAULT_PURCHASE_WORKFLOW: WorkflowDef = {
  schemaVersion: 1,
  trigger: {
    autoReorder: true,
    notifyRoles: [],
  },
  reminders: {
    routineHours: 24, // routine requests: once a day
    urgentHours:  3,  // urgent & emergency: every 3 hours
  },
  steps: [
    {
      key: "budget-approval",
      type: "approval",
      name: "Budget approval",
      description: "Small routine purchases skip this step and are approved automatically.",
      roles: ["ORDER_APPROVER", "HEAD_MENTOR"],
      when: {
        match: "any",
        rules: [
          { field: "total",    op: "gt", value: 50 },
          { field: "priority", op: "eq", value: "EMERGENCY" },
        ],
      },
      allowSelfApproval: true,
      notify:  { roles: ["ORDER_APPROVER", "HEAD_MENTOR"], requester: true, discord: true },
      effects: {},
    },
    {
      key: "order",
      type: "order",
      name: "Buyer orders",
      description: "Items move to To order. The Buyer exports them to the purchasing spreadsheet, places the orders and adds tracking links — each item becomes Ordered. Done when every item is ordered.",
      roles: ["BUYER", "HEAD_MENTOR"],
      notify:  { roles: ["BUYER"], requester: true, discord: false },
      effects: { recordCommitment: true },
    },
    {
      key: "receive",
      type: "receive",
      name: "Arrive & stock",
      description: "Anyone marks items Arrived as they show up; each is added to inventory. Done when every item has arrived.",
      roles: ["TEAM_MEMBER", "BUILD_LEAD", "INVENTORY_ADMIN", "ORDER_APPROVER", "SAFETY_CAPTAIN", "BUYER", "TEAM_LEADERSHIP", "MENTOR", "HEAD_MENTOR"],
      notify:  { roles: [], requester: true, discord: false },
      effects: { addStock: true, recordExpense: true },
    },
  ],
};
