// Fixed-window rate limiting stored in Postgres (no extra service needed). Server-only.
//
//   if (!await rateLimit(`login:email:${email}`, 10, 15 * 60)) return "Too many attempts…";
//
// Expired rows are cleared by the hourly cron (pruneRateLimits).

import { prisma } from "@/lib/prisma";

/**
 * Count one attempt against `key`. True if it's within `limit` attempts per `windowSeconds`,
 * false once the limit is passed. Fails open if the database call errors, so a hiccup
 * never locks everyone out.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  try {
    const [row] = await prisma.$queryRaw<{ count: number }[]>`
      INSERT INTO "RateLimit" ("key", "count", "resetAt")
      VALUES (${key}, 1, now() + make_interval(secs => ${windowSeconds}))
      ON CONFLICT ("key") DO UPDATE SET
        "count"   = CASE WHEN "RateLimit"."resetAt" < now() THEN 1 ELSE "RateLimit"."count" + 1 END,
        "resetAt" = CASE WHEN "RateLimit"."resetAt" < now() THEN now() + make_interval(secs => ${windowSeconds}) ELSE "RateLimit"."resetAt" END
      RETURNING "count"`;
    return Number(row?.count ?? 0) <= limit;
  } catch (e) {
    console.error("[rate-limit] check failed, allowing:", e);
    return true;
  }
}

/** Several limits at once (e.g. per email and per IP); every one is counted */
export async function rateLimitAll(checks: [key: string, limit: number, windowSeconds: number][]): Promise<boolean> {
  const results = await Promise.all(checks.map(([k, l, w]) => rateLimit(k, l, w)));
  return results.every(Boolean);
}

/** Forget a key (e.g. after a successful sign-in) */
export async function clearRateLimit(key: string): Promise<void> {
  await prisma.rateLimit.deleteMany({ where: { key } }).catch(() => {});
}

/** Drop expired counters */
export async function pruneRateLimits(): Promise<number> {
  const { count } = await prisma.rateLimit.deleteMany({ where: { resetAt: { lt: new Date() } } });
  return count;
}

export const TOO_MANY = "Too many attempts. Please wait a few minutes and try again.";
