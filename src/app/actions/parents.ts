"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { linkParentByNames, teamStudents } from "@/lib/parents";

type Result = { success: true; linked?: number } | { success: false; error: string };

/** A parent on the team (only they set their own students) */
async function requireParent() {
  const session = await auth();
  if (!session?.user?.id || !session.user.teamId) return null;
  if (!session.user.roles.includes("PARENT")) return null;
  return { id: session.user.id, teamId: session.user.teamId };
}

function refresh() {
  revalidatePath("/settings/profile");
  revalidatePath("/settings/members");
}

/** Link (or unlink) one of the team's students as this parent's */
export async function setMyStudentAction(studentId: string, linked: boolean): Promise<Result> {
  const me = await requireParent();
  if (!me) return { success: false, error: "Only parents can do this." };
  if (linked) {
    const students = await teamStudents(me.teamId);
    if (!students.some((s) => s.id === studentId)) return { success: false, error: "That student isn't on your team." };
    await prisma.parentLink.createMany({ data: [{ parentId: me.id, studentId }], skipDuplicates: true });
  } else {
    await prisma.parentLink.deleteMany({ where: { parentId: me.id, studentId } });
  }
  refresh();
  return { success: true };
}

/** Whose parent they are, in their own words; names matching students on the team get linked too */
export async function saveParentOfAction(text: string): Promise<Result> {
  const me = await requireParent();
  if (!me) return { success: false, error: "Only parents can do this." };
  const parsed = z.string().trim().max(300, "Keep it under 300 characters.").safeParse(text);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
  await prisma.user.update({ where: { id: me.id }, data: { parentOf: parsed.data || null } });
  const linked = await linkParentByNames(me.id, me.teamId, parsed.data);
  refresh();
  return { success: true, linked };
}
