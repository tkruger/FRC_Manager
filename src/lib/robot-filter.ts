// The robot filter on Tasks and the Gantt chart (remembered per device). Server-only.
//
// It only applies when the season has more than one robot: with one (or none) there's nothing
// to choose, so a remembered choice is ignored and no filter is shown.

import { prisma } from "@/lib/prisma";
import { getActiveRobotId } from "@/app/actions/robot-context";

export interface RobotFilter {
  /** Robots to choose from (empty: don't show the filter) */
  robots: { id: string; displayName: string }[];
  /** The chosen robot, if it's one of them */
  robotId: string | null;
}

export async function robotFilter(seasonId: string): Promise<RobotFilter> {
  const [robots, saved] = await Promise.all([
    prisma.robot.findMany({ where: { seasonId, archived: false }, orderBy: { createdAt: "asc" }, select: { id: true, displayName: true } }),
    getActiveRobotId(),
  ]);
  if (robots.length < 2) return { robots: [], robotId: null };
  return { robots, robotId: robots.some((r) => r.id === saved) ? saved : null };
}
