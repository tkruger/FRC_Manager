"use client";

export function RobotSwitcher({
  robots,
  currentId,
}: {
  robots: { id: string; displayName: string }[];
  currentId: string;
}) {
  return (
    <select
      className="h-9 rounded-md border border-[--color-border] bg-[--color-surface] px-3 text-sm text-[--color-text-primary] focus:outline-none"
      value={currentId}
      onChange={(e) => {
        window.location.href = `/budget/bom?robotId=${e.target.value}`;
      }}
    >
      {robots.map((r) => (
        <option key={r.id} value={r.id}>{r.displayName}</option>
      ))}
    </select>
  );
}
