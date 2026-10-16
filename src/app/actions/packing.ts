"use server";

// Competition packing. Team Leadership / Mentors / Head Mentors keep a master pack list
// and start packing for an event; then anyone on the team helps by scanning tools (and
// the location each one goes into) or ticking off other items. A checklist only: packing
// never changes a tool's status.

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { canManagePacking } from "@/lib/packing";
import { resolveScanCode } from "@/lib/scan-code";

type Result = { success: true; message?: string } | { success: false; error: string };

function refresh(sessionId?: string) {
  revalidatePath("/tools", "layout");
  if (sessionId) revalidatePath(`/tools/pack/${sessionId}`);
}

async function member() {
  const session = await auth();
  if (!session?.user?.teamId) return null;
  return { userId: session.user.id, teamId: session.user.teamId, manager: canManagePacking(session.user.roles) };
}

async function manager() {
  const me = await member();
  return me?.manager ? me : null;
}

// ── Master list ──────────────────────────────────────────────────────────────

export interface PackItemInput {
  /** A tool group (tool name), or… */
  toolName?: string | null;
  /** …anything else, ticked by hand */
  label?:    string | null;
  quantity:  number;
  notes?:    string | null;
}

function cleanItem(input: PackItemInput) {
  const toolName = input.toolName?.trim().slice(0, 120) || null;
  const label    = toolName ? null : input.label?.trim().slice(0, 120) || null;
  const quantity = Math.max(1, Math.min(99, Math.round(Number(input.quantity) || 1)));
  const notes    = input.notes?.trim().slice(0, 300) || null;
  return { toolName, label, quantity, notes };
}

export async function addPackItemAction(input: PackItemInput): Promise<Result> {
  const me = await manager();
  if (!me) return { success: false, error: "Only Team Leadership and Head Mentors can change the pack list." };
  const data = cleanItem(input);
  if (!data.toolName && !data.label) return { success: false, error: "Pick a tool group or name the item." };

  const last = await prisma.packListItem.aggregate({ where: { teamId: me.teamId }, _max: { sortOrder: true } });
  await prisma.packListItem.create({ data: { ...data, teamId: me.teamId, sortOrder: (last._max.sortOrder ?? 0) + 1 } });
  refresh();
  return { success: true };
}

export async function updatePackItemAction(id: string, input: PackItemInput): Promise<Result> {
  const me = await manager();
  if (!me) return { success: false, error: "Only Team Leadership and Head Mentors can change the pack list." };
  const data = cleanItem(input);
  if (!data.toolName && !data.label) return { success: false, error: "Pick a tool group or name the item." };
  const { count } = await prisma.packListItem.updateMany({ where: { id, teamId: me.teamId }, data });
  if (!count) return { success: false, error: "Item not found." };
  refresh();
  return { success: true };
}

export async function deletePackItemAction(id: string): Promise<Result> {
  const me = await manager();
  if (!me) return { success: false, error: "Only Team Leadership and Head Mentors can change the pack list." };
  await prisma.packListItem.deleteMany({ where: { id, teamId: me.teamId } });
  refresh();
  return { success: true };
}

/** Move an item up or down the list */
export async function movePackItemAction(id: string, direction: "up" | "down"): Promise<Result> {
  const me = await manager();
  if (!me) return { success: false, error: "Only Team Leadership and Head Mentors can change the pack list." };
  const items = await prisma.packListItem.findMany({
    where: { teamId: me.teamId }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true },
  });
  const i = items.findIndex((x) => x.id === id);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= items.length) return { success: true };
  [items[i], items[j]] = [items[j], items[i]];
  await prisma.$transaction(items.map((x, n) => prisma.packListItem.update({ where: { id: x.id }, data: { sortOrder: n + 1 } })));
  refresh();
  return { success: true };
}

// ── Packing sessions ─────────────────────────────────────────────────────────

export async function startPackingAction(competitionId: string): Promise<{ success: true; sessionId: string } | { success: false; error: string }> {
  const me = await manager();
  if (!me) return { success: false, error: "Only Team Leadership and Head Mentors can start packing." };

  const comp = await prisma.competitionEvent.findFirst({
    where:  { id: competitionId, season: { teamId: me.teamId } },
    select: { id: true, packSessions: { where: { finishedAt: null }, select: { id: true } } },
  });
  if (!comp) return { success: false, error: "Competition not found." };
  if (comp.packSessions[0]) return { success: true, sessionId: comp.packSessions[0].id }; // already packing

  const session = await prisma.packSession.create({
    data:   { teamId: me.teamId, competitionId: comp.id, startedById: me.userId },
    select: { id: true },
  });
  refresh();
  return { success: true, sessionId: session.id };
}

export async function finishPackingAction(sessionId: string, finished: boolean): Promise<Result> {
  const me = await manager();
  if (!me) return { success: false, error: "Only Team Leadership and Head Mentors can finish packing." };
  const { count } = await prisma.packSession.updateMany({
    where: { id: sessionId, teamId: me.teamId },
    data:  { finishedAt: finished ? new Date() : null },
  });
  if (!count) return { success: false, error: "Packing not found." };
  refresh(sessionId);
  return { success: true, message: finished ? "Packing finished." : "Packing reopened." };
}

export async function deletePackSessionAction(sessionId: string): Promise<Result> {
  const me = await manager();
  if (!me) return { success: false, error: "Only Team Leadership and Head Mentors can delete packing." };
  await prisma.packSession.deleteMany({ where: { id: sessionId, teamId: me.teamId } });
  refresh();
  return { success: true };
}

