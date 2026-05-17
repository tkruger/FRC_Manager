"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateTeamAccessCodeAction } from "@/app/actions/members";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";

export function AccessCodeForm({ currentCode }: { currentCode: string }) {
  const router = useRouter();
  const [code, setCode] = useState(currentCode);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      await updateTeamAccessCodeAction(code);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSave} className="flex gap-3 items-end">
      <Field
        label="Access code"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Leave blank to disable"
        hint="Case-sensitive. Share with students at onboarding events."
        className="flex-1"
      />
      <Button type="submit" size="sm" isLoading={isPending} className="mb-6">
        {saved ? "Saved ✓" : "Save"}
      </Button>
    </form>
  );
}
