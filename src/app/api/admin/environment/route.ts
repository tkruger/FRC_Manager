// GET /api/admin/environment — which deployment and database is this? (Head Mentors only)
// For checking environment variables on Vercel: shows the database host, never the password.

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { appUrl } from "@/lib/app-url";

export const dynamic = "force-dynamic";

function describe(url: string | undefined) {
  if (!url) return null;
  try {
    const u = new URL(url);
    return { host: u.hostname, database: u.pathname.slice(1), user: u.username };
  } catch {
    return { error: "not a valid URL" };
  }
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.roles?.includes("HEAD_MENTOR")) return new NextResponse("Forbidden", { status: 403 });

  // What the database itself reports, to confirm the connection really goes where the URL says
  let connected: unknown;
  try {
    const [row] = await prisma.$queryRaw<{ db: string; version: string; seasons: bigint }[]>`
      select current_database() as db, version() as version, (select count(*) from "Season") as seasons`;
    connected = { database: row.db, postgres: row.version.split(" on ")[0], seasons: Number(row.seasons) };
  } catch (e) {
    connected = { error: e instanceof Error ? e.message : String(e) };
  }

  return NextResponse.json({
    vercelEnvironment: process.env.VERCEL_ENV ?? "local",           // production | preview | development
    customEnvironment: process.env.VERCEL_TARGET_ENV ?? null,       // e.g. "pre-production" (custom environments)
    branch:            process.env.VERCEL_GIT_COMMIT_REF ?? null,
    commit:            process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    deploymentUrl:     process.env.VERCEL_URL ?? null,
    appUrl:            appUrl(),
    authUrl:           process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? null,
    databaseUrl:       describe(process.env.DATABASE_URL),
    connectedTo:       connected,
  });
}
