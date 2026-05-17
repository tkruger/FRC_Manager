"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteTemplateAction } from "@/app/actions/templates";
import { Trash2 } from "lucide-react";

export function DeleteTemplateButton({ templateId, templateName }: { templateId: string; templateName: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handle() {
    if (!confirm(`Delete template "${templateName}"? This cannot be undone.`)) return;
    startTransition(async () => {
      await deleteTemplateAction(templateId);
      router.refresh();
    });
  }

  return (
    <button onClick={handle} disabled={isPending}
      className="text-[--color-text-disabled] hover:text-[--color-danger] transition-colors disabled:opacity-50 shrink-0 p-1"
      title="Delete template">
      <Trash2 className="h-4 w-4" />
    </button>
  );
}
