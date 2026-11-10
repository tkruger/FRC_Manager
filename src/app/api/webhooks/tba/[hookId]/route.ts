import { after, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { open } from "@/lib/security/secret-box";
import { syncLiveCompetitions } from "@/lib/frc/live-sync";
import { EVENT_KEY } from "@/lib/frc/links";
import { rateLimit } from "@/lib/security/rate-limit";

// A team's The Blue Alliance webhook, at the team's own address (/api/webhooks/tba/{hookId} — see
// Settings → Integrations → The Blue Alliance & Nexus).
//
// Setting it up in myTBA: you add this URL, TBA makes a secret for it (pasted into the team's
// settings) and right away sends a verification code here, to type back into myTBA. That message
// usually arrives before the secret is saved (or while an old one still is), so verifications are
// always accepted — they only store a code to show the team's admins. Everything else must be signed:
// X-TBA-HMAC = HMAC-SHA256(secret, body). A message about an event prompts an immediate check of
// that team's competition there.

export const dynamic = "force-dynamic";

function signed(secret: string, body: string, given: string): boolean {
  const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
  return given.length === expected.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

export async function POST(request: Request, { params }: { params: Promise<{ hookId: string }> }) {
  const { hookId } = await params;
  const settings = await prisma.teamFrcSettings.findUnique({ where: { hookId }, select: { teamId: true, tbaWebhookSecretEnc: true } });
  if (!settings) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const secret = settings.tbaWebhookSecretEnc ? open(settings.tbaWebhookSecretEnc) : null;

  const body = await request.text();
  if (body.length > 200_000) return NextResponse.json({ error: "Too large" }, { status: 413 });
  const given = request.headers.get("x-tba-hmac") ?? "";

  let msg: { message_type?: string; message_data?: Record<string, unknown> };
  try { msg = JSON.parse(body); } catch { return NextResponse.json({ error: "Bad body" }, { status: 400 }); }

  if (msg.message_type === "verification") {
    // Unsigned, so kept to what setting up needs: a few a day, and only something shaped like a code
    if (!await rateLimit(`tba-verify:${hookId}`, 10, 24 * 60 * 60)) return NextResponse.json({ error: "Too many" }, { status: 429 });
    const code = String(msg.message_data?.verification_key ?? "");
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(code)) return NextResponse.json({ error: "Bad code" }, { status: 400 });
    await prisma.teamFrcSettings.update({ where: { hookId }, data: { tbaVerificationCode: code, lastWebhookAt: new Date() } });
    return NextResponse.json({ ok: true });
  }

  if (!secret) return NextResponse.json({ error: "Not set up" }, { status: 404 });
  if (!signed(secret, body, given)) return NextResponse.json({ error: "Bad signature" }, { status: 401 });
  await prisma.teamFrcSettings.update({ where: { hookId }, data: { lastWebhookAt: new Date() } });

  // Most messages carry event_key; match messages carry it inside the match
  const d = msg.message_data ?? {};
  const match = d.match as { event_key?: string } | undefined;
  const key = String(d.event_key ?? match?.event_key ?? "").toLowerCase();
  if (EVENT_KEY.test(key)) {
    after(() => syncLiveCompetitions({ eventKey: key, teamId: settings.teamId }).catch((e) => console.error("[tba-webhook]", e)));
  }
  return NextResponse.json({ ok: true });
}
