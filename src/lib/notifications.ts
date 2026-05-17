"use server";

import { prisma } from "@/lib/prisma";
import type { NotificationType } from "@/generated/prisma";

export async function createNotification({
  userId,
  type,
  title,
  body,
  linkUrl,
}: {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  linkUrl?: string;
}) {
  return prisma.notification.create({
    data: { userId, type, title, body, linkUrl },
  });
}

export async function notifyTeam({
  teamId,
  roles,
  type,
  title,
  body,
  linkUrl,
}: {
  teamId: string;
  roles?: string[];
  type: NotificationType;
  title: string;
  body?: string;
  linkUrl?: string;
}) {
  const users = await prisma.user.findMany({
    where: {
      teamId,
      status: "ACTIVE",
      ...(roles?.length
        ? { roles: { some: { role: { in: roles as any[] } } } }
        : {}),
    },
    select: { id: true },
  });

  if (users.length === 0) return;

  await prisma.notification.createMany({
    data: users.map((u) => ({ userId: u.id, type, title, body, linkUrl })),
  });
}
