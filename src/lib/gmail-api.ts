// Sending a team's email through the Gmail API (Google Workspace / Gmail), connected with Google.
// https://developers.google.com/workspace/gmail/api/guides/sending
//
// A Head Mentor or Integration Admin clicks "Connect with Google" (Settings → Team email), signs in
// with the team's Google account and allows only "send email on your behalf" (gmail.send). The
// refresh token Google returns is stored encrypted; each send swaps it for a short-lived access token
// and posts the message to users.messages.send. Server-only.
//
// Uses the app's Google sign-in client (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET). In that Google
// Cloud project: enable the Gmail API, add the gmail.send scope to the OAuth consent screen, and add
// {site}/api/integrations/gmail/callback as an authorized redirect URI.

import crypto from "crypto";
import { appUrl } from "@/lib/app-url";

export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.send";

export function gmailConfigured(): boolean {
  return !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;
}

export const gmailRedirectUri = () => `${appUrl()}/api/integrations/gmail/callback`;

/** Where to send the person to connect the team's Google account */
export function gmailAuthUrl(state: string, loginHint?: string): string {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: gmailRedirectUri(),
    response_type: "code",
    scope: `openid email ${GMAIL_SCOPE}`,
    // A refresh token, every time (so reconnecting always works)
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "false",
    state,
    ...(loginHint ? { login_hint: loginHint } : {}),
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

/** A message safe to show a Head Mentor */
export class GmailError extends Error {}

/** Why connecting failed, handed from the OAuth callback to the settings page */
export const GMAIL_REASON_COOKIE = "gmail_connect_reason";

async function tokenRequest(body: Record<string, string>) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, ...body }),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  const data = await res.json().catch(() => ({})) as {
    access_token?: string; refresh_token?: string; expires_in?: number; scope?: string; id_token?: string; error?: string; error_description?: string;
  };
  if (!res.ok || !data.access_token) {
    if (data.error === "invalid_grant") throw new GmailError("Google no longer allows sending for this account (access was removed or expired) — connect Gmail again.");
    throw new GmailError(`Google refused the sign-in${data.error_description ? `: ${data.error_description}` : "."}`);
  }
  return data;
}

/** After Google sends the person back: the refresh token and which account it's for */
export async function exchangeGmailCode(code: string): Promise<{ refreshToken: string; email: string }> {
  const t = await tokenRequest({ code, grant_type: "authorization_code", redirect_uri: gmailRedirectUri() });
  if (!t.scope?.split(" ").includes(GMAIL_SCOPE)) throw new GmailError("Google didn't give permission to send email — tick \"Send email on your behalf\" when connecting.");
  if (!t.refresh_token) throw new GmailError("Google didn't return a long-term token. Remove FRC Manager under your Google Account → Security → Third-party access, then connect again.");
  // The account's address (straight from Google, over TLS)
  const info = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${t.access_token}` }, cache: "no-store", signal: AbortSignal.timeout(10_000),
  }).then((r) => r.json()).catch(() => ({})) as { email?: string; email_verified?: boolean };
  if (!info.email) throw new GmailError("Couldn't read the Google account's address.");
  return { refreshToken: t.refresh_token, email: info.email.toLowerCase() };
}

// Access tokens last about an hour — kept per refresh token while this server instance is warm
const accessCache = new Map<string, { token: string; until: number }>();

async function accessToken(refreshToken: string): Promise<string> {
  const key = crypto.createHash("sha256").update(refreshToken).digest("hex");
  const hit = accessCache.get(key);
  if (hit && hit.until > Date.now() + 60_000) return hit.token;
  const t = await tokenRequest({ refresh_token: refreshToken, grant_type: "refresh_token" });
  accessCache.set(key, { token: t.access_token!, until: Date.now() + (t.expires_in ?? 3600) * 1000 });
  return t.access_token!;
}

/** Stop the app's access (when the team removes it) — best-effort */
export async function revokeGmail(refreshToken: string): Promise<void> {
  try {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refreshToken)}`, { method: "POST", signal: AbortSignal.timeout(8_000) });
  } catch { /* the token is deleted either way */ }
}

// ── The message (RFC 2822 / MIME) ───────────────────────────────────────────

/** A header value with non-ASCII text, encoded (RFC 2047) */
const encodeWord = (s: string) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${Buffer.from(s, "utf8").toString("base64")}?=`);
/** No line breaks in headers (header injection) */
const oneLine = (s: string) => s.replace(/[\r\n]+/g, " ").trim();
const address = (name: string | null, email: string) =>
  name ? `${encodeWord(`"${oneLine(name).replace(/["\\]/g, "")}"`)} <${oneLine(email)}>` : oneLine(email);
/** Base64 body, wrapped at 76 characters */
const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64").replace(/.{76}/g, "$&\r\n");

export function buildMime(m: { fromName: string | null; fromEmail: string; to: string; subject: string; text: string; html: string; replyTo?: string }): string {
  const boundary = `frc-${crypto.randomBytes(12).toString("hex")}`;
  return [
    `From: ${address(m.fromName, m.fromEmail)}`,
    `To: ${oneLine(m.to)}`,
    ...(m.replyTo ? [`Reply-To: ${oneLine(m.replyTo)}`] : []),
    `Subject: ${encodeWord(oneLine(m.subject))}`,
    `Date: ${new Date().toUTCString()}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    b64(m.text),
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    b64(m.html),
    `--${boundary}--`,
    "",
  ].join("\r\n");
}

/** Send one message as the connected account */
export async function sendViaGmailApi(
  s: { refreshToken: string; fromName: string | null; fromEmail: string },
  msg: { to: string; subject: string; text: string; html: string; replyTo?: string },
): Promise<{ sent: true } | { sent: false; error: string }> {
  return sendGmailMessage(() => accessToken(s.refreshToken), { fromName: s.fromName, fromEmail: s.fromEmail }, msg, "the app's Google Cloud project");
}

/**
 * Post a message to users.messages.send with an access token from getToken (a connected account
 * or a service account). project: whose Google Cloud project, for the "API isn't on" message.
 */
export async function sendGmailMessage(
  getToken: () => Promise<string>,
  from: { fromName: string | null; fromEmail: string },
  msg: { to: string; subject: string; text: string; html: string; replyTo?: string },
  project: string,
): Promise<{ sent: true } | { sent: false; error: string }> {
  try {
    const token = await getToken();
    const raw = Buffer.from(buildMime({ ...msg, ...from }), "utf8").toString("base64url");
    const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ raw }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (res.ok) return { sent: true };
    const err = await res.json().catch(() => ({})) as { error?: { message?: string; status?: string } };
    const detail = err.error?.message ?? `error ${res.status}`;
    if (res.status === 403 && /not been used|disabled/i.test(detail)) return { sent: false, error: `The Gmail API isn't turned on for ${project}.` };
    if (res.status === 400 && /from/i.test(detail)) return { sent: false, error: "Gmail refused the From address — it has to be the account's address or a \"Send mail as\" alias." };
    if (res.status === 429) return { sent: false, error: "Gmail's sending limit was reached for now — try again later." };
    return { sent: false, error: `Gmail refused the message: ${detail}` };
  } catch (e) {
    return { sent: false, error: e instanceof GmailError ? e.message : "Couldn't reach Gmail." };
  }
}
