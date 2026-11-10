// Uses auth.config.ts (Edge-safe) — NOT auth.ts — to avoid importing
// bcryptjs which requires Node.js crypto, unavailable in the Edge Runtime.
import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
import { NextResponse } from "next/server";
import { contentSecurityPolicy, newNonce } from "@/lib/security/csp";

const { auth } = NextAuth(authConfig);

// Pages and routes that work signed out. Exact paths only — a new route under one of
// these doesn't become public by accident. Each still does its own checks.
const PUBLIC_EXACT = new Set([
  "/login", "/register", "/register/finish", "/pending",
  "/forgot-password",
  "/terms", "/privacy",          // Legal pages — linked from Discord and the sign-in screens
  "/sw.js",                      // Service worker (push notifications)
  "/manifest.webmanifest",
  "/api/manifest",               // Web app manifest (chosen home-screen icon)
  "/api/discord/interactions",   // Called by Discord — authenticated by its Ed25519 signature instead
]);

// Whole subtrees that are public (matched with the trailing slash)
const PUBLIC_PREFIXES = [
  "/api/auth/",
  "/api/calendar/",    // iCal feed — must be accessible without auth for calendar apps
  "/public/schedule/", // Public team schedule page
  "/api/cron/",        // Scheduled jobs — authenticated with CRON_SECRET instead
  "/api/webhooks/",    // Each team's TBA / Nexus webhooks — authenticated by its signature or token instead
  "/invite/",          // Invite links — people open them before they have an account
  "/reset-password/",  // Emailed password-reset links
  "/verify-email/",    // Emailed confirmation links
  "/app-icons/",
];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // A fresh nonce for this request's Content Security Policy: Next.js reads it from the request's
  // CSP header for its own inline scripts; app/layout.tsx reads x-nonce for the theme script.
  // (The service worker has its own policy, in next.config.ts.)
  const csp = pathname === "/sw.js" ? null : contentSecurityPolicy(newNonce());
  const next = () => {
    if (!csp) return NextResponse.next();
    const headers = new Headers(req.headers);
    headers.set("x-nonce", /'nonce-([^']+)'/.exec(csp)![1]);
    headers.set("Content-Security-Policy", csp);
    const res = NextResponse.next({ request: { headers } });
    res.headers.set("Content-Security-Policy", csp);
    return res;
  };

  const isPublic = PUBLIC_EXACT.has(pathname) || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
  if (isPublic) return next();

  // CSV exports opened in Safari from the iPhone app carry a signed, short-lived
  // token instead of a login (the route verifies it)
  if (pathname === "/api/orders/csv" && req.nextUrl.searchParams.has("token")) return next();

  if (!req.auth) {
    const loginUrl = new URL("/login", req.url);
    // Keep the query (e.g. the Discord /link token) so they land back on the same page
    loginUrl.searchParams.set("callbackUrl", pathname + req.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  return next();
});

export const config = {
  // _vercel: the Analytics script and events must load for signed-out visitors too
  matcher: ["/((?!_next/static|_next/image|_vercel|favicon.ico|.*\\.png$).*)"],
};
