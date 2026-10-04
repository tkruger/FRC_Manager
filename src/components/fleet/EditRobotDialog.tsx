"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateRobotAction } from "@/app/actions/fleet";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogClose } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";

const ROLE_OPTIONS = [
  { value: "COMPETITION", label: "Competition Bot" },
  { value: "PRACTICE",    label: "Practice Bot (Beta)" },
  { value: "DEMO",        label: "Demo Bot" },
  { value: "RETIRED",     label: "Retired" },
  { value: "OTHER",       label: "Other" },
];

const STATUS_OPTIONS = [
  { value: "ACTIVE_BUILD",             label: "In build" },
  { value: "ACTIVE_COMPETITION_READY", label: "Competition ready" },
  { value: "RETIRED_DISPLAY",          label: "Retired — on display" },
  { value: "RETIRED_STORAGE",          label: "Retired — in storage" },
  { value: "DECOMMISSIONED",           label: "Decommissioned" },
];

interface Props {
  robot: {
    id:           string;
    year:         number;
    name:         string;
    role:         string;
    status:       string;
    description:  string | null;
    weightTarget: number | null;
  };
}

export function EditRobotDialog({ robot }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(robot.name);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await updateRobotAction(robot.id, formData);
      if (result.success) {
        toast.success("Robot saved");
        setOpen(false);
        router.refresh();
      } else {
        setError(result.error ?? "Couldn't save the robot.");
      }
    });
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => { setName(robot.name); setError(null); setOpen(true); }}>
        Edit robot
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Edit robot">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="text-sm text-(--color-danger) bg-(--color-danger)/10 rounded px-3 py-2">{error}</div>
            )}
            <Field
              label="Robot name"
              name="name"
              required
              maxLength={60}
              value={name}
              onChange={(e) => setName(e.target.value)}
              hint={`Shown as “${robot.year} ${name.trim() || "…"}”`}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select label="Role" name="role" required options={ROLE_OPTIONS} defaultValue={robot.role} />
              <Select label="Status" name="status" required options={STATUS_OPTIONS} defaultValue={robot.status} />
            </div>
            <Field
              label="Weight target (lbs)"
              name="weightTarget"
              type="number"
              min="1"
              step="0.1"
              placeholder="115"
              defaultValue={robot.weightTarget ?? ""}
              hint="Leave blank to use the default 115 lb limit"
            />
            <Textarea
              label="Description"
              name="description"
              rows={3}
              maxLength={1000}
              defaultValue={robot.description ?? ""}
              placeholder="Optional — game, drivetrain, notable features…"
            />
            <div className="flex gap-2 pt-2">
              <Button type="submit" isLoading={isPending}>Save changes</Button>
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancel</Button>
              </DialogClose>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
