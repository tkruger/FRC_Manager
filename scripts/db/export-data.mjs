// Save every row of the current database (DATABASE_URL) to a JSON file in db-export/.
// Only reads. The file holds real data (emails, password hashes, tokens): it's kept out of
// git — store it somewhere private and delete it when you're done.
//
//   npm run db:export

import fs from "node:fs";
import path from "node:path";
import { appTables, connect, fail, host, quote, requireUrl } from "./common.mjs";

const source = requireUrl("DATABASE_URL");

try {
  const c = await connect(source);
  const tables = await appTables(c);
  const migrations = (await c.query(`select migration_name from _prisma_migrations
    where finished_at is not null and rolled_back_at is null order by migration_name`)).rows.map((r) => r.migration_name);

  const data = {};
  let total = 0;
  for (const t of tables) {
    const rows = (await c.query(`select * from ${quote(t)}`)).rows;
    data[t] = rows;
    total += rows.length;
  }
  await c.end();

  const dir = path.resolve("db-export");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `frc-manager-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.json`);
  fs.writeFileSync(file, JSON.stringify({
    exportedAt: new Date().toISOString(),
    from: host(source),
    // The import checks the new database has the same migrations, so the columns line up
    migrations,
    tables: data,
  }));

  console.log(`Exported ${tables.length} tables, ${total} rows from ${host(source)}`);
  console.log(`→ ${path.relative(process.cwd(), file)}`);
} catch (e) {
  fail(e);
}
