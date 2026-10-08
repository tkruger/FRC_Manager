// Make someone a super admin (platform admin who approves new teams), or list them.
// Needed once to create the first super admin; after that they can add others in
// Settings → Team approvals.
//
//   npm run db:super-admin -- someone@example.com           grant (DATABASE_URL)
//   npm run db:super-admin -- someone@example.com --remove  revoke
//   npm run db:super-admin                                  list current super admins
//   add --target to use TARGET_DATABASE_URL instead of DATABASE_URL

import { args, connect, fail, host, requireUrl } from "./common.mjs";

const flags  = args();
const url    = requireUrl(flags.has("--target") ? "TARGET_DATABASE_URL" : "DATABASE_URL");
const email  = process.argv.slice(2).find((a) => !a.startsWith("--"));
const remove = flags.has("--remove");

try {
  const c = await connect(url);
  console.log(`Database: ${host(url)}\n`);

  if (email) {
    const { rows } = await c.query(`select id, name, status, "isSuperAdmin" from "User" where lower(email) = lower($1)`, [email]);
    const user = rows[0];
    if (!user) throw new Error(`No account uses ${email}. They need to register first.`);
    if (remove) {
      const others = (await c.query(`select count(*) n from "User" where "isSuperAdmin" and status = 'ACTIVE' and id <> $1`, [user.id])).rows[0].n;
      if (Number(others) === 0) throw new Error("That's the last super admin — add another before removing them.");
    } else if (user.status !== "ACTIVE") {
      throw new Error(`${user.name}'s account is ${user.status.toLowerCase()}, not active.`);
    }
    await c.query(`update "User" set "isSuperAdmin" = $2 where id = $1`, [user.id, !remove]);
    console.log(remove ? `${user.name} is no longer a super admin.` : `${user.name} is now a super admin.`);
  }

  const admins = (await c.query(`select name, email from "User" where "isSuperAdmin" order by name`)).rows;
  console.log(`\nSuper admins (${admins.length}):`);
  for (const a of admins) console.log(`  ${a.name} <${a.email}>`);
  await c.end();
} catch (e) {
  fail(e);
}
