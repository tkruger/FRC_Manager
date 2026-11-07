// Make the small list copies (thumbnails) for stored photos uploaded before they existed. Photos
// uploaded since then get one from the browser. Safe to run again: only photos without one are done.
//
//   npm run db:photo-thumbs              DATABASE_URL
//   npm run db:photo-thumbs -- --target  TARGET_DATABASE_URL
//
// Uses sharp (installed with Next.js).

import sharp from "sharp";
import { args, connect, fail, host, requireUrl } from "./common.mjs";

const flags = args();
const url   = requireUrl(flags.has("--target") ? "TARGET_DATABASE_URL" : "DATABASE_URL");

try {
  const c = await connect(url);
  console.log(`Database: ${host(url)}\n`);
  const { rows } = await c.query(`select id from "StoredPhoto" where thumb is null order by "createdAt"`);
  console.log(`${rows.length} photo${rows.length === 1 ? "" : "s"} without a thumbnail`);
  let done = 0;
  for (const { id } of rows) {
    const { rows: [p] } = await c.query(`select data from "StoredPhoto" where id = $1`, [id]);
    try {
      const thumb = await sharp(p.data).rotate().resize(320, 320, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 75 }).toBuffer();
      await c.query(`update "StoredPhoto" set thumb = $2 where id = $1`, [id, thumb]);
      done++;
    } catch (e) {
      console.warn(`  ${id}: couldn't read it (${e.message})`);
    }
  }
  console.log(`Made ${done}.`);
  await c.end();
} catch (e) {
  fail(e);
}
