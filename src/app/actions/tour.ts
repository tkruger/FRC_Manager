"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** The app tour was finished or skipped — don't offer it again (on any device) */
export async function markTourSeenAction(): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) return;
  await prisma.user.update({ where: { id: session.user.id }, data: { tourSeenAt: new Date() } });
}
