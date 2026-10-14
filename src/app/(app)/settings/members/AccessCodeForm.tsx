"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateTeamAccessCodeAction } from "@/app/actions/members";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";

export function AccessCodeForm({ currentCode }: { currentCode: string }) {
  const router = useRouter();
  const [code, setCode] = useState(currentCode);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function save(generate: boolean) {
    startTransition(async () => {
      const res = await updateTeamAccessCodeAction(code, generate);
      if (!res.success) { toast.error(res.error ?? "Couldn't save."); return; }
      if (generate) setCode(res.code ?? "");
      toast.success(generate ? "New access code generated" : "Access code saved");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      router.refresh();
    });
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); save(false); }} className="space-y-2">
      <div className="flex flex-wrap gap-3 items-end">
        <Field
          label="Access code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Leave blank to turn off"
          maxLength={64}
          hint="Anyone with this code joins as an approved Team Member. At least 12 characters; case-sensitive."
          className="flex-1 min-w-[12rem]"
        />
        <div className="flex gap-2 mb-6">
          <Button type="button" size="sm" variant="outline" isLoading={isPending} onClick={() => save(true)}>Generate</Button>
          <Button type="submit" size="sm" isLoading={isPending}>{saved ? "Saved ✓" : "Save"}</Button>
        </div>
      </div>
    </form>
  );
}
