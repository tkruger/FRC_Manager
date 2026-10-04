"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { WorkflowPipeline } from "@/components/workflow/WorkflowPipeline";
import { saveWorkflowAction, resetWorkflowAction } from "@/app/actions/workflows";
import {
  ROLE_VALUES,
  ROLE_DISPLAY,
  RULE_FIELDS,
  RULE_FIELD_DISPLAY,
  RULE_FIELD_VALUES,
  RULE_OP_DISPLAY,
  STEP_TYPE_DISPLAY,
  type Condition,
  type Rule,
  type RuleField,
  type RuleOp,
  type WorkflowDef,
  type WorkflowRole,
  type WorkflowStep,
} from "@/lib/workflow/types";

interface Props {
  def:      WorkflowDef;
  counts:   Record<string, number>;
  isCustom: boolean;
}

const inputCls =
  "w-full rounded-md border border-[--color-border] bg-[--color-surface] text-[--color-text-primary] px-2.5 py-1.5 text-sm focus:border-[--color-primary] focus:outline-none";
const selectCls =
  "rounded-md border border-[--color-border] bg-[--color-surface] text-[--color-text-primary] px-2 py-1.5 text-sm";

export function WorkflowEditor({ def, counts, isCustom }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState<WorkflowDef>(def);
  const [error, setError]     = useState<string | null>(null);
  const [pending, start]      = useTransition();

  function beginEdit() {
    setDraft(structuredClone(def));
    setError(null);
    setEditing(true);
  }

  function save() {
    setError(null);
    start(async () => {
      const res = await saveWorkflowAction(draft);
      if (!res.success) { setError(res.error); return; }
      setEditing(false);
      router.refresh();
    });
  }

  function reset() {
    if (!confirm("Replace the current workflow with the default? This is saved as a new version.")) return;
    start(async () => {
      const res = await resetWorkflowAction();
      if (!res.success) { setError(res.error); return; }
      setEditing(false);
      router.refresh();
    });
  }

  if (!editing) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2 justify-end">
          {isCustom && (
            <Button size="sm" variant="outline" onClick={reset} disabled={pending}>Reset to default</Button>
          )}
          <Button size="sm" onClick={beginEdit}>Edit workflow</Button>
        </div>
        {error && <p className="text-sm text-[--color-danger]">{error}</p>}
        <WorkflowPipeline def={def} counts={counts} />
      </div>
    );
  }

  // ── Draft mutation helpers ─────────────────────────────────────────────────
  const updateStep = (key: string, patch: Partial<WorkflowStep>) =>
    setDraft((d) => ({ ...d, steps: d.steps.map((s) => (s.key === key ? { ...s, ...patch } : s)) }));

  const approvals = draft.steps.filter((s) => s.type === "approval");
  const tail      = draft.steps.filter((s) => s.type !== "approval");

  const setApprovals = (next: WorkflowStep[]) => setDraft((d) => ({ ...d, steps: [...next, ...tail] }));

  function addApproval() {
    const taken = new Set(draft.steps.map((s) => s.key));
    let n = approvals.length + 1;
    while (taken.has(`approval-${n}`)) n++;
    setApprovals([
      ...approvals,
      {
        key:  `approval-${n}`,
        type: "approval",
        name: "Mentor approval",
        roles: ["HEAD_MENTOR"],
        when: { match: "all", rules: [{ field: "total", op: "gt", value: 500 }] },
        allowSelfApproval: false,
        notify:  { roles: ["HEAD_MENTOR"], requester: true, discord: false },
        effects: {},
      },
    ]);
  }

  function moveApproval(index: number, dir: -1 | 1) {
    const next = [...approvals];
    const [s] = next.splice(index, 1);
    next.splice(index + dir, 0, s);
    setApprovals(next);
  }

  return (
    <div className="space-y-4">
      <div className="card py-3 px-4 text-small text-[--color-text-secondary]">
        A workflow is: any number of <b>approval</b> steps (each can apply only in certain cases), then <b>Place order</b>,
        then <b>Receive</b>. Changes apply to new requests only.
      </div>

      {/* Trigger */}
      <EditorCard title="Request is raised" badge="Trigger">
        <Check
          label="Automatically add items to the reorder queue when stock falls to or below their minimum"
          checked={draft.trigger.autoReorder}
          onChange={(v) => setDraft((d) => ({ ...d, trigger: { ...d.trigger, autoReorder: v } }))}
        />
        {draft.trigger.autoReorder && (
          <FieldRow label="Notify when an item is queued">
            <RoleChips
              value={draft.trigger.notifyRoles}
              onChange={(roles) => setDraft((d) => ({ ...d, trigger: { ...d.trigger, notifyRoles: roles } }))}
            />
          </FieldRow>
        )}
      </EditorCard>

      {/* Approval steps */}
      {approvals.map((step, i) => (
        <StepEditor
          key={step.key}
          step={step}
          onChange={(patch) => updateStep(step.key, patch)}
          controls={
            <div className="flex gap-1">
              <IconBtn label="Move up"   disabled={i === 0}                    onClick={() => moveApproval(i, -1)}>↑</IconBtn>
              <IconBtn label="Move down" disabled={i === approvals.length - 1} onClick={() => moveApproval(i, 1)}>↓</IconBtn>
              <IconBtn label="Remove step" danger onClick={() => setApprovals(approvals.filter((s) => s.key !== step.key))}>✕</IconBtn>
            </div>
          }
        />
      ))}
      <button
        type="button"
        onClick={addApproval}
        className="w-full rounded-lg border-2 border-dashed border-[--color-border] py-3 text-sm font-medium text-[--color-text-secondary] hover:border-[--color-primary] hover:text-[--color-primary] transition-colors"
      >
        + Add approval step
      </button>

      {/* Order + receive (fixed position) */}
      {tail.map((step) => (
        <StepEditor key={step.key} step={step} onChange={(patch) => updateStep(step.key, patch)} />
      ))}

      {/* Reminders */}
      <EditorCard title="Reminders" badge="Until someone acts">
        <div className="grid gap-3 sm:grid-cols-2">
          <FieldRow label="Routine requests — remind every (hours)">
            <input type="number" min={1} max={168} className={inputCls} value={draft.reminders.routineHours}
              onChange={(e) => setDraft((d) => ({ ...d, reminders: { ...d.reminders, routineHours: clampHours(e.target.value) } }))} />
          </FieldRow>
          <FieldRow label="Urgent & emergency — remind every (hours)">
            <input type="number" min={1} max={168} className={inputCls} value={draft.reminders.urgentHours}
              onChange={(e) => setDraft((d) => ({ ...d, reminders: { ...d.reminders, urgentHours: clampHours(e.target.value) } }))} />
          </FieldRow>
        </div>
        <p className="text-small text-[--color-text-secondary]">Reminders go to whoever can act on the step, outside their quiet hours.</p>
      </EditorCard>

      {error && (
        <p className="text-sm text-[--color-danger] bg-[--color-danger]/10 rounded px-3 py-2">{error}</p>
      )}
      <div className="sticky bottom-16 lg:bottom-4 z-10 flex justify-end gap-2 rounded-lg bg-[--color-surface] border border-[--color-border] p-3 shadow-lg">
        <Button variant="outline" onClick={() => setEditing(false)} disabled={pending}>Cancel</Button>
        <Button onClick={save} isLoading={pending}>Save as new version</Button>
      </div>
    </div>
  );
}

