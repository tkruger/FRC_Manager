import { NextResponse } from "next/server";
import { runReminders } from "@/lib/notify/scheduler";

// Hourly reminder job. Called by Vercel Cron or the GitHub Actions schedule with
// `Authorization: Bearer $CRON_SECRET`. Safe to call more often — reminders are deduplicated.

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const started = Date.now();
  const result = await runReminders();
  return NextResponse.json({ ...result, ms: Date.now() - started });
}
