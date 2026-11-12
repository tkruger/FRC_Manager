"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { cancelJoinRequestAction } from "@/app/actions/auth";

/** Take back a request to join (or register) a team made by mistake, and pick again. */
export function CancelRequestButton({ newTeam }: { newTeam: boolean }) {
  const [pending, start] = useTransition();

  function cancel() {
    const question = newTeam
      ? "Cancel your request to register this team? You can then pick the right team."
      : "Cancel your request to join this team? You can then pick the right team.";
    if (!confirm(question)) return;
    start(async () => {
      // Goes on to pick a team when it works
      const res = await cancelJoinRequestAction();
      if (res && !res.success) alert(res.error);
    });
  }

  return (
    <Button type="button" variant="dangerOutline" className="w-full" isLoading={pending} onClick={cancel}>
      Cancel my request
    </Button>
  );
}
