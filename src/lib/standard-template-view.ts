// The standard template as timeline tasks (for the templates page and its presentation)

import { STANDARD_TASKS } from "@/lib/standard-template";
import type { TimelineTask } from "@/lib/template-timeline";

export function standardTimelineTasks(): TimelineTask[] {
  return STANDARD_TASKS.map((t, i) => ({
    id: `standard-${i}`, name: t.name, subTeam: t.subTeam, priority: t.priority, isMilestone: t.isMilestone,
    anchor: t.anchor, anchorNumber: t.anchorNumber ?? null, anchorTaskName: t.anchorTaskName ?? null,
    startOffset: t.startOffset, durationBuildDays: t.durationBuildDays,
    estimatedHours: t.estimatedHours ?? null, designReviewRequired: t.designReviewRequired,
    prerequisiteNames: t.prerequisiteNames, description: t.description ?? null,
  }));
}
