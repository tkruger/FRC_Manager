"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, formatTime12 } from "@/lib/utils";
import { EditSeasonForm } from "./EditSeasonForm";
import { RobotForm } from "./RobotForm";
import { CompetitionsSection, type Competition } from "./CompetitionsSection";
import { EditRobotDialog } from "@/components/fleet/EditRobotDialog";

interface Robot {
  id: string;
  year: number;
  name: string;
  displayName: string;
  role: string;
  status: string;
  description: string | null;
  weightTarget: number | null;
}

interface Season {
  id: string;
  name: string;
  year: number;
  kickoffDate: Date;
  endDate: Date;
  /** The season has started, so its start date can't change */
  startLocked: boolean;
  meetingDays: string[];
  meetingStartTime: string;
  meetingEndTime: string;
  meetingDayTimes: Record<string, { start: string; end: string }> | null;
  expectedAttendance: number;
  robots: Robot[];
  competitions: Competition[];
}

const WEEK_ORDER = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const DAY_SHORT: Record<string, string> = { MON: "Mon", TUE: "Tue", WED: "Wed", THU: "Thu", FRI: "Fri", SAT: "Sat", SUN: "Sun" };

/** Full season card. Also used for past seasons (isActive=false) on /settings/season/[id]. */
export function ActiveSeasonCard({
  season, canEdit = false, isActive = true,
}: { season: Season; canEdit?: boolean; isActive?: boolean }) {
  const [editing, setEditing] = useState(false);

  return (
    <div className={`card border-l-4 ${isActive ? "border-l-(--color-success)" : "border-l-(--color-border-strong)"}`}>
      {!editing ? (
        <>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-h3 text-[--color-text-primary]">{season.name}</h2>
                {isActive ? <Badge variant="success">Active</Badge> : <Badge variant="neutral">Past season</Badge>}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-1 text-small text-(--color-text-secondary) mt-2">
                <span>Starts: <strong className="text-(--color-text-primary)">{formatDate(season.kickoffDate)}</strong></span>
                <span>Ends: <strong className="text-(--color-text-primary)">{formatDate(season.endDate)}</strong></span>
                <span>Attendance: <strong className="text-(--color-text-primary)">{season.expectedAttendance}</strong></span>
              </div>

              {/* Every meeting day with its own times */}
              <div className="mt-3">
                <p className="text-small text-(--color-text-secondary) mb-1">Meeting schedule</p>
                {season.meetingDays.length === 0 ? (
                  <p className="text-small text-(--color-text-secondary)">No meeting days set.</p>
                ) : (
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-0.5 text-small">
                    {WEEK_ORDER.filter((d) => season.meetingDays.includes(d)).map((d) => {
                      const t = season.meetingDayTimes?.[d] ?? { start: season.meetingStartTime, end: season.meetingEndTime };
                      return (
                        <li key={d} className="flex gap-3">
                          <span className="w-10 font-medium text-(--color-text-primary)">{DAY_SHORT[d]}</span>
                          <span className="text-(--color-text-primary)">{formatTime12(t.start)} – {formatTime12(t.end)}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
            {canEdit && (
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                Edit
              </Button>
            )}
          </div>

          {/* Robots */}
          <div className="mt-5 pt-4 border-t border-[--color-border]">
            <h3 className="text-h3 text-[--color-text-primary] mb-3">{isActive ? "Robots this season" : "Robots"}</h3>
            {season.robots.length === 0 ? (
              <p className="text-small text-[--color-text-secondary]">No robots added yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                {season.robots.map((r) => (
                  <div key={r.id} className="rounded-md border border-[--color-border] bg-[--color-surface] px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-[--color-text-primary]">{r.displayName}</p>
                      <p className="text-small text-[--color-text-secondary]">{r.role.replace(/_/g, " ")}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge variant={r.status === "ACTIVE_BUILD" ? "info" : r.status === "ACTIVE_COMPETITION_READY" ? "success" : "neutral"}>
                        {r.status.replace(/_/g, " ")}
                      </Badge>
                      {canEdit && <EditRobotDialog robot={r} />}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {canEdit && <RobotForm seasonId={season.id} />}
          </div>

          <CompetitionsSection seasonId={season.id} competitions={season.competitions} canEdit={canEdit} />
        </>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-h3 text-[--color-text-primary]">Edit season</h2>
            {isActive ? <Badge variant="success">Active</Badge> : <Badge variant="neutral">Past season</Badge>}
          </div>
          <EditSeasonForm season={season} onClose={() => setEditing(false)} />
        </>
      )}
    </div>
  );
}
