const fs = require("fs");
const f = "src/app/(app)/settings/discord/page.tsx";
let s = fs.readFileSync(f, "utf8"); const crlf = s.includes("\r\n"); s = s.replace(/\r\n/g, "\n");
const rep = (a, b) => { if (!s.includes(a)) throw new Error(a.slice(0, 70)); s = s.replace(a, () => b); };

rep(`  const isAdmin = session.user.roles.some((r) => ["HEAD_MENTOR", "TEAM_LEADERSHIP"].includes(r));
  if (!isAdmin) redirect("/dashboard");

  const [config, members, recentLogs] = await Promise.all([
    prisma.discordConfig.findUnique({ where: { teamId: session.user.teamId } }),`, `  const isAdmin = session.user.roles.some((r) => DISCORD_ADMIN_ROLES.includes(r));
  if (!isAdmin) redirect("/dashboard");

  const [configs, members, recentLogs] = await Promise.all([
    prisma.discordConfig.findMany({ where: { teamId: session.user.teamId } }),`]);
rep(`        <p className="text-body text-(--color-text-secondary) mt-1">
          Connect your team's Discord server to enable slash commands and proactive notifications.
        </p>
      </div>
`, `        <p className="text-body text-(--color-text-secondary) mt-1">
          Connect your team&apos;s Discord servers for slash commands and notifications: the <b>student server</b> gets
          the build notifications (orders, tasks, safety, inventory); an optional <b>parent server</b> gets what parents
          care about — meetings that need adult volunteers, and milestone celebrations. The same bot serves both; members
          run <code>/link</code> once, in either server.
        </p>
      </div>
`);
// Status + form → one card per server
const a = s.indexOf(`      {/* Connection status */}`);
const b = s.indexOf(`      {/* Account links */}`);
if (a < 0 || b < 0) throw new Error("cards block");
const setup = s.slice(s.indexOf(`        {/* Setup instructions */}`), s.indexOf(`      {/* Config form */}`));
s = s.slice(0, a) + `      {(["STUDENT", "PARENT"] as const).map((audience) => {
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
${setup.replace(/^/gm, "    ").replace(/\{!config\?\.active && \(/, "{!parent && !configs.some((c) => c.active) && (")}
            <div className="border-t border-(--color-border) pt-5">
              <h3 className="text-h3 text-(--color-text-primary) mb-4">{config?.active ? "Server configuration" : "Connect the server"}</h3>
              <DiscordConfigForm config={config} audience={audience} />
            </div>
          </section>
        );
      })}

` + s.slice(b);
rep(`import { appUrl } from "@/lib/app-url";`, `import { appUrl } from "@/lib/app-url";
import { DISCORD_ADMIN_ROLES } from "@/lib/rbac";`);
fs.writeFileSync(f, crlf ? s.replace(/\n/g, "\r\n") : s); console.log("ok");
