"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { safetyIncidentFiled } from "@/lib/notify/events";
import type { IncidentSeverity, CertStatus } from "@/generated/prisma";

const IncidentSchema = z.object({
  incidentDate:    z.string().min(1),
  description:     z.string().min(1),
  severity:        z.enum(["NEAR_MISS", "MINOR_INJURY", "SIGNIFICANT_INJURY"]),
  toolOrMaterial:  z.string().optional(),
  peopleInvolved:  z.string().optional(),
  immediateAction: z.string().optional(),
  correctiveAction:z.string().optional(),
});

export async function fileIncidentAction(
  _prev: { success: boolean; error?: string } | null,
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session) return { success: false, error: "Not authenticated." };

  const parsed = IncidentSchema.safeParse({
    incidentDate:     formData.get("incidentDate"),
    description:      formData.get("description"),
    severity:         formData.get("severity"),
    toolOrMaterial:   formData.get("toolOrMaterial") || undefined,
    peopleInvolved:   formData.get("peopleInvolved") || undefined,
    immediateAction:  formData.get("immediateAction") || undefined,
    correctiveAction: formData.get("correctiveAction") || undefined,
  });
  if (!parsed.success) return { success: false, error: "Please fill in all required fields." };

  await prisma.safetyIncident.create({
    data: {
      reportedById:    session.user.id,
      incidentDate:    new Date(parsed.data.incidentDate),
      description:     parsed.data.description,
      severity:        parsed.data.severity as IncidentSeverity,
      toolOrMaterial:  parsed.data.toolOrMaterial,
      peopleInvolved:  parsed.data.peopleInvolved,
      immediateAction: parsed.data.immediateAction,
      correctiveAction:parsed.data.correctiveAction,
    },
  });
  if (session.user.teamId) await safetyIncidentFiled(session.user.teamId, parsed.data.severity, session.user.id);

  revalidatePath("/safety");
  revalidatePath("/safety/incidents");
  return { success: true };
}

// Matches who sees Award/Revoke on the certifications page
const CERT_MANAGER_ROLES = ["HEAD_MENTOR", "SAFETY_CAPTAIN", "INVENTORY_ADMIN"];
function canManageCerts(roles: string[]) {
  return roles.some((r) => CERT_MANAGER_ROLES.includes(r));
}

const CertSchema = z.object({
  userId:       z.string().min(1),
  certName:     z.string().min(1),
  certifiedById:z.string().optional(),
  certifiedAt:  z.string().min(1),
  expiresAt:    z.string().optional(),
  notes:        z.string().optional(),
});

export async function awardCertificationAction(
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.teamId) return { success: false, error: "Not authenticated." };
  // Certifications gate tool checkouts, so only certifiers may grant them
  if (!canManageCerts(session.user.roles)) return { success: false, error: "Not authorized." };

  const parsed = CertSchema.safeParse({
    userId:        formData.get("userId"),
    certName:      formData.get("certName"),
    certifiedById: session.user.id,
    certifiedAt:   formData.get("certifiedAt"),
    expiresAt:     formData.get("expiresAt") || undefined,
    notes:         formData.get("notes") || undefined,
  });
  if (!parsed.success) return { success: false, error: "Please fill in all required fields." };

  const member = await prisma.user.findFirst({ where: { id: parsed.data.userId, teamId: session.user.teamId }, select: { id: true } });
  if (!member) return { success: false, error: "Member not found." };

  await prisma.userCertification.upsert({
    where: { userId_certName: { userId: parsed.data.userId, certName: parsed.data.certName } },
    create: {
      userId:        parsed.data.userId,
      certName:      parsed.data.certName,
      certifiedById: parsed.data.certifiedById,
      certifiedAt:   new Date(parsed.data.certifiedAt),
      expiresAt:     parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
      notes:         parsed.data.notes,
      status:        "ACTIVE",
    },
    update: {
      certifiedById: parsed.data.certifiedById,
      certifiedAt:   new Date(parsed.data.certifiedAt),
      expiresAt:     parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
      notes:         parsed.data.notes,
      status:        "ACTIVE",
    },
  });

  revalidatePath("/safety/certifications");
  return { success: true };
}

export async function revokeCertificationAction(
  userId: string,
  certName: string
): Promise<{ success: boolean }> {
  const session = await auth();
  if (!session?.user?.teamId || !canManageCerts(session.user.roles)) return { success: false };

  await prisma.userCertification.updateMany({
    where: { userId, certName, user: { teamId: session.user.teamId } },
    data: { status: "REVOKED" },
  });

  revalidatePath("/safety/certifications");
  return { success: true };
}

