// View-only accounts. Safe to import on server and client.
//
// Someone whose only roles are Parent and/or Volunteer coordinator sees what a Team Member
// sees but can't change anything — apart from their own account, notification settings and
// volunteering. Enforced for every write by the Prisma client (src/lib/access/guard.ts);
// pages also hide the buttons (isViewOnly) so people don't run into the error.

export const VIEW_ONLY_ROLES = ["PARENT", "VOLUNTEER_COORDINATOR"] as const;

export function isViewOnly(roles: readonly string[] | null | undefined): boolean {
  return !!roles && roles.length > 0 && roles.every((r) => (VIEW_ONLY_ROLES as readonly string[]).includes(r));
}

export const VIEW_ONLY_MESSAGE = "Your account is view-only, so it can't make changes here.";
