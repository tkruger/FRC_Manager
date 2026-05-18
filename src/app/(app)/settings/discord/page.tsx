import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Table, TableHead, TableBody, Th, Td, Tr } from "@/components/ui/table";
import { formatDate } from "@/lib/utils";
import { DiscordConfigForm } from "./DiscordConfigForm";
import { RevokeLinkButton } from "./RevokeLinkButton";
import { RegisterCommandsButton } from "./RegisterCommandsButton";

export default async function DiscordSettingsPage() {
  const session = await auth();
  if (!session?.user?.teamId) redirect("/dashboard");

  const isAdmin = session.user.roles.some((r) => ["HEAD_MENTOR", "INVENTORY_ADMIN"].includes(r));
  if (!isAdmin) redirect("/dashboard");

  const [config, members, recentLogs] = await Promise.all([
    prisma.discordConfig.findUnique({ where: { teamId: session.user.teamId } }),
    prisma.user.findMany({
      where: { teamId: session.user.teamId, status: "ACTIVE" },
      include: { discordLink: true },
      orderBy: { name: "asc" },
    }),
    prisma.discordInteractionLog.findMany({
      where: { config: { teamId: session.user.teamId } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  const interactionsEndpoint = `${process.env.NEXTAUTH_URL ?? "https://frc-manager.vercel.app"}/api/discord/interactions`;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <nav className="text-small text-[--color-text-secondary] mb-1">
          <Link href="/settings/members" className="hover:text-[--color-primary]">Settings</Link>
          <span className="mx-2">›</span>Discord
        </nav>
        <h1 className="text-h1 text-[--color-text-primary]">Discord Integration</h1>
        <p className="text-body text-[--color-text-secondary] mt-1">
          Connect your team's Discord server to enable slash commands and proactive notifications.
        </p>
      </div>

      {/* Connection status */}
      <div className="card">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-h3 text-[--color-text-primary] mb-1">Connection status</h2>
            {config?.active ? (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="success">Connected</Badge>
                  <span className="text-small text-[--color-text-secondary]">Guild ID: <code>{config.guildId}</code></span>
                </div>
              </div>
            ) : (
              <Badge variant="neutral">Not connected</Badge>
            )}
          </div>
          {config?.active && <RegisterCommandsButton />}
        </div>

        {/* Setup instructions */}
        {!config?.active && (
          <div className="mt-4 rounded-md bg-[--color-info]/10 border border-[--color-info]/20 px-4 py-3 space-y-2">
            <p className="text-sm font-medium text-[--color-text-primary]">Setup instructions</p>
            <ol className="text-small text-[--color-text-secondary] space-y-1 list-decimal list-inside">
              <li>Create a Discord bot at <a href="https://discord.com/developers/applications" target="_blank" rel="noopener noreferrer" className="text-[--color-secondary] hover:underline">discord.com/developers/applications</a></li>
              <li>Add <code>DISCORD_BOT_TOKEN</code>, <code>DISCORD_APPLICATION_ID</code>, and <code>DISCORD_PUBLIC_KEY</code> to your Vercel environment variables</li>
              <li>Set the Interactions Endpoint URL in your Discord app to: <code className="text-[10px]">{interactionsEndpoint}</code></li>
              <li>Invite the bot to your server, then enter the Guild ID below and save</li>
              <li>Click "Register Commands" to activate all slash commands</li>
            </ol>
          </div>
        )}
      </div>

      {/* Config form */}
      <div className="card">
        <h2 className="text-h3 text-[--color-text-primary] mb-4">
          {config?.active ? "Server configuration" : "Connect a Discord server"}
        </h2>
        <DiscordConfigForm config={config} />
      </div>

      {/* Account links */}
      <div>
        <h2 className="text-h2 text-[--color-text-primary] mb-3">Account links</h2>
        <p className="text-small text-[--color-text-secondary] mb-3">
          Members link their Discord accounts by running <code>/link</code> in Discord.
        </p>
        <Table>
          <TableHead>
            <tr>
              <Th>Member</Th>
              <Th>Discord account</Th>
              <Th>Linked</Th>
              <Th>Status</Th>
              <Th />
            </tr>
          </TableHead>
          <TableBody>
            {members.map((m) => {
              // discordLink is 1:1 — only active if revokedAt is null
              const link = m.discordLink?.revokedAt ? null : m.discordLink;
              return (
                <Tr key={m.id}>
                  <Td className="font-medium">{m.name}</Td>
                  <Td className="text-mono">{link?.discordUsername ?? "—"}</Td>
                  <Td>{link ? formatDate(link.linkedAt) : "—"}</Td>
                  <Td>
                    {link
                      ? <Badge variant="success">Linked</Badge>
                      : <Badge variant="neutral">Not linked</Badge>}
                  </Td>
                  <Td>
                    {link && <RevokeLinkButton linkId={link.id} memberName={m.name} />}
                  </Td>
                </Tr>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Activity log */}
      {recentLogs.length > 0 && (
        <div>
          <h2 className="text-h2 text-[--color-text-primary] mb-3">Recent activity</h2>
          <Table>
            <TableHead>
              <tr><Th>Command</Th><Th>Discord user</Th><Th>Result</Th><Th>Time</Th></tr>
            </TableHead>
            <TableBody>
              {recentLogs.map((log) => (
                <Tr key={log.id}>
                  <Td mono>{log.command}</Td>
                  <Td mono>{log.discordUserId}</Td>
                  <Td>
                    <Badge variant={log.success ? "success" : "danger"}>
                      {log.success ? "OK" : "Error"}
                    </Badge>
                  </Td>
                  <Td>{formatDate(log.createdAt)}</Td>
                </Tr>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
