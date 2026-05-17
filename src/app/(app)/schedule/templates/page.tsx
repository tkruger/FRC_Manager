import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ApplyTemplateButton } from "./ApplyTemplateButton";
import { shortDate } from "@/lib/schedule-helpers";

const STANDARD_MILESTONES = [
  { name: "Game Analysis Complete",                offset: "Kickoff + 2d",  team: "Strategy"    },
  { name: "Robot Strategy & Design Brief",         offset: "Kickoff + 5d",  team: "Design"      },
  { name: "Subsystem Design Reviews Complete",     offset: "Kickoff + 10d", team: "Mechanical"  },
  { name: "Prototyping Complete",                  offset: "Kickoff + 14d", team: "Mechanical"  },
  { name: "Full Robot CAD Complete",               offset: "Kickoff + 18d", team: "Design"      },
  { name: "Drivetrain Assembled & Driving",        offset: "Week 0 − 21d",  team: "Mechanical"  },
  { name: "All Subsystems Integrated",             offset: "Week 0 − 14d",  team: "Mechanical"  },
  { name: "Robot Driving with Full Functionality", offset: "Week 0 − 10d",  team: "Programming" },
  { name: "Driver Practice Begins",               offset: "Week 0 − 7d",   team: "Drive Team"  },
  { name: "Robot Weight Confirmed Under Limit",   offset: "Week 0 − 5d",   team: "Mechanical"  },
  { name: "BOM Complete & Reviewed",              offset: "Week 0 − 3d",   team: "Operations"  },
  { name: "Robot Documentation Complete",         offset: "Week 0 − 2d",   team: "Operations"  },
  { name: "Week 0 — Robot Done",                  offset: "Week 0",        team: "All"         },
];

export default async function TemplatesPage() {
  const session = await auth();
  if (!session?.user?.teamId) redirect("/dashboard");

  const activeSeason = await prisma.season.findFirst({
    where: { teamId: session.user.teamId, isActive: true },
  });

  const taskCount = activeSeason
    ? await prisma.task.count({ where: { seasonId: activeSeason.id } })
    : 0;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <nav className="text-small text-[--color-text-secondary] mb-1">
          <Link href="/schedule" className="hover:text-[--color-primary]">Schedule</Link>
          <span className="mx-2">›</span>Templates
        </nav>
        <h1 className="text-h1 text-[--color-text-primary]">Season templates</h1>
        <p className="text-body text-[--color-text-secondary] mt-1">
          Apply a task template to instantly populate your build season schedule.
        </p>
      </div>

      {/* Standard FRC template */}
      <div className="card space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-h2 text-[--color-text-primary]">Standard 6-Week FRC Build Season</h2>
            <p className="text-body text-[--color-text-secondary] mt-1">
              {STANDARD_MILESTONES.length} milestones + {22 - STANDARD_MILESTONES.length} supporting tasks, anchored to your kickoff and Week 0 dates.
              Missing tasks are added; existing tasks are never overwritten.
            </p>
            {activeSeason && (
              <p className="text-small text-[--color-text-secondary] mt-2">
                Kickoff: <strong>{shortDate(activeSeason.kickoffDate)}</strong> · Week 0: <strong>{shortDate(activeSeason.week0Date)}</strong>
              </p>
            )}
          </div>
          <ApplyTemplateButton disabled={!activeSeason} existingTaskCount={taskCount} />
        </div>

        {/* Milestone preview */}
        <div className="border border-[--color-border] rounded-md overflow-hidden">
          <div className="bg-[--color-surface-raised] px-4 py-2 border-b border-[--color-border]">
            <p className="text-label font-medium text-[--color-text-secondary]">Milestones included</p>
          </div>
          <div className="divide-y divide-[--color-border]">
            {STANDARD_MILESTONES.map((m) => (
              <div key={m.name} className="flex items-center justify-between px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-[--color-primary] text-xs">◆</span>
                  <span className="text-sm text-[--color-text-primary]">{m.name}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Badge variant="neutral">{m.team}</Badge>
                  <span className="text-small text-[--color-text-secondary] font-mono">{m.offset}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Current tasks summary */}
      {activeSeason && taskCount > 0 && (
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-h3 text-[--color-text-primary]">Current season tasks</h3>
              <p className="text-small text-[--color-text-secondary] mt-0.5">{taskCount} tasks in {activeSeason.name}</p>
            </div>
            <Link href="/schedule/tasks" className="text-small text-[--color-secondary] hover:underline">View all →</Link>
          </div>
        </div>
      )}
    </div>
  );
}
