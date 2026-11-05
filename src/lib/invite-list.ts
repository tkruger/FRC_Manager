// Reading a list of people to invite, as pasted from an email's To: line or typed by hand. Each entry
// can be a plain address or a name and address:
//
//   alex@example.com, Dana Starler <dana@example.com>; "Starler, Dana" <dana@example.com>
//   Starler, Dana <dana@example.com>   (Outlook)        <sam@example.com>        mailto:sam@example.com
//
// separated by commas, semicolons, new lines or spaces. "Last, First" names become "First Last".
// Client-safe (no database access).

export interface InviteEntry { email: string; name: string | null }

const EMAIL = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]+$/;

/** "Starler, Dana" → "Dana Starler"; quotes and extra spaces removed */
function cleanName(raw: string): string | null {
  let n = raw.replace(/["']/g, "").replace(/\s+/g, " ").trim().replace(/^[,;]+|[,;]+$/g, "").trim();
  const parts = n.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 2) n = `${parts[1]} ${parts[0]}`;
  return n ? n.slice(0, 100) : null;
}

const plain = (s: string) => s.replace(/^mailto:/i, "").trim().toLowerCase();

/** Every entry in the list, plus anything that isn't an email address (to report back) */
export function parseInviteList(raw: string): { entries: InviteEntry[]; invalid: string[] } {
  const entries: InviteEntry[] = [];
  const invalid: string[] = [];
  const addPlain = (text: string) => {
    for (const t of text.split(/[\s,]+/).map((x) => x.trim()).filter(Boolean)) {
      const e = plain(t);
      if (EMAIL.test(e)) entries.push({ email: e, name: null }); else invalid.push(t);
    }
  };

  // Semicolons and new lines always separate people; commas might be inside a name
  for (const segment of raw.split(/[;\n\r]+/)) {
    let rest = segment;
    // Each "<address>" belongs to the name just before it
    for (let m = rest.match(/<([^<>]*)>/); m && m.index !== undefined; m = rest.match(/<([^<>]*)>/)) {
      const before = rest.slice(0, m.index);
      rest = rest.slice(m.index + m[0].length);
      // Anything before the name that looks like an address is its own entry ("a@b.com, Dana <d@…>")
      let nameText = before;
      const quoted = before.match(/"([^"]*)"\s*$/);
      if (quoted) {
        addPlain(before.slice(0, quoted.index));
        nameText = quoted[1];
      } else {
        const pieces = before.split(",");
        const firstName = pieces.findIndex((p, i) => !pieces.slice(i).some((q) => q.includes("@")) );
        const lead = firstName > 0 ? pieces.slice(0, firstName) : pieces.filter((p) => p.includes("@"));
        if (lead.length && lead.every((p) => p.includes("@") || !p.trim())) {
          addPlain(lead.join(","));
          nameText = pieces.slice(lead.length).join(",");
        }
      }
      const e = plain(m[1]);
      if (EMAIL.test(e)) entries.push({ email: e, name: cleanName(nameText) }); else invalid.push(m[0]);
    }
    addPlain(rest);
  }

  // One invite per address — the first name given wins
  const seen = new Map<string, InviteEntry>();
  for (const e of entries) {
    const had = seen.get(e.email);
    if (!had) seen.set(e.email, e);
    else if (!had.name && e.name) had.name = e.name;
  }
  return { entries: [...seen.values()], invalid };
}

/** "Dana Starler <dana@…>" or just the address */
export const inviteLabel = (e: { email: string | null; name?: string | null }) =>
  e.name ? `${e.name} <${e.email ?? ""}>` : e.email ?? "";
