import { NextResponse } from "next/server";
import { runReminders } from "@/lib/notify/scheduler";
import { safeEqual } from "@/lib/security/crypto";
import { pruneRateLimits } from "@/lib/security/rate-limit";
import { pruneAuthTokens } from "@/lib/security/auth-tokens";
import { syncAllActiveSeasons } from "@/lib/season-active";
import { prisma } from "@/lib/prisma";
import { pruneChangeLog } from "@/lib/audit/changes";

// Hourly reminder job. Called by Vercel Cron or the GitHub Actions schedule with
// `Authorization: Bearer $CRON_SECRET`. Safe to call more often — reminders are deduplicated.

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !safeEqual(request.headers.get("authorization") ?? "", `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const started = Date.now();
  // The season today falls in becomes active on its own (a future season on its start date)
  const seasonsSwitched = await syncAllActiveSeasons().catch(() => 0);
  const result = await runReminders();
  // Housekeeping: expired rate-limit counters and one-time email links, and change history over a year old
  const [rateLimitsCleared, tokensCleared] = await Promise.all([pruneRateLimits(), pruneAuthTokens()]).catch(() => [0, 0]);
  const changesCleared = await pruneChangeLog(prisma).catch(() => 0);
  return NextResponse.json({ ...result, seasonsSwitched, rateLimitsCleared, tokensCleared, changesCleared, ms: Date.now() - started });
}
