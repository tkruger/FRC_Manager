"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { awardCertificationAction } from "@/app/actions/safety";
import { Dialog, DialogContent, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";

interface Props {
  members: { id: string; name: string }[];
  certNames: string[];
}

export function AwardCertDialog({ members, certNames }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [customCert, setCustomCert] = useState("");
  const [selectedCert, setSelectedCert] = useState("");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    if (customCert) fd.set("certName", customCert);
    startTransition(async () => {
      const result = await awardCertificationAction(fd);
      if (result.success) { setOpen(false); router.refresh(); }
      else setError(result.error ?? "Failed.");
    });
  }

  const memberOpts = members.map((m) => ({ value: m.id, label: m.name }));
  const certOpts = certNames.map((c) => ({ value: c, label: c }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm">+ Award certification</Button></DialogTrigger>
      <DialogContent title="Award certification">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="text-sm text-[--color-danger] bg-[--color-danger]/10 rounded px-3 py-2">{error}</div>}
          <Select label="Member" name="userId" required options={memberOpts} placeholder="Select member" />
          <div>
            <Select label="Certification" name="certName" options={certOpts} placeholder="Select existing…"
              value={selectedCert} onChange={(e) => { setSelectedCert(e.target.value); setCustomCert(""); }} />
            <p className="text-small text-[--color-text-secondary] mt-1">or enter a custom name:</p>
            <input type="text" value={customCert} onChange={(e) => { setCustomCert(e.target.value); setSelectedCert(""); }}
              placeholder="Custom certification name"
              className="mt-1 flex h-10 w-full rounded-md border border-[--color-border] bg-[--color-surface] px-3 py-2 text-sm text-[--color-text-primary] focus:border-[--color-primary] focus:outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Certified on" name="certifiedAt" type="date" required defaultValue={new Date().toISOString().split("T")[0]} />
            <Field label="Expires (optional)" name="expiresAt" type="date" />
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="submit" isLoading={isPending}>Award</Button>
            <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
