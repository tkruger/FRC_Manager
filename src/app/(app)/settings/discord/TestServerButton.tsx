"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { sendDiscordTestAction } from "@/app/actions/discord-settings";

/** Posts a "ready to go" message to the server so you can see the bot works. */
export function TestServerButton() {
  const [isPending, startTransition] = useTransition();

  function handle() {
    startTransition(async () => {
      const res = await sendDiscordTestAction();
      if (res.success) toast.success(`Test message sent to ${res.channel}`);
      else toast.error(res.error);
    });
  }

  return (
    <Button variant="outline" size="sm" onClick={handle} isLoading={isPending}>
      Test server
    </Button>
  );
}
