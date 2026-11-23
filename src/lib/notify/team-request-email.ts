// The "are you the Head Mentor?" email for a team that's new to FRC Manager. Server-only.
// Sent to the person who registered the team when they sign up, with every super admin on CC
// (replies go to the super admins too), and again whenever a super admin presses Resend on
// Team approvals. Best-effort: a failure is logged and never stops the registration.

import { prisma } from "@/lib/prisma";
import { sendEmail, escapeHtml } from "@/lib/email";

const BODY = [
  "I saw a request for an account on frcmanager.com - To grant it I need a head mentor to be the first person that applies so I can approve that role first. Please let me know if either 1. you are the head mentor or 2. who I should be looking for from a name perspective?",
  "Ps. If you are looking for the game from Chief Delphi this is not it.",
  "Thank you!",
  "~\nFRC Manager Server Admin\nTeam 8738 SLICE",
];

export async function sendTeamRequestEmail(teamId: string): Promise<{ sent: boolean; error?: string; to?: string; cc?: number }> {
  try {
    const team = await prisma.team.findUnique({
      where:  { id: teamId },
      select: { teamNumber: true, status: true, users: { where: { status: "PENDING" }, orderBy: { createdAt: "asc" }, take: 1, select: { email: true } } },
    });
    if (!team) return { sent: false, error: "Team not found." };
    if (team.status !== "PENDING") return { sent: false, error: "This team has already been reviewed." };
    const founder = team.users[0];
    if (!founder || founder.email.endsWith(".invalid")) return { sent: false, error: "No one is waiting on this team to email." };

    const admins = await prisma.user.findMany({ where: { isSuperAdmin: true, status: "ACTIVE" }, select: { email: true } });
    const cc = [...new Set(admins.map((a) => a.email.toLowerCase()))]
      .filter((e) => !e.endsWith(".invalid") && e !== founder.email.toLowerCase());

    const res = await sendEmail({
      to:      founder.email,
      cc,
      subject: `FRC Manager request for team ${team.teamNumber}`,
      text:    BODY.join("\n\n"),
      html: `<div style="font-family:system-ui,sans-serif;max-width:560px;line-height:1.5;color:#1f2430">
        ${BODY.map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`).join("\n        ")}
      </div>`,
    });
    if (!res.sent) {
      console.warn(`[email] Head Mentor check for team ${team.teamNumber} not sent: ${res.error}`);
      return { sent: false, error: res.error };
    }
    await prisma.team.update({ where: { id: teamId }, data: { headMentorCheckSentAt: new Date(), headMentorCheckSentCount: { increment: 1 } } });
    return { sent: true, to: founder.email, cc: cc.length };
  } catch (e) {
    console.error("[email] Head Mentor check email failed:", e);
    return { sent: false, error: "The email couldn't be sent." };
  }
}
