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
import { TestServerButton } from "./TestServerButton";
import { PageTitle } from "@/components/PageHeader";
import { appUrl } from "@/lib/app-url";
import { DISCORD_ADMIN_ROLES } from "@/lib/rbac";

export default async function DiscordSettingsPage() {
  const session = await auth();
  if (!session?.user?.teamId) redirect("/dashboard");

  const isAdmin = session.user.roles.some((r) => DISCORD_ADMIN_ROLES.includes(r));
  if (!isAdmin) redirect("/dashboard");

  const [configs, members, recentLogs] = await Promise.all([
    prisma.discordConfig.findMany({ where: { teamId: session.user.teamId } }),
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

  const interactionsEndpoint = `${appUrl()}/api/discord/interactions`;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <nav className="text-small text-(--color-text-secondary) mb-1">
          <Link href="/settings/integrations" className="hover:text-(--color-primary)">Integrations</Link>
          <span className="mx-2">›</span>Discord
        </nav>
        <PageTitle help="discord">Discord Integration</PageTitle>
        <p className="text-body text-(--color-text-secondary) mt-1">
          Connect your team&apos;s Discord servers for slash commands and notifications. The <b>student server</b> gets the
          build notifications (orders, tasks, safety, inventory). An optional <b>parent server</b> gets what parents care
          about: meetings that need adult volunteers, and milestone celebrations. The same bot serves both, and members
          run <code>/link</code> once, in either server.
        </p>
      </div>

      {/* Setup instructions (until any server is connected) */}
      {!configs.some((c) => c.active) && (
        <div className="card">
          <div className="rounded-md bg-(--color-info)/10 border border-(--color-info)/20 px-4 py-3 space-y-2">
            <p className="text-sm font-medium text-(--color-text-primary)">Setup instructions</p>
            <ol className="text-small text-(--color-text-secondary) space-y-1 list-decimal list-inside">
              <li>Create a Discord bot at <a href="https://discord.com/developers/applications" target="_blank" rel="noopener noreferrer" className="text-(--color-secondary) hover:underline">discord.com/developers/applications</a></li>
              <li>Add <code>DISCORD_BOT_TOKEN</code>, <code>DISCORD_APPLICATION_ID</code>, and <code>DISCORD_PUBLIC_KEY</code> to your Vercel environment variables</li>
              <li>Set the Interactions Endpoint URL in your Discord app to: <code className="text-[10px]">{interactionsEndpoint}</code></li>
              <li>Invite the bot to your server, then enter the Guild ID below and save</li>
              <li>Click "Register Commands" to activate all slash commands</li>
              <li>For a parent server too: invite the same bot to it and connect it under Parent server</li>
            </ol>
          </div>
        </div>
      )}

      {/* One card per server */}
      {(["STUDENT", "PARENT"] as const).map((audience) => {
        const config = configs.find((c) => c.audience === audience) ?? null;
        const parent = audience === "PARENT";
        return (
          <section key={audience} className="card space-y-5">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h2 className="text-h2 text-(--color-text-primary)">{parent ? "Parent server" : "Student server"}</h2>
                {config?.active
                  ? <Badge variant="success">Connected</Badge>
                  : <Badge variant="neutral">{parent ? "Optional — not connected" : "Not connected"}</Badge>}
              </div>
              {config?.active && <p className="text-small text-(--color-text-secondary) break-all">Server ID: <code>{config.guildId}</code></p>}
              {/* Actions sit under the status (they used to squeeze in beside it and run off phones) */}
              {config?.active && (
                <div className="flex flex-wrap items-center gap-2">
                  <TestServerButton audience={audience} />
                  {/* Slash commands belong to the shared bot, so only platform admins re-register them */}
                  {!parent && session.user.isSuperAdmin && <RegisterCommandsButton />}
                </div>
              )}
              {parent && !config?.active && (
                <p className="text-small text-(--color-text-secondary)">
                  If parents have their own Discord server, connect it here: invite the same bot to it, then enter its server ID.
                </p>
              )}
            </div>
            <div className="border-t border-(--color-border) pt-5">
              <h3 className="text-h3 text-(--color-text-primary) mb-4">{config?.active ? "Server configuration" : "Connect the server"}</h3>
              <DiscordConfigForm config={config} audience={audience} />
            </div>
          </section>
        );
      })}

      {/* Account links */}
      <div>
        <h2 className="text-h2 text-(--color-text-primary) mb-3">Account links</h2>
        <p className="text-small text-(--color-text-secondary) mb-3">
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
          <h2 className="text-h2 text-(--color-text-primary) mb-3">Recent activity</h2>
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
