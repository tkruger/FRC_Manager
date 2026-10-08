// Create all of FRC Manager's tables in an empty database (TARGET_DATABASE_URL), using the
// app's own migrations — the same steps production went through, so the structure matches.
//
//   npm run db:schema
//   npm run db:schema -- --reset   wipe the target first (start a new database over, e.g.
//                                  after a failed run). Never allowed against DATABASE_URL.

import { execSync } from "node:child_process";
import { appTables, args, connect, fail, host, requireUrl } from "./common.mjs";

const target = requireUrl("TARGET_DATABASE_URL");
const source = process.env.DATABASE_URL;
const reset  = args().has("--reset");

try {
  if (source && host(source) === host(target)) {
    throw new Error("TARGET_DATABASE_URL is the same database as DATABASE_URL — point it at the new one.");
  }
  console.log(`Creating tables in ${host(target)}…\n`);

  const c = await connect(target);
  if (reset) {
    // Everything in the target goes: tables, enum types and the migration log
    console.log("--reset: wiping the target database first…\n");
    await c.query("drop schema public cascade");
    await c.query("create schema public");
    await c.query("grant all on schema public to public");
  }

  const before = await appTables(c);
  const hasLog = (await c.query("select to_regclass('_prisma_migrations') t")).rows[0].t;
  const failed = hasLog
    ? (await c.query("select migration_name from _prisma_migrations where finished_at is null and rolled_back_at is null")).rows
    : [];
  await c.end();

  if (failed.length) {
    throw new Error(`A previous run failed partway (${failed.map((r) => r.migration_name).join(", ")}). `
      + "If this is a new database, start it over with: npm run db:schema -- --reset");
  }
  if (before.length) console.log(`(${before.length} tables already exist — only missing migrations will run)\n`);

  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: target, PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK: "1" },
  });

  const d = await connect(target);
  const tables = await appTables(d);
  await d.end();
  console.log(`\nDone: ${tables.length} tables in ${host(target)}.`);
} catch (e) {
  fail(e);
}
