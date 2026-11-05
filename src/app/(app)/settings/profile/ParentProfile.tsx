"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { saveParentOfAction, setMyStudentAction } from "@/app/actions/parents";

const inputCls = "flex h-11 w-full min-w-0 rounded-md border border-(--color-border) bg-(--color-surface) px-3 text-sm text-(--color-text-primary) placeholder:text-(--color-text-disabled) focus:border-(--color-primary) focus:outline-none focus:ring-2 focus:ring-(--color-primary)/20";

/** Parents: which students are theirs — picked from the team, or named if they aren't on the app yet */
export function ParentProfile({ linked, students, parentOf }: {
  linked: { id: string; name: string }[]; students: { id: string; name: string }[]; parentOf: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [pick, setPick] = useState("");
  const [text, setText] = useState(parentOf ?? "");
  const others = students.filter((s) => !linked.some((l) => l.id === s.id));

  const setLink = (studentId: string, on: boolean) => start(async () => {
    const res = await setMyStudentAction(studentId, on);
    if (!res.success) { toast.error(res.error); return; }
    setPick("");
    router.refresh();
  });

  return (
    <section className="card space-y-4">
      <div>
        <h2 className="text-h3 text-(--color-text-primary)">My students</h2>
        <p className="text-small text-(--color-text-secondary) mt-0.5">
          Whose parent you are — mentors see it next to your name on the team list.
        </p>
      </div>

      {linked.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {linked.map((s) => (
            <span key={s.id} className="inline-flex items-center gap-1.5 rounded-full border border-(--color-primary)/40 bg-(--color-primary)/10 py-1 pl-3 pr-1.5 text-sm text-(--color-text-primary)">
              {s.name}
              <button type="button" disabled={pending} onClick={() => setLink(s.id, false)} aria-label={`Remove ${s.name}`}
                className="rounded-full p-0.5 text-(--color-text-secondary) hover:bg-(--color-surface-overlay) hover:text-(--color-danger)">
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-small text-(--color-text-secondary)">No students linked yet.</p>
      )}

      {others.length > 0 && (
        <div className="flex gap-2">
          <select className={inputCls} value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Add a student">
            <option value="">Add a student on the team…</option>
            {others.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <Button type="button" variant="outline" disabled={!pick} isLoading={pending && !!pick} onClick={() => setLink(pick, true)}>Add</Button>
        </div>
      )}

      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const res = await saveParentOfAction(text);
            if (!res.success) { toast.error(res.error); return; }
            toast.success(res.linked ? `Saved — linked ${res.linked} student${res.linked === 1 ? "" : "s"} on the team` : "Saved");
            router.refresh();
          });
        }}
      >
        <label htmlFor="parentOf" className="block text-sm font-medium text-(--color-text-primary)">
          Not on FRC Manager yet? <span className="font-normal text-(--color-text-secondary)">Their first and last names</span>
        </label>
        <div className="flex gap-2">
          <input id="parentOf" className={inputCls} value={text} maxLength={300} onChange={(e) => setText(e.target.value)} placeholder="e.g. Alex Starler, Jamie Starler" />
          <Button type="submit" variant="outline" disabled={pending || text.trim() === (parentOf ?? "")}>Save</Button>
        </div>
        <p className="text-small text-(--color-text-secondary)">When they join, they&apos;re linked to you automatically if the names match.</p>
      </form>
    </section>
  );
}
