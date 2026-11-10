// Links people type in (product pages, vendor sites, tracking). Safe to import on server and client.

/** A web address (http or https) — never javascript:, data: and the like */
export function isWebUrl(v: string | null | undefined): v is string {
  if (!v) return false;
  try { const u = new URL(v); return u.protocol === "https:" || u.protocol === "http:"; } catch { return false; }
}

/** "wcproducts.com/…" → "https://wcproducts.com/…"; anything else unchanged */
export function withScheme(v: string): string {
  const s = v.trim();
  return s && !/^[a-z][a-z0-9+.-]*:/i.test(s) && /^[\w-]+(\.[\w-]+)+([/?#]|$)/.test(s) ? `https://${s}` : s;
}

/** For an href: the link when it's a web address, otherwise nothing (the text shows without a link) */
export const webHref = (v: string | null | undefined): string | undefined => (isWebUrl(v) ? v : undefined);
