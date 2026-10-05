// Short-lived signed links for CSV exports. Server-only.
//
// The iPhone home-screen app can't download files and doesn't share its login
// with Safari, so it opens exports in Safari using a link that carries its own
// proof of access: who asked, which team, which export, and an expiry, signed
// with AUTH_SECRET.

import crypto from "crypto";

export interface ExportScope {
  userId: string;
  teamId: string;
  /** One order's items… */
  order?:  string;
  /** …or every order on an Orders tab */
  view?:   "open" | "mine" | "all";
}

const TTL_MS = 5 * 60_000;

function secret() {
  const s = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return s;
}

function sign(payload: string) {
  return crypto.createHmac("sha256", secret()).update(`order-export:${payload}`).digest("base64url");
}

export function createExportToken(scope: ExportScope): string {
  const payload = Buffer.from(JSON.stringify({ ...scope, exp: Date.now() + TTL_MS })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

/** The scope if the token is genuine and unexpired, otherwise null. */
export function verifyExportToken(token: string): ExportScope | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = Buffer.from(sign(payload));
  const given    = Buffer.from(sig);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as ExportScope & { exp: number };
    if (typeof data.exp !== "number" || data.exp < Date.now()) return null;
    return { userId: data.userId, teamId: data.teamId, order: data.order, view: data.view };
  } catch {
    return null;
  }
}
