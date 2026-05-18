"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { revokeDiscordLinkAction } from "@/app/actions/discord-settings";
import { Button } from "@/components/ui/button";

export function RevokeLinkButton({ linkId, memberName }: { linkId: string; memberName: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handle() {
    if (!confirm(`Revoke Discord link for ${memberName}? They will need to run /link again.`)) return;
    startTransition(async () => {
      await revokeDiscordLinkAction(linkId);
      router.refresh();
    });
  }

  return (
    <Button variant="outline" size="sm" onClick={handle} isLoading={isPending}>
      Revoke
    </Button>
  );
}
