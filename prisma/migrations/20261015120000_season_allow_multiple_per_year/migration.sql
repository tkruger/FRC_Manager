-- A team can have more than one season in a year (e.g. "REBUILT 2026" and "REBUILT Post
-- Season"). Production dropped this unique index without a migration; drop it here too so
-- databases built from migrations match. A no-op where it's already gone.

-- DropIndex
DROP INDEX IF EXISTS "Season_teamId_year_key";
