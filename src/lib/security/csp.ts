// Content Security Policy, set per request by the proxy (src/proxy.ts) with a fresh nonce. Scripts run
// only from this site, Vercel Analytics, or inline with the nonce: Next.js puts it on its own inline
// scripts (it reads it from this header), and the theme script in app/layout.tsx reads it from the
// x-nonce request header. So a script that got into a page some other way doesn't run.
// Edge-safe: no imports.

/** A new random nonce for one request */
export function newNonce(): string {
  return btoa(crypto.randomUUID());
}

export function contentSecurityPolicy(nonce: string): string {
  const dev = process.env.NODE_ENV !== "production";
  // Only on Vercel (always HTTPS): locally, `next start` serves plain http on localhost
  const onVercel = !!process.env.VERCEL;
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'${dev ? " 'unsafe-eval'" : ""} https://va.vercel-scripts.com`,
    // Inline style attributes (React's style={…}) can't carry a nonce
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.public.blob.vercel-storage.com",
    "font-src 'self' data:",
    `connect-src 'self' https://va.vercel-scripts.com https://vitals.vercel-insights.com${dev ? " ws: wss:" : ""}`,
    "media-src 'self' blob:",
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    // Google/Discord: signing in with them redirects there
    "form-action 'self' https://accounts.google.com https://discord.com",
    "frame-ancestors 'none'",
    ...(onVercel ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}
