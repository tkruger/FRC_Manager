# Database scripts

Copy FRC Manager's data into a new Postgres database (for example a new Neon project).

| Command | What it does | Uses |
|---|---|---|
| `npm run db:schema` | Creates every table in an empty database, using the app's migrations (`--reset` wipes the target first) | `TARGET_DATABASE_URL` |
| `npm run db:export` | Saves every row of the current database to `db-export/…json` (read-only) | `DATABASE_URL` |
| `npm run db:super-admin -- <email>` | Makes someone a super admin (approves new teams). `--remove` revokes; no email lists them; `--target` uses the new database | `DATABASE_URL` |
| `npm run db:import -- <file>` | Loads an export into the target database (`--replace` empties it first) | `TARGET_DATABASE_URL` |

Connection strings come from `.env`, or from the shell (the shell wins):

```bash
TARGET_DATABASE_URL="postgresql://…" npm run db:schema
```

PowerShell:

```powershell
$env:TARGET_DATABASE_URL = "postgresql://…"; npm run db:schema
```

Both scripts that write refuse to run against the same database as `DATABASE_URL`.

## Moving to a new database

1. Create the new database (Neon: new project, Postgres 17, AWS US East).
2. `npm run db:schema` with `TARGET_DATABASE_URL` set to it — creates the tables.
3. `npm run db:export` — saves the current data to `db-export/`.
4. `npm run db:import -- db-export/<file>.json` — loads it. Counts are checked and every link
   between records is re-validated; if anything fails, nothing is changed.
5. Create branches from it (e.g. `preprod`, `dev`) — in Neon a branch is an instant copy with
   the data, so there's no need to import into each one.
6. Point Vercel's production `DATABASE_URL` at the new database and redeploy.

To refresh the data just before switching over: export again, then import with `--replace`.

The export file contains real team data (emails, password hashes, tokens). `db-export/` is
git-ignored — keep the file private and delete it when you're done.
