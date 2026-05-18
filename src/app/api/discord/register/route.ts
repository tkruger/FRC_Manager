// POST /api/discord/register — registers global slash commands with Discord
// Call once after deploying (or on-demand from the settings page)
// Requires: DISCORD_BOT_TOKEN, DISCORD_APPLICATION_ID
import { auth } from "@/lib/auth";
import { SLASH_COMMANDS } from "@/lib/discord";
import { NextResponse } from "next/server";

export async function POST() {
  const session = await auth();
  if (!session?.user?.roles?.includes("HEAD_MENTOR" as any)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const appId = process.env.DISCORD_APPLICATION_ID;
  const token = process.env.DISCORD_BOT_TOKEN;

  if (!appId || !token) {
    return NextResponse.json({ error: "DISCORD_APPLICATION_ID and DISCORD_BOT_TOKEN must be set." }, { status: 503 });
  }

  const res = await fetch(
    `https://discord.com/api/v10/applications/${appId}/commands`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bot ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(SLASH_COMMANDS),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: err }, { status: res.status });
  }

  const data = await res.json();
  return NextResponse.json({ registered: data.length, commands: data.map((c: any) => c.name) });
}