// Inspection checklist
export async function createInspectionChecklistAction(
  robotId: string,
  eventName: string
): Promise<{ success: boolean; checklistId?: string }> {
  const session = await auth();
  if (!session?.user?.teamId) return { success: false };

  const robot = await prisma.robot.findFirst({ where: { id: robotId, season: { teamId: session.user.teamId } }, select: { id: true } });
  if (!robot) return { success: false };

  const INSPECTION_ITEMS = [
    { category: "Weight",       description: "Robot body ≤ 115 lbs" },
    { category: "Weight",       description: "Robot body + bumpers ≤ 135 lbs" },
    { category: "Frame",        description: "Frame perimeter within starting configuration" },
    { category: "Bumpers",      description: "Bumper construction meets FIRST specs" },
    { category: "Bumpers",      description: "Bumpers correctly labeled with team number" },
    { category: "Electrical",   description: "Main breaker accessible and functional" },
    { category: "Electrical",   description: "Wiring routed safely, no exposed conductors" },
    { category: "Electrical",   description: "Motor controllers are FIRST-legal models" },
    { category: "Electrical",   description: "Motors are on the legal motor list" },
    { category: "Pneumatics",   description: "System components are legal and rated correctly" },
    { category: "Pneumatics",   description: "Pressure gauges installed and functional" },
    { category: "Pneumatics",   description: "Max system pressure ≤ 120 PSI" },
    { category: "Electronics",  description: "Robot Signal Light (RSL) functional" },
    { category: "Electronics",  description: "Radio configured at event kiosk" },
    { category: "Software",     description: "roboRIO image is current season version" },
    { category: "Software",     description: "Driver Station software is current version" },
    { category: "BOM",          description: "BOM present and complete" },
    { category: "Safety",       description: "No prohibited materials (lasers, flammable gases)" },
    { category: "Safety",       description: "No sharp or hazardous protrusions" },
  ];

  const checklist = await prisma.inspectionChecklist.create({
    data: {
      robotId,
      eventName,
      items: { create: INSPECTION_ITEMS },
    },
  });

  revalidatePath("/safety/inspection");
  return { success: true, checklistId: checklist.id };
}

export async function updateCheckItemAction(
  itemId: string,
  status: "PASS" | "FAIL" | "NOT_CHECKED"
): Promise<void> {
  // Previously had no auth check at all
  const session = await auth();
  if (!session?.user?.teamId) return;
  if (!["PASS", "FAIL", "NOT_CHECKED"].includes(status)) return;

  // InspectionChecklist.robotId has no relation, so scope through the team's robot ids
  const robotIds = (await prisma.robot.findMany({
    where:  { season: { teamId: session.user.teamId } },
    select: { id: true },
  })).map((r) => r.id);

  await prisma.inspectionCheckItem.updateMany({
    where: { id: itemId, checklist: { robotId: { in: robotIds } } },
    data: { status, checkedAt: status !== "NOT_CHECKED" ? new Date() : null },
  });
  revalidatePath("/safety/inspection");
}

// ── PRECHECK (official self-inspection) ─────────────────────────────────────

/** Save a robot's PRECHECK link and/or status. Any team member, like the in-app checklist. */
export async function updatePrecheckAction(
  robotId: string,
  input: { url?: string | null; status?: string },
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await auth();
  if (!session?.user?.teamId) return { success: false, error: "Not authenticated." };

  const { isPrecheckUrl, PRECHECK_STATUSES } = await import("@/lib/precheck");
  const data: { precheckUrl?: string | null; precheckStatus?: (typeof PRECHECK_STATUSES)[number] } = {};
  if (input.url !== undefined) {
    const url = input.url?.trim() || null;
    if (url && !isPrecheckUrl(url)) return { success: false, error: "Paste the link PRECHECK gives you, like https://precheck.frc.nexus/AbCd1234." };
    data.precheckUrl = url;
  }
  if (input.status !== undefined) {
    if (!PRECHECK_STATUSES.includes(input.status as never)) return { success: false, error: "Unknown status." };
    data.precheckStatus = input.status as (typeof PRECHECK_STATUSES)[number];
  }

  const res = await prisma.robot.updateMany({
    where: { id: robotId, season: { teamId: session.user.teamId } },
    data:  { ...data, precheckUpdatedAt: new Date(), precheckUpdatedById: session.user.id },
  });
  if (res.count === 0) return { success: false, error: "Robot not found." };

  revalidatePath("/safety", "layout");
  revalidatePath("/fleet", "layout");
  return { success: true };
}
