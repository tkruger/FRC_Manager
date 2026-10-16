import type { NextConfig } from "next";

const dev = process.env.NODE_ENV !== "production";
// Only on Vercel (always HTTPS): locally, `next start` serves plain http on localhost
const onVercel = !!process.env.VERCEL;

// Content Security Policy. 'unsafe-inline' scripts are needed for Next's inline bootstrap
// and the blocking theme script in app/layout.tsx; everything else is locked to this site,
// Vercel Analytics, and tool photos in Vercel Blob. Google/Discord appear in form-action
// because signing in with them redirects there.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""} https://va.vercel-scripts.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.public.blob.vercel-storage.com",
  "font-src 'self' data:",
  `connect-src 'self' https://va.vercel-scripts.com https://vitals.vercel-insights.com${dev ? " ws: wss:" : ""}`,
  "media-src 'self' blob:",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://accounts.google.com https://discord.com",
  "frame-ancestors 'none'",
  ...(onVercel ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // Don't let other sites frame the app (clickjacking)
  { key: "X-Frame-Options", value: "DENY" },
  // Links out of the app don't carry tokens in the URL (invites, exports, calendar)
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // The camera is used for barcode scanning; nothing else is needed
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // The Team Admin page is now the Buyer page
      { source: "/procurement/admin", destination: "/procurement/buyer", permanent: true },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        // Service worker must never be cached, or push handling changes won't reach devices
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
