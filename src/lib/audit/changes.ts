// Change history for orders, tasks and meetings. Server-only.
//
// A Prisma client extension (applied in src/lib/prisma.ts) watches every create, update and
// delete on the models below and writes a ChangeLog row: who, which order/task/meeting, and
// each watched field from → to, formatted for display. Because it sits in the client, every
// path is covered — server actions, the order workflow, Discord commands and background jobs.
//
// Who made the change: runAs(userId, fn) when the caller knows (Discord commands); otherwise
// the signed-in user of the current request; otherwise nobody (shown as "System").
//
// Reads of the "before" state and the log writes use the plain client, outside any
// transaction the change is part of, so they never hold up its locks. A change to a row the
// same transaction created can't be seen from there and isn't logged — the "created" entry
// (or none, for rows made together with a new season) covers it.

import { AsyncLocalStorage } from "node:async_hooks";
import { Prisma, type PrismaClient } from "@/generated/prisma";
import { STATUS_CONFIG, PRIORITY_CONFIG, SUBTEAM_OPTIONS } from "@/lib/schedule-helpers";
import { statusLabel } from "@/lib/procurement-helpers";
import { ITEM_STATUS_INFO, IMPORTANCE_OPTIONS, itemRef } from "@/lib/orders/constants";
import { BUDGET_CATEGORY_LABELS } from "@/lib/budget-categories";

import type { EntityType, FieldChange } from "./changes-types";
export type { EntityType, FieldChange };

/** How long change history is kept (the hourly job removes older rows) */
export const CHANGE_LOG_DAYS = 365;

// ── Who is making the change ────────────────────────────────────────────────

const actorStore = new AsyncLocalStorage<{ userId: string | null }>();

/** Run `fn` with changes credited to `userId` (for callers outside a signed-in request) */
export function runAs<T>(userId: string | null, fn: () => T): T {
  return actorStore.run({ userId }, fn);
}

async function currentActor(): Promise<string | null> {
  const set = actorStore.getStore();
  if (set) return set.userId;
  try {
    // Imported here: auth.ts itself uses the Prisma client
    const { auth } = await import("@/lib/auth");
    return (await auth())?.user?.id ?? null;
  } catch {
    return null; // Not in a request (cron, scripts)
  }
}

// ── What is watched, and how values are shown ───────────────────────────────

type Kind =
  | "text" | "long" | "date" | "money" | "number" | "bool" | "time"
  | { enum: Record<string, string> }
  | "robot";

const labels = (opts: readonly { value: string; label: string }[]) => Object.fromEntries(opts.map((o) => [o.value, o.label]));
const ORDER_STATUS = Object.fromEntries(
  (["DRAFT", "SUBMITTED", "APPROVED", "DENIED", "ORDERED", "PARTIAL_RECEIVED", "RECEIVED", "CANCELLED"] as const)
    .map((k) => { const s = statusLabel(k); return [k, s.charAt(0) + s.slice(1).toLowerCase()]; }),
);

interface Spec {
  entity: EntityType;
  fields: Record<string, { label: string; kind: Kind }>;
  /** Many-to-many lists, changed with set/connect/disconnect */
  lists?: Record<string, { label: string; of: "user" | "task" }>;
  /** Extra fields needed for the label, the team and the parent */
  select: Record<string, unknown>;
  teamOf: (row: Row) => string | undefined;
  /** The order/task/meeting the history belongs to */
  idOf: (row: Row) => string;
  labelOf: (row: Row) => string;
  /** Rows that belong to something else (an item → its order): the field name is prefixed */
  part?: (row: Row) => string;
  skip?: (row: Row) => boolean;
  /** Parent lookup for creates (the row itself can't be read yet) */
  parent: { key: string; find: (base: PrismaClient, id: string) => Promise<Row | null> };
}

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const seasonTeam = { season: { select: { teamId: true } } };
const findSeason = (base: PrismaClient, id: string) => base.season.findUnique({ where: { id }, select: { teamId: true } }).then((s) => (s ? { season: s } : null));
const findOrder = (base: PrismaClient, id: string) =>
  base.purchaseRequest.findUnique({ where: { id }, select: { id: true, title: true, season: { select: { teamId: true } } } }).then((r) => (r ? { requestId: r.id, request: r } : null));

