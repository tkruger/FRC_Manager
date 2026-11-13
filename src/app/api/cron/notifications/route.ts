import { NextResponse } from "next/server";
import { runReminders } from "@/lib/notify/scheduler";
import { safeEqual } from "@/lib/security/crypto";
import { pruneRateLimits } from "@/lib/security/rate-limit";
import { pruneAuthTokens } from "@/lib/security/auth-tokens";
import { syncAllActiveSeasons } from "@/lib/season-active";
import { prisma } from "@/lib/prisma";
import { pruneChangeLog } from "@/lib/audit/changes";
import { postVolunteerDigests } from "@/lib/notify/discord-volunteers";
import { sweepUnusedToolPhotos } from "@/lib/blob-cleanup";
import { sweepUnusedStoredPhotos } from "@/lib/photos";
import { checkPackages } from "@/lib/orders/packages";

const DAY = 86_400_000;

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
  // Parent Discord servers: the morning list of meetings that need adults
  const volunteerPosts = await postVolunteerDigests().catch((e) => { console.error("[cron] volunteer digests", e); return 0; });
  // Packages on their way (Track123): delivered ones tell everyone on their orders
  const packages = await checkPackages().catch((e) => { console.error("[cron] packages", e); return null; });
  // Housekeeping: expired rate-limit counters and one-time email links, and change history over a year old
  const [rateLimitsCleared, tokensCleared] = await Promise.all([pruneRateLimits(), pruneAuthTokens()]).catch(() => [0, 0]);
  const changesCleared = await pruneChangeLog(prisma).catch(() => 0);
  // Receipts uploaded for an expense that was never submitted
  const receiptsCleared = await prisma.expenseReceipt.deleteMany({ where: { claimId: null, createdAt: { lt: new Date(Date.now() - 86_400_000) } } })
    .then((r) => r.count).catch(() => 0);
  // Old rows nobody needs: read notifications after 90 days (any after 180), reminder bookkeeping
  // and Discord command logs after 180 / 90 days
  const ago = (days: number) => new Date(Date.now() - days * DAY);
  const [notificationsCleared, remindersCleared, discordLogsCleared] = await Promise.all([
    prisma.notification.deleteMany({ where: { OR: [{ read: true, createdAt: { lt: ago(90) } }, { createdAt: { lt: ago(180) } }] } }).then((r) => r.count),
    prisma.reminderLog.deleteMany({ where: { lastSentAt: { lt: ago(180) } } }).then((r) => r.count),
    prisma.discordInteractionLog.deleteMany({ where: { createdAt: { lt: ago(90) } } }).then((r) => r.count),
  ]).catch(() => [0, 0, 0]);
  // Once a day (the 8:05 UTC run — the early hours in the US): tool photos that nothing uses any more
  const photosCleared = new Date().getUTCHours() === 8
    ? (await sweepUnusedToolPhotos().catch((e) => { console.error("[cron] photo sweep", e); return 0; }))
      + (await sweepUnusedStoredPhotos().catch((e) => { console.error("[cron] stored photo sweep", e); return 0; }))
    : 0;
  return NextResponse.json({
    ...result, seasonsSwitched, packages, rateLimitsCleared, tokensCleared, changesCleared, receiptsCleared, volunteerPosts,
    notificationsCleared, remindersCleared, discordLogsCleared, photosCleared, ms: Date.now() - started,
  });
}
