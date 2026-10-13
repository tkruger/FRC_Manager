"use server";

// Tool locations: shelves, cabinets, totes and competition cases, each with a barcode
// (LOC-0001, …). Anyone can move a tool to a location by scanning; adding, renaming and
// deleting locations is for the people who edit tools.

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { canEditLocations, locationCode } from "@/lib/packing";

type Result = { success: true; message?: string } | { success: false; error: string };

function refresh() {
  revalidatePath("/tools", "layout");
}

async function requireEditor() {
  const session = await auth();
  if (!session?.user?.teamId) return null;
  return canEditLocations(session.user.roles) ? { teamId: session.user.teamId } : null;
}

async function nameTaken(teamId: string, name: string, exceptId?: string) {
  return !!await prisma.toolLocation.findFirst({
    where:  { teamId, name: { equals: name, mode: "insensitive" }, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { id: true },
  });
}

export async function createLocationAction(rawName: string): Promise<Result> {
  const me = await requireEditor();
  if (!me) return { success: false, error: "You don't have permission to add locations." };
  const name = rawName.trim().slice(0, 80);
  if (!name) return { success: false, error: "Give the location a name." };
  if (await nameTaken(me.teamId, name)) return { success: false, error: `There's already a location called "${name}".` };

  // Next free code (skips any already in use)
  let code = "";
  for (;;) {
    const { nextLocationNumber } = await prisma.team.update({
      where:  { id: me.teamId },
      data:   { nextLocationNumber: { increment: 1 } },
      select: { nextLocationNumber: true },
    });
    code = locationCode(nextLocationNumber - 1);
    if (!await prisma.toolLocation.findFirst({ where: { teamId: me.teamId, code }, select: { id: true } })) break;
  }

  await prisma.toolLocation.create({ data: { teamId: me.teamId, name, code } });
  refresh();
  return { success: true, message: `Added ${name} (${code}).` };
}

/** Rename a location; tools there move with it */
export async function renameLocationAction(id: string, rawName: string): Promise<Result> {
  const me = await requireEditor();
  if (!me) return { success: false, error: "You don't have permission to rename locations." };
  const name = rawName.trim().slice(0, 80);
  if (!name) return { success: false, error: "Give the location a name." };

  const loc = await prisma.toolLocation.findFirst({ where: { id, teamId: me.teamId } });
  if (!loc) return { success: false, error: "Location not found." };
  if (loc.name === name) return { success: true };
  if (await nameTaken(me.teamId, name, id)) return { success: false, error: `There's already a location called "${name}".` };

  await prisma.$transaction([
    prisma.toolLocation.update({ where: { id }, data: { name } }),
    prisma.tool.updateMany({ where: { teamId: me.teamId, homeLocation: loc.name }, data: { homeLocation: name } }),
  ]);
  refresh();
  return { success: true, message: `Renamed to ${name}.` };
}

/** Delete a location. Tools there keep the name as plain text; packing records lose the link. */
export async function deleteLocationAction(id: string): Promise<Result> {
  const me = await requireEditor();
  if (!me) return { success: false, error: "You don't have permission to delete locations." };
  const loc = await prisma.toolLocation.findFirst({ where: { id, teamId: me.teamId } });
  if (!loc) return { success: false, error: "Location not found." };
  await prisma.toolLocation.delete({ where: { id } });
  refresh();
  return { success: true, message: `Deleted ${loc.name}.` };
}

/** Put a tool away at a location (sets its home location). Anyone on the team can. */
export async function moveToolToLocationAction(toolId: string, locationId: string): Promise<Result> {
  const session = await auth();
  if (!session?.user?.teamId) return { success: false, error: "Not signed in." };
  const teamId = session.user.teamId;

  const [tool, loc] = await Promise.all([
    prisma.tool.findFirst({ where: { id: toolId, teamId, retired: false }, select: { id: true, name: true, assetTag: true } }),
    prisma.toolLocation.findFirst({ where: { id: locationId, teamId }, select: { name: true } }),
  ]);
  if (!tool) return { success: false, error: "Tool not found." };
  if (!loc) return { success: false, error: "Location not found." };

  await prisma.tool.update({ where: { id: tool.id }, data: { homeLocation: loc.name } });
  refresh();
  return { success: true, message: `${tool.name}${tool.assetTag ? ` ${tool.assetTag}` : ""} → ${loc.name}` };
}
