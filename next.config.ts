import type { NextConfig } from "next";

// The Content Security Policy is set per request by the proxy (src/proxy.ts), with a nonce for
// inline scripts — see src/lib/security/csp.ts.
const securityHeaders = [
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
