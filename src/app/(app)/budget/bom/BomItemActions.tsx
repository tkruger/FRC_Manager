"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteBomItemAction } from "@/app/actions/bom";
import { Trash2 } from "lucide-react";

export function BomItemActions({ itemId }: { itemId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm("Remove this BOM item?")) return;
    startTransition(async () => {
      await deleteBomItemAction(itemId);
      router.refresh();
    });
  }

  return (
    <button
      onClick={handleDelete}
      disabled={isPending}
      className="text-[--color-text-disabled] hover:text-[--color-danger] transition-colors disabled:opacity-50"
      title="Remove item"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}
