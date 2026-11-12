"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { approveTeamAction, deleteTeamRequestAction, denyTeamAction } from "@/app/actions/admin";

export function TeamReviewButtons({ teamId, teamNumber, founderName }: { teamId: string; teamNumber: number; founderName: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function run(action: "approve" | "deny" | "delete") {
    const question = {
      approve: `Approve team ${teamNumber}?${founderName ? ` ${founderName} becomes its Head Mentor.` : ""}`,
      deny:    `Deny team ${teamNumber}? Everyone waiting to join it is denied, and the team number can't register again.`,
      // For a request made by mistake (a wrong team number, a duplicate)
      delete:  `Delete team ${teamNumber}'s request? It's removed with the accounts waiting on it, as if they never signed up — they and the team number can register again.`,
    }[action];
    if (!confirm(question)) return;
    start(async () => {
      const res = action === "approve" ? await approveTeamAction(teamId)
        : action === "deny" ? await denyTeamAction(teamId)
        : await deleteTeamRequestAction(teamId);
      if (!res.success) { toast.error(res.error); return; }
      toast.success(res.message ?? "Done");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" isLoading={pending} onClick={() => run("approve")}>Approve</Button>
      <Button size="sm" variant="outline" disabled={pending} onClick={() => run("deny")}>Deny</Button>
      <Button size="sm" variant="dangerOutline" disabled={pending} onClick={() => run("delete")}>Delete request</Button>
    </div>
  );
}
