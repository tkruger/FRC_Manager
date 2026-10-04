"use client";

import { useState } from "react";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import {
  ANCHOR_OPTIONS, STAGE_INFO, describeAnchor, isCompetitionAnchor, legacyAnchor, type TaskAnchor,
} from "@/lib/competition";

/** "When does this task start?" — anchor, optional competition number, and day offset. */
export function AnchorFields({
  anchor: initialAnchor, anchorNumber: initialNumber, startOffset: initialOffset = 0,
}: { anchor?: TaskAnchor; anchorNumber?: number | null; startOffset?: number }) {
  const [anchor, setAnchor] = useState<TaskAnchor>(initialAnchor ?? legacyAnchor(initialOffset));
  const [number, setNumber] = useState(initialNumber != null ? String(initialNumber) : "");
  const [offset, setOffset] = useState(String(initialOffset));

  const numbered = isCompetitionAnchor(anchor) && STAGE_INFO[anchor].numbered;
  const preview  = describeAnchor(anchor, numbered && number !== "" ? Number(number) : null, Number(offset) || 0);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_1fr] gap-4">
        <Select
          label="Starts relative to"
          name="anchor"
          options={ANCHOR_OPTIONS}
          value={anchor}
          onChange={(e) => setAnchor(e.target.value as TaskAnchor)}
        />
        {numbered ? (
          <Field
            label={`${STAGE_INFO[anchor as keyof typeof STAGE_INFO].prefix} #`}
            name="anchorNumber"
            type="number"
            min="0"
            max="99"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder="Each"
            hint="Blank = every one"
          />
        ) : <div className="hidden sm:block" />}
        <Field
          label="Days"
          name="startOffset"
          type="number"
          required
          value={offset}
          onChange={(e) => setOffset(e.target.value)}
          hint="− before, + after"
        />
      </div>
      <p className="text-small text-(--color-text-secondary)">
        Starts: <span className="font-medium text-(--color-text-primary)">{preview}</span>
        {numbered && number === "" && " — one task is created for each, named after it (e.g. “… — Week1”)."}
        {isCompetitionAnchor(anchor) && " Skipped if the season has no matching competition."}
      </p>
    </div>
  );
}
