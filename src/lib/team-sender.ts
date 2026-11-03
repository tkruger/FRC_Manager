// Sending through a team's own email, whichever way it's connected: a mail server (SMTP) or Gmail
// (connected with Google, the Gmail API). Server-only.

import { open } from "@/lib/security/secret-box";
import { sendViaMailServer, type OutgoingMail } from "@/lib/team-mail";
import { sendViaGmailApi } from "@/lib/gmail-api";
import type { MailSecurity } from "@/lib/email-providers";

export interface TeamMailRow {
  method: string;
  host: string | null; port: number | null; security: string | null; username: string | null; passwordEnc: string | null;
  refreshTokenEnc: string | null;
  fromName: string | null; fromEmail: string;
}

export async function sendThroughTeam(s: TeamMailRow, msg: OutgoingMail): Promise<{ sent: true } | { sent: false; error: string }> {
  if (s.method === "gmail_api") {
    const refreshToken = s.refreshTokenEnc ? open(s.refreshTokenEnc) : null;
    if (!refreshToken) return { sent: false, error: "The saved Google connection can't be read anymore — connect Gmail again." };
    return sendViaGmailApi({ refreshToken, fromName: s.fromName, fromEmail: s.fromEmail }, msg);
  }
  const password = s.passwordEnc ? open(s.passwordEnc) : null;
  if (!password || !s.host || !s.port || !s.username) return { sent: false, error: "The saved password can't be read anymore — enter it again." };
  return sendViaMailServer({
    host: s.host, port: s.port, security: (s.security ?? "ssl") as MailSecurity, username: s.username, password,
    fromName: s.fromName, fromEmail: s.fromEmail,
  }, msg);
}
