"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableHead, TableBody, Th, Td, Tr } from "@/components/ui/table";
import { ToolDetailsModal } from "./ToolDetailsModal";
import { CheckinButton } from "./CheckinButton";

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

interface Checkout {
  id: string;
  toolId: string;
  quantity: number;
  expectedReturn: string;
  user: { name: string };
}

interface Props {
  tools:          Tool[];
  activeCheckouts: Checkout[];
  canEdit:        boolean;
}

const CONDITION_BADGE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  EXCELLENT: "success", GOOD: "success", FAIR: "warning",
  NEEDS_REPAIR: "danger", OUT_OF_SERVICE: "danger", OUT_FOR_MAINTENANCE: "warning",
};

export function ToolsClient({ tools, activeCheckouts, canEdit }: Props) {
  const [selected, setSelected] = useState<Tool | null>(null);

  function availableFor(toolId: string, owned: number) {
    const checked = activeCheckouts
      .filter((c) => c.toolId === toolId)
      .reduce((s, c) => s + c.quantity, 0);
    return owned - checked;
  }

  const selectedAvailable = selected ? availableFor(selected.id, selected.quantityOwned) : 0;

  return (
    <>
      <Table>
        <TableHead>
          <tr>
            <Th>Tool</Th>
            <Th>Type</Th>
            <Th>Available</Th>
            <Th>Condition</Th>
            <Th>Location</Th>
            <Th>Cert</Th>
            <Th>Actions</Th>
          </tr>
        </TableHead>
        <TableBody>
          {tools.map((t) => {
            const avail    = availableFor(t.id, t.quantityOwned);
            const checkout = activeCheckouts.find((c) => c.toolId === t.id);
            return (
              <Tr key={t.id} className="group">
                {/* Clickable name → modal */}
                <Td>
                  <button
                    onClick={() => setSelected(t)}
                    className="font-medium text-[--color-secondary] group-hover:text-[--color-primary] text-left"
                  >
                    {t.name}
                  </button>
                  {t.assetTag && <p className="text-mono text-[--color-text-secondary]">{t.assetTag}</p>}
                </Td>
                <Td>{t.toolType.replace(/_/g, " ")}</Td>
                <Td>
                  <span className={avail === 0 ? "text-[--color-danger] font-medium" : "text-[--color-text-primary]"}>
                    {avail}/{t.quantityOwned}
                  </span>
                </Td>
                <Td>
                  <Badge variant={CONDITION_BADGE[t.condition] ?? "neutral"}>
                    {t.condition.replace(/_/g, " ")}
                  </Badge>
                </Td>
                <Td>{t.homeLocation ?? "—"}</Td>
                <Td>
                  {t.requiresCertification
                    ? <Badge variant="warning">{t.certificationName ?? "Required"}</Badge>
                    : "—"}
                </Td>
                {/* Separate action buttons */}
                <Td>
                  <div className="flex gap-1.5 flex-wrap">
                    {checkout ? (
                      <CheckinButton checkoutId={checkout.id} toolName={t.name} />
                    ) : avail > 0 ? (
                      <Link href={`/tools/${t.id}`}>
                        <Button variant="outline" size="sm">Check out</Button>
                      </Link>
                    ) : (
                      <span className="text-small text-[--color-text-disabled]">Unavailable</span>
                    )}
                    {canEdit && (
                      <Link href={`/tools/${t.id}/edit`}>
                        <Button variant="outline" size="sm">Edit</Button>
                      </Link>
                    )}
                  </div>
                </Td>
              </Tr>
            );
          })}
        </TableBody>
      </Table>

      <ToolDetailsModal
        tool={selected}
        available={selectedAvailable}
        canEdit={canEdit}
        onClose={() => setSelected(null)}
      />
    </>
  );
}
