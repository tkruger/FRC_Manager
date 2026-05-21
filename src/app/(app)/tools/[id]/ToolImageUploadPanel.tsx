"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ToolImageCapture } from "@/components/ui/ToolImageCapture";
import { updateToolImageAction } from "@/app/actions/tools";

interface Props {
  toolId:          string;
  currentImageUrl: string | null;
}

export function ToolImageUploadPanel({ toolId, currentImageUrl }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleUrl(url: string | null) {
    startTransition(async () => {
      await updateToolImageAction(toolId, url);
      router.refresh();
    });
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-h3 text-[--color-text-primary]">Photo</h2>
        {isPending && (
          <span className="text-small text-[--color-text-secondary]">Saving…</span>
        )}
      </div>
      <ToolImageCapture
        name="imageUrl"
        defaultUrl={currentImageUrl}
        onUrl={handleUrl}
      />
    </div>
  );
}
