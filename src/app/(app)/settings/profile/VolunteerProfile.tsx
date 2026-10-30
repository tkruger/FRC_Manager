"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { savePhoneAction } from "@/app/actions/volunteers";

/** Volunteering: your clearance (set by a Head Mentor) and a phone number for the coordinator */
export function VolunteerProfile({ phone, status }: { phone: string | null; status: string }) {
  const router = useRouter();
  const [value, setValue] = useState(phone ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const changed = value.trim() !== (phone ?? "");

  return (
    <section className="card space-y-4">
      <div>
        <h2 className="text-h3 text-(--color-text-primary)">Volunteering</h2>
        <p className="text-small text-(--color-text-secondary) mt-0.5">{status} <Link href="/volunteers" className="text-(--color-primary) hover:underline">Volunteers →</Link></p>
      </div>
      <form className="space-y-2" onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const res = await savePhoneAction(value);
          if (!res.success) { setError(res.error); return; }
          toast.success(value.trim() ? "Phone number saved" : "Phone number removed");
          router.refresh();
        });
      }}>
        <label className="block space-y-1.5">
          <span className="block text-sm font-medium text-(--color-text-primary)">Phone <span className="font-normal text-(--color-text-secondary)">(optional — only volunteer coordinators and Head Mentors see it)</span></span>
          <div className="flex gap-2">
            <input type="tel" autoComplete="tel" value={value} onChange={(e) => setValue(e.target.value)} placeholder="(555) 123-4567"
              className="h-10 w-full max-w-xs rounded-md border border-(--color-border) bg-(--color-surface) px-3 text-sm text-(--color-text-primary) focus:border-(--color-primary) focus:outline-none" />
            {changed && <Button type="submit" size="sm" isLoading={pending}>Save</Button>}
          </div>
        </label>
        {error && <p className="text-sm text-(--color-danger)">{error}</p>}
      </form>
    </section>
  );
}
