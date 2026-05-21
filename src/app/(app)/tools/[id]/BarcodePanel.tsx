"use client";

import QRCode from "react-qr-code";

interface Props {
  toolId:   string;
  toolName: string;
  assetTag: string | null;
}

export function BarcodePanel({ toolId, toolName, assetTag }: Props) {
  // The scan page looks up by assetTag OR id
  const codeValue = assetTag ?? toolId;

  function printBarcode() {
    const win = window.open("", "_blank", "width=400,height=500");
    if (!win) return;
    const svg = document.getElementById("tool-qr-svg")?.outerHTML ?? "";
    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Barcode — ${toolName}</title>
  <style>
    body { margin: 0; display: flex; flex-direction: column; align-items: center;
           justify-content: center; min-height: 100vh; font-family: sans-serif; padding: 24px; }
    svg { width: 180px; height: 180px; }
    h1  { font-size: 14px; font-weight: 700; margin: 12px 0 4px; text-align: center; }
    p   { font-size: 11px; color: #555; margin: 0; text-align: center; font-family: monospace; }
    @media print {
      @page { margin: 0; }
    }
  </style>
</head>
<body>
  ${svg}
  <h1>${toolName}</h1>
  <p>${codeValue}</p>
  <script>window.onload = () => { window.print(); window.close(); }</script>
</body>
</html>`);
    win.document.close();
  }

  function downloadSvg() {
    const svg  = document.getElementById("tool-qr-svg")?.outerHTML;
    if (!svg) return;
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `tool-${codeValue}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-h3 text-[--color-text-primary]">Barcode</h2>
        <div className="flex gap-2">
          <button
            onClick={downloadSvg}
            className="text-sm text-[--color-text-secondary] hover:text-[--color-text-primary] transition-colors px-2 py-1 rounded hover:bg-[--color-surface-overlay]"
          >
            Download SVG
          </button>
          <button
            onClick={printBarcode}
            className="text-sm font-medium px-3 py-1.5 rounded-lg border border-[--color-border] hover:border-[--color-border-strong] text-[--color-text-secondary] hover:text-[--color-text-primary] transition-colors"
          >
            Print barcode
          </button>
        </div>
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
          <p className="text-mono text-sm text-[--color-text-primary]">{codeValue}</p>
          <p className="text-small text-[--color-text-secondary] mt-0.5">
            Scan to check in / out
          </p>
        </div>
      </div>
    </div>
  );
}
