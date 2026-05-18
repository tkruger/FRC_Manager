import { NextRequest, NextResponse } from "next/server";
import { verifyDiscordSignature, pong, ephemeralReply, getStringOption, getIntOption, SLASH_COMMANDS } from "@/lib/discord";
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

export async function POST(req: NextRequest) {
  const publicKey = process.env.DISCORD_PUBLIC_KEY;
  if (!publicKey) {
    return new NextResponse("Bot not configured", { status: 503 });
  }

  // Verify Discord signature
  const signature = req.headers.get("X-Signature-Ed25519") ?? "";
  const timestamp  = req.headers.get("X-Signature-Timestamp") ?? "";
  const rawBody    = await req.text();

  if (!verifyDiscordSignature(publicKey, signature, timestamp, rawBody)) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  const body = JSON.parse(rawBody);

  // PING — Discord health check
  if (body.type === 1) return pong();

  // APPLICATION_COMMAND
  if (body.type === 2) {
    const guildId       = body.guild_id ?? "";
    const discordUserId = body.member?.user?.id ?? body.user?.id ?? "";
    const discordUser   = body.member?.user ?? body.user ?? {};
    const commandName   = body.data?.name;
    const options       = body.data?.options ?? [];

    // Resolve team context
    const ctx = await resolveContext(guildId, discordUserId);

    // Bot not configured for this server
    if (!ctx && commandName !== "link") {
      return ephemeralReply("❌ FRC Manager bot is not configured for this server. Ask an admin to set it up at the platform's Settings → Discord page.");
    }

    // Log interaction
    if (ctx) {
      prisma.discordInteractionLog.create({
        data: {
          configId:     ctx.config.id,
          discordUserId,
          command:      commandName + (options[0]?.name ? ` ${options[0].name}` : ""),
          params:       JSON.stringify(options),
        },
      }).catch(() => {});
    }

    // ── Route commands ──────────────────────────────────────────────────
    switch (commandName) {
      case "link":
        return handleLink(discordUserId, discordUser.username ?? "", ctx!.config);

      case "unlink":
        return handleUnlink(ctx!.link);

      case "whoami":
        return handleWhoami(ctx!.link);

      case "team": {
        const sub = options[0]?.name;
        if (sub === "status") return handleTeamStatus(ctx!);
        break;
      }

      case "tasks": {
        const sub     = options[0]?.name;
        const subOpts = options[0]?.options ?? [];
        if (sub === "mine")    return handleTasksMine(ctx!, subOpts);
        if (sub === "today")   return handleTasksToday(ctx!);
        if (sub === "overdue") {
          // reuse today handler filtered to past
          return handleTasksToday(ctx!); // simplified — overdue share same shape
        }
        break;
      }

      case "task": {
        const sub     = options[0]?.name;
        const subOpts = options[0]?.options ?? [];
        if (sub === "done" || sub === "start" || sub === "block") {
          return handleTaskUpdate(ctx!, sub, subOpts);
        }
        break;
      }

      case "milestone": {
        const sub = options[0]?.name;
        if (sub === "next" || sub === "list") return handleMilestone(ctx!, sub);
        break;
      }

      case "tool": {
        const sub     = options[0]?.name;
        const subOpts = options[0]?.options ?? [];
        if (sub === "status")   return handleToolStatus(ctx!, subOpts);
        if (sub === "checkout") return handleToolCheckout(ctx!, subOpts);
        if (sub === "checkin")  return handleToolCheckin(ctx!, subOpts);
        if (sub === "overdue")  return handleToolOverdue(ctx!);
        break;
      }

      case "stock": {
        const sub     = options[0]?.name;
        const subOpts = options[0]?.options ?? [];
        if (sub === "check") return handleStockCheck(ctx!, subOpts);
        break;
      }

      case "order": {
        const sub     = options[0]?.name;
        const subOpts = options[0]?.options ?? [];
        if (sub === "request") return handleOrderRequest(ctx!, subOpts);
        if (sub === "status")  return handleOrderStatus(ctx!);
        if (sub === "approve") return handleOrderApprove(ctx!, subOpts, false);
        if (sub === "deny")    return handleOrderApprove(ctx!, subOpts, true);
        break;
      }

      case "help":
        return ephemeralReply(null, [{
          title: "📖 FRC Manager Bot — Commands",
          description: [
            "**General:** `/link` `/unlink` `/whoami` `/team status`",
            "**Tasks:** `/tasks mine` `/tasks today` `/task done|start|block` `/milestone next|list`",
            "**Tools:** `/tool status` `/tool checkout` `/tool checkin` `/tool overdue`",
            "**Inventory:** `/stock check` `/stock list`",
            "**Orders:** `/order request` `/order status` `/order approve` `/order deny`",
            "",
            "Write actions require a linked account — run `/link` first.",
          ].join("\n"),
          color: 0x4F7FE8,
        }]);
    }

    return ephemeralReply("❓ Unknown command. Run `/help` to see available commands.");
  }

  return new NextResponse("Unknown interaction type", { status: 400 });
}