/** A session anyone on the team can still pack into */
async function openSession(sessionId: string, teamId: string) {
  return prisma.packSession.findFirst({ where: { id: sessionId, teamId, finishedAt: null }, select: { id: true } });
}

async function locationFor(locationId: string | null | undefined, teamId: string) {
  if (!locationId) return null;
  return prisma.toolLocation.findFirst({ where: { id: locationId, teamId }, select: { id: true, name: true } });
}

export type PackScanResult =
  | { success: false; error: string }
  | { success: true; kind: "location"; location: { id: string; name: string; code: string } }
  | {
      success: true; kind: "tool";
      entryId: string;
      tool: { name: string; assetTag: string | null };
      /** Where it went (null: not said yet) */
      location: { id: string; name: string } | null;
      /** It was already packed — the scan only moved it (or did nothing) */
      already: boolean;
    };

/**
 * A scan while packing. A location barcode just answers "this is Tote 2" (the page then packs
 * into it); a tool barcode packs that tool into `locationId` (or moves it there if it was
 * already packed).
 */
export async function packScanAction(sessionId: string, code: string, locationId: string | null): Promise<PackScanResult> {
  const me = await member();
  if (!me) return { success: false, error: "Not signed in." };
  if (!await openSession(sessionId, me.teamId)) return { success: false, error: "This packing list is finished." };

  const found = await resolveScanCode(me.teamId, code);
  if (found.kind === "location") return { success: true, kind: "location", location: found.location };
  if (found.kind === "unknown") return { success: false, error: `No tool or location found with code "${code}".` };

  return packTool(sessionId, me, found.tool.id, locationId);
}

/** Pack a tool picked by hand (no barcode handy) */
export async function packToolAction(sessionId: string, toolId: string, locationId: string | null): Promise<PackScanResult> {
  const me = await member();
  if (!me) return { success: false, error: "Not signed in." };
  if (!await openSession(sessionId, me.teamId)) return { success: false, error: "This packing list is finished." };
  return packTool(sessionId, me, toolId, locationId);
}

async function packTool(sessionId: string, me: { userId: string; teamId: string }, toolId: string, locationId: string | null): Promise<PackScanResult> {
  const [tool, location] = await Promise.all([
    prisma.tool.findFirst({ where: { id: toolId, teamId: me.teamId, retired: false }, select: { id: true, name: true, assetTag: true } }),
    locationFor(locationId, me.teamId),
  ]);
  if (!tool) return { success: false, error: "Tool not found." };

  const existing = await prisma.packEntry.findUnique({
    where:  { sessionId_toolId: { sessionId, toolId: tool.id } },
    select: { id: true, location: { select: { id: true, name: true } } },
  });
  if (existing) {
    // Scanning it again with a different location moves it there
    if (location && existing.location?.id !== location.id) {
      await prisma.packEntry.update({ where: { id: existing.id }, data: { locationId: location.id } });
      refresh(sessionId);
      return { success: true, kind: "tool", entryId: existing.id, tool, location, already: true };
    }
    return { success: true, kind: "tool", entryId: existing.id, tool, location: existing.location, already: true };
  }

  const entry = await prisma.packEntry.create({
    data:   { sessionId, toolId: tool.id, locationId: location?.id ?? null, packedById: me.userId },
    select: { id: true },
  });
  refresh(sessionId);
  return { success: true, kind: "tool", entryId: entry.id, tool, location, already: false };
}

/** Tick (or untick) a hand-packed list item */
export async function tickPackItemAction(sessionId: string, itemId: string, packed: boolean, locationId: string | null): Promise<Result> {
  const me = await member();
  if (!me) return { success: false, error: "Not signed in." };
  if (!await openSession(sessionId, me.teamId)) return { success: false, error: "This packing list is finished." };
  const item = await prisma.packListItem.findFirst({ where: { id: itemId, teamId: me.teamId }, select: { id: true } });
  if (!item) return { success: false, error: "Item not found." };

  if (packed) {
    const location = await locationFor(locationId, me.teamId);
    await prisma.packEntry.upsert({
      where:  { sessionId_itemId: { sessionId, itemId } },
      create: { sessionId, itemId, locationId: location?.id ?? null, packedById: me.userId },
      update: {},
    });
  } else {
    await prisma.packEntry.deleteMany({ where: { sessionId, itemId } });
  }
  refresh(sessionId);
  return { success: true };
}

/** Say (or change) where a packed tool or item went */
export async function setPackEntryLocationAction(entryId: string, locationId: string | null): Promise<Result> {
  const me = await member();
  if (!me) return { success: false, error: "Not signed in." };
  const entry = await prisma.packEntry.findFirst({
    where:  { id: entryId, session: { teamId: me.teamId, finishedAt: null } },
    select: { id: true, sessionId: true },
  });
  if (!entry) return { success: false, error: "That packed item isn't on an open packing list." };
  const location = await locationFor(locationId, me.teamId);
  if (locationId && !location) return { success: false, error: "Location not found." };

  await prisma.packEntry.update({ where: { id: entry.id }, data: { locationId: location?.id ?? null } });
  refresh(entry.sessionId);
  return { success: true };
}

/** Take something back off the packed list */
export async function unpackEntryAction(entryId: string): Promise<Result> {
  const me = await member();
  if (!me) return { success: false, error: "Not signed in." };
  const entry = await prisma.packEntry.findFirst({
    where:  { id: entryId, session: { teamId: me.teamId, finishedAt: null } },
    select: { id: true, sessionId: true },
  });
  if (!entry) return { success: false, error: "That packed item isn't on an open packing list." };
  await prisma.packEntry.delete({ where: { id: entry.id } });
  refresh(entry.sessionId);
  return { success: true };
}
