"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveMemberAction } from "@/app/actions/members";
import { Dialog, DialogContent, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ROLE_LABELS } from "@/lib/rbac";
import type { Role } from "@/generated/prisma";

const ALL_ROLES: Role[] = ["TEAM_MEMBER", "BUILD_LEAD", "INVENTORY_ADMIN", "BUDGET_MANAGER", "SAFETY_CAPTAIN", "TEAM_LEADERSHIP", "HEAD_MENTOR"];

export function ApproveDialog({ userId, userName }: { userId: string; userName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Role[]>(["TEAM_MEMBER"]);
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
        {error && <div className="text-sm text-[--color-danger] bg-[--color-danger]/10 rounded px-3 py-2 mb-4">{error}</div>}
        <div className="space-y-2 mb-6">
          {ALL_ROLES.map((role) => (
            <label key={role} className="flex items-center gap-3 cursor-pointer py-1.5 px-2 rounded hover:bg-[--color-surface-overlay]">
              <input
                type="checkbox"
                checked={selected.includes(role)}
                onChange={() => toggle(role)}
                className="rounded"
              />
              <span className="text-sm text-[--color-text-primary]">{ROLE_LABELS[role]}</span>
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
