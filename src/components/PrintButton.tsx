"use client";

import { Button } from "@/components/ui/button";

/** Opens the browser's print dialog (pages hide their chrome with the print styles in globals.css) */
export function PrintButton({ label = "Print" }: { label?: string }) {
  return <Button variant="outline" size="sm" className="no-print" onClick={() => window.print()}>{label}</Button>;
}
