"use client";

import Link from "next/link";
import { Dialog, DialogContent, DialogClose } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";

interface Tool {
  id: string;
  name: string;
  toolType: string;
  space: string;
  manufacturer: string | null;
  model: string | null;
  assetTag: string | null;
  quantityOwned: number;
  homeLocation: string | null;
  condition: string;
  requiresCertification: boolean;
  certificationName: string | null;
  maintenanceIntervalDays: number | null;
  replacementCost: number | null;
  notes: string | null;
  image: string | null;
}

interface Props {
  tool:      Tool | null;
  available: number;
  canEdit:   boolean;
  onClose:   () => void;
}

const CONDITION_BADGE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  EXCELLENT: "success", GOOD: "success", FAIR: "warning",
  NEEDS_REPAIR: "danger", OUT_OF_SERVICE: "danger", OUT_FOR_MAINTENANCE: "warning",
};

export function ToolDetailsModal({ tool, available, canEdit, onClose }: Props) {
  if (!tool) return null;

  const meta = [
    { label: "Type",         value: tool.toolType.replace(/_/g, " ") },
    { label: "Qty owned",    value: tool.quantityOwned },
    { label: "Asset tag",    value: tool.assetTag ?? "—" },
    { label: "Location",     value: tool.homeLocation ?? "—" },
    { label: "Manufacturer", value: tool.manufacturer ?? "—" },
    { label: "Model",        value: tool.model ?? "—" },
    { label: "Space",        value: tool.space.replace(/_/g, " ") },
    { label: "Replacement",  value: tool.replacementCost ? formatCurrency(tool.replacementCost) : "—" },
  ];

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={tool.name} className="sm:max-w-lg">
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">

          {/* Photo */}
          {tool.image && (
            <div className="w-full aspect-video rounded-lg overflow-hidden bg-[--color-surface-overlay] max-h-48">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={tool.image} alt={tool.name} className="w-full h-full object-cover" />
            </div>
          )}

          {/* Badges */}
          <div className="flex flex-wrap gap-2">
            <Badge variant={CONDITION_BADGE[tool.condition] ?? "neutral"}>
              {tool.condition.replace(/_/g, " ")}
            </Badge>
            <Badge variant={available > 0 ? "success" : "danger"}>
              {available > 0 ? `${available} available` : "None available"}
            </Badge>
            {tool.requiresCertification && (
              <Badge variant="warning">{tool.certificationName ?? "Cert required"}</Badge>
            )}
          </div>

          {/* Meta grid */}
          <div className="grid grid-cols-2 gap-2">
            {meta.map((m) => (
              <div key={m.label} className="rounded-md bg-[--color-surface-overlay] px-3 py-2">
                <p className="text-label text-[--color-text-secondary]">{m.label}</p>
                <p className="text-sm font-medium text-[--color-text-primary] mt-0.5">{String(m.value)}</p>
              </div>
            ))}
          </div>

          {/* Notes */}
          {tool.notes && (
            <div>
              <p className="text-label text-[--color-text-secondary] mb-1">Notes</p>
              <p className="text-sm text-[--color-text-primary] whitespace-pre-wrap">{tool.notes}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2 border-t border-[--color-border]">
            {available > 0 && (
              <Link href={`/tools/${tool.id}`}>
                <Button size="sm">Check out</Button>
              </Link>
            )}
            {canEdit && (
              <Link href={`/tools/${tool.id}/edit`}>
                <Button variant="outline" size="sm">Edit tool</Button>
              </Link>
            )}
            <DialogClose asChild>
              <Button variant="outline" size="sm">Close</Button>
            </DialogClose>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
