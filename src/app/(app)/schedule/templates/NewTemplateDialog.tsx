"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createTemplateAction } from "@/app/actions/templates";
import { Dialog, DialogContent, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";

export function NewTemplateDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createTemplateAction, null);

  useEffect(() => {
    if (state?.success && state.id) {
      setOpen(false);
      router.push(`/schedule/templates/${state.id}`);
    }
  }, [state, router]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">+ New template</Button>
      </DialogTrigger>
      <DialogContent title="Create template" description="Give your template a name, then add tasks on the next screen.">
        <form action={action} className="space-y-4">
          {state && !state.success && (
            <div className="text-sm text-[--color-danger] bg-[--color-danger]/10 rounded px-3 py-2">{state.error}</div>
          )}
          <Field label="Template name" name="name" required placeholder='e.g. "2026 Offseason Build"' />
          <Textarea label="Description" name="description" rows={2} placeholder="Optional — what is this template for?" />
          <div className="flex gap-2 pt-2">
            <Button type="submit" isLoading={pending}>Create & add tasks →</Button>
            <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
