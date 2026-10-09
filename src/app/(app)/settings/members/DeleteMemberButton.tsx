"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/toast";
import { deleteMemberAction } from "@/app/actions/members";

/** Delete a member (or erase their details, if they have history the team needs to keep) */
export function DeleteMemberButton({ userId, name }: { userId: string; name: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm(
          `Delete ${name}?\n\nThey lose access straight away and are taken off their tasks. ` +
          `If they have orders, safety reports, tool checkouts or certifications, those stay — shown as "Former member" — ` +
          `and the rest of their details are erased. This can't be undone.`,
        )) return;
        start(async () => {
          const res = await deleteMemberAction(userId);
          if (!res.success) { toast.error(res.error ?? "Couldn't delete the member."); return; }
          toast.success(res.erased ? `${name} deleted — their history stays as "Former member"` : `${name} deleted`);
          router.refresh();
        });
      }}
      className="text-small font-medium text-(--color-danger) hover:underline disabled:opacity-50"
    >
      {pending ? "Deleting…" : "Delete"}
    </button>
  );
}
