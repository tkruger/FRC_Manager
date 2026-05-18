import { NextRequest, NextResponse } from "next/server";
import { verifyDiscordSignature, pong, ephemeralReply } from "@/lib/discord";
import {
  resolveContext,
  handleLink, handleUnlink, handleWhoami, handleTeamStatus,
  handleTasksMine, handleTasksToday, handleTaskUpdate,
  handleMilestone,
  handleToolStatus, handleToolCheckout, handleToolCheckin, handleToolOverdue,
  handleStockCheck,
  handleOrderRequest, handleOrderStatus, handleOrderApprove,
} from "@/lib/discord-commands";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// GET — shown when someone visits the URL in a browser or Discord validates it
export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "FRC Manager Discord bot interactions endpoint. This endpoint only accepts POST requests from Discord.",
  });
}

export async function POST(req: NextRequest) {
  const publicKey = process.env.DISCORD_PUBLIC_KEY;
  if (!publicKey) {
    return new NextResponse(
      "Discord bot not configured. Set DISCORD_PUBLIC_KEY, DISCORD_BOT_TOKEN, and DISCORD_APPLICATION_ID in your environment variables.",
      { status: 503 }
    );
  }

  // Read the raw body first — must be done before any other body consumption
  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return new NextResponse("Could not read request body", { status: 400 });
  }

  // Verify Discord Ed25519 signature
  const signature = req.headers.get("X-Signature-Ed25519") ?? "";
  const timestamp  = req.headers.get("X-Signature-Timestamp") ?? "";

  if (!signature || !timestamp) {
    return new NextResponse("Missing signature headers", { status: 401 });
  }

  if (!verifyDiscordSignature(publicKey, signature, timestamp, rawBody)) {
    return new NextResponse("Invalid request signature", { status: 401 });
  }

  let body: any;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return new NextResponse("Invalid JSON body", { status: 400 });
  }

  // PING — Discord endpoint verification (type 1)
  if (body.type === 1) return pong();

  // APPLICATION_COMMAND (type 2)
  if (body.type === 2) {
    const guildId       = body.guild_id ?? "";
    const discordUserId = body.member?.user?.id ?? body.user?.id ?? "";
    const discordUser   = body.member?.user ?? body.user ?? {};
    const commandName   = body.data?.name ?? "";
    const options       = body.data?.options ?? [];

    // Resolve team context (null if this guild has no FRC Manager config)
    const ctx = await resolveContext(guildId, discordUserId);

    // /link is special — allowed even when bot isn't fully configured for this guild
    if (commandName === "link") {
      if (!ctx) {
        return ephemeralReply(
          "❌ FRC Manager bot is not configured for this server yet. An admin needs to complete setup at **Settings → Discord** in the platform first."
        );
      }
      return handleLink(discordUserId, discordUser.username ?? "", ctx.config);
    }

    // All other commands require a configured guild
    if (!ctx) {
      return ephemeralReply(
        "❌ FRC Manager bot is not configured for this server. Ask an admin to complete setup at the platform's Settings → Discord page."
      );
    }

    // Log the interaction (best-effort, don't block response)
    prisma.discordInteractionLog.create({
      data: {
        configId:     ctx.config.id,
        discordUserId,
        command:      commandName + (options[0]?.name ? ` ${options[0].name}` : ""),
        params:       JSON.stringify(options),
      },
    }).catch(() => {});

    // ── Command routing ──────────────────────────────────────────────────
    switch (commandName) {
      case "unlink":
        return handleUnlink(ctx.link);

      case "whoami":
        return handleWhoami(ctx.link);

      case "team": {
        const sub = options[0]?.name;
        if (sub === "status") return handleTeamStatus(ctx);
        break;
      }

      case "tasks": {
        const sub     = options[0]?.name;
        const subOpts = options[0]?.options ?? [];
        if (sub === "mine")    return handleTasksMine(ctx, subOpts);
        if (sub === "today")   return handleTasksToday(ctx);
        if (sub === "overdue") return handleTasksToday(ctx); // shares same shape
        break;
      }

      case "task": {
        const sub     = options[0]?.name;
        const subOpts = options[0]?.options ?? [];
        if (sub === "done" || sub === "start" || sub === "block") {
          return handleTaskUpdate(ctx, sub, subOpts);
        }
        break;
      }

      case "milestone": {
        const sub = options[0]?.name;
        if (sub === "next" || sub === "list") return handleMilestone(ctx, sub);
        break;
      }

      case "tool": {
        const sub     = options[0]?.name;
        const subOpts = options[0]?.options ?? [];
        if (sub === "status")   return handleToolStatus(ctx, subOpts);
        if (sub === "checkout") return handleToolCheckout(ctx, subOpts);
        if (sub === "checkin")  return handleToolCheckin(ctx, subOpts);
        if (sub === "overdue")  return handleToolOverdue(ctx);
        break;
      }

      case "stock": {
        const sub     = options[0]?.name;
        const subOpts = options[0]?.options ?? [];
        if (sub === "check") return handleStockCheck(ctx, subOpts);
        break;
      }

      case "order": {
        const sub     = options[0]?.name;
        const subOpts = options[0]?.options ?? [];
        if (sub === "request") return handleOrderRequest(ctx, subOpts);
        if (sub === "status")  return handleOrderStatus(ctx);
        if (sub === "approve") return handleOrderApprove(ctx, subOpts, false);
        if (sub === "deny")    return handleOrderApprove(ctx, subOpts, true);
        break;
      }

      case "help":
        return ephemeralReply(null, [{
          title: "📖 FRC Manager Bot — Commands",
          description: [
            "**General:** `/link` `/unlink` `/whoami` `/team status`",
            "**Tasks:** `/tasks mine` `/tasks today` `/task done|start|block` `/milestone next|list`",
            "**Tools:** `/tool status` `/tool checkout` `/tool checkin` `/tool overdue`",
            "**Inventory:** `/stock check`",
            "**Orders:** `/order request` `/order status` `/order approve` `/order deny`",
            "",
            "Write actions require a linked account — run `/link` first.",
          ].join("\n"),
          color: 0x4F7FE8,
        }]);
    }

    return ephemeralReply("❓ Unknown command. Run `/help` to see available commands.");
  }

  // Other interaction types (message components, modals, etc.) — not implemented
  return new NextResponse("Unsupported interaction type", { status: 400 });
}
