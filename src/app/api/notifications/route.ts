import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const MarkRead = z.object({ ids: z.array(z.string().max(64)).max(200) });

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

  const parsed = MarkRead.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Send { ids: string[] }" }, { status: 400 });
  await prisma.notification.updateMany({
    where: { userId: session.user.id, id: { in: parsed.data.ids } },
    data: { read: true },
  });

  return NextResponse.json({ ok: true });
}
