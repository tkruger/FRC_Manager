import { after, NextResponse } from "next/server";
import { safeEqual } from "@/lib/security/crypto";
import { syncLiveCompetitions } from "@/lib/frc/live-sync";
import { EVENT_KEY } from "@/lib/frc/links";

// FRC Nexus webhook (frc.nexus/api): sends an event's live status whenever queuing changes, with the
// token from NEXUS_WEBHOOK_TOKEN in the Nexus-Token header. It prompts an immediate check of that
// event, so "Now queuing" goes out right away.

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const token = process.env.NEXUS_WEBHOOK_TOKEN;
  if (!token) return NextResponse.json({ error: "Not set up" }, { status: 404 });
  if (!safeEqual(request.headers.get("nexus-token") ?? "", token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as { eventKey?: string } | null;
  const key = String(body?.eventKey ?? "").toLowerCase();
  if (EVENT_KEY.test(key)) after(() => syncLiveCompetitions({ eventKey: key }).catch((e) => console.error("[nexus-webhook]", e)));
  return NextResponse.json({ ok: true });
}
