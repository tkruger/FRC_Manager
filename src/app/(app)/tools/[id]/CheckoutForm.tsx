"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { checkoutToolAction } from "@/app/actions/tools";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";

export function CheckoutForm({ toolId, maxQty }: { toolId: string; maxQty: number }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await checkoutToolAction(toolId, fd);
      if (result.success) router.refresh();
      else setError(result.error ?? "Failed.");
    });
  }

  // Default return = 7 days from now
  const defaultReturn = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="text-sm text-[--color-danger] bg-[--color-danger]/10 rounded px-3 py-2">{error}</div>}
      <div className="grid grid-cols-2 gap-4">
        <Field label="Quantity" name="quantity" type="number" min="1" max={maxQty} defaultValue={1} required />
        <Field label="Expected return" name="expectedReturn" type="date" defaultValue={defaultReturn} required />
      </div>
      <Field label="Intended use" name="intendedUse" placeholder="What will you use it for?" />
      <Button type="submit" isLoading={isPending}>Check out</Button>
    </form>
  );
}
