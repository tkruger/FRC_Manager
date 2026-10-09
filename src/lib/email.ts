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
  if (!key) {
    console.warn("[email] RESEND_API_KEY isn't set in this deployment — nothing sent (redeploy after adding it)");
    return { sent: false, error: "Email isn't set up in this deployment (RESEND_API_KEY). If you just added it, redeploy." };
  }
  const from = process.env.EMAIL_FROM || "FRC Manager <onboarding@resend.dev>";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method:  "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body:    JSON.stringify({
        from,
        to:      [msg.to],
        subject: msg.subject,
        html:    msg.html,
        text:    msg.text,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { message?: string; name?: string };
      // Shows up in Vercel → Logs; the reason is also shown to whoever sent the invite
      console.error(`[email] Resend refused (${res.status} ${body.name ?? ""}) sending from "${from}" to ${msg.to}: ${body.message ?? "no message"}`);
      return { sent: false, error: body.message ?? `Resend error ${res.status}` };
    }
    return { sent: true };
  } catch (e) {
    console.error("[email] Couldn't reach Resend:", e);
    return { sent: false, error: e instanceof Error ? e.message : "Couldn't reach the email service." };
  }
}

/** Escape text for an HTML email */
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
