import { after, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { open } from "@/lib/security/secret-box";
import { syncLiveCompetitions } from "@/lib/frc/live-sync";
import { EVENT_KEY } from "@/lib/frc/links";

// A team's The Blue Alliance webhook (myTBA → Account → Webhooks), at the team's own address
// (/api/webhooks/tba/{hookId} — see Settings → Integrations → The Blue Alliance & Nexus). TBA signs
// each message with X-TBA-HMAC = HMAC-SHA256(the team's webhook secret, body). A message about an
// event prompts an immediate check of that team's competition there.
//
// The first message is a verification: its code shows on the team's settings page, to paste into myTBA.

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ hookId: string }> }) {
  const { hookId } = await params;
  const settings = await prisma.teamFrcSettings.findUnique({ where: { hookId }, select: { teamId: true, tbaWebhookSecretEnc: true } });
  const secret = settings?.tbaWebhookSecretEnc ? open(settings.tbaWebhookSecretEnc) : null;
  if (!settings || !secret) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.text();
  const given = request.headers.get("x-tba-hmac") ?? "";
  const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
  if (given.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected))) {
    return NextResponse.json({ error: "Bad signature" }, { status: 401 });
  }

  let msg: { message_type?: string; message_data?: Record<string, unknown> };
  try { msg = JSON.parse(body); } catch { return NextResponse.json({ error: "Bad body" }, { status: 400 }); }

  if (msg.message_type === "verification") {
    const code = String(msg.message_data?.verification_key ?? "").slice(0, 100);
    await prisma.teamFrcSettings.update({ where: { hookId }, data: { tbaVerificationCode: code || null, lastWebhookAt: new Date() } });
    return NextResponse.json({ ok: true });
  }
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
