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
// Migrations use a direct (non-pooled) connection: Neon's pooler can't hold the advisory
// lock Prisma takes to stop two deployments migrating at once. Set DATABASE_URL_UNPOOLED
// (Neon's Vercel integration does) or DIRECT_URL to choose it; otherwise the pooled host
// "ep-…-pooler.…" is turned into the direct "ep-….…".

import { execSync } from "node:child_process";
import { host, requireUrl } from "./common.mjs";

const onVercel = process.env.VERCEL === "1";
const forced   = process.argv.includes("--force");

if (!onVercel && !forced) {
  console.log("[migrate] Not on Vercel — skipping database migrations (run npm run db:migrate to apply them).");
  process.exit(0);
}

const pooled = requireUrl("DATABASE_URL");

function directUrl() {
  const explicit = process.env.DATABASE_URL_UNPOOLED || process.env.DIRECT_URL;
  if (explicit) return explicit;
  try {
    const u = new URL(pooled);
    u.hostname = u.hostname.replace(/-pooler(?=\.)/, "");
    return u.toString();
  } catch {
    return pooled;
  }
}

const url = directUrl();
const where = [process.env.VERCEL_ENV, process.env.VERCEL_TARGET_ENV, process.env.VERCEL_GIT_COMMIT_REF].filter(Boolean).join(" · ");
console.log(`[migrate] Applying migrations to ${host(url)}${where ? ` (${where})` : ""}`);

try {
  execSync("npx prisma migrate deploy", { stdio: "inherit", env: { ...process.env, DATABASE_URL: url } });
  console.log("[migrate] Database is up to date.");
} catch {
  console.error("[migrate] Migrations failed — stopping the build so this deployment doesn't go live.");
  process.exit(1);
}
