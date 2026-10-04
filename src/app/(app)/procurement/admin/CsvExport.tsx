"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { exportToOrderCsvAction } from "@/app/actions/orders";

/** Export "To order" items for the purchasing spreadsheet (no header row). */
export function CsvExport({ newCount, totalCount }: { newCount: number; totalCount: number }) {
  const router = useRouter();
  const [includeExported, setIncludeExported] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const count = includeExported ? totalCount : newCount;

  function exportCsv(mode: "copy" | "download") {
    setMsg(null);
    start(async () => {
      const res = await exportToOrderCsvAction({ onlyNew: !includeExported });
      if (!res.success) { setMsg({ ok: false, text: res.error }); return; }
      if (res.count === 0) { setMsg({ ok: false, text: "Nothing to export." }); return; }
      if (mode === "copy") {
        try {
          await navigator.clipboard.writeText(res.csv);
          setMsg({ ok: true, text: `Copied ${res.count} row${res.count === 1 ? "" : "s"} — paste into the spreadsheet.` });
        } catch {
          setMsg({ ok: false, text: "Couldn't use the clipboard — try Download instead." });
        }
      } else {
        const blob = new Blob([res.csv + "\n"], { type: "text/csv;charset=utf-8" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `to-order-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
        setMsg({ ok: true, text: `Downloaded ${res.count} row${res.count === 1 ? "" : "s"}.` });
      }
      router.refresh();
    });
  }

  return (
    <section className="card space-y-3">
      <div>
        <h2 className="text-h3 text-(--color-text-primary)">Export for the purchasing spreadsheet</h2>
        <p className="text-small text-(--color-text-secondary)">
          CSV with no header row, columns: ID, Vendor, Name, Link, Unit Cost, Quantity, Notes, Date.
          Items are marked “in spreadsheet” once exported, so next time you only get new ones.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={pending || count === 0} onClick={() => exportCsv("copy")}>Copy {count} row{count === 1 ? "" : "s"}</Button>
        <Button size="sm" variant="outline" disabled={pending || count === 0} onClick={() => exportCsv("download")}>Download CSV</Button>
        <label className="flex items-center gap-2 text-sm text-(--color-text-secondary) cursor-pointer">
          <input type="checkbox" className="accent-(--color-primary)" checked={includeExported} onChange={(e) => setIncludeExported(e.target.checked)} />
          Include items already exported ({totalCount - newCount})
        </label>
      </div>
      {msg && <p className={`text-sm ${msg.ok ? "text-(--color-success)" : "text-(--color-danger)"}`}>{msg.text}</p>}
    </section>
  );
}
