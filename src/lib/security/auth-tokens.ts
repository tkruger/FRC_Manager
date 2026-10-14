// One-time links sent by email (verify address, reset password, confirm new email).
// Server-only. Only a SHA-256 of each token is stored; a token works once, before it expires.

import { prisma } from "@/lib/prisma";
import type { AuthTokenKind } from "@/generated/prisma";
import { hashToken, newSecretToken } from "./crypto";

const TTL_MINUTES: Record<AuthTokenKind, number> = {
  EMAIL_VERIFY:   24 * 60,
  PASSWORD_RESET: 30,
  EMAIL_CHANGE:   60,
};

/** Make a new link token (earlier unused ones of the same kind stop working) */
export async function createAuthToken(userId: string, kind: AuthTokenKind, email?: string): Promise<string> {
  const token = newSecretToken();
  await prisma.$transaction([
    prisma.authToken.deleteMany({ where: { userId, kind, usedAt: null } }),
    prisma.authToken.create({
      data: {
        userId, kind, email: email ?? null,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + TTL_MINUTES[kind] * 60_000),
      },
    }),
  ]);
  return token;
}

/** The token's record if it's real, unused and unexpired (doesn't use it up) */
export async function peekAuthToken(token: string, kind: AuthTokenKind) {
  if (!token || token.length > 100) return null;
  const row = await prisma.authToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!row || row.kind !== kind || row.usedAt || row.expiresAt < new Date()) return null;
  return row;
}

/**
 * Use the token up. Returns its record, or null if it was already used, expired, or never
 * existed. Safe against two requests racing: only one of them marks it used.
 */
export async function consumeAuthToken(token: string, kind: AuthTokenKind) {
  const row = await peekAuthToken(token, kind);
  if (!row) return null;
  const { count } = await prisma.authToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } });
  return count === 1 ? row : null;
}

/** Clear out tokens that expired over a day ago (called by the hourly cron) */
export async function pruneAuthTokens(): Promise<number> {
  const { count } = await prisma.authToken.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 86_400_000) } } });
  return count;
}
