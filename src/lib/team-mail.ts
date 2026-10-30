// Sending through a team's own mail server (Settings → Email). Server-only.
//
// The server's address is checked before connecting: it must resolve to a public address
// (never this machine or a private network), on a mail port, and the connection is pinned to
// the address that was checked (the certificate is still verified against the host name).

import dns from "node:dns/promises";
import net from "node:net";
import nodemailer from "nodemailer";
import { MAIL_PORTS, type MailSecurity } from "@/lib/email-providers";

export interface MailServer {
  host: string;
  port: number;
  security: MailSecurity;
  username: string;
  password: string;
  fromName: string | null;
  fromEmail: string;
}

export interface OutgoingMail { to: string; subject: string; html: string; text: string }

/** A message safe to show a Head Mentor (no stack traces or internals) */
export class MailServerError extends Error {}

function isPrivate(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||   // carrier-grade NAT
      (a === 169 && b === 254) ||             // link-local (cloud metadata)
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19));
  }
  const v = ip.toLowerCase();
  if (v.startsWith("::ffff:")) return isPrivate(v.slice(7));
  return v === "::" || v === "::1" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe8") || v.startsWith("fe9") || v.startsWith("fea") || v.startsWith("feb") || v.startsWith("ff");
}

/** The public address to connect to, or a reason it can't be used */
async function resolvePublic(host: string): Promise<string> {
  const name = host.trim().toLowerCase();
  if (!/^[a-z0-9.-]+$/.test(name) || !name.includes(".") || name === "localhost" || name.endsWith(".local") || name.endsWith(".internal")) {
    throw new MailServerError("Enter the mail server's public name, like smtp.example.com.");
  }
  let addrs: { address: string }[];
  try {
    addrs = await dns.lookup(name, { all: true });
  } catch {
    throw new MailServerError(`Couldn't find a mail server called ${name}. Check the spelling.`);
  }
  if (addrs.length === 0 || addrs.some((a) => isPrivate(a.address))) {
    throw new MailServerError(`${name} points to a private network address, which isn't allowed.`);
  }
  return addrs[0].address;
}

/** Turn mail server errors into something a person can act on */
function explain(e: unknown): string {
  const err = e as { code?: string; responseCode?: number; response?: string; message?: string };
  if (e instanceof MailServerError) return e.message;
  if (err.code === "EAUTH" || err.responseCode === 535 || err.responseCode === 534) {
    return "The mail server didn't accept the username or password. Gmail, Yahoo and iCloud need an app password, not your normal one.";
  }
  if (err.code === "ETIMEDOUT" || err.code === "ECONNECTION" || err.code === "ESOCKET" || err.code === "ECONNREFUSED") {
    return "Couldn't connect to the mail server. Check the server, port and security setting.";
  }
  if (err.code === "EENVELOPE" || err.responseCode === 553 || err.responseCode === 550) {
    return "The mail server refused the From address. It has to be the account's address or an alias it's allowed to send as.";
  }
  const detail = (err.response ?? err.message ?? "").replace(/\s+/g, " ").slice(0, 200);
  return `The mail server refused the message${detail ? `: ${detail}` : "."}`;
}

async function transport(s: MailServer) {
  if (!MAIL_PORTS.includes(s.port)) throw new MailServerError(`Use a mail port (${MAIL_PORTS.join(", ")}).`);
  const address = await resolvePublic(s.host);
  return nodemailer.createTransport({
    host: address,
    port: s.port,
    secure: s.security === "ssl",
    requireTLS: s.security === "starttls",
    auth: { user: s.username, pass: s.password },
    // Pinned to the checked address; the certificate is still checked against the name
    tls: { servername: s.host.trim().toLowerCase(), minVersion: "TLSv1.2" },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
}

const fromHeader = (s: MailServer) => (s.fromName ? { name: s.fromName, address: s.fromEmail } : s.fromEmail);

/** Log in to the server without sending anything (when the settings are saved) */
export async function verifyMailServer(s: MailServer): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const t = await transport(s);
    await t.verify();
    t.close();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: explain(e) };
  }
}

/** Send one message through the team's server */
export async function sendViaMailServer(s: MailServer, msg: OutgoingMail): Promise<{ sent: true } | { sent: false; error: string }> {
  try {
    const t = await transport(s);
    await t.sendMail({ from: fromHeader(s), to: msg.to, subject: msg.subject, html: msg.html, text: msg.text });
    t.close();
    return { sent: true };
  } catch (e) {
    return { sent: false, error: explain(e) };
  }
}
