import { NextResponse } from "next/server";
import { safeEqual } from "@/lib/security/crypto";
import { syncLiveCompetitions } from "@/lib/frc/live-sync";

// Live competition updates, every 5 minutes (GitHub Actions schedule, `Authorization: Bearer $CRON_SECRET`).
// Quick when no competition is on. Safe to call more often — each notice is sent once.

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !safeEqual(request.headers.get("authorization") ?? "", `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const started = Date.now();
  const result = await syncLiveCompetitions();
  return NextResponse.json({ ...result, ms: Date.now() - started });
}
