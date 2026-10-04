import Link from "next/link";

interface Season {
  id: string;
  name: string;
  year: number;
  robotCount: number;
  taskCount: number;
  taskComplete: number;
}

/** List of past seasons; each opens its full page at /settings/season/[id]. */
export function PastSeasonsCard({ seasons }: { seasons: Season[] }) {
  return (
    <div className="card">
      <h2 className="text-h3 text-(--color-text-primary) mb-3">Past seasons</h2>
      <div className="divide-y divide-(--color-border)/60">
        {seasons.map((s) => {
          const pct = s.taskCount > 0 ? Math.round((s.taskComplete / s.taskCount) * 100) : 0;
          return (
            <Link
              key={s.id}
              href={`/settings/season/${s.id}`}
              className="w-full flex items-center justify-between py-3 text-left hover:bg-(--color-surface-overlay) -mx-5 px-5 transition-colors group first:rounded-t-md last:rounded-b-md"
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-(--color-text-primary) group-hover:text-(--color-primary) transition-colors">
                  {s.name}
                </span>
                <span className="text-small text-(--color-text-secondary)">{s.year}</span>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                {s.taskCount > 0 && (
                  <span className="hidden sm:inline text-small text-(--color-text-secondary)">{pct}% tasks done</span>
                )}
                <span className="hidden sm:inline text-small text-(--color-text-secondary)">
                  {s.robotCount} robot{s.robotCount !== 1 ? "s" : ""}
                </span>
                <span className="text-small text-(--color-secondary)">Open →</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
