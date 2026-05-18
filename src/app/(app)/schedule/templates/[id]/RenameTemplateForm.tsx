"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateTemplateAction } from "@/app/actions/templates";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";

interface Props { templateId: string; currentName: string; currentDescription: string | null; }

export function RenameTemplateForm({ templateId, currentName, currentDescription }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      await updateTemplateAction(templateId, fd);
      setEditing(false);
      router.refresh();
    });
  }

  if (!editing) {
    return (
      <div className="flex items-start gap-3">
        <div>
          <h1 className="text-h1 text-[--color-text-primary]">{currentName}</h1>
          {currentDescription && <p className="text-body text-[--color-text-secondary] mt-1">{currentDescription}</p>}
        </div>
        <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="mt-1 shrink-0">
          Rename
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Field label="Template name" name="name" required defaultValue={currentName} />
      <Textarea label="Description" name="description" rows={2} defaultValue={currentDescription ?? ""} />
      <div className="flex gap-2">
        <Button type="submit" size="sm" isLoading={isPending}>Save</Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
      </div>
    </form>
  );
}
