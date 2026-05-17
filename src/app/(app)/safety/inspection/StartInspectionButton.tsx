"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createInspectionChecklistAction } from "@/app/actions/safety";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";

export function StartInspectionButton({ robots }: { robots: { id: string; displayName: string }[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [eventName, setEventName] = useState("");
  const [robotId, setRobotId] = useState(robots[0]?.id ?? "");

  function handle() {
    if (!robotId) return;
    startTransition(async () => {
      const result = await createInspectionChecklistAction(robotId, eventName || "Self-check");
      if (result.success && result.checklistId) {
        router.push(`/safety/inspection?checklistId=${result.checklistId}`);
      }
    });
  }

  return (
    <div className="flex gap-3 items-end">
      {robots.length > 1 && (
        <Select label="Robot" options={robots.map((r) => ({ value: r.id, label: r.displayName }))}
          value={robotId} onChange={(e) => setRobotId(e.target.value)} className="w-48" />
      )}
      <Field label="Event name" value={eventName} onChange={(e) => setEventName(e.target.value)}
        placeholder='e.g. Week 1 — Newton Field' className="flex-1" />
      <Button onClick={handle} isLoading={isPending} disabled={!robotId} className="mb-6">
        Start checklist
      </Button>
    </div>
  );
}
