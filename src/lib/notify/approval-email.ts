// "You're approved" email. Server-only. Sent when a member is approved (Team members) or a
// new team is approved by a super admin (its founder becomes Head Mentor). Best-effort: a
// failure is logged and never undoes the approval.

import { prisma } from "@/lib/prisma";
import { appUrl } from "@/lib/app-url";
import { ROLE_LABELS } from "@/lib/rbac";
import { sendEmail, escapeHtml } from "@/lib/email";

export async function sendApprovalEmail(userId: string, opts: { newTeam?: boolean } = {}): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where:  { id: userId },
      select: { name: true, email: true, roles: { select: { role: true } }, team: { select: { teamNumber: true, name: true } } },
    });
    if (!user?.team || user.email.endsWith(".invalid")) return;

    const url   = `${appUrl()}/login`;
    const team  = `Team ${user.team.teamNumber}`;
    const roles = user.roles.map((r) => ROLE_LABELS[r.role]).join(", ") || "Team Member";
    const first = user.name.split(" ")[0] || user.name;

    const intro = opts.newTeam
      ? `${team} (${user.team.name}) is approved on FRC Manager, and you're its Head Mentor. Sign in to set up your season and invite your team.`
      : `You've been approved to join ${team} (${user.team.name}) on FRC Manager as ${roles}.`;

    const res = await sendEmail({
      to:      user.email,
      subject: opts.newTeam ? `${team} is approved on FRC Manager` : `You're approved — welcome to ${team}`,
      text:    `Hi ${first},\n\n${intro}\n\nSign in: ${url}`,
      html: `<div style="font-family:system-ui,sans-serif;max-width:480px;line-height:1.5;color:#1f2430">
        <p>Hi ${escapeHtml(first)},</p>
        <p>${escapeHtml(intro)}</p>
        <p><a href="${url}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">Sign in to FRC Manager</a></p>
        <p style="font-size:13px;color:#555">If the button doesn't work, open: ${url}</p>
      </div>`,
    });
    if (!res.sent) console.warn(`[email] Approval email to user ${userId} not sent: ${res.error}`);
  } catch (e) {
    console.error("[email] Approval email failed:", e);
  }
}
