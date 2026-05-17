"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
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

  revalidatePath("/safety");
  revalidatePath("/safety/incidents");
  return { success: true };
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
  if (!session) return { success: false, error: "Not authenticated." };

  const parsed = CertSchema.safeParse({
    userId:        formData.get("userId"),
    certName:      formData.get("certName"),
    certifiedById: session.user.id,
    certifiedAt:   formData.get("certifiedAt"),
    expiresAt:     formData.get("expiresAt") || undefined,
    notes:         formData.get("notes") || undefined,
  });
  if (!parsed.success) return { success: false, error: "Please fill in all required fields." };

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
  if (!session) return { success: false };

  await prisma.userCertification.updateMany({
    where: { userId, certName },
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
  if (!session) return { success: false };

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
    { category: "BOM",          description: "BOM present and total FMV ≤ $5,000" },
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
  await prisma.inspectionCheckItem.update({
    where: { id: itemId },
    data: { status, checkedAt: status !== "NOT_CHECKED" ? new Date() : null },
  });
  revalidatePath("/safety/inspection");
}
