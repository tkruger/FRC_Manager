"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { fileIncidentAction } from "@/app/actions/safety";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const SEVERITY_OPTS = [
  { value: "NEAR_MISS",           label: "Near miss — no injury, but could have been" },
  { value: "MINOR_INJURY",        label: "Minor injury — first aid only" },
  { value: "SIGNIFICANT_INJURY",  label: "Significant injury — medical attention required" },
];

export function IncidentForm() {
  const router = useRouter();
  const [state, action, pending] = useActionState(fileIncidentAction, null);

  useEffect(() => {
    if (state?.success) router.push("/safety");
  }, [state, router]);

  return (
    <form action={action} className="space-y-6">
      {state && !state.success && (
        <div className="rounded-md bg-[--color-danger]/10 border border-[--color-danger]/20 px-4 py-3 text-sm text-[--color-danger]">{state.error}</div>
      )}
      <div className="card space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Incident date" name="incidentDate" type="date" required defaultValue={new Date().toISOString().split("T")[0]} />
          <Select label="Severity" name="severity" required options={SEVERITY_OPTS} />
        </div>
        <Textarea label="Description" name="description" required rows={4}
          placeholder="What happened? Where? What were you doing? Be specific." />
        <Field label="Tool or material involved" name="toolOrMaterial" placeholder='e.g. Angle grinder, aluminum extrusion' />
        <Field label="People involved / witnesses" name="peopleInvolved" placeholder="Names of those involved or who witnessed it" />
      </div>
      <div className="card space-y-4">
        <h2 className="text-h3 text-[--color-text-primary]">Response</h2>
        <Textarea label="Immediate action taken" name="immediateAction" rows={2}
          placeholder='e.g. Applied first aid, stopped work, notified mentor' />
        <Textarea label="Corrective action planned" name="correctiveAction" rows={2}
          placeholder='e.g. Will add guard to machine, retrain all students on procedure' />
      </div>
      <div className="flex gap-3">
        <Button type="submit" isLoading={pending}>Submit report</Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
      </div>
    </form>
  );
}
