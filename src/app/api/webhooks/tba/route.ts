import { after, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { syncLiveCompetitions } from "@/lib/frc/live-sync";
import { EVENT_KEY } from "@/lib/frc/links";

// The Blue Alliance webhook (myTBA → Account → Webhooks). TBA signs each message with
// X-TBA-HMAC = HMAC-SHA256(TBA_WEBHOOK_SECRET, body). Any message about an event we're at
// prompts an immediate check of that event, so updates arrive in seconds instead of minutes.
//
// The first message is a verification: its key shows on Settings → Integrations, to paste into TBA.

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = process.env.TBA_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Not set up" }, { status: 404 });

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
    console.log(`[tba-webhook] verification key: ${code}`);
    // Kept so Settings → Integrations can show it
    if (code) await prisma.reminderLog.upsert({ where: { key: `tba-webhook-verify:${code}` }, create: { key: `tba-webhook-verify:${code}`, lastSentAt: new Date() }, update: { lastSentAt: new Date() } });
    return NextResponse.json({ ok: true });
  }

  // Most messages carry event_key; match messages carry it inside the match
  const d = msg.message_data ?? {};
  const match = d.match as { event_key?: string } | undefined;
  const key = String(d.event_key ?? match?.event_key ?? "").toLowerCase();
  if (EVENT_KEY.test(key)) after(() => syncLiveCompetitions({ eventKey: key }).catch((e) => console.error("[tba-webhook]", e)));
  return NextResponse.json({ ok: true });
}
