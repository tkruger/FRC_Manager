// Uses auth.config.ts (Edge-safe) — NOT auth.ts — to avoid importing
// bcryptjs which requires Node.js crypto, unavailable in the Edge Runtime.
import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

const PUBLIC_PATHS = [
  "/login", "/register", "/pending",
  "/api/auth",
  "/api/calendar",    // iCal feed — must be accessible without auth for calendar apps
  "/public/schedule", // Public team schedule page
  "/api/cron",        // Scheduled jobs — authenticated with CRON_SECRET instead
  "/api/discord/interactions", // Called by Discord — authenticated by its Ed25519 signature instead
  "/sw.js",           // Service worker (push notifications)
  "/manifest.webmanifest",
  "/api/manifest",      // Web app manifest (chosen home-screen icon)
  "/app-icons",
  "/terms", "/privacy", // Legal pages — linked from Discord and the sign-in screens
];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  if (isPublic) return NextResponse.next();

  // CSV exports opened in Safari from the iPhone app carry a signed, short-lived
  // token instead of a login (the route verifies it)
  if (pathname === "/api/orders/csv" && req.nextUrl.searchParams.has("token")) return NextResponse.next();

  if (!req.auth) {
    const loginUrl = new URL("/login", req.url);
    // Keep the query (e.g. the Discord /link token) so they land back on the same page
    loginUrl.searchParams.set("callbackUrl", pathname + req.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
