"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveMemberAction } from "@/app/actions/members";
import { Dialog, DialogContent, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ALL_ROLES, ROLE_LABELS } from "@/lib/rbac";
import type { Role } from "@/generated/prisma";


/** grantable: the roles the approver may give (others are a Head Mentor's) */
export function ApproveDialog({ userId, userName, grantable, parentOf }: { userId: string; userName: string; grantable: Role[]; parentOf?: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // Said they're a parent when signing up
  const [selected, setSelected] = useState<Role[]>(parentOf && grantable.includes("PARENT") ? ["PARENT"] : ["TEAM_MEMBER"]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggle(role: Role) {
    setSelected((prev) => prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]);
  }

  function handleApprove() {
    setError(null);
    startTransition(async () => {
      const result = await approveMemberAction(userId, selected);
      if (result.success) { setOpen(false); router.refresh(); }
      else setError(result.error ?? "Failed.");
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Approve</Button>
      </DialogTrigger>
      <DialogContent title={`Approve ${userName}`} description="Assign roles before approving. The user can log in immediately after.">
        {error && <div className="text-sm text-(--color-danger) bg-(--color-danger)/10 rounded px-3 py-2 mb-4">{error}</div>}
        {parentOf && <p className="mb-3 text-sm text-(--color-text-primary)">Says they&apos;re the parent of <b>{parentOf}</b>.</p>}
        <div className="space-y-2 mb-6">
          {ALL_ROLES.map((role) => (
            <label key={role} className={`flex items-center gap-3 py-1.5 px-2 rounded ${grantable.includes(role) ? "cursor-pointer hover:bg-(--color-surface-overlay)" : "opacity-60"}`}>
              <input
                type="checkbox"
                checked={selected.includes(role)}
                onChange={() => toggle(role)}
                disabled={!grantable.includes(role)}
                className="rounded"
              />
              <span className="text-sm text-(--color-text-primary)">{ROLE_LABELS[role]}</span>
              {!grantable.includes(role) && <span className="ml-auto text-xs text-(--color-text-secondary)">Head Mentor only</span>}
            </label>
          ))}
        </div>
        <div className="flex gap-2">
          <Button onClick={handleApprove} isLoading={isPending} disabled={selected.length === 0}>
            Approve & assign roles
          </Button>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}
