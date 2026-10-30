// Blocks every database write by a view-only account (see read-only.ts), whatever path it
// comes through — server actions, API routes, Discord commands. Server-only.

import type { PrismaClient } from "@/generated/prisma";
import { ActionError } from "@/lib/action-error";
import { requestUser } from "@/lib/request-user";
import { isViewOnly, VIEW_ONLY_MESSAGE } from "./read-only";

const WRITES = new Set([
  "create", "createMany", "createManyAndReturn", "update", "updateMany", "updateManyAndReturn",
  "upsert", "delete", "deleteMany",
]);

/** What view-only accounts may still change: their own account and settings, and volunteering */
const ALLOWED = new Set([
  "User", "UserRole", "Account", "Session", "AuthToken", "RateLimit", "VerificationToken", "Invite",
  "Notification", "NotificationPreference", "PushSubscription", "ReminderLog",
  "DiscordLink", "DiscordLinkToken", "DiscordInteractionLog",
  "ChangeLog", "ActivityLog",
  "MeetingVolunteer", "MeetingVolunteerNote", "VolunteerSettings",
]);

export function withViewOnlyGuard<C extends PrismaClient>(client: C, base: PrismaClient): C {
  return client.$extends({
    name: "viewOnlyGuard",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (WRITES.has(operation) && !ALLOWED.has(model)) {
            const user = await requestUser(base);
            if (user && isViewOnly(user.roles)) throw new ActionError(VIEW_ONLY_MESSAGE);
          }
          return query(args);
        },
      },
    },
  }) as unknown as C;
}
