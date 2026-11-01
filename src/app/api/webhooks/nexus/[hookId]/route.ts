import { after, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { safeEqual } from "@/lib/security/crypto";
import { open } from "@/lib/security/secret-box";
import { syncLiveCompetitions } from "@/lib/frc/live-sync";
import { EVENT_KEY } from "@/lib/frc/links";

// A team's FRC Nexus webhook (frc.nexus/api), at the team's own address (/api/webhooks/nexus/{hookId}).
// Nexus sends an event's live status whenever queuing changes, with the team's token in the
// Nexus-Token header. It prompts an immediate check, so "Now queuing" goes out right away.

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ hookId: string }> }) {
  const { hookId } = await params;
  const settings = await prisma.teamFrcSettings.findUnique({ where: { hookId }, select: { teamId: true, nexusWebhookTokenEnc: true } });
  const token = settings?.nexusWebhookTokenEnc ? open(settings.nexusWebhookTokenEnc) : null;
  if (!settings || !token) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!safeEqual(request.headers.get("nexus-token") ?? "", token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await prisma.teamFrcSettings.update({ where: { hookId }, data: { lastWebhookAt: new Date() } });
  const body = (await request.json().catch(() => null)) as { eventKey?: string } | null;
  const key = String(body?.eventKey ?? "").toLowerCase();
  if (EVENT_KEY.test(key)) {
    after(() => syncLiveCompetitions({ eventKey: key, teamId: settings.teamId }).catch((e) => console.error("[nexus-webhook]", e)));
  }
  return NextResponse.json({ ok: true });
}
