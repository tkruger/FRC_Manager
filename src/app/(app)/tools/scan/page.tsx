import Link from "next/link";
import { ScanClient } from "./ScanClient";
import { Button } from "@/components/ui/button";

export default function ToolScanPage() {
  return (
    <div className="max-w-md mx-auto px-4 py-8 space-y-6">
      <div>
        <nav className="text-small text-[--color-text-secondary] mb-1">
          <Link href="/tools" className="hover:text-[--color-primary]">Tools</Link>
          <span className="mx-2">›</span>Scan
        </nav>
        <h1 className="text-h1 text-[--color-text-primary]">Scan tool</h1>
        <p className="text-body text-[--color-text-secondary] mt-1">
          Point your camera at a tool&apos;s QR code or barcode to instantly check out or check in.
        </p>
      </div>
      <ScanClient />
    </div>
  );
}
