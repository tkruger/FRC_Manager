import { z } from "zod";

// Shared (client + server) shape of a purchase workflow definition.
// Stored as JSON in WorkflowDefinition.definition — bump SCHEMA_VERSION and add a
// migration in parseWorkflow() if this shape ever changes incompatibly.

export const SCHEMA_VERSION = 1;

export const ROLE_VALUES = [
  "TEAM_MEMBER",
  "BUILD_LEAD",
  "INVENTORY_ADMIN",
  "BUDGET_MANAGER",
  "SAFETY_CAPTAIN",
  "TEAM_LEADERSHIP",
  "HEAD_MENTOR",
] as const;
export type WorkflowRole = (typeof ROLE_VALUES)[number];

/** Step types come from a fixed catalog — the engine knows how to run each one. */
export const STEP_TYPES = ["approval", "order", "receive"] as const;
export type StepType = (typeof STEP_TYPES)[number];

export const RULE_FIELDS = ["total", "priority", "subTeam", "budgetCategory"] as const;
export type RuleField = (typeof RULE_FIELDS)[number];

export const RULE_OPS = ["gt", "gte", "lt", "lte", "eq", "neq"] as const;
export type RuleOp = (typeof RULE_OPS)[number];

const RuleSchema = z.object({
  field: z.enum(RULE_FIELDS),
  op:    z.enum(RULE_OPS),
  value: z.union([z.number(), z.string()]),
});
export type Rule = z.infer<typeof RuleSchema>;

const ConditionSchema = z.object({
  match: z.enum(["all", "any"]),
  rules: z.array(RuleSchema).min(1),
});
export type Condition = z.infer<typeof ConditionSchema>;

const StepSchema = z.object({
  key:         z.string().min(1).max(40).regex(/^[a-z0-9_-]+$/),
  type:        z.enum(STEP_TYPES),
  name:        z.string().trim().min(1).max(60),
  description: z.string().max(300).optional(),
  /** Who can act on this step. Head Mentor can always act. */
  roles:       z.array(z.enum(ROLE_VALUES)).min(1),
  /** Step only applies when this is true; otherwise it is skipped automatically. */
  when:        ConditionSchema.nullable().optional(),
  /** Approval steps only: may the requester approve their own request? */
  allowSelfApproval: z.boolean().optional(),
  notify: z.object({
    /** Told the request is waiting on them when it reaches this step */
    roles:     z.array(z.enum(ROLE_VALUES)),
    /** Requester is told when this step is completed (or denied) */
    requester: z.boolean(),
    /** Post to the team's Discord */
    discord:   z.boolean(),
  }),
  effects: z.object({
    /** order: log the order total as committed spend in the season budget */
    recordCommitment: z.boolean().optional(),
    /** receive: convert committed spend to an actual expense (or create one) */
    recordExpense:    z.boolean().optional(),
    /** receive: add received quantities to linked inventory items */
    addStock:         z.boolean().optional(),
  }),
});
export type WorkflowStep = z.infer<typeof StepSchema>;

export const WorkflowSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    trigger: z.object({
      /** Add an item to the order queue when stock falls to/below its minimum */
      autoReorder: z.boolean(),
      /** Who is told when an item lands in the order queue */
      notifyRoles: z.array(z.enum(ROLE_VALUES)),
    }),
    steps: z.array(StepSchema),
    /** Repeat "waiting on you" reminders until someone acts (added after v1 — defaults keep older rows valid) */
    reminders: z.object({
      routineHours: z.number().int().min(1).max(168),
      urgentHours:  z.number().int().min(1).max(168),
    }).default({ routineHours: 24, urgentHours: 3 }),
  })
  .superRefine((def, ctx) => {
    const keys = new Set<string>();
    for (const s of def.steps) {
      if (keys.has(s.key)) ctx.addIssue({ code: "custom", message: `Duplicate step key "${s.key}"` });
      keys.add(s.key);
    }
    // Shape: any number of approvals, then exactly one order, then exactly one receive.
    const types = def.steps.map((s) => s.type);
    const firstNonApproval = types.findIndex((t) => t !== "approval");
    const tail = firstNonApproval === -1 ? [] : types.slice(firstNonApproval);
    if (tail.length !== 2 || tail[0] !== "order" || tail[1] !== "receive") {
      ctx.addIssue({
        code: "custom",
        message: "Workflow must be: approval steps (any number), then one Order step, then one Receive step.",
      });
    }
  });
export type WorkflowDef = z.output<typeof WorkflowSchema>;

export function parseWorkflow(json: unknown): WorkflowDef {
  return WorkflowSchema.parse(json);
}

// ── Display helpers ─────────────────────────────────────────────────────────

