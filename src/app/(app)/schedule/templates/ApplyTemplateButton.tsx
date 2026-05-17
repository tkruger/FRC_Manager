"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { applyStandardTemplateAction } from "@/app/actions/templates";
import { Button } from "@/components/ui/button";

interface Props {
  disabled?: boolean;
  existingTaskCount: number;
}

export function ApplyTemplateButton({ disabled, existingTaskCount }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  function handleApply() {
    if (existingTaskCount > 0) {
      const ok = confirm(
        `You already have ${existingTaskCount} task(s). Applying the template will add missing tasks without overwriting existing ones. Continue?`
      );
      if (!ok) return;
    }
    setResult(null);
    startTransition(async () => {
      const res = await applyStandardTemplateAction();
      if (res.success) {
        setResult(res.count === 0 ? "All template tasks already exist." : `Added ${res.count} tasks.`);
        router.refresh();
      } else {
        setResult(res.error ?? "Failed.");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-2 shrink-0">
      <Button onClick={handleApply} isLoading={isPending} disabled={disabled}>
        Apply template
      </Button>
      {result && (
        <p className="text-small text-[--color-success]">{result}</p>
      )}
      {disabled && (
        <p className="text-small text-[--color-text-secondary]">Set up a season first</p>
      )}
    </div>
  );
}
