// Full auth — Node.js runtime only (API routes, server components).
// Middleware uses auth.config.ts instead to avoid the Edge crypto restriction.
import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/lib/auth.config";
import { withImpliedRoles } from "@/lib/rbac";
import type { Role } from "@/generated/prisma";

/** The database host this deployment talks to (never the password) */
function databaseHost(): string {
  try { return new URL(process.env.DATABASE_URL ?? "").hostname || "(not set)"; } catch { return "(invalid URL)"; }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  events: {
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
