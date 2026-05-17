"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { EditSeasonForm } from "./EditSeasonForm";
import { RobotForm } from "./RobotForm";

interface Robot {
  id: string;
  displayName: string;
  role: string;
  status: string;
}

interface Season {
  id: string;
  name: string;
  year: number;
  kickoffDate: Date;
  week0Date: Date;
  meetingDays: string[];
  meetingStartTime: string;
  meetingEndTime: string;
  expectedAttendance: number;
  robots: Robot[];
}

export function ActiveSeasonCard({ season }: { season: Season }) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="card border-l-4 border-l-[--color-success]">
      {!editing ? (
        <>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-h3 text-[--color-text-primary]">{season.name}</h2>
                <Badge variant="success">Active</Badge>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-1 text-small text-[--color-text-secondary] mt-2">
                <span>Kickoff: <strong className="text-[--color-text-primary]">{formatDate(season.kickoffDate)}</strong></span>
                <span>Week 0: <strong className="text-[--color-text-primary]">{formatDate(season.week0Date)}</strong></span>
                <span>Meeting days: <strong className="text-[--color-text-primary]">{season.meetingDays.join(", ")}</strong></span>
                <span>Start time: <strong className="text-[--color-text-primary]">{season.meetingStartTime}</strong></span>
                <span>End time: <strong className="text-[--color-text-primary]">{season.meetingEndTime}</strong></span>
                <span>Attendance: <strong className="text-[--color-text-primary]">{season.expectedAttendance}</strong></span>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              Edit
            </Button>
          </div>

          {/* Robots */}
          <div className="mt-5 pt-4 border-t border-[--color-border]">
            <h3 className="text-h3 text-[--color-text-primary] mb-3">Robots this season</h3>
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
                    <Badge variant={r.status === "ACTIVE_BUILD" ? "info" : r.status === "ACTIVE_COMPETITION_READY" ? "success" : "neutral"}>
                      {r.status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
            <RobotForm seasonId={season.id} />
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-h3 text-[--color-text-primary]">Edit season</h2>
            <Badge variant="success">Active</Badge>
          </div>
          <EditSeasonForm season={season} onClose={() => setEditing(false)} />
        </>
      )}
    </div>
  );
}
