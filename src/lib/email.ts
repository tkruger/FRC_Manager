// Sending email (Resend — https://resend.com). Server-only.
//
//   RESEND_API_KEY  the API key; without it nothing is sent (callers fall back to showing links)
//   EMAIL_FROM      the sender, e.g. "FRC Manager <invites@frcmanager.com>" — the domain must be
//                   verified in Resend. Until then Resend's test sender only reaches your own address.

export function emailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

export async function sendEmail(msg: { to: string; subject: string; html: string; text: string }): Promise<{ sent: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { sent: false, error: "Email isn't set up (RESEND_API_KEY)." };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method:  "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body:    JSON.stringify({
        from:    process.env.EMAIL_FROM || "FRC Manager <onboarding@resend.dev>",
        to:      [msg.to],
        subject: msg.subject,
        html:    msg.html,
        text:    msg.text,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { message?: string };
      return { sent: false, error: body.message ?? `Resend error ${res.status}` };
    }
    return { sent: true };
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : "Couldn't reach the email service." };
  }
}

/** Escape text for an HTML email */
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
