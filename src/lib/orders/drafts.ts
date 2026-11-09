// Who can do what with an order draft. Server-only.
//
// Drafts are shared with the team: everyone can see them (read-only). The person who started one
// and the people they invited (collaborators) can edit it, add items to it and submit it. Only the
// person who started it can invite, remove collaborators or delete it; a collaborator can leave.

import type { Prisma } from "@/generated/prisma";

/** Drafts this person may edit: their own, and the ones they were invited to */
export const editableDrafts = (userId: string): Prisma.OrderDraftWhereInput => ({
  OR: [{ userId }, { collaborators: { some: { userId } } }],
});

/** Can this person edit the draft? (pass its maker and collaborator ids) */
export function canEditDraft(draft: { userId: string; collaborators: { userId: string }[] }, userId: string): boolean {
  return draft.userId === userId || draft.collaborators.some((c) => c.userId === userId);
}
