// Server actions are plain POST requests: whatever their TypeScript signature says, the caller can
// send any value — an object where a string id is expected, for one. Passed into a Prisma `where`,
// `{ not: "" }` is a filter, not an id, and matches some other row. Server-only.

import { ActionError } from "@/lib/action-error";

/** Longest text any action takes as a plain argument (longer fields go through a schema) */
const MAX_TEXT = 20_000;
const MAX_LIST = 1_000;

const plain = (v: unknown): boolean =>
  v === undefined || v === null || typeof v === "boolean" ||
  (typeof v === "number" && Number.isFinite(v)) ||
  (typeof v === "string" && v.length <= MAX_TEXT);

/**
 * Each argument is a plain value — a string, number, boolean, null, or a list of strings — never an
 * object. Call it first thing in an action with its simple arguments. Only a hand-made request
 * fails this, so it throws rather than returning a friendly error.
 */
export function plainArgs(...values: unknown[]): void {
  for (const v of values) if (!plainOrStrings(v)) throw new ActionError("Invalid input.");
}

const plainOrStrings = (v: unknown): boolean =>
  plain(v) || (Array.isArray(v) && v.length <= MAX_LIST && v.every((x) => typeof x === "string" && x.length <= MAX_TEXT));

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype &&
  Object.keys(v).length <= 50 && Object.values(v).every(plainOrStrings);

/** An object argument ({ title, body, … }) whose fields are all plain values — or, with `list`, a list of them */
export function plainObject(v: unknown, opts: { optional?: boolean } = {}): void {
  if (opts.optional && (v === undefined || v === null)) return;
  if (!isPlainObject(v)) throw new ActionError("Invalid input.");
}

export function plainObjects(v: unknown): void {
  if (!Array.isArray(v) || v.length > MAX_LIST || !v.every(isPlainObject)) throw new ActionError("Invalid input.");
}
