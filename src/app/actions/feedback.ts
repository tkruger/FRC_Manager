"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendEmail, escapeHtml } from "@/lib/email";
import { notifyUsers } from "@/lib/notify/deliver";
import { rateLimit } from "@/lib/security/rate-limit";
import { ROLE_LABELS } from "@/lib/rbac";
import { APP_VERSION } from "@/lib/version";
import { appUrl } from "@/lib/app-url";
import type { Role } from "@/generated/prisma";
import { plainObject } from "@/lib/action-args";

const KINDS = { idea: "💡 Idea", bug: "🐞 Problem", other: "💬 Feedback" } as const;

/**
 * Feedback from anyone signed in, emailed to the app's super admins (reply goes to the sender)
 * and shown in their notifications — with who sent it, their team, and where they were in the app.
 */
export async function sendFeedbackAction(input: {
  message: string; kind: string; page: string; userAgent?: string; viewport?: string;
}): Promise<{ success: true } | { success: false; error: string }> {
  plainObject(input);
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Sign in to send feedback." };
  const message = String(input.message ?? "").trim().slice(0, 4000);
  if (message.length < 3) return { success: false, error: "Tell us a little more." };
  const kind = (input.kind in KINDS ? input.kind : "other") as keyof typeof KINDS;
  const page = String(input.page ?? "").slice(0, 500);
  // Ten an hour per person is plenty
  if (!(await rateLimit(`feedback:${session.user.id}`, 10, 3600))) return { success: false, error: "That's a lot of feedback — try again in a little while." };

  const [me, admins] = await Promise.all([
    prisma.user.findUnique({
      where:  { id: session.user.id },
      select: { name: true, email: true, roles: { select: { role: true } }, team: { select: { name: true, teamNumber: true } } },
    }),
    prisma.user.findMany({ where: { isSuperAdmin: true, status: "ACTIVE", deletedAt: null }, select: { id: true, email: true } }),
  ]);
  if (!me) return { success: false, error: "Sign in to send feedback." };
  if (admins.length === 0) return { success: false, error: "There's nobody to send feedback to yet." };

  const team = me.team ? `Team ${me.team.teamNumber} — ${me.team.name}` : "No team";
  const roles = me.roles.map((r) => ROLE_LABELS[r.role as Role]).join(", ") || "—";
  const pageUrl = `${appUrl()}${page.startsWith("/") ? page : `/${page}`}`;
  const realEmail = !me.email.endsWith(".invalid");
  const facts: [string, string][] = [
    ["From", `${me.name}${realEmail ? ` <${me.email}>` : ""}`],
    ["Team", team],
    ["Roles", roles],
    ["Page", pageUrl],
    ["App version", APP_VERSION],
    ...(input.viewport ? [["Screen", String(input.viewport).slice(0, 40)] as [string, string]] : []),
    ...(input.userAgent ? [["Browser", String(input.userAgent).slice(0, 300)] as [string, string]] : []),
  ];
  const subject = `${KINDS[kind]} from ${me.name} (${me.team ? `Team ${me.team.teamNumber}` : "no team"})`;

  await Promise.allSettled(admins.filter((a) => !a.email.endsWith(".invalid")).map((a) => sendEmail({
    to: a.email,
    subject: `FRC Manager feedback: ${subject.replace(/^[^\p{L}]+/u, "")}`,
    replyTo: realEmail ? me.email : undefined,
    text: `${message}\n\n${facts.map(([k, v]) => `${k}: ${v}`).join("\n")}\n`,
    html: `<div style="font-family:system-ui,sans-serif;max-width:560px;line-height:1.5;color:#1f2430">
      <p style="font-size:17px;font-weight:600;margin:0 0 8px">${escapeHtml(subject)}</p>
      <blockquote style="margin:0 0 16px;padding:8px 12px;border-left:3px solid #2563eb;background:#f5f7fb;white-space:pre-wrap">${escapeHtml(message)}</blockquote>
      <table style="font-size:13px;border-collapse:collapse">${facts.map(([k, v]) =>
        `<tr><td style="padding:2px 12px 2px 0;color:#666;vertical-align:top">${escapeHtml(k)}</td><td style="padding:2px 0">${k === "Page" ? `<a href="${escapeHtml(v)}">${escapeHtml(v)}</a>` : escapeHtml(v)}</td></tr>`).join("")}</table>
      ${realEmail ? `<p style="font-size:12px;color:#666">Reply to this email to answer ${escapeHtml(me.name)}.</p>` : ""}
    </div>`,
  })));

  await notifyUsers(admins.map((a) => a.id), {
    topic: "admin.feedback",
    type:  "FEEDBACK",
    title: subject,
    body:  `${message.slice(0, 280)}${message.length > 280 ? "…" : ""} — on ${page || "/"}`,
  }).catch((e) => console.error("[feedback] notify", e));

  return { success: true };
}