// ── Step editor ──────────────────────────────────────────────────────────────

function StepEditor({
  step, onChange, controls,
}: {
  step:      WorkflowStep;
  onChange:  (patch: Partial<WorkflowStep>) => void;
  controls?: React.ReactNode;
}) {
  const isApproval = step.type === "approval";

  return (
    <EditorCard title={step.name || "Untitled step"} badge={STEP_TYPE_DISPLAY[step.type].label} controls={controls}>
      <div className="grid gap-3 sm:grid-cols-2">
        <FieldRow label="Step name">
          <input className={inputCls} value={step.name} maxLength={60} onChange={(e) => onChange({ name: e.target.value })} />
        </FieldRow>
        <FieldRow label="Description (optional)">
          <input className={inputCls} value={step.description ?? ""} maxLength={300}
            onChange={(e) => onChange({ description: e.target.value || undefined })} />
        </FieldRow>
      </div>

      <FieldRow label={`Who can ${STEP_TYPE_DISPLAY[step.type].verb.toLowerCase()}`} hint="Head Mentor can always act.">
        <RoleChips value={step.roles} onChange={(roles) => onChange({ roles })} />
      </FieldRow>

      {isApproval && (
        <>
          <ConditionEditor value={step.when ?? null} onChange={(when) => onChange({ when })} />
          <Check
            label="Requesters may approve their own request"
            checked={step.allowSelfApproval !== false}
            onChange={(v) => onChange({ allowSelfApproval: v })}
          />
        </>
      )}

      <FieldRow label="Notify when a request reaches this step">
        <RoleChips value={step.notify.roles} onChange={(roles) => onChange({ notify: { ...step.notify, roles } })} />
      </FieldRow>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <Check
          label={isApproval ? "Tell the requester when approved or denied" : "Tell the requester when done"}
          checked={step.notify.requester}
          onChange={(v) => onChange({ notify: { ...step.notify, requester: v } })}
        />
        <Check
          label="Post to Discord"
          checked={step.notify.discord}
          onChange={(v) => onChange({ notify: { ...step.notify, discord: v } })}
        />
      </div>

      {step.type === "order" && (
        <Check
          label="Log the order total as committed spend in the budget"
          checked={!!step.effects.recordCommitment}
          onChange={(v) => onChange({ effects: { ...step.effects, recordCommitment: v } })}
        />
      )}
      {step.type === "receive" && (
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <Check
            label="Add received quantities to inventory"
            checked={!!step.effects.addStock}
            onChange={(v) => onChange({ effects: { ...step.effects, addStock: v } })}
          />
          <Check
            label="Record the actual expense in the budget"
            checked={!!step.effects.recordExpense}
            onChange={(v) => onChange({ effects: { ...step.effects, recordExpense: v } })}
          />
        </div>
      )}
    </EditorCard>
  );
}

