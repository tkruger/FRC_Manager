"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { addOrderCommentAction, deleteOrderCommentAction } from "@/app/actions/order-comments";

export interface OrderCommentRow { id: string; author: string; mine: boolean; body: string; at: string }

const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** Comments on an order: back orders, broken links, questions for the Buyer — everyone on the order is told */
export function OrderComments({ requestId, comments, canComment, canModerate }: {
  requestId: string; comments: OrderCommentRow[]; canComment: boolean; canModerate: boolean;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [pending, start] = useTransition();

  const post = () => start(async () => {
    const res = await addOrderCommentAction(requestId, text);
    if (!res.success) { toast.error(res.error); return; }
    setText("");
    router.refresh();
  });
  const remove = (id: string) => {
    if (!confirm("Remove this comment?")) return;
    start(async () => {
      const res = await deleteOrderCommentAction(id);
      if (!res.success) { toast.error(res.error); return; }
      router.refresh();
    });
  };

  return (
    <section id="comments" className="card space-y-4 scroll-mt-24">
      <div>
        <h2 className="flex items-center gap-2 text-h3 text-(--color-text-primary)">
          <MessageSquare className="h-4 w-4 text-(--color-text-secondary)" aria-hidden /> Comments
          {comments.length > 0 && <span className="text-small font-normal text-(--color-text-secondary)">({comments.length})</span>}
        </h2>
        <p className="text-small text-(--color-text-secondary) mt-0.5">
          Anything everyone on the order should know — a back order, a broken link, a question for the Buyer. They&apos;re all told.
        </p>
      </div>

      {comments.length > 0 && (
        <ol className="space-y-3">
          {comments.map((c) => (
            <li key={c.id} className="rounded-lg bg-(--color-surface-overlay) px-3 py-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm">
                  <span className="font-medium text-(--color-text-primary)">{c.author}</span>
                  <span className="text-small text-(--color-text-secondary)"> · {when(c.at)}</span>
                </p>
                {(c.mine || canModerate) && (
                  <button type="button" disabled={pending} onClick={() => remove(c.id)} className="text-small text-(--color-text-secondary) hover:text-(--color-danger) hover:underline">
                    Remove
                  </button>
                )}
              </div>
              <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-(--color-text-primary)">{c.body}</p>
            </li>
          ))}
        </ol>
      )}

      {canComment && (
        <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); if (text.trim()) post(); }}>
          <textarea
            className="w-full min-h-20 rounded-md border border-(--color-border) bg-(--color-surface) px-3 py-2 text-sm text-(--color-text-primary) placeholder:text-(--color-text-disabled) focus:border-(--color-primary) focus:outline-none focus:ring-2 focus:ring-(--color-primary)/20"
            placeholder="e.g. This item is back ordered and won't ship for a couple of weeks"
            maxLength={2000}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && text.trim()) post(); }}
          />
          <div className="flex justify-end">
            <Button type="submit" size="sm" isLoading={pending} disabled={!text.trim()}>Post comment</Button>
          </div>
        </form>
      )}
    </section>
  );
}
