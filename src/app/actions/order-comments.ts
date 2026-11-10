"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isViewOnly } from "@/lib/access/read-only";
import { notifyUsers } from "@/lib/notify/deliver";
import { STATUS_OVERRIDE_ROLES } from "@/lib/orders/constants";
import { plainArgs } from "@/lib/action-args";

type Result = { success: true } | { success: false; error: string };

const Body = z.string().trim().min(1, "Write a comment first.").max(2000, "Keep comments under 2,000 characters.");

/**
 * Comment on an order — anyone on the team who can work on orders (not view-only parents). Everyone on
 * the order hears about it: who placed it, everyone who has acted on it, and everyone who commented.
 */
export async function addOrderCommentAction(requestId: string, text: string): Promise<Result> {
  plainArgs(requestId, text);
  const session = await auth();
  if (!session?.user?.teamId) return { success: false, error: "Not authenticated." };
  if (isViewOnly(session.user.roles)) return { success: false, error: "Your role can read orders but not comment on them." };
  const body = Body.safeParse(text);
  if (!body.success) return { success: false, error: body.error.issues[0].message };

  const order = await prisma.purchaseRequest.findFirst({
    where:  { id: requestId, season: { teamId: session.user.teamId } },
    select: { id: true, title: true, requestedById: true, events: { select: { actorId: true } }, comments: { select: { authorId: true } } },
  });
  if (!order) return { success: false, error: "Order not found." };

  await prisma.orderComment.create({ data: { requestId, authorId: session.user.id, body: body.data } });

  const ids = [...new Set([order.requestedById, ...order.events.map((e) => e.actorId), ...order.comments.map((c) => c.authorId)])]
    .filter((id): id is string => !!id && id !== session.user.id);
  if (ids.length) {
    await notifyUsers(ids, {
      topic: "purchase.comments",
      type:  "ORDER_COMMENT",
      title: `${session.user.name ?? "Someone"} commented on "${order.title}"`,
      body:  body.data.length > 240 ? body.data.slice(0, 237) + "…" : body.data,
      details: body.data,
      url:   `/procurement/requests/${requestId}#comments`,
      tag:   `order-comment-${requestId}`,
    }).catch((e) => console.error("[orders] comment notification:", e));
  }
  revalidatePath(`/procurement/requests/${requestId}`);
  return { success: true };
}

/** Remove a comment — its author, or the Buyer, captains and Head Mentors */
export async function deleteOrderCommentAction(commentId: string): Promise<Result> {
  plainArgs(commentId);
  const session = await auth();
  if (!session?.user?.teamId) return { success: false, error: "Not authenticated." };
  const c = await prisma.orderComment.findFirst({
    where:  { id: commentId, request: { season: { teamId: session.user.teamId } } },
    select: { id: true, authorId: true, requestId: true },
  });
  if (!c) return { success: false, error: "Comment not found." };
  if (c.authorId !== session.user.id && !session.user.roles.some((r) => STATUS_OVERRIDE_ROLES.includes(r))) {
    return { success: false, error: "Only whoever wrote it (or the Buyer, captains and Head Mentors) can remove a comment." };
  }
  await prisma.orderComment.delete({ where: { id: c.id } });
  revalidatePath(`/procurement/requests/${c.requestId}`);
  return { success: true };
}
