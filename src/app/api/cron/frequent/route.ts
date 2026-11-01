import { NextResponse } from "next/server";
import { safeEqual } from "@/lib/security/crypto";
import { syncLiveCompetitions } from "@/lib/frc/live-sync";
import { meetingStartTasks } from "@/lib/notify/meeting-start";

// Every 5 minutes (GitHub Actions schedule, `Authorization: Bearer $CRON_SECRET`): live competition
// updates, and each member's open tasks as a meeting starts. Quick when nothing is on. Safe to call
// more often — each notice is sent once.

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !safeEqual(request.headers.get("authorization") ?? "", `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const started = Date.now();
  const [competitions, meetingStarts] = await Promise.all([
    syncLiveCompetitions().catch((e) => { console.error("[cron/frequent] competitions", e); return null; }),
    meetingStartTasks().catch((e) => { console.error("[cron/frequent] meeting starts", e); return null; }),
  ]);
  return NextResponse.json({ competitions, meetingStarts, ms: Date.now() - started });
}
