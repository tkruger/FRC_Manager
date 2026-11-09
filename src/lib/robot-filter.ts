// The robot filter on Tasks and the Gantt chart (remembered per device). Server-only.
//
// Only robots being worked on count: in build or competition-ready (not retired or decommissioned).
// With two or more of those there's a choice to make, so the filter shows. With exactly one, that
// robot is used without asking; with none, nothing is filtered.

import { prisma } from "@/lib/prisma";
import { getActiveRobotId } from "@/app/actions/robot-context";
import type { RobotStatus } from "@/generated/prisma";

/** Robots that are being built or are ready to compete */
export const WORKING_ROBOT_STATUSES: RobotStatus[] = ["ACTIVE_BUILD", "ACTIVE_COMPETITION_READY"];

export interface RobotFilter {
  /** Robots to choose from (empty: don't show the filter) */
  robots: { id: string; displayName: string }[];
  /** The chosen robot — or the only working one */
  robotId: string | null;
}

export async function robotFilter(seasonId: string): Promise<RobotFilter> {
  const [robots, saved] = await Promise.all([
    prisma.robot.findMany({
      where: { seasonId, archived: false, status: { in: WORKING_ROBOT_STATUSES } },
      orderBy: { createdAt: "asc" }, select: { id: true, displayName: true },
    }),
    getActiveRobotId(),
  ]);
  if (robots.length === 1) return { robots: [], robotId: robots[0].id };
  if (robots.length < 2) return { robots: [], robotId: null };
  return { robots, robotId: robots.some((r) => r.id === saved) ? saved : null };
}
