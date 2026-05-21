import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { EditToolForm } from "../EditToolForm";
import { ToolImageUploadPanel } from "../ToolImageUploadPanel";
import { BarcodePanel } from "../BarcodePanel";

const TOOL_EDIT_ROLES = ["INVENTORY_ADMIN", "BUILD_LEAD", "TEAM_LEADERSHIP", "HEAD_MENTOR"];

export default async function ToolEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id }  = await params;
  const session = await auth();
  if (!session?.user?.teamId) redirect("/dashboard");

  if (!session.user.roles.some((r) => TOOL_EDIT_ROLES.includes(r))) redirect("/tools");

  const tool = await prisma.tool.findFirst({
    where: { id, teamId: session.user.teamId },
  });
  if (!tool) notFound();

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <nav className="text-small text-[--color-text-secondary]">
        <Link href="/tools" className="hover:text-[--color-primary]">Tools</Link>
        <span className="mx-2">›</span>
        <span className="text-[--color-text-primary]">{tool.name}</span>
        <span className="mx-2">›</span>
        <span className="text-[--color-text-primary]">Edit</span>
      </nav>

      <h1 className="text-h1 text-[--color-text-primary]">{tool.name}</h1>

      <ToolImageUploadPanel toolId={tool.id} currentImageUrl={tool.image} />

      <div className="card space-y-4">
        <h2 className="text-h3 text-[--color-text-primary]">Edit details</h2>
        <EditToolForm key={tool.updatedAt.toISOString()} tool={{
          id:                      tool.id,
          name:                    tool.name,
          toolType:                tool.toolType,
          space:                   tool.space,
          manufacturer:            tool.manufacturer,
          model:                   tool.model,
          assetTag:                tool.assetTag,
          quantityOwned:           tool.quantityOwned,
          homeLocation:            tool.homeLocation,
          condition:               tool.condition,
          requiresCertification:   tool.requiresCertification,
          certificationName:       tool.certificationName,
          maintenanceIntervalDays: tool.maintenanceIntervalDays,
          replacementCost:         tool.replacementCost,
          notes:                   tool.notes,
        }} />
      </div>

      <BarcodePanel toolId={tool.id} toolName={tool.name} assetTag={tool.assetTag} />
    </div>
  );
}
