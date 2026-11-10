import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EMAIL_ADMIN_ROLES } from "@/lib/rbac";
import { seal, open } from "@/lib/security/secret-box";
import { exchangeGmailCode, GmailError, revokeGmail, GMAIL_REASON_COOKIE } from "@/lib/gmail-api";
import { safeEqual } from "@/lib/security/crypto";
import { appUrl } from "@/lib/app-url";

// Google sends the person back here after "Connect with Google". The state must match the cookie set
// when they left, for the same signed-in Head Mentor / Integration Admin and team. Then the refresh
// token is saved (encrypted) and the team's email sends through Gmail.

export const dynamic = "force-dynamic";
const STATE_COOKIE = "gmail_oauth_state";

export async function GET(request: NextRequest) {
  const back = (q: string) => {
    const res = NextResponse.redirect(`${appUrl()}/settings/email?gmail=${q}`);
    res.cookies.delete({ name: STATE_COOKIE, path: "/api/integrations/gmail" });
    return res;
  };
  const url = new URL(request.url);
  if (url.searchParams.get("error")) return back("cancelled");

  const session = await auth();
  if (!session?.user?.teamId || !session.user.roles.some((r) => EMAIL_ADMIN_ROLES.includes(r))) return back("denied");
  const [state, teamId, userId] = (request.cookies.get(STATE_COOKIE)?.value ?? "").split(".");
  const given = url.searchParams.get("state") ?? "";
  if (!state || !safeEqual(given, state) || teamId !== session.user.teamId || userId !== session.user.id) return back("expired");
  const code = url.searchParams.get("code");
  if (!code) return back("cancelled");

  try {
    const { refreshToken, email } = await exchangeGmailCode(code);
    const [existing, team] = await Promise.all([
      prisma.teamEmailServer.findUnique({ where: { teamId }, select: { refreshTokenEnc: true, fromName: true, fromEmail: true, method: true } }),
      prisma.team.findUnique({ where: { id: teamId }, select: { teamNumber: true } }),
    ]);
    // The old Google connection (a different account, or this one again) is no longer needed
    const old = existing?.refreshTokenEnc ? open(existing.refreshTokenEnc) : null;
    if (old && old !== refreshToken) await revokeGmail(old);
    // Keep a Send-mail-as alias chosen earlier for this account; otherwise send as the account itself
    const keepAlias = existing?.method === "gmail_api" && existing.fromEmail && existing.fromEmail !== email;
    const data = {
      provider: "gmail", method: "gmail_api",
      host: null, port: null, security: null, username: null, passwordEnc: null,
      refreshTokenEnc: seal(refreshToken), googleEmail: email, serviceKeyEnc: null, serviceAccountEmail: null,
      fromName: existing?.fromName ?? (team ? `FRC Team ${team.teamNumber}` : null),
      fromEmail: keepAlias ? existing!.fromEmail : email,
      enabled: true, lastError: null, lastErrorAt: null, updatedById: session.user.id,
    };
    await prisma.teamEmailServer.upsert({ where: { teamId }, create: { teamId, ...data }, update: data });
    return back("connected");
  } catch (e) {
    console.error("[gmail] connect failed:", e instanceof Error ? e.message : e);
    const res = back("failed");
    // Why, for the settings page — in a short-lived cookie only this route sets, not the address
    // (a ?reason= in the address would let anyone send a mentor a link showing their own words)
    if (e instanceof GmailError) {
      res.cookies.set(GMAIL_REASON_COOKIE, e.message.slice(0, 300), {
        httpOnly: true, sameSite: "lax", secure: appUrl().startsWith("https:"), path: "/settings/email", maxAge: 120,
      });
    }
    return res;
  }
}
