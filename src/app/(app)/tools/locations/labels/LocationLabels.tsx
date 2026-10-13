"use client";

import QRCode from "react-qr-code";
import { Button } from "@/components/ui/button";

export function LocationLabels({ locations }: { locations: { id: string; name: string; code: string }[] }) {
  if (locations.length === 0) {
    return <div className="card text-center py-10 text-body text-(--color-text-secondary)">No locations to print.</div>;
  }
  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <p className="text-body text-(--color-text-secondary)">
          {locations.length === 1 ? "1 label" : `${locations.length} labels`} — stick each one where the scanner can see it.
        </p>
        <Button onClick={() => window.print()}>Print</Button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 print:grid-cols-3 print:gap-3">
        {locations.map((l) => (
          <div key={l.id} className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-(--color-border-strong) bg-white p-4 text-black break-inside-avoid">
            <QRCode value={l.code} size={128} level="M" />
            <p className="text-center text-sm font-bold leading-tight">{l.name}</p>
            <p className="font-mono text-xs text-gray-600">{l.code}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
