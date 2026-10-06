"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { createOrderExportLinkAction } from "@/app/actions/orders";
import { isIos, isStandalone } from "@/lib/push-client";

/**
 * Downloads an order export. In the iPhone/iPad home-screen app — which can't
 * download files and doesn't share its login with Safari — it opens a short-lived
 * signed link in Safari instead, where the normal download prompt appears.
 */
export function ExportCsvButton({ order, view, title }: { order?: string; view?: string; title?: string }) {
  const [busy, setBusy] = useState(false);
  const params = order ? `order=${encodeURIComponent(order)}` : `view=${encodeURIComponent(view ?? "open")}`;

  async function exportCsv() {
    if (!(isIos() && isStandalone())) {
      // Normal browsers: the session cookie authorizes a plain download
      const a = document.createElement("a");
      a.href = `/api/orders/csv?${params}`;
      a.download = "";
      a.click();
      return;
    }

    setBusy(true);
    try {
      const res = await createOrderExportLinkAction(order ? { order } : { view });
      if (!res.success) { toast.error(res.error); return; }
      const url = new URL(res.path, window.location.origin).href;

      // x-safari-https:// opens Safari itself (iOS 17+). If that doesn't take us
      // out of the app, fall back to an in-app browser window.
      window.location.href = url.replace(/^https?:\/\//, (m) => `x-safari-${m}`);
      setTimeout(() => {
        if (document.visibilityState === "visible") window.open(url, "_blank");
      }, 1200);
      toast.success("Opening the export in Safari…");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button size="sm" variant="outline" onClick={exportCsv} isLoading={busy} title={title}>
      Export CSV
    </Button>
  );
}
