// Full auth — Node.js runtime only (API routes, server components).
// Middleware uses auth.config.ts instead to avoid the Edge crypto restriction.
import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import Discord from "next-auth/providers/discord";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/lib/auth.config";
import { withImpliedRoles } from "@/lib/rbac";
import type { Role } from "@/generated/prisma";

/** Discord sign-in uses the bot's application (DISCORD_APPLICATION_ID) plus its OAuth2 client secret */
const DISCORD_CLIENT_ID     = process.env.DISCORD_CLIENT_ID ?? process.env.DISCORD_APPLICATION_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;

/** Sign-in methods besides email and password that this deployment has set up */
export function oauthProviders(): ("google" | "discord")[] {
  return [
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET ? ["google" as const] : []),
    ...(DISCORD_CLIENT_ID && DISCORD_CLIENT_SECRET ? ["discord" as const] : []),
  ];
}

/**
 * Signing in with Discord also links the account for the Discord bot (slash commands,
 * DMs), unless either side is already linked.
 */
async function linkDiscordForBot(userId: string, discordUserId: string, discordUsername: string | null) {
  try {
    const taken = await prisma.discordLink.findFirst({
      where:  { OR: [{ userId }, { discordUserId }] },
      select: { id: true },
    });
    if (!taken) await prisma.discordLink.create({ data: { userId, discordUserId, discordUsername } });
  } catch (e) {
    console.warn("[auth] Couldn't link Discord for the bot:", e);
  }
}

/** The database host this deployment talks to (never the password) */
function databaseHost(): string {
  try { return new URL(process.env.DATABASE_URL ?? "").hostname || "(not set)"; } catch { return "(invalid URL)"; }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  events: {
    linkAccount({ user, account, profile }) {
      if (account.provider === "discord" && user.id) {
        const username = (profile as { username?: string } | undefined)?.username ?? null;
        return linkDiscordForBot(user.id, account.providerAccountId, username);
      }
    },
    // One line in the server logs per sign-in: which database and deployment served it
    // (Vercel → project → Logs). Helps confirm each environment uses its own database.
    signIn({ user, account }) {
      console.info(
        `[auth] sign-in ${user.email ?? user.id ?? "unknown"} via ${account?.provider ?? "?"} ` +
        `— database ${databaseHost()} — ${process.env.VERCEL_ENV ?? "local"}` +
        (process.env.VERCEL_TARGET_ENV && process.env.VERCEL_TARGET_ENV !== process.env.VERCEL_ENV ? ` (${process.env.VERCEL_TARGET_ENV})` : "") +
        (process.env.VERCEL_GIT_COMMIT_REF ? ` @ ${process.env.VERCEL_GIT_COMMIT_REF}` : ""),
      );
    },
  },
  callbacks: {
    ...authConfig.callbacks,
    // Discord accounts sign in (and match an existing account by email) only with an
    // email address Discord has verified
    async signIn({ account, profile }) {
      if (account?.provider === "discord") {
        const p = profile as { email?: string | null; verified?: boolean } | undefined;
        if (!p?.email || !p.verified) return "/login?error=DiscordEmail";
      }
      return true;
    },
    // Roles, team and status used to be frozen into the JWT at sign-in, so a suspended
    // member (or one whose roles were removed) kept access until the token expired.
    // Re-read them on every server-side session check. (The Edge proxy keeps using
    // auth.config.ts, which only checks that a session exists.)
    async jwt(params) {
      const token = await authConfig.callbacks.jwt(params);
      if (!token?.id) return token;
      const user = await prisma.user.findUnique({
        where:  { id: token.id as string },
        select: { status: true, teamId: true, isSuperAdmin: true, roles: { select: { role: true } } },
      });
      if (!user || user.status === "SUSPENDED" || user.status === "DENIED") return null;
      token.teamId = user.teamId ?? undefined;
      token.status = user.status;
      // Mentor counts as Team Leadership (withImpliedRoles) for every permission check
      token.roles  = user.status === "ACTIVE" ? withImpliedRoles(user.roles.map((r) => r.role)) : [];
      token.isSuperAdmin = user.status === "ACTIVE" && user.isSuperAdmin;
      return token;
    },
  },
  adapter: PrismaAdapter(prisma),
  providers: [
    // Only include Google if both credentials are present — avoids the
    // "Missing required parameter: client_id" error when env vars aren't set.
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [Google({ clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET })]
      : []),
    ...(DISCORD_CLIENT_ID && DISCORD_CLIENT_SECRET
      ? [Discord({
          clientId: DISCORD_CLIENT_ID,
          clientSecret: DISCORD_CLIENT_SECRET,
          // Discord now adds iss=https://discord.com to its callback (RFC 9207). Without this,
          // Auth.js checks it against its placeholder issuer and rejects the sign-in.
          issuer: "https://discord.com",
          // Discord verifies email addresses (checked in signIn above), so an existing
          // FRC Manager account with the same email signs in with Discord too
          allowDangerousEmailAccountLinking: true,
          // prompt=none skips Discord's consent screen after the first time
          authorization: { params: { scope: "identify email", prompt: "none" } },
        })]
      : []),
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
          include: { roles: true },
        });

        if (!user || !user.password) return null;
        if (user.status !== "ACTIVE") return null;

        const valid = await bcrypt.compare(
          credentials.password as string,
          user.password
        );
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          teamId: user.teamId,
          roles: user.roles.map((r: { role: Role }) => r.role),
          displayMode: user.displayMode,
        };
      },
    }),
  ],
});