export const ROLE_DISPLAY: Record<WorkflowRole, string> = {
  TEAM_MEMBER:     "Team Member",
  BUILD_LEAD:      "Build Lead",
  INVENTORY_ADMIN: "Inventory Admin",
  BUDGET_MANAGER:  "Budget Manager",
  SAFETY_CAPTAIN:  "Safety Captain",
  TEAM_LEADERSHIP: "Team Leadership",
  HEAD_MENTOR:     "Head Mentor",
};

export const STEP_TYPE_DISPLAY: Record<StepType, { label: string; verb: string }> = {
  approval: { label: "Approval", verb: "Approve or deny" },
  order:    { label: "Order",    verb: "Place the order" },
  receive:  { label: "Receive",  verb: "Confirm delivery" },
};

export const RULE_FIELD_DISPLAY: Record<RuleField, string> = {
  total:          "Estimated total ($)",
  priority:       "Priority",
  subTeam:        "Sub-team",
  budgetCategory: "Budget category",
};

export const RULE_OP_DISPLAY: Record<RuleOp, string> = {
  gt: ">", gte: "≥", lt: "<", lte: "≤", eq: "is", neq: "is not",
};

/** Allowed values for enum-valued rule fields (used by the editor). */
export const RULE_FIELD_VALUES: Partial<Record<RuleField, { value: string; label: string }[]>> = {
  priority: [
    { value: "ROUTINE",   label: "Routine" },
    { value: "URGENT",    label: "Urgent" },
    { value: "EMERGENCY", label: "Emergency" },
  ],
  subTeam: [
    { value: "MECHANICAL",  label: "Mechanical" },
    { value: "ELECTRICAL",  label: "Electrical" },
    { value: "PROGRAMMING", label: "Programming" },
    { value: "DRIVE_TEAM",  label: "Drive Team" },
    { value: "STRATEGY",    label: "Strategy" },
    { value: "DESIGN",      label: "Design" },
    { value: "OUTREACH",    label: "Outreach" },
    { value: "OPERATIONS",  label: "Operations" },
  ],
  budgetCategory: [
    { value: "ROBOT_MECHANICAL", label: "Robot — Mechanical" },
    { value: "ROBOT_ELECTRICAL", label: "Robot — Electrical" },
    { value: "ROBOT_PNEUMATICS", label: "Robot — Pneumatics" },
    { value: "RAW_MATERIALS",    label: "Raw Materials" },
    { value: "TOOLS_EQUIPMENT",  label: "Tools & Equipment" },
    { value: "CONSUMABLES",      label: "Consumables" },
    { value: "SAFETY_EQUIPMENT", label: "Safety Equipment" },
    { value: "OTHER",            label: "Other" },
  ],
};

// ── Conditions ──────────────────────────────────────────────────────────────

export interface ConditionSubject {
  total:          number;
  priority:       string;
  subTeam:        string | null;
  budgetCategory: string | null;
}

function evalRule(rule: Rule, s: ConditionSubject): boolean {
  if (rule.field === "total") {
    const v = Number(rule.value);
    switch (rule.op) {
      case "gt":  return s.total >  v;
      case "gte": return s.total >= v;
      case "lt":  return s.total <  v;
      case "lte": return s.total <= v;
      case "eq":  return s.total === v;
      case "neq": return s.total !== v;
    }
  }
  const actual = s[rule.field];
  if (rule.op === "eq")  return actual === rule.value;
  if (rule.op === "neq") return actual !== rule.value;
  return false; // ordering comparisons only make sense for totals
}

export function evaluateCondition(cond: Condition | null | undefined, s: ConditionSubject): boolean {
  if (!cond || cond.rules.length === 0) return true;
  return cond.match === "all"
    ? cond.rules.every((r) => evalRule(r, s))
    : cond.rules.some((r) => evalRule(r, s));
}

function describeValue(rule: Rule): string {
  if (rule.field === "total") return `$${Number(rule.value).toFixed(2).replace(/\.00$/, "")}`;
  return RULE_FIELD_VALUES[rule.field]?.find((o) => o.value === rule.value)?.label ?? String(rule.value);
}

export function describeRule(rule: Rule): string {
  const field = rule.field === "total" ? "total" : RULE_FIELD_DISPLAY[rule.field].toLowerCase();
  return `${field} ${RULE_OP_DISPLAY[rule.op]} ${describeValue(rule)}`;
}

export function describeCondition(cond: Condition | null | undefined): string | null {
  if (!cond || cond.rules.length === 0) return null;
  return cond.rules.map(describeRule).join(cond.match === "all" ? " and " : " or ");
}

export function describeRoles(roles: WorkflowRole[]): string {
  return roles.map((r) => ROLE_DISPLAY[r]).join(", ");
}

/** Status shown on the request while it sits at a step of this type */
export const STEP_STATUS = {
  approval: "SUBMITTED",
  order:    "APPROVED",
  receive:  "ORDERED",
} as const;
