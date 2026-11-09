"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { formatDate } from "@/lib/utils";
import { inviteDraftCollaboratorAction, removeDraftCollaboratorAction } from "@/app/actions/orders";

interface Person { id: string; name: string }

/**
 * Who's working on this draft. Its maker invites teammates (they can then edit, add items and submit
 * it) and can take them off again; a collaborator can leave.
 */
export function DraftCollaborators({ draftId, maker, collaborators, canManage, me, teammates, lastSaved }: {
  draftId: string; maker: Person; collaborators: Person[]; canManage: boolean; me: string;
  teammates: Person[]; lastSaved: { at: string; by: string | null };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [pick, setPick] = useState("");
  const on = new Set(collaborators.map((c) => c.id));
  const choices = teammates.filter((t) => !on.has(t.id));

  const run = (fn: () => Promise<{ success: boolean; error?: string }>, ok: string, after?: () => void) => start(async () => {
    const res = await fn();
    if (!res.success) { toast.error(res.error ?? "Couldn't change that."); return; }
    toast.success(ok);
    after?.();
    router.refresh();
  });

  return (
    <section className="card space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-h3 text-(--color-text-primary)"><Users className="h-4 w-4" aria-hidden /> Working on this draft</h2>
        <p className="text-small text-(--color-text-secondary)">Saved {formatDate(lastSaved.at)}{lastSaved.by ? ` by ${lastSaved.by}` : ""}</p>
      </div>
      <ul className="flex flex-wrap gap-2">
        <li className="inline-flex items-center gap-1.5 rounded-full border border-(--color-border) bg-(--color-surface-overlay) px-3 py-1 text-sm text-(--color-text-primary)">
          {maker.name}{maker.id === me && " (you)"} <span className="text-xs text-(--color-text-secondary)">started it</span>
        </li>
        {collaborators.map((c) => (
          <li key={c.id} className="inline-flex items-center gap-1.5 rounded-full border border-(--color-border) bg-(--color-surface-overlay) py-1 pl-3 pr-1.5 text-sm text-(--color-text-primary)">
            {c.name}{c.id === me && " (you)"}
            {(canManage || c.id === me) && (
              <button type="button" disabled={pending} aria-label={c.id === me ? "Leave this draft" : `Remove ${c.name}`}
                title={c.id === me ? "Leave this draft" : `Remove ${c.name}`}
                onClick={() => {
                  if (c.id === me && !confirm("Leave this draft? You'll still see it, but can't change it.")) return;
                  run(() => removeDraftCollaboratorAction(draftId, c.id), c.id === me ? "You left the draft" : `${c.name} removed`,
                    c.id === me ? () => router.push("/procurement?view=drafts") : undefined);
                }}
                className="flex h-6 w-6 items-center justify-center rounded-full text-(--color-text-secondary) hover:bg-(--color-danger)/10 hover:text-(--color-danger)">
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            )}
          </li>
        ))}
      </ul>
      {canManage ? (
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="Invite a teammate" value={pick} onChange={(e) => setPick(e.target.value)}
            className="h-9 min-w-0 flex-1 rounded-md border border-(--color-border) bg-(--color-surface) px-2.5 text-sm text-(--color-text-primary) sm:max-w-xs">
            <option value="">Invite a teammate…</option>
            {choices.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <Button type="button" size="sm" variant="outline" disabled={!pick || pending}
            onClick={() => { const name = choices.find((t) => t.id === pick)?.name ?? "They"; run(() => inviteDraftCollaboratorAction(draftId, pick), `${name} invited — they'll get a notification`, () => setPick("")); }}>
            <UserPlus className="h-4 w-4" aria-hidden /> Invite
          </Button>
          <p className="w-full text-small text-(--color-text-secondary)">
            Everyone on the team can see this draft. People you invite can also edit it, add items and submit it. Save before someone else edits — the last save wins.
          </p>
        </div>
      ) : (
        <p className="text-small text-(--color-text-secondary)">
          {maker.name} invited you, so you can edit this draft, add items and submit it. Save before someone else edits — the last save wins.
        </p>
      )}
    </section>
  );
}
