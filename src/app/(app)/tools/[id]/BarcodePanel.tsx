"use client";

import QRCode from "react-qr-code";
import { Button } from "@/components/ui/button";

interface Props {
  toolId:   string;
  toolName: string;
  assetTag: string | null;
}

export function BarcodePanel({ toolId, assetTag }: Props) {
  // The scan page looks up by assetTag OR id
  const codeValue = assetTag ?? toolId;

  function downloadSvg() {
    const svg  = document.getElementById("tool-qr-svg")?.outerHTML;
    if (!svg) return;
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `tool-${codeValue.replace(/[^A-Za-z0-9-]+/g, "_")}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-h3 text-(--color-text-primary)">Barcode</h2>
        <Button type="button" variant="outline" size="sm" onClick={downloadSvg}>Download SVG</Button>
      </div>

      <div className="flex flex-col items-center gap-3 py-2">
        <div className="p-3 bg-white rounded-lg inline-block">
          <QRCode
            id="tool-qr-svg"
            value={codeValue}
            size={160}
            level="M"
          />
        </div>
        <div className="text-center">
          <p className="text-mono text-sm text-(--color-text-primary)">{codeValue}</p>
          <p className="text-small text-(--color-text-secondary) mt-0.5">
            Scan to check in / out
          </p>
        </div>
      </div>
    </div>
  );
}