const ITEM_FIELDS: Spec["fields"] = {
  name:             { label: "Name",            kind: "text" },
  partNumber:       { label: "Part number",     kind: "text" },
  vendorName:       { label: "Vendor",          kind: "text" },
  vendorProductUrl: { label: "Link",            kind: "text" },
  quantity:         { label: "Quantity",        kind: "number" },
  unitCost:         { label: "Unit price",      kind: "money" },
  budgetCategory:   { label: "Budget category", kind: { enum: BUDGET_CATEGORY_LABELS } },
  subTeam:          { label: "Sub-team",        kind: { enum: labels(SUBTEAM_OPTIONS) } },
  importance:       { label: "Importance",      kind: { enum: labels(IMPORTANCE_OPTIONS) } },
  reasoning:        { label: "Why it's needed", kind: "long" },
  notes:            { label: "Notes",           kind: "long" },
  status:           { label: "Status",          kind: { enum: Object.fromEntries(Object.entries(ITEM_STATUS_INFO).map(([k, v]) => [k, v.label])) } },
};

const SPECS: Record<string, Spec> = {
  task: {
    entity: "task",
    fields: {
      name:           { label: "Name",            kind: "text" },
      details:        { label: "Details",         kind: "long" },
      status:         { label: "Status",          kind: { enum: Object.fromEntries(Object.entries(STATUS_CONFIG).map(([k, v]) => [k, v.label])) } },
      priority:       { label: "Priority",        kind: { enum: Object.fromEntries(Object.entries(PRIORITY_CONFIG).map(([k, v]) => [k, v.label])) } },
      subTeam:        { label: "Sub-team",        kind: { enum: labels(SUBTEAM_OPTIONS) } },
      robotId:        { label: "Robot",           kind: "robot" },
      startDate:      { label: "Start",           kind: "date" },
      dueDate:        { label: "Due",             kind: "date" },
      autoSchedule:   { label: "Follows prerequisites", kind: "bool" },
      durationDays:   { label: "Length (days)",   kind: "number" },
      lagDays:        { label: "Days after prerequisites", kind: "number" },
      estimatedHours: { label: "Estimated hours", kind: "number" },
      actualHours:    { label: "Actual hours",    kind: "number" },
      blockersNotes:  { label: "Blockers",        kind: "long" },
      isMilestone:    { label: "Milestone",       kind: "bool" },
    },
    lists: {
      assignees:     { label: "Assigned to", of: "user" },
      prerequisites: { label: "Depends on",  of: "task" },
    },
    select: { id: true, name: true, isTemplateTask: true, ...seasonTeam },
    teamOf: (r) => r.season?.teamId,
    idOf: (r) => r.id,
    labelOf: (r) => r.name,
    skip: (r) => !!r.isTemplateTask,
    parent: { key: "seasonId", find: findSeason },
  },
  meeting: {
    entity: "meeting",
    fields: {
      date:         { label: "Date",          kind: "date" },
      startTime:    { label: "Start",         kind: "time" },
      endTime:      { label: "End",           kind: "time" },
      title:        { label: "Title",         kind: "text" },
      notes:        { label: "Notes",         kind: "long" },
      cancelled:    { label: "Canceled",      kind: "bool" },
      cancelReason: { label: "Cancel reason", kind: "text" },
    },
    select: { id: true, title: true, date: true, ...seasonTeam },
    teamOf: (r) => r.season?.teamId,
    idOf: (r) => r.id,
    labelOf: (r) => `${r.title || "Meeting"} (${fmtDate(r.date)})`,
    parent: { key: "seasonId", find: findSeason },
  },
  purchaseRequest: {
    entity: "order",
    fields: {
      title:          { label: "Name",            kind: "text" },
      status:         { label: "Status",          kind: { enum: ORDER_STATUS } },
      priority:       { label: "Importance",      kind: { enum: labels(IMPORTANCE_OPTIONS) } },
      budgetCategory: { label: "Budget category", kind: { enum: BUDGET_CATEGORY_LABELS } },
      justification:  { label: "Reason",          kind: "long" },
      approvalNotes:  { label: "Approval note",   kind: "long" },
      actualTotal:    { label: "Actual total",    kind: "money" },
    },
    select: { id: true, title: true, ...seasonTeam },
    teamOf: (r) => r.season?.teamId,
    idOf: (r) => r.id,
    labelOf: (r) => r.title,
    parent: { key: "seasonId", find: findSeason },
  },
  purchaseLineItem: {
    entity: "order",
    fields: ITEM_FIELDS,
    select: { id: true, name: true, orderNumber: true, requestId: true, request: { select: { title: true, season: { select: { teamId: true } } } } },
    teamOf: (r) => r.request?.season?.teamId,
    idOf: (r) => r.requestId,
    labelOf: (r) => r.request?.title ?? "Order",
    part: (r) => `${r.orderNumber ? itemRef(r as { id: string; orderNumber: number }) + " " : ""}${r.name ?? "Item"}`,
    parent: { key: "requestId", find: findOrder },
  },
  orderVendorCharge: {
    entity: "order",
    fields: {
      tax:      { label: "Tax",      kind: "money" },
      shipping: { label: "Shipping", kind: "money" },
    },
    select: { id: true, vendorName: true, requestId: true, request: { select: { title: true, season: { select: { teamId: true } } } } },
    teamOf: (r) => r.request?.season?.teamId,
    idOf: (r) => r.requestId,
    labelOf: (r) => r.request?.title ?? "Order",
    part: (r) => r.vendorName || "No vendor",
    parent: { key: "requestId", find: findOrder },
  },
};

