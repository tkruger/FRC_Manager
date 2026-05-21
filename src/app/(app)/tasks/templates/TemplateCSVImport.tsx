"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { parseCSV } from "@/lib/template-csv";
import { importTemplateTasksAction } from "@/app/actions/templates";

interface Props {
  templateId: string;
}

export function TemplateCSVImport({ templateId }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [preview, setPreview]  = useState<ReturnType<typeof parseCSV> | null>(null);
  const [filename, setFilename] = useState("");
  const [message,  setMessage]  = useState<{ type: "success" | "error"; text: string } | null>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFilename(file.name);
    setMessage(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = parseCSV(ev.target?.result as string);
      setPreview(result);
    };
    reader.readAsText(file);
  }

  function handleImport() {
    if (!preview?.tasks.length) return;
    startTransition(async () => {
      const result = await importTemplateTasksAction(templateId, preview.tasks);
      if (result.success) {
        setMessage({ type: "success", text: `Imported ${result.count} task${result.count !== 1 ? "s" : ""} successfully.` });
        setPreview(null);
        setFilename("");
        if (fileRef.current) fileRef.current.value = "";
        router.refresh();
      } else {
        setMessage({ type: "error", text: result.error ?? "Import failed." });
      }
    });
  }

  function handleClear() {
    setPreview(null);
    setFilename("");
    setMessage(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="space-y-3">
      {/* File picker */}
      {!preview && (
        <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[--color-border] text-sm font-medium text-[--color-text-secondary] hover:border-[--color-border-strong] hover:text-[--color-text-primary] cursor-pointer transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          Import from CSV
          <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleFile} className="sr-only" />
        </label>
      )}

      {/* Message */}
      {message && (
        <div className={`text-sm rounded px-3 py-2 ${
          message.type === "success"
            ? "bg-[--color-success]/10 text-[--color-success]"
            : "bg-[--color-danger]/10 text-[--color-danger]"
        }`}>
          {message.text}
        </div>
      )}

      {/* Preview */}
      {preview && (
        <div className="rounded-lg border border-[--color-border] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 bg-[--color-surface-overlay] border-b border-[--color-border]">
            <p className="text-sm font-medium text-[--color-text-primary]">
              {filename} — {preview.tasks.length} task{preview.tasks.length !== 1 ? "s" : ""}
              {preview.errors.length > 0 && (
                <span className="ml-2 text-[--color-warning]">({preview.errors.length} warning{preview.errors.length !== 1 ? "s" : ""})</span>
              )}
            </p>
            <button onClick={handleClear} className="text-[--color-text-secondary] hover:text-[--color-danger] text-sm transition-colors">Cancel</button>
          </div>

          {preview.errors.length > 0 && (
            <div className="px-4 py-2 bg-[--color-warning]/5 border-b border-[--color-border] space-y-1">
              {preview.errors.map((e, i) => (
                <p key={i} className="text-xs text-[--color-warning]">{e}</p>
              ))}
            </div>
          )}

          {preview.tasks.length > 0 && (
            <div className="max-h-48 overflow-y-auto divide-y divide-[--color-table-border]">
              {preview.tasks.map((t, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-2">
                  {t.isMilestone && <span className="text-[--color-primary] text-xs shrink-0">◆</span>}
                  <span className="text-sm text-[--color-text-primary] truncate flex-1">{t.name}</span>
                  {t.subTeam && <span className="text-xs text-[--color-text-secondary] shrink-0">{t.subTeam.replace(/_/g, " ")}</span>}
                  <span className="text-xs text-[--color-text-disabled] shrink-0">
                    {t.startOffset >= 0 ? `+${t.startOffset}d kickoff` : `${t.startOffset}d week0`}
                  </span>
                </div>
              ))}
            </div>
          )}

          {preview.tasks.length > 0 && (
            <div className="px-4 py-3 border-t border-[--color-border] bg-[--color-surface-overlay]">
              <Button size="sm" onClick={handleImport} isLoading={isPending}>
                Import {preview.tasks.length} task{preview.tasks.length !== 1 ? "s" : ""}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
