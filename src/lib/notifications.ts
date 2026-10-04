// Server-only helpers. Deliberately NOT "use server": that would expose these as
// callable endpoints, letting any client send notifications to any user.
//
// Thin wrappers kept for existing callers — new code should use
// notifyUsers / notifyRoles from "@/lib/notify/deliver" with an explicit topic.

import type { NotificationType, Role } from "@/generated/prisma";
import { notifyUsers, notifyRoles } from "@/lib/notify/deliver";
import type { TopicId } from "@/lib/notify/topics";

export async function createNotification({
  userId, type, topic, title, body, linkUrl,
}: {
  userId: string;
  type: NotificationType;
  topic: TopicId;
  title: string;
  body?: string;
  linkUrl?: string;
}) {
  return notifyUsers([userId], { topic, type, title, body, url: linkUrl });
}

export async function notifyTeam({
  teamId, roles, type, topic, title, body, linkUrl, bypassQuietHours,
}: {
  teamId: string;
  roles?: Role[];
  type: NotificationType;
  topic: TopicId;
  title: string;
  body?: string;
  linkUrl?: string;
  bypassQuietHours?: boolean;
}) {
  return notifyRoles(teamId, roles?.length ? roles : "all", { topic, type, title, body, url: linkUrl, bypassQuietHours });
}
