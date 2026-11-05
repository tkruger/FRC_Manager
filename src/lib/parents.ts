// Parents and their students. A parent says whose parent they are in their own words (at sign-up or in
// Profile); names that match a student on the team link the two accounts. They can also pick students
// in Profile.

import { prisma } from "@/lib/prisma";
import { isAdult } from "@/lib/volunteers";
import { nameKey, splitNames } from "@/lib/names";

/** The team's students (active, Team Member, no adult role), by name */
export async function teamStudents(teamId: string): Promise<{ id: string; name: string }[]> {
  const users = await prisma.user.findMany({
    where:   { teamId, status: "ACTIVE", deletedAt: null, roles: { some: { role: "TEAM_MEMBER" } } },
    orderBy: { name: "asc" },
    select:  { id: true, name: true, roles: { select: { role: true } } },
  });
  return users.filter((u) => !isAdult(u.roles.map((r) => r.role))).map(({ id, name }) => ({ id, name }));
}

/**
 * Link a parent to the students named in `text`: a full-name match, or a first name alone that's
 * unique among students sharing the parent's last name ("Alex" from Dana Starler → Alex Starler).
 * Returns how many new links were made.
 */
export async function linkParentByNames(parentId: string, teamId: string, text: string | null | undefined, onlyStudentId?: string): Promise<number> {
  const names = splitNames(text ?? "");
  if (names.length === 0) return 0;
  const [parent, students] = await Promise.all([
    prisma.user.findUnique({ where: { id: parentId }, select: { name: true, teamId: true } }),
    teamStudents(teamId),
  ]);
  if (!parent || parent.teamId !== teamId) return 0;
  const lastName = nameKey(parent.name).split(" ").slice(1).pop();

  const ids = new Set<string>();
  for (const n of names) {
    const key = nameKey(n);
    const full = students.filter((s) => nameKey(s.name) === key);
    if (full.length === 1) { ids.add(full[0].id); continue; }
    if (!key.includes(" ") && lastName) {
      const byFirst = students.filter((s) => { const p = nameKey(s.name).split(" "); return p[0] === key && p[p.length - 1] === lastName; });
      if (byFirst.length === 1) ids.add(byFirst[0].id);
    }
  }
  ids.delete(parentId);
  if (onlyStudentId) for (const id of ids) if (id !== onlyStudentId) ids.delete(id);
  if (ids.size === 0) return 0;
  const made = await prisma.parentLink.createMany({ data: [...ids].map((studentId) => ({ parentId, studentId })), skipDuplicates: true });
  return made.count;
}

/**
 * After someone joins the team: if they're a parent, link the students they named; otherwise link the
 * parents who named them (a parent who signed up first is linked when their student joins). Only links
 * involving the newcomer, so a link a parent removed doesn't come back.
 */
export async function linkNewMember(teamId: string, userId: string): Promise<void> {
  const me = await prisma.user.findUnique({ where: { id: userId }, select: { parentOf: true, roles: { select: { role: true } } } });
  if (!me) return;
  if (me.roles.some((r) => r.role === "PARENT")) { await linkParentByNames(userId, teamId, me.parentOf); return; }
  const parents = await prisma.user.findMany({
    where:  { teamId, status: "ACTIVE", deletedAt: null, parentOf: { not: null }, roles: { some: { role: "PARENT" } } },
    select: { id: true, parentOf: true },
  });
  for (const p of parents) await linkParentByNames(p.id, teamId, p.parentOf, userId);
}
