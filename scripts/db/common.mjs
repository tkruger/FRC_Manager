// Shared helpers for the database scripts in this folder.
//
// Connection strings come from the environment or the project's .env file:
//   DATABASE_URL         the current database (export reads it)
//   TARGET_DATABASE_URL  the database to create/fill (schema and import write to it)
// A variable set in the shell wins over .env, e.g.
//   TARGET_DATABASE_URL="postgresql://…" npm run db:schema

import "dotenv/config";
import pg from "pg";

// Keep dates exactly as stored. pg would otherwise read "timestamp without time zone"
// values in this computer's time zone and shift them on the way back in.
for (const oid of [1082, 1114, 1184]) pg.types.setTypeParser(oid, (v) => v); // date, timestamp, timestamptz

export function requireUrl(name) {
  const url = process.env[name];
  if (!url) {
    console.error(`${name} isn't set. Add it to .env or set it in the shell (see scripts/db/README.md).`);
    process.exit(1);
  }
  return url;
}

export function host(url) {
  try { return new URL(url).hostname; } catch { return "(unreadable URL)"; }
}

export async function connect(url) {
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  return c;
}

export const quote = (id) => `"${id.replace(/"/g, '""')}"`;

/** The app's tables (Prisma's own migration log excluded) */
export async function appTables(c) {
  const r = await c.query(`select table_name from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE' and table_name <> '_prisma_migrations'
    order by table_name`);
  return r.rows.map((x) => x.table_name);
}

export async function rowCounts(c, tables) {
  const out = {};
  for (const t of tables) out[t] = Number((await c.query(`select count(*) n from ${quote(t)}`)).rows[0].n);
  return out;
}

export function args() {
  return new Set(process.argv.slice(2));
}

export function fail(e) {
  console.error(`\nStopped: ${e.message}`);
  process.exit(1);
}

/**
 * A database's structure, in comparable form: every column (type, nullable, default),
 * index and constraint. Used to make sure an export and its target line up exactly.
 */
export async function schemaSignature(c) {
  const columns = (await c.query(`select table_name, column_name, data_type, udt_name, is_nullable, column_default
    from information_schema.columns where table_schema = 'public' and table_name <> '_prisma_migrations'
    order by table_name, column_name`)).rows
    .map((r) => `${r.table_name}.${r.column_name} ${r.udt_name}${r.is_nullable === "NO" ? " not null" : ""}${r.column_default ? ` default ${r.column_default}` : ""}`);
  const indexes = (await c.query(`select indexdef from pg_indexes where schemaname = 'public' and tablename <> '_prisma_migrations'
    order by indexname`)).rows.map((r) => r.indexdef);
  // contype 'n' (NOT NULL as a named constraint) only exists from Postgres 18 — skip it;
  // "not null" is already part of each column above, so versions 17 and 18 compare equal
  const constraints = (await c.query(`select conrelid::regclass::text || ' ' || conname || ' ' || pg_get_constraintdef(oid) d
    from pg_constraint where connamespace = 'public'::regnamespace and conrelid::regclass::text <> '_prisma_migrations'
      and contype <> 'n'
    order by 1`)).rows.map((r) => r.d);
  const enums = (await c.query(`select t.typname || ': ' || string_agg(e.enumlabel, ', ' order by e.enumsortorder) d
    from pg_enum e join pg_type t on t.oid = e.enumtypid group by t.typname order by t.typname`)).rows.map((r) => r.d);
  return [...columns, ...indexes, ...constraints, ...enums];
}

/** Lines in one signature but not the other */
export function compareSignatures(expected, actual) {
  const a = new Set(actual), e = new Set(expected);
  return {
    missing: expected.filter((x) => !a.has(x)),  // in the source, not in the target
    extra:   actual.filter((x) => !e.has(x)),     // in the target, not in the source
  };
}
