// Blocks every database write by a view-only account (see read-only.ts), or by one that hasn't
// been approved yet, whatever path it comes through — server actions, API routes, Discord
// commands. Server-only.
//
// It checks the model being written, not nested writes inside it: a write through an allowed
// model (User, for one) can reach others. Actions still check roles themselves.

import type { PrismaClient } from "@/generated/prisma";
import { ActionError } from "@/lib/action-error";
import { requestUser } from "@/lib/request-user";
import { isViewOnly, VIEW_ONLY_MESSAGE } from "./read-only";

const NOT_APPROVED_MESSAGE = "Your account hasn't been approved yet, so it can't make changes.";

const WRITES = new Set([
  "create", "createMany", "createManyAndReturn", "update", "updateMany", "updateManyAndReturn",
  "upsert", "delete", "deleteMany",
]);

/** What view-only accounts may still change: their own account and settings, volunteering,
 *  submitting expenses, and helping out — packing for competitions */
const ALLOWED = new Set([
  "User", "UserRole", "Account", "Session", "AuthToken", "RateLimit", "VerificationToken", "Invite",
  "Notification", "NotificationPreference", "PushSubscription", "ReminderLog",
  "DiscordLink", "DiscordLinkToken", "DiscordInteractionLog",
  "ChangeLog", "ActivityLog",
  "MeetingVolunteer", "MeetingVolunteerNote", "VolunteerSettings",
  "PackEntry",
  // Parents often buy things for the team: they can submit expenses (with receipts)
  "ExpenseClaim", "ExpenseReceipt",
]);

/** What an account that isn't approved yet may change: the above, plus what asking to join
 *  writes — a new team (with its starting sub-categories) and parent links */
const ALLOWED_BEFORE_APPROVAL = new Set([...ALLOWED, "Team", "InventorySubcategory", "ParentLink"]);

/** Single fields they may change on otherwise read-only models: scanning a tool into a location */
const ALLOWED_FIELDS: Record<string, string[]> = {
  Tool: ["homeLocation"],
};

function onlyAllowedFields(model: string, operation: string, args: unknown): boolean {
  const fields = ALLOWED_FIELDS[model];
  if (!fields || (operation !== "update" && operation !== "updateMany")) return false;
  const data = (args as { data?: Record<string, unknown> })?.data;
  return !!data && Object.keys(data).length > 0 && Object.keys(data).every((k) => fields.includes(k));
}

export function withViewOnlyGuard<C extends PrismaClient>(client: C, base: PrismaClient): C {
  return client.$extends({
    name: "viewOnlyGuard",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (WRITES.has(operation) && !ALLOWED.has(model) && !onlyAllowedFields(model, operation, args)) {
            const user = await requestUser(base);
            if (user && !user.member && !ALLOWED_BEFORE_APPROVAL.has(model)) throw new ActionError(NOT_APPROVED_MESSAGE);
            if (user && isViewOnly(user.roles)) throw new ActionError(VIEW_ONLY_MESSAGE);
          }
          return query(args);
        },
      },
    },
  }) as unknown as C;
}
