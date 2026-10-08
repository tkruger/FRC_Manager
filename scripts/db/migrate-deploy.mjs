// Apply any pending migrations to this environment's database (DATABASE_URL).
//
// Runs as the first step of every Vercel build ("build" in package.json), so each
// deployment upgrades its own database — production deploys the production database,
// preprod deploys the preprod branch. If a migration fails, the build fails and the
// deployment never goes live.
//
// Locally the build skips it, so building on a laptop never touches a database. To run
// it on purpose:  npm run db:migrate
//
// Locking: two deployments must never migrate the same database at once. Prisma's own
// advisory lock can be left behind by a pooled (PgBouncer) connection and then blocks
// every later deploy, so it's switched off here. Instead this script holds its own lock
// (a different key) on a direct connection for the whole run. A direct connection is a
// real session: if the build dies, Postgres drops the lock with it.
//
// The direct connection comes from DATABASE_URL_UNPOOLED or DIRECT_URL if set (Neon's
// Vercel integration sets the first); otherwise the pooled Neon host "ep-…-pooler.…" is
// turned into the direct "ep-….…".

import { execSync } from "node:child_process";
import { connect, host, requireUrl } from "./common.mjs";

const onVercel = process.env.VERCEL === "1";
const forced   = process.argv.includes("--force");

if (!onVercel && !forced) {
  console.log("[migrate] Not on Vercel — skipping database migrations (run npm run db:migrate to apply them).");
  process.exit(0);
}

const LOCK_KEY  = 8738_0001;          // ours, not Prisma's 72707369
const WAIT_MS   = 120_000;            // another deploy migrating the same database
const RETRY_MS  = 3_000;

function directUrl() {
  const explicit = process.env.DATABASE_URL_UNPOOLED || process.env.DIRECT_URL;
  if (explicit) return explicit;
  const pooled = requireUrl("DATABASE_URL");
  try {
    const u = new URL(pooled);
    u.hostname = u.hostname.replace(/-pooler(?=\.)/, "");
    u.searchParams.delete("pgbouncer");
    return u.toString();
  } catch {
    return pooled;
  }
}

function looksPooled(url) {
  try {
    const u = new URL(url);
    return /-pooler\./.test(u.hostname) || u.searchParams.get("pgbouncer") === "true" || u.port === "6543";
  } catch {
    return false;
  }
}

const url   = directUrl();
const where = [process.env.VERCEL_ENV, process.env.VERCEL_TARGET_ENV, process.env.VERCEL_GIT_COMMIT_REF].filter(Boolean).join(" · ");
console.log(`[migrate] Database ${host(url)}${where ? ` (${where})` : ""} — ${looksPooled(url) ? "POOLED connection (set DATABASE_URL_UNPOOLED to the direct one)" : "direct connection"}`);

const lockConn = await connect(url);
let locked = false;
try {
  // Hold our lock for the whole run; wait if another deploy is migrating this database
  const started = Date.now();
  while (!(locked = (await lockConn.query("select pg_try_advisory_lock($1) ok", [LOCK_KEY])).rows[0].ok)) {
    if (Date.now() - started > WAIT_MS) {
      const holders = (await lockConn.query(`select a.pid, a.application_name, a.client_addr, a.backend_start, a.state
        from pg_locks l join pg_stat_activity a on a.pid = l.pid
        where l.locktype = 'advisory' and l.objid = $1`, [LOCK_KEY])).rows;
      console.error("[migrate] Another deployment has been migrating this database for 2 minutes. Lock holder:", holders);
      throw new Error("timed out waiting for the migration lock");
    }
    console.log("[migrate] Another deployment is migrating this database — waiting…");
    await new Promise((r) => setTimeout(r, RETRY_MS));
  }

  console.log("[migrate] Applying migrations…");
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url, PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK: "1" },
  });
  console.log("[migrate] Database is up to date.");
} catch (e) {
  console.error(`[migrate] Migrations failed (${e instanceof Error ? e.message : e}) — stopping the build so this deployment doesn't go live.`);
  process.exitCode = 1;
} finally {
  if (locked) await lockConn.query("select pg_advisory_unlock($1)", [LOCK_KEY]).catch(() => {});
  await lockConn.end().catch(() => {});
}
