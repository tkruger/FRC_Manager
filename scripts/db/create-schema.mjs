// Create all of FRC Manager's tables in an empty database (TARGET_DATABASE_URL), using the
// app's own migrations — the same steps production went through, so the structure matches.
//
//   npm run db:schema

import { execSync } from "node:child_process";
import { appTables, connect, fail, host, requireUrl } from "./common.mjs";

const target = requireUrl("TARGET_DATABASE_URL");
const source = process.env.DATABASE_URL;

try {
  if (source && host(source) === host(target)) {
    throw new Error("TARGET_DATABASE_URL is the same database as DATABASE_URL — point it at the new one.");
  }
  console.log(`Creating tables in ${host(target)}…\n`);

  const c = await connect(target);
  const before = await appTables(c);
  await c.end();
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