function fmtDate(d: unknown): string {
  if (!d) return "—";
  const date = d instanceof Date ? d : new Date(String(d));
  if (Number.isNaN(date.getTime())) return "—";
  // Calendar dates are stored at UTC midnight
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

const EMPTY = "—";
function show(kind: Kind, v: unknown, names: Map<string, string>): string {
  if (v === null || v === undefined || v === "") return EMPTY;
  if (typeof kind === "object") return kind.enum[String(v)] ?? String(v);
  switch (kind) {
    case "date":   return fmtDate(v);
    case "money":  return `$${Number(v).toFixed(2)}`;
    case "number": return String(Math.round(Number(v) * 100) / 100);
    case "bool":   return v ? "Yes" : "No";
    case "robot":  return names.get(String(v)) ?? "a robot";
    case "time": {
      const [h, m] = String(v).split(":").map(Number);
      if (Number.isNaN(h)) return String(v);
      return `${((h + 11) % 12) + 1}:${String(m ?? 0).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
    }
    case "long": {
      const s = String(v).replace(/\s+/g, " ").trim();
      return s.length > 160 ? s.slice(0, 157) + "…" : s;
    }
    default: return String(v).slice(0, 300);
  }
}

/** A field's new value from update data, or undefined when it isn't being set */
function newValue(data: Row, field: string): { value: unknown } | undefined {
  if (field === "robotId" && data.robot && typeof data.robot === "object") {
    if (data.robot.disconnect) return { value: null };
    if (data.robot.connect?.id) return { value: data.robot.connect.id };
  }
  if (!(field in data)) return undefined;
  const v = data[field];
  if (v && typeof v === "object" && !(v instanceof Date)) {
    if ("set" in v) return { value: v.set };
    return undefined; // increment etc. — not used on watched fields
  }
  return { value: v };
}

/** A list's ids after an update's set/connect/disconnect */
function newList(op: unknown, before: string[]): string[] | undefined {
  if (!op || typeof op !== "object") return undefined;
  const o = op as Row;
  const ids = (x: unknown) => (Array.isArray(x) ? x : x ? [x] : []).map((y: Row) => y.id).filter(Boolean) as string[];
  if ("set" in o) return ids(o.set);
  let out = [...before];
  if ("connect" in o) out = [...new Set([...out, ...ids(o.connect)])];
  if ("disconnect" in o) { const gone = new Set(ids(o.disconnect)); out = out.filter((id) => !gone.has(id)); }
  return out;
}

// ── Working out the changes ─────────────────────────────────────────────────

interface Entry {
  teamId: string; entityType: EntityType; entityId: string | null; entityLabel: string;
  action: "created" | "updated" | "deleted"; changes: FieldChange[];
}

async function lookupNames(base: PrismaClient, users: string[], tasks: string[], robots: string[]): Promise<Map<string, string>> {
  const [u, t, r] = await Promise.all([
    users.length ? base.user.findMany({ where: { id: { in: users } }, select: { id: true, name: true } }) : [],
    tasks.length ? base.task.findMany({ where: { id: { in: tasks } }, select: { id: true, name: true } }) : [],
    robots.length ? base.robot.findMany({ where: { id: { in: robots } }, select: { id: true, name: true } }) : [],
  ]);
  return new Map([...u, ...t, ...r].map((x) => [x.id, x.name]));
}

function beforeSelect(spec: Spec) {
  const sel: Row = { ...spec.select };
  for (const f of Object.keys(spec.fields)) sel[f] = true;
  for (const l of Object.keys(spec.lists ?? {})) sel[l] = { select: { id: true } };
  return sel;
}

async function diffRows(base: PrismaClient, spec: Spec, rows: Row[], data: Row): Promise<Entry[]> {
  // Names for robots and lists, before and after
  const users = new Set<string>(), tasks = new Set<string>(), robots = new Set<string>();
  const after = rows.map((row) => {
    const lists: Record<string, { from: string[]; to: string[] }> = {};
    for (const [l, def] of Object.entries(spec.lists ?? {})) {
      const from = (row[l] ?? []).map((x: Row) => x.id);
      const to = newList(data[l], from);
      if (!to) continue;
      lists[l] = { from, to };
      for (const id of [...from, ...to]) (def.of === "user" ? users : tasks).add(id);
    }
    return lists;
  });
  if ("robotId" in spec.fields) {
    for (const row of rows) if (row.robotId) robots.add(row.robotId);
    const nv = newValue(data, "robotId");
    if (nv?.value) robots.add(String(nv.value));
  }
  const names = await lookupNames(base, [...users], [...tasks], [...robots]);

  const out: Entry[] = [];
  rows.forEach((row, i) => {
    const teamId = spec.teamOf(row);
    if (!teamId || spec.skip?.(row)) return;
    const changes: FieldChange[] = [];
    const prefix = spec.part ? `${spec.part(row)} — ` : "";
    for (const [f, def] of Object.entries(spec.fields)) {
      const nv = newValue(data, f);
      if (!nv) continue;
      const from = show(def.kind, row[f], names), to = show(def.kind, nv.value, names);
      // Long text: compare the full values, show a shortened version
      const same = def.kind === "long" ? String(row[f] ?? "").trim() === String(nv.value ?? "").trim() : from === to;
      if (!same) changes.push({ field: prefix + def.label, from, to });
    }
    for (const [l, { from, to }] of Object.entries(after[i])) {
      const a = [...from].sort().join(), b = [...to].sort().join();
      if (a === b) continue;
      const list = (ids: string[]) => ids.map((id) => names.get(id) ?? "someone").join(", ") || EMPTY;
      changes.push({ field: prefix + spec.lists![l].label, from: list(from), to: list(to) });
    }
    if (changes.length) out.push({ teamId, entityType: spec.entity, entityId: spec.idOf(row), entityLabel: spec.labelOf(row), action: "updated", changes });
  });
  return out;
}

/** Created or deleted rows. Parts (items, vendor charges) show as a change to their order. */
function lifecycle(spec: Spec, row: Row, action: "created" | "deleted"): Entry | null {
  const teamId = spec.teamOf(row);
  if (!teamId || spec.skip?.(row)) return null;
  if (!spec.part) {
    return { teamId, entityType: spec.entity, entityId: spec.idOf(row), entityLabel: spec.labelOf(row), action, changes: [] };
  }
  const added = action === "created";
  let changes: FieldChange[];
  if ("tax" in spec.fields) {
    // A vendor's tax & shipping: each amount that was set appears or goes
    changes = Object.entries(spec.fields)
      .filter(([f]) => Number(row[f]) > 0)
      .map(([f, def]) => {
        const v = show(def.kind, row[f], new Map());
        return { field: `${spec.part!(row)} — ${def.label}`, from: added ? EMPTY : v, to: added ? v : EMPTY };
      });
  } else {
    const what = row.quantity ? ` (${row.quantity}${row.unitCost ? ` × $${Number(row.unitCost).toFixed(2)}` : ""})` : "";
    changes = [{ field: spec.part!(row), from: added ? EMPTY : "on the order", to: added ? `added${what}` : "removed" }];
  }
  return changes.length ? { teamId, entityType: spec.entity, entityId: spec.idOf(row), entityLabel: spec.labelOf(row), action: "updated", changes } : null;
}

async function write(base: PrismaClient, entries: Entry[]) {
  if (!entries.length) return;
  const actorId = await currentActor();
  await base.changeLog.createMany({
    data: entries.map((e) => ({ ...e, changes: e.changes as unknown as Prisma.InputJsonValue, actorId })),
  });
}

/** Never let history keeping break the change itself */
async function safely(what: string, fn: () => Promise<void>) {
  try { await fn(); } catch (e) { console.error(`[change-log] ${what}:`, e); }
}

// ── The extension ───────────────────────────────────────────────────────────

/** Wraps a client so changes to orders, tasks and meetings are recorded */
export function withChangeLog(base: PrismaClient) {
  const handlers = Object.fromEntries(Object.entries(SPECS).map(([model, spec]) => {
    const delegate = () => (base as unknown as Record<string, Row>)[model];
    const sel = beforeSelect(spec);

    return [model, {
      async create({ args, query }: { args: Row; query: (a: Row) => Promise<Row> }) {
        const result = await query(args);
        await safely(`${model}.create`, async () => {
          const data = args.data as Row;
          const parentId = data[spec.parent.key] ?? data[spec.parent.key.replace(/Id$/, "")]?.connect?.id;
          const parent = parentId ? await spec.parent.find(base, parentId) : null;
          if (!parent) return; // Parent made in the same transaction (e.g. a new season's tasks)
          const row = { ...data, ...parent, id: result?.id, [spec.parent.key]: parentId };
          const e = lifecycle(spec, row, "created");
          if (e) await write(base, [e]);
        });
        return result;
      },
      async createMany({ args, query }: { args: Row; query: (a: Row) => Promise<Row> }) {
        const result = await query(args);
        await safely(`${model}.createMany`, async () => {
          // One summary per parent (e.g. "12 meetings added" when the schedule is regenerated)
          const rows = (Array.isArray(args.data) ? args.data : [args.data]) as Row[];
          const byParent = new Map<string, Row[]>();
          for (const r of rows) if (r[spec.parent.key]) byParent.set(r[spec.parent.key], [...(byParent.get(r[spec.parent.key]) ?? []), r]);
          const entries: Entry[] = [];
          for (const [pid, list] of byParent) {
            const parent = await spec.parent.find(base, pid);
            if (!parent) continue;
            if (spec.part) {
              for (const r of list) { const e = lifecycle(spec, { ...r, ...parent }, "created"); if (e) entries.push(e); }
            } else {
              const teamId = spec.teamOf(parent);
              const live = list.filter((r) => !spec.skip?.(r));
              if (teamId && live.length) entries.push({ teamId, entityType: spec.entity, entityId: null, entityLabel: `${live.length} ${spec.entity}${live.length === 1 ? "" : "s"}`, action: "created", changes: [] });
            }
          }
          await write(base, entries);
        });
        return result;
      },
      async update({ args, query }: { args: Row; query: (a: Row) => Promise<Row> }) {
        let before: Row | null = null;
        await safely(`${model}.update (before)`, async () => { before = await delegate().findUnique({ where: args.where, select: sel }); });
        const result = await query(args);
        if (before) await safely(`${model}.update`, async () => write(base, await diffRows(base, spec, [before!], args.data)));
        return result;
      },
      async updateMany({ args, query }: { args: Row; query: (a: Row) => Promise<Row> }) {
        let before: Row[] = [];
        await safely(`${model}.updateMany (before)`, async () => { before = await delegate().findMany({ where: args.where, select: sel, take: 500 }); });
        const result = await query(args);
        if (before.length) await safely(`${model}.updateMany`, async () => write(base, merge(await diffRows(base, spec, before, args.data))));
        return result;
      },
      async upsert({ args, query }: { args: Row; query: (a: Row) => Promise<Row> }) {
        let before: Row | null = null;
        await safely(`${model}.upsert (before)`, async () => { before = await delegate().findUnique({ where: args.where, select: sel }); });
        const result = await query(args);
        await safely(`${model}.upsert`, async () => {
          if (before) return write(base, await diffRows(base, spec, [before], args.update));
          const parentId = args.create?.[spec.parent.key];
          const parent = parentId ? await spec.parent.find(base, parentId) : null;
          const e = parent ? lifecycle(spec, { ...args.create, ...parent, id: result?.id }, "created") : null;
          if (e) await write(base, [e]);
        });
        return result;
      },
      async delete({ args, query }: { args: Row; query: (a: Row) => Promise<Row> }) {
        let before: Row | null = null;
        await safely(`${model}.delete (before)`, async () => { before = await delegate().findUnique({ where: args.where, select: sel }); });
        const result = await query(args);
        if (before) await safely(`${model}.delete`, async () => { const e = lifecycle(spec, before!, "deleted"); if (e) await write(base, [e]); });
        return result;
      },
      async deleteMany({ args, query }: { args: Row; query: (a: Row) => Promise<Row> }) {
        let before: Row[] = [];
        await safely(`${model}.deleteMany (before)`, async () => { before = await delegate().findMany({ where: args.where, select: sel, take: 500 }); });
        const result = await query(args);
        await safely(`${model}.deleteMany`, async () => {
          const live = before.filter((r) => spec.teamOf(r) && !spec.skip?.(r));
          if (spec.part || live.length <= 5) {
            return write(base, merge(live.map((r) => lifecycle(spec, r, "deleted")).filter((e): e is Entry => !!e)));
          }
          // Many at once (the schedule regenerated): one summary per team
          const teams = new Map<string, number>();
          for (const r of live) teams.set(spec.teamOf(r)!, (teams.get(spec.teamOf(r)!) ?? 0) + 1);
          await write(base, [...teams].map(([teamId, n]) => ({ teamId, entityType: spec.entity, entityId: null, entityLabel: `${n} ${spec.entity}s`, action: "deleted" as const, changes: [] })));
        });
        return result;
      },
    }];
  }));

  return base.$extends({ name: "changeLog", query: handlers as never });
}

/** One entry per order when several of its items change at once */
function merge(entries: Entry[]): Entry[] {
  const out = new Map<string, Entry>();
  for (const e of entries) {
    const k = e.action === "updated" && e.entityId ? `${e.entityType}:${e.entityId}` : Math.random().toString();
    const had = out.get(k);
    if (had) had.changes.push(...e.changes); else out.set(k, { ...e, changes: [...e.changes] });
  }
  return [...out.values()];
}

/** The hourly job: history older than a year goes */
export async function pruneChangeLog(base: { changeLog: PrismaClient["changeLog"] }): Promise<number> {
  const cutoff = new Date(Date.now() - CHANGE_LOG_DAYS * 86_400_000);
  return (await base.changeLog.deleteMany({ where: { createdAt: { lt: cutoff } } })).count;
}
