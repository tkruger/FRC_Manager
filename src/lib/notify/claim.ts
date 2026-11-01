// One-time notices: claim a key before sending, so overlapping runs (the 5-minute job, webhooks)
// never send the same thing twice. Server-only.

import { prisma } from "@/lib/prisma";

/** True for the first caller only (insert-if-absent into ReminderLog) */
export async function claimOnce(key: string): Promise<boolean> {
  const { count } = await prisma.reminderLog.createMany({ data: [{ key, lastSentAt: new Date() }], skipDuplicates: true });
  return count === 1;
}
