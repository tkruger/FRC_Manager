"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency } from "@/lib/utils";
import { retireToolAction } from "@/app/actions/tools";
import { CheckoutForm } from "./[id]/CheckoutForm";
import { EditToolForm } from "./[id]/EditToolForm";
import { BarcodePanel } from "./[id]/BarcodePanel";
import { ToolImageUploadPanel } from "./[id]/ToolImageUploadPanel";
import { CheckinButton } from "./CheckinButton";
import { CONDITION_BADGE, isAvailable, type ToolRow } from "./tool-helpers";

export type ToolTab = "details" | "checkout" | "edit";

interface Props {
  tool:          ToolRow;
  initialTab:    ToolTab;
  canEdit:       boolean;
  currentUserId: string;
  hasCert:       boolean;
  onClose:       () => void;
}

/** Everything about one physical tool, in a window over the tools list. */
export function ToolDialog({ tool, initialTab, canEdit, currentUserId, hasCert, onClose }: Props) {
  const router = useRouter();
  const available = isAvailable(tool);
  const tabs: { id: ToolTab; label: string }[] = [
    { id: "details", label: "Details" },
    ...(available ? [{ id: "checkout" as const, label: "Check out" }] : []),
    ...(canEdit ? [{ id: "edit" as const, label: "Edit" }] : []),
  ];
  const [tab, setTab] = useState<ToolTab>(tabs.some((t) => t.id === initialTab) ? initialTab : "details");
  const [retiring, startRetire] = useTransition();

  const c = tool.checkout;
  const meta = [
    { label: "Asset tag",    value: tool.assetTag ?? "—" },
    { label: "Type",         value: tool.toolType.replace(/_/g, " ").toLowerCase() },
    { label: "Location",     value: tool.homeLocation ?? "—" },
    { label: "Space",        value: tool.space.replace(/_/g, " ").toLowerCase() },
    { label: "Manufacturer", value: tool.manufacturer ?? "—" },
    { label: "Model",        value: tool.model ?? "—" },
    { label: "Replacement",  value: tool.replacementCost ? formatCurrency(tool.replacementCost) : "—" },
    { label: "Maintenance",  value: tool.maintenanceIntervalDays ? `Every ${tool.maintenanceIntervalDays} days` : "—" },
  ];

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={tool.assetTag ? `${tool.name} · ${tool.assetTag}` : tool.name} className="sm:max-w-xl">
        <div className="space-y-4">
          {tabs.length > 1 && (
            <div role="tablist" className="flex gap-1 border-b border-(--color-border)">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={tab === t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                    tab === t.id
                      ? "border-(--color-primary) text-(--color-primary)"
                      : "border-transparent text-(--color-text-secondary) hover:text-(--color-text-primary)"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}

          <div className="max-h-[65vh] overflow-y-auto pr-1 space-y-4">
            {tab === "details" && (
              <>
                {tool.image && (
                  <div className="w-full aspect-video rounded-lg overflow-hidden bg-(--color-surface-overlay) max-h-48">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={tool.image} alt={tool.name} className="w-full h-full object-cover" />
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <Badge variant={CONDITION_BADGE[tool.condition] ?? "neutral"}>{tool.condition.replace(/_/g, " ").toLowerCase()}</Badge>
                  <Badge variant={available ? "success" : "danger"}>{available ? "Available" : c ? "Checked out" : "Unavailable"}</Badge>
                  {tool.requiresCertification && <Badge variant="warning">{tool.certificationName ?? "Cert required"}</Badge>}
                </div>

                {c && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-(--color-border) px-3 py-2">
                    <p className="text-sm text-(--color-text-primary)">
                      Checked out by <b>{c.userId === currentUserId ? "you" : c.userName}</b>, due{" "}
                      {new Date(c.expectedReturn).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </p>
                    {(c.userId === currentUserId || canEdit) && (
                      <CheckinButton checkoutId={c.id} toolName={`${tool.name} ${tool.assetTag ?? ""}`.trim()} />
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  {meta.map((m) => (
                    <div key={m.label} className="rounded-md bg-(--color-surface-overlay) px-3 py-2">
                      <p className="text-label text-(--color-text-secondary)">{m.label}</p>
                      <p className="text-sm font-medium text-(--color-text-primary) mt-0.5">{m.value}</p>
                    </div>
                  ))}
                </div>

                {tool.notes && (
                  <div>
                    <p className="text-label text-(--color-text-secondary) mb-1">Notes</p>
                    <p className="text-sm text-(--color-text-primary) whitespace-pre-wrap">{tool.notes}</p>
                  </div>
                )}

                <BarcodePanel toolId={tool.id} toolName={tool.name} assetTag={tool.assetTag} />
              </>
            )}

            {tab === "checkout" && (
              hasCert ? (
                <CheckoutForm toolId={tool.id} onDone={onClose} />
              ) : (
                <p className="rounded-md bg-(--color-warning)/10 border border-(--color-warning)/20 px-4 py-3 text-sm text-(--color-warning)">
                  You need <b>{tool.certificationName}</b> certification to check out this tool. Ask a Safety Captain, Inventory Admin or Head Mentor.
                </p>
              )
            )}

            {tab === "edit" && canEdit && (
              <>
                <ToolImageUploadPanel toolId={tool.id} currentImageUrl={tool.image} />
                <EditToolForm tool={tool} />
                <div className="border-t border-(--color-border) pt-4 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-small text-(--color-text-secondary)">Lost, broken or sold? Retiring hides this tool but keeps its history.</p>
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={retiring || !!c}
                    title={c ? "Check it in first" : undefined}
                    onClick={() => {
                      if (!confirm(`Retire ${tool.name} ${tool.assetTag ?? ""}?`)) return;
                      startRetire(async () => {
                        await retireToolAction(tool.id);
                        onClose();
                        router.refresh();
                      });
                    }}
                  >
                    Retire tool
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
