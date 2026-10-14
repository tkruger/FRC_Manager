// Small crypto helpers. Server-only.

import crypto from "crypto";

/** Compare two secrets without leaking where they differ (timing-safe) */
export function safeEqual(a: string, b: string): boolean {
  const x = crypto.createHash("sha256").update(a).digest();
  const y = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(x, y) && a.length === b.length;
}

/** A random URL-safe token (32 bytes) */
export function newSecretToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

/** What we store for a token: never the token itself */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** A random team access code that's hard to guess (12 characters, no look-alikes) */
export function newAccessCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(12);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}
