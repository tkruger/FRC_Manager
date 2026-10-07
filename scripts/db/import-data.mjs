// Load an export (from db:export) into TARGET_DATABASE_URL. The tables must exist already
// (run db:schema first) and be empty — or pass --replace to empty them first.
//
//   npm run db:import -- db-export/frc-manager-….json
//   npm run db:import -- db-export/frc-manager-….json --replace
//
// Runs in one transaction: if anything fails, nothing is changed. Links between records
// are switched off while loading and switched back on at the end, which re-checks them all.

import fs from "node:fs";
import { appTables, args, connect, fail, host, quote, requireUrl, rowCounts } from "./common.mjs";

const target = requireUrl("TARGET_DATABASE_URL");
const file = process.argv.slice(2).find((a) => !a.startsWith("--"));
const replace = args().has("--replace");

try {
  if (!file || !fs.existsSync(file)) throw new Error("Give the export file, e.g. npm run db:import -- db-export/frc-manager-….json");
  if (process.env.DATABASE_URL && host(process.env.DATABASE_URL) === host(target)) {
    throw new Error("TARGET_DATABASE_URL is the same database as DATABASE_URL — refusing to import into it.");
  }
  const dump = JSON.parse(fs.readFileSync(file, "utf8"));
  console.log(`Importing ${file} (exported ${dump.exportedAt} from ${dump.from})\n into ${host(target)}\n`);

  const c = await connect(target);

  // Same migrations on both sides, so every column exists and means the same thing
  const have = new Set((await c.query(`select migration_name from _prisma_migrations
    where finished_at is not null and rolled_back_at is null`)).rows.map((r) => r.migration_name));
  const missing = dump.migrations.filter((m) => !have.has(m));
  if (missing.length) throw new Error(`The new database is missing migrations (run npm run db:schema): ${missing.join(", ")}`);

  const tables = await appTables(c);
  const absent = Object.keys(dump.tables).filter((t) => !tables.includes(t));
  if (absent.length) throw new Error(`Tables not in the new database: ${absent.join(", ")}`);

  const existing = await rowCounts(c, tables);
  const filled = tables.filter((t) => existing[t] > 0);
  if (filled.length && !replace) throw new Error(`The new database already has data (${filled.join(", ")}). Use --replace to empty it first.`);

  const fks = (await c.query(`select conrelid::regclass::text tbl, conname, pg_get_constraintdef(oid) def
    from pg_constraint where contype = 'f' and connamespace = 'public'::regnamespace`)).rows;

  await c.query("begin");
  try {
    for (const f of fks) await c.query(`alter table ${f.tbl} drop constraint ${quote(f.conname)}`);
    if (replace) await c.query(`truncate ${tables.map(quote).join(", ")}`);

    for (const [t, rows] of Object.entries(dump.tables)) {
      if (!rows.length) continue;
      const cols = (await c.query(`select column_name, data_type from information_schema.columns
        where table_schema = 'public' and table_name = $1`, [t])).rows;
      const json = new Set(cols.filter((x) => x.data_type === "jsonb" || x.data_type === "json").map((x) => x.column_name));
      const names = Object.keys(rows[0]);

      for (let i = 0; i < rows.length; i += 200) {
        const params = [];
        const values = rows.slice(i, i + 200).map((row) => `(${names.map((n) => {
          const v = row[n];
          // JSON columns go in as JSON text (a JSON list would otherwise become a Postgres array)
          params.push(json.has(n) && v !== null ? JSON.stringify(v) : v);
          return `$${params.length}`;
        }).join(", ")})`);
        await c.query(`insert into ${quote(t)} (${names.map(quote).join(", ")}) values ${values.join(", ")}`, params);
      }
      console.log(`  ${t}: ${rows.length}`);
    }

    for (const f of fks) await c.query(`alter table ${f.tbl} add constraint ${quote(f.conname)} ${f.def}`);
    await c.query("commit");
  } catch (e) {
    await c.query("rollback");
    throw e;
  }

  const after = await rowCounts(c, Object.keys(dump.tables));
  await c.end();
  const wrong = Object.keys(dump.tables).filter((t) => after[t] !== dump.tables[t].length);
  const total = Object.values(dump.tables).reduce((n, rows) => n + rows.length, 0);
  if (wrong.length) throw new Error(`Row counts differ: ${wrong.map((t) => `${t} ${dump.tables[t].length}→${after[t]}`).join(", ")}`);
  console.log(`\nDone: ${Object.keys(dump.tables).length} tables, ${total} rows. Counts match and every link between records was re-checked.`);
} catch (e) {
  fail(e);
}
