import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function DiscordLinkPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const session   = await auth();

  if (!session) redirect(`/login?callbackUrl=/settings/discord/link?token=${token}`);

  if (!token) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
        <p className="text-h2 text-[--color-text-primary]">❌ Invalid link</p>
        <p className="text-body text-[--color-text-secondary]">No token provided. Use <code>/link</code> in Discord to get a new link.</p>
      </div>
    );
  }

  const record = await prisma.discordLinkToken.findUnique({ where: { token } });

  if (!record || record.used || record.expiresAt < new Date()) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
        <p className="text-h2 text-[--color-text-primary]">⏰ Link expired</p>
        <p className="text-body text-[--color-text-secondary]">This link has expired or already been used. Run <code>/link</code> in Discord to get a fresh one.</p>
      </div>
    );
  }

  // Parse the discord info stored in userId field
  let discordInfo: { discordUserId: string; discordUsername: string; teamId: string } | null = null;
  try {
    discordInfo = JSON.parse(record.userId);
  } catch {
    discordInfo = null;
  }

  if (!discordInfo) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <p className="text-h2 text-[--color-text-primary]">❌ Invalid token data</p>
      </div>
    );
  }

  // Check user is on the right team
  if (session.user.teamId !== discordInfo.teamId) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
        <p className="text-h2 text-[--color-text-primary]">❌ Wrong team</p>
        <p className="text-body text-[--color-text-secondary]">
          This link is for a different team. Make sure you&apos;re signed in to the correct account.
        </p>
      </div>
    );
  }

  // Check not already linked to a different Discord account
  const existingByUser = await prisma.discordLink.findFirst({
    where: { userId: session.user.id, revokedAt: null },
  });
  const existingByDiscord = await prisma.discordLink.findFirst({
    where: { discordUserId: discordInfo.discordUserId, revokedAt: null },
  });

  if (existingByUser || existingByDiscord) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
        <p className="text-h2 text-[--color-text-primary]">⚠️ Already linked</p>
        <p className="text-body text-[--color-text-secondary]">
          {existingByUser
            ? "Your platform account is already linked to a Discord account."
            : "This Discord account is already linked to another platform account."}
          {" "}Use <code>/unlink</code> in Discord first.
        </p>
        <Link href="/settings/discord"><Button>Go to Discord settings</Button></Link>
      </div>
    );
  }

  // Create the link
  await prisma.$transaction([
    prisma.discordLink.create({
      data: {
        userId:          session.user.id,
        discordUserId:   discordInfo.discordUserId,
        discordUsername: discordInfo.discordUsername,
      },
    }),
    prisma.discordLinkToken.update({
      where: { id: record.id },
      data:  { used: true },
    }),
  ]);

  // Try to confirm via DM (best effort)
  try {
    const { sendDM } = await import("@/lib/discord");
    await sendDM(
      discordInfo.discordUserId,
      `✅ Your Discord account is now linked to **${session.user.name}**. Type \`/help\` to see what you can do.`
    );
  } catch {
    // DM failed — link is still created
  }

  return (
    <div className="max-w-md mx-auto px-4 py-16 text-center space-y-6">
      <div className="text-5xl">✅</div>
      <h1 className="text-h1 text-[--color-text-primary]">Discord linked!</h1>
      <p className="text-body text-[--color-text-secondary]">
        Your Discord account <strong>@{discordInfo.discordUsername}</strong> is now linked to{" "}
        <strong>{session.user.name}</strong>. Head back to Discord and run{" "}
        <code>/help</code> to see available commands.
      </p>
      <Link href="/dashboard"><Button>Go to dashboard</Button></Link>
    </div>
  );
}
