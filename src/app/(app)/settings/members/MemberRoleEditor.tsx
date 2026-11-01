"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateMemberRolesAction, suspendMemberAction } from "@/app/actions/members";
import { Dialog, DialogContent, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ALL_ROLES, ROLE_LABELS } from "@/lib/rbac";
import type { Role } from "@/generated/prisma";
import { toast } from "@/components/ui/toast";
import { SubTeamPicker } from "@/components/SubTeamPicker";


/**
 * grantable: the roles the editor may give or take away (others are a Head Mentor's).
 * locked: roles that stay on (a super admin's Head Mentor). self: editing your own roles — no Suspend.
 */
export function MemberRoleEditor({ userId, currentRoles, grantable, subTeams, locked = [], self = false }: {
  userId: string; currentRoles: Role[]; grantable: Role[]; subTeams: string[]; locked?: Role[]; self?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Role[]>(currentRoles);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggle(role: Role) {
    setSelected((prev) => prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]);
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const result = await updateMemberRolesAction(userId, selected);
      if (result.success) { toast.success("Roles saved"); setOpen(false); router.refresh(); }
      else setError(result.error ?? "Failed.");
    });
  }

  function handleSuspend() {
    if (!confirm("Suspend this member? They won't be able to log in.")) return;
    startTransition(async () => {
      const res = await suspendMemberAction(userId);
      if (!res.success) { toast.error(res.error ?? "Couldn't suspend."); return; }
      toast.success("Member suspended");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">Edit roles</Button>
      </DialogTrigger>
      <DialogContent title="Edit member roles">
        {error && <div className="text-sm text-(--color-danger) bg-(--color-danger)/10 rounded px-3 py-2 mb-4">{error}</div>}
        <div className="space-y-2 mb-6">
          {ALL_ROLES.map((role) => (
            <label key={role} className={`flex items-center gap-3 py-1.5 px-2 rounded ${grantable.includes(role) ? "cursor-pointer hover:bg-(--color-surface-overlay)" : "opacity-60"}`}>
              <input type="checkbox" checked={selected.includes(role)} onChange={() => toggle(role)} disabled={!grantable.includes(role) || locked.includes(role)} className="rounded" />
              <span className="text-sm text-(--color-text-primary)">{ROLE_LABELS[role]}</span>
              {locked.includes(role)
                ? <span className="ml-auto text-xs text-(--color-text-secondary)">Always on for super admins</span>
                : !grantable.includes(role) && <span className="ml-auto text-xs text-(--color-text-secondary)">Head Mentor only</span>}
            </label>
          ))}
        </div>
        <div className="mb-6 space-y-2">
          <p className="text-sm font-medium text-(--color-text-primary)">Sub-teams <span className="font-normal text-(--color-text-secondary)">(saved as you tap)</span></p>
          <SubTeamPicker userId={userId} current={subTeams} />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <Button onClick={handleSave} isLoading={isPending} disabled={selected.length === 0}>Save roles</Button>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          </div>
          {!self && <Button variant="danger" size="sm" onClick={handleSuspend} isLoading={isPending}>Suspend</Button>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
