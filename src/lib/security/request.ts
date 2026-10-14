// Who's calling: the client IP for rate limiting. Server-only.

import { headers } from "next/headers";

/** The caller's IP from the request headers (Vercel sets x-forwarded-for / x-real-ip) */
export function ipFrom(h: Headers): string {
  return h.get("x-real-ip")?.trim()
    || h.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "unknown";
}

/** The caller's IP inside a server action or server component */
export async function clientIp(): Promise<string> {
  return ipFrom(await headers());
}
