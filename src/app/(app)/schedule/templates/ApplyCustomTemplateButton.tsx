"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { applyCustomTemplateAction } from "@/app/actions/templates";
import { Button } from "@/components/ui/button";

export function ApplyCustomTemplateButton({ templateId, disabled }: { templateId: string; disabled?: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  function handle() {
    setResult(null);
    startTransition(async () => {
      const res = await applyCustomTemplateAction(templateId);
      if (res.success) {
        setResult(res.count === 0 ? "Already up to date" : `Added ${res.count} tasks`);
        router.refresh();
      } else {
        setResult(res.error ?? "Failed");
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" onClick={handle} isLoading={isPending} disabled={disabled}>
        Apply to season
      </Button>
      {result && <span className="text-small text-[--color-success]">{result}</span>}
      {disabled && <span className="text-small text-[--color-text-disabled]">No active season</span>}
    </div>
  );
}
