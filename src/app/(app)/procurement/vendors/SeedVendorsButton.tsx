"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { seedFrcVendorsAction } from "@/app/actions/vendor";
import { Button } from "@/components/ui/button";

export function SeedVendorsButton({ label = "Import FRC vendors" }: { label?: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleSeed() {
    startTransition(async () => {
      const result = await seedFrcVendorsAction();
      if (result.success) router.refresh();
    });
  }

  return (
    <Button variant="outline" size="sm" onClick={handleSeed} isLoading={isPending}>
      {label}
    </Button>
  );
}
