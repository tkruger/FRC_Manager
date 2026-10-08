"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { approveTeamAction, denyTeamAction } from "@/app/actions/admin";

export function TeamReviewButtons({ teamId, teamNumber, founderName }: { teamId: string; teamNumber: number; founderName: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function run(approve: boolean) {
    const question = approve
      ? `Approve team ${teamNumber}?${founderName ? ` ${founderName} becomes its Head Mentor.` : ""}`
      : `Deny team ${teamNumber}? Everyone waiting to join it is denied, and the team number can't register again.`;
    if (!confirm(question)) return;
    start(async () => {
      const res = approve ? await approveTeamAction(teamId) : await denyTeamAction(teamId);
      if (!res.success) { toast.error(res.error); return; }
      toast.success(res.message ?? "Done");
      router.refresh();
    });
  }

  return (
    <div className="flex gap-2">
      <Button size="sm" isLoading={pending} onClick={() => run(true)}>Approve</Button>
      <Button size="sm" variant="outline" disabled={pending} onClick={() => run(false)}>Deny</Button>
    </div>
  );
}
