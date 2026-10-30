// Who the current request is for, from anywhere on the server (including the Prisma client's
// extensions). Server-only.
//
// runAs(userId, fn) sets it for callers outside a signed-in request (Discord commands);
// otherwise it's the signed-in user, looked up once per request.

import { AsyncLocalStorage } from "node:async_hooks";
import type { PrismaClient } from "@/generated/prisma";

export interface RequestUser { id: string; roles: string[] }

const store = new AsyncLocalStorage<{ userId: string | null; user?: Promise<RequestUser | null> }>();

/** Run `fn` as `userId` — its changes are credited to them and their permissions apply */
export function runAs<T>(userId: string | null, fn: () => T): T {
  return store.run({ userId }, fn);
}

const perRequest = new WeakMap<object, Promise<RequestUser | null>>();

/** The current user and their roles, or null (signed out, a background job, a script) */
export function requestUser(base: PrismaClient): Promise<RequestUser | null> {
  const set = store.getStore();
  if (set) {
    const userId = set.userId;
    if (!userId) return Promise.resolve(null);
    set.user ??= base.userRole.findMany({ where: { userId }, select: { role: true } })
      .then((rs) => ({ id: userId, roles: rs.map((r) => r.role as string) }));
    return set.user;
  }
  return fromSession();
}

async function fromSession(): Promise<RequestUser | null> {
  let key: object;
  try {
    // Imported here: outside a request (cron, scripts) headers() throws, and auth.ts
    // itself uses the Prisma client
    const { headers } = await import("next/headers");
    key = await headers();
  } catch {
    return null;
  }
  let p = perRequest.get(key);
  if (!p) {
    p = import("@/lib/auth")
      .then(({ auth }) => auth())
      .then((s) => (s?.user?.id ? { id: s.user.id, roles: (s.user.roles ?? []) as string[] } : null))
      .catch(() => null);
    perRequest.set(key, p);
  }
  return p;
}
