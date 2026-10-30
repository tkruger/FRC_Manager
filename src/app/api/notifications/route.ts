import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

/** Which notifications: listed ids, or all of yours when the list is empty */
const Ids = z.object({ ids: z.array(z.string().max(64)).max(200).default([]) });
const which = (userId: string, ids: string[]) => ({ userId, ...(ids.length ? { id: { in: ids } } : {}) });

export async function GET() {
  const session = await auth();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const notifications = await prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return NextResponse.json(notifications);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  // Mark read (an empty list marks them all — it used to match none)
  const parsed = Ids.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Send { ids: string[] }" }, { status: 400 });
  await prisma.notification.updateMany({ where: { ...which(session.user.id, parsed.data.ids), read: false }, data: { read: true } });

  return NextResponse.json({ ok: true });
}

/** Clear notifications: the ones listed, or all of yours */
export async function DELETE(req: Request) {
  const session = await auth();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const parsed = Ids.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Send { ids: string[] }" }, { status: 400 });
  const { count } = await prisma.notification.deleteMany({ where: which(session.user.id, parsed.data.ids) });

  return NextResponse.json({ ok: true, cleared: count });
}
