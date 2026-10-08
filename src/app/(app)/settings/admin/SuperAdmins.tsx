"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { grantSuperAdminAction, revokeSuperAdminAction } from "@/app/actions/admin";

interface Admin { id: string; name: string; email: string; teamNumber: number | null }
type Result = { success: true; message?: string } | { success: false; error: string };

/** Who can approve teams. Super admins add each other by email; one always remains. */
export function SuperAdmins({ admins, currentUserId }: { admins: Admin[]; currentUserId: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pending, start] = useTransition();

  function run(action: () => Promise<Result>, after?: () => void) {
    start(async () => {
      const res = await action();
      if (!res.success) { toast.error(res.error); return; }
      toast.success(res.message ?? "Saved");
      after?.();
      router.refresh();
    });
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-h2 text-(--color-text-primary)">Super admins</h2>
        <p className="text-small text-(--color-text-secondary) mt-1">
          Super admins approve new teams and get notified when one registers. It&apos;s separate from team roles.
        </p>
      </div>

      <div className="card divide-y divide-(--color-border) p-0">
        {admins.map((a) => (
          <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
            <div className="min-w-0">
              <p className="text-sm text-(--color-text-primary)">
                {a.name}{a.id === currentUserId && <span className="ml-2 text-xs text-(--color-text-secondary)">(you)</span>}
              </p>
              <p className="text-small text-(--color-text-secondary) break-all">
                {a.email}{a.teamNumber && ` · Team ${a.teamNumber}`}
              </p>
            </div>
            {admins.length > 1 && (
              <button
                type="button"
                disabled={pending}
                onClick={() => { if (confirm(`Remove ${a.name} as a super admin?`)) run(() => revokeSuperAdminAction(a.id)); }}
                className="text-small font-medium text-(--color-danger) hover:underline disabled:opacity-50"
              >
                Remove
              </button>
            )}
          </div>
        ))}
      </div>

      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => { e.preventDefault(); if (email.trim()) run(() => grantSuperAdminAction(email), () => setEmail("")); }}
      >
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email of an existing account"
          className="h-11 min-w-0 flex-1 rounded-md border border-(--color-border) bg-(--color-surface) px-3 text-sm text-(--color-text-primary) focus:border-(--color-primary) focus:outline-none"
        />
        <Button type="submit" isLoading={pending}>Add super admin</Button>
      </form>
    </section>
  );
}
