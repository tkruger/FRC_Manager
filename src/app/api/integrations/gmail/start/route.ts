import crypto from "crypto";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { EMAIL_ADMIN_ROLES } from "@/lib/rbac";
import { gmailAuthUrl, gmailConfigured } from "@/lib/gmail-api";
import { appUrl } from "@/lib/app-url";

// "Connect with Google" (Settings → Team email): off to Google's consent screen. A one-time state,
// kept in a short-lived cookie, ties the answer to this person and team.

export const dynamic = "force-dynamic";
const STATE_COOKIE = "gmail_oauth_state";

export async function GET() {
  const session = await auth();
  const back = `${appUrl()}/settings/email`;
  if (!session?.user?.teamId || !session.user.roles.some((r) => EMAIL_ADMIN_ROLES.includes(r))) return NextResponse.redirect(`${back}?gmail=denied`);
  if (!gmailConfigured()) return NextResponse.redirect(`${back}?gmail=unavailable`);

  const state = crypto.randomBytes(24).toString("base64url");
  const res = NextResponse.redirect(gmailAuthUrl(state));
  res.cookies.set(STATE_COOKIE, `${state}.${session.user.teamId}.${session.user.id}`, {
    httpOnly: true, secure: appUrl().startsWith("https:"), sameSite: "lax", path: "/api/integrations/gmail", maxAge: 600,
  });
  return res;
}
