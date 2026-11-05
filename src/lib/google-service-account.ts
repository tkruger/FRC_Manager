// Team email through a Google Workspace service account with domain-wide delegation. Server-only.
//
// The team's Integration Admin uploads the service account's key file (JSON, or the same JSON
// base64-encoded) and names the one mailbox to send as. The key is stored encrypted. Each send signs
// a short JWT (RS256) acting as that mailbox with only the gmail.send scope, swaps it at Google for a
// one-hour access token, and posts the message through users.messages.send.
//
// The mailbox is fixed in the team's settings — the app never sends as any other address, even
// though domain-wide delegation would let the key act for every mailbox in the Workspace.

import crypto from "node:crypto";
import { GMAIL_SCOPE, GmailError, sendGmailMessage } from "@/lib/gmail-api";

export interface ServiceAccountKey {
  type: "service_account";
  client_email: string;
  client_id?: string;
  private_key: string;
  private_key_id?: string;
  token_uri?: string;
}

const TOKEN_URI = "https://oauth2.googleapis.com/token";

/** The key file as uploaded: JSON, or base64-encoded JSON (whitespace ignored) */
export function parseServiceAccountKey(input: string): ServiceAccountKey {
  const text = input.trim();
  let json = text;
  if (!text.startsWith("{")) {
    try { json = Buffer.from(text.replace(/\s+/g, ""), "base64").toString("utf8"); } catch { /* checked below */ }
  }
  let key: ServiceAccountKey;
  try { key = JSON.parse(json); } catch { throw new GmailError("That isn't a service account key file (JSON, or base64-encoded JSON)."); }
  if (key?.type !== "service_account" || !key.client_email || !/PRIVATE KEY/.test(key.private_key ?? "")) {
    throw new GmailError("That isn't a Google service account key file — download a JSON key for the service account in Google Cloud.");
  }
  // Some tools keep the PEM's line breaks as literal "\n"
  key.private_key = key.private_key.replace(/\\n/g, "\n");
  try { crypto.createPrivateKey(key.private_key); } catch { throw new GmailError("The key file's private key couldn't be read."); }
  return key;
}

const b64url = (v: Buffer | string) => Buffer.from(v).toString("base64url");

function assertion(key: ServiceAccountKey, sender: string): string {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT", ...(key.private_key_id ? { kid: key.private_key_id } : {}) };
  const claims = { iss: key.client_email, sub: sender, scope: GMAIL_SCOPE, aud: TOKEN_URI, iat: now, exp: now + 3600 };
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`;
  return `${unsigned}.${b64url(crypto.createSign("RSA-SHA256").update(unsigned).sign(key.private_key))}`;
}

// One-hour access tokens, per service account + mailbox, while this server instance is warm
const cache = new Map<string, { token: string; until: number }>();

export async function serviceAccountToken(key: ServiceAccountKey, sender: string): Promise<string> {
  const id = `${key.client_email}|${sender}`;
  const hit = cache.get(id);
  if (hit && hit.until > Date.now() + 60_000) return hit.token;
  const res = await fetch(TOKEN_URI, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: assertion(key, sender) }),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  const data = await res.json().catch(() => ({})) as { access_token?: string; expires_in?: number; error?: string; error_description?: string };
  if (!res.ok || !data.access_token) {
    if (data.error === "unauthorized_client") {
      throw new GmailError(`Domain-wide delegation isn't set up for this service account: in the Google Admin console → Security → API controls → Domain-wide delegation, add client ID ${key.client_id ?? "(from the key file)"} with the scope ${GMAIL_SCOPE}.`);
    }
    if (data.error === "invalid_grant") {
      throw new GmailError(`Google refused to act as ${sender} — check it's a mailbox in your Workspace, and that the key hasn't been deleted.`);
    }
    throw new GmailError(`Google refused the service account${data.error_description ? `: ${data.error_description}` : "."}`);
  }
  cache.set(id, { token: data.access_token, until: Date.now() + (data.expires_in ?? 3600) * 1000 });
  return data.access_token;
}

/** Send one message as the team's mailbox */
export function sendViaServiceAccount(
  s: { key: ServiceAccountKey; sender: string; fromName: string | null; fromEmail: string },
  msg: { to: string; subject: string; text: string; html: string; replyTo?: string },
) {
  return sendGmailMessage(() => serviceAccountToken(s.key, s.sender), { fromName: s.fromName, fromEmail: s.fromEmail }, msg, "your Google Cloud project");
}
