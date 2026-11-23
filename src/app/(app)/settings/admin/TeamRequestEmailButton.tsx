"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { resendTeamRequestEmailAction } from "@/app/actions/admin";

/** Email (again) the person who registered a waiting team, asking if they're its Head Mentor */
export function TeamRequestEmailButton({ teamId, teamNumber, email, sent }: { teamId: string; teamNumber: number; email: string; sent: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function send() {
    if (!confirm(`${sent ? "Resend" : "Send"} the Head Mentor check for team ${teamNumber} to ${email}? Super admins are on CC.`)) return;
    start(async () => {
      const res = await resendTeamRequestEmailAction(teamId);
      if (!res.success) { toast.error(res.error); return; }
      toast.success(res.message ?? "Sent");
      router.refresh();
    });
  }

  return (
    <Button size="sm" variant="outline" isLoading={pending} onClick={send}>
      <Mail className="h-4 w-4" aria-hidden="true" />
      {sent ? "Resend email" : "Send email"}
    </Button>
  );
}
