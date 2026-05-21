import { cn } from "@/lib/utils";

export function Table({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("w-full overflow-x-auto rounded-lg border border-[--color-table-border]", className)}>
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

export function TableHead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="border-b border-[--color-table-border] bg-[--color-surface-raised]">
      {children}
    </thead>
  );
}

export function TableBody({ children }: { children: React.ReactNode }) {
  return <tbody className="bg-[--color-surface] divide-y divide-[--color-table-border]">{children}</tbody>;
}

export function Th({ children, className, right }: { children?: React.ReactNode; className?: string; right?: boolean }) {
  return (
    <th className={cn(
      "px-4 py-3 text-left text-label font-medium text-[--color-text-secondary] uppercase tracking-wide whitespace-nowrap",
      right && "text-right",
      className
    )}>
      {children}
    </th>
  );
}

export function Td({ children, className, right, mono, colSpan }: { children?: React.ReactNode; className?: string; right?: boolean; mono?: boolean; colSpan?: number }) {
  return (
    <td colSpan={colSpan} className={cn(
      "px-4 py-3 text-[--color-text-primary] whitespace-nowrap",
      right && "text-right tabular-nums",
      mono && "font-mono text-xs",
      className
    )}>
      {children}
    </td>
  );
}

export function Tr({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <tr className={cn("frc-tr transition-colors", className)}>
      {children}
    </tr>
  );
}