// ── Condition editor ─────────────────────────────────────────────────────────

function ConditionEditor({ value, onChange }: { value: Condition | null; onChange: (c: Condition | null) => void }) {
  const enabled = !!value && value.rules.length > 0;

  function setRule(i: number, patch: Partial<Rule>) {
    if (!value) return;
    onChange({ ...value, rules: value.rules.map((r, idx) => (idx === i ? { ...r, ...patch } : r)) });
  }

  function changeField(i: number, field: RuleField) {
    // Reset op/value to something valid for the new field
    const enumValues = RULE_FIELD_VALUES[field];
    setRule(i, field === "total"
      ? { field, op: "gt", value: 50 }
      : { field, op: "eq", value: enumValues?.[0]?.value ?? "" });
  }

  return (
    <div className="space-y-2">
      <Check
        label="Only require this step in certain cases"
        checked={enabled}
        onChange={(v) => onChange(v ? { match: "any", rules: [{ field: "total", op: "gt", value: 50 }] } : null)}
      />
      {enabled && value && (
        <div className="ml-6 space-y-2 rounded-md bg-[--color-surface-overlay] p-3">
          <div className="flex items-center gap-2 text-small text-[--color-text-secondary]">
            Required when
            <select className={selectCls} value={value.match}
              onChange={(e) => onChange({ ...value, match: e.target.value as Condition["match"] })}>
              <option value="any">any</option>
              <option value="all">all</option>
            </select>
            of these are true — otherwise skipped automatically:
          </div>
          {value.rules.map((rule, i) => {
            const enumValues = RULE_FIELD_VALUES[rule.field];
            const ops: RuleOp[] = rule.field === "total" ? ["gt", "gte", "lt", "lte"] : ["eq", "neq"];
            return (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <select className={selectCls} value={rule.field} onChange={(e) => changeField(i, e.target.value as RuleField)}>
                  {RULE_FIELDS.map((f) => <option key={f} value={f}>{RULE_FIELD_DISPLAY[f]}</option>)}
                </select>
                <select className={selectCls} value={rule.op} onChange={(e) => setRule(i, { op: e.target.value as RuleOp })}>
                  {ops.map((o) => <option key={o} value={o}>{RULE_OP_DISPLAY[o]}</option>)}
                </select>
                {enumValues ? (
                  <select className={selectCls} value={String(rule.value)} onChange={(e) => setRule(i, { value: e.target.value })}>
                    {enumValues.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
                  </select>
                ) : (
                  <input type="number" min={0} step="1" className={cn(inputCls, "w-28")} value={Number(rule.value)}
                    onChange={(e) => setRule(i, { value: Number(e.target.value) || 0 })} />
                )}
                {value.rules.length > 1 && (
                  <IconBtn label="Remove condition" danger
                    onClick={() => onChange({ ...value, rules: value.rules.filter((_, idx) => idx !== i) })}>✕</IconBtn>
                )}
              </div>
            );
          })}
          <button type="button" className="text-small font-medium text-[--color-secondary] hover:underline"
            onClick={() => onChange({ ...value, rules: [...value.rules, { field: "priority", op: "eq", value: "EMERGENCY" }] })}>
            + Add condition
          </button>
        </div>
      )}
    </div>
  );
}

// ── Small building blocks ────────────────────────────────────────────────────

function clampHours(v: string) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(168, Math.max(1, n)) : 24;
}

function EditorCard({
  title, badge, controls, children,
}: { title: string; badge: string; controls?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="card space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="text-sm font-semibold text-[--color-text-primary] truncate">{title}</h3>
          <span className="badge badge-neutral">{badge}</span>
        </div>
        {controls}
      </div>
      {children}
    </section>
  );
}

function FieldRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium text-[--color-text-primary]">
        {label}
        {hint && <span className="ml-2 font-normal text-small text-[--color-text-secondary]">{hint}</span>}
      </p>
      {children}
    </div>
  );
}

function RoleChips({ value, onChange }: { value: WorkflowRole[]; onChange: (roles: WorkflowRole[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {ROLE_VALUES.map((role) => {
        const on = value.includes(role);
        return (
          <button
            key={role}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((r) => r !== role) : [...value, role])}
            className={cn(
              "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
              on
                ? "border-[--color-primary] bg-[--color-primary]/10 text-[--color-primary]"
                : "border-[--color-border] text-[--color-text-secondary] hover:text-[--color-text-primary]"
            )}
          >
            {ROLE_DISPLAY[role]}
          </button>
        );
      })}
    </div>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start gap-2 text-sm text-[--color-text-primary] cursor-pointer">
      <input type="checkbox" className="mt-0.5 accent-[--color-primary]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function IconBtn({
  label, onClick, disabled, danger, children,
}: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "h-7 w-7 rounded-md border border-[--color-border] text-sm transition-colors disabled:opacity-30",
        danger ? "text-[--color-danger] hover:bg-[--color-danger]/10" : "text-[--color-text-secondary] hover:text-[--color-text-primary]"
      )}
    >
      {children}
    </button>
  );
}
