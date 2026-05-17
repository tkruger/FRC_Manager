// Edge-safe auth configuration — NO Node.js-only imports (no bcrypt, no prisma).
// Used by middleware.ts which runs in the Edge Runtime.
// The full auth.ts (with Credentials provider + bcrypt) is used everywhere else.

import type { NextAuthConfig } from "next-auth";
import type { Role } from "@/generated/prisma";

export const authConfig = {
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: { strategy: "jwt" as const, maxAge: 14 * 24 * 60 * 60 },
  providers: [],   // providers with DB/bcrypt are added in auth.ts
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.teamId = (user as { teamId?: string }).teamId;
        token.roles = (user as { roles?: Role[] }).roles ?? [];
        token.displayMode = (user as { displayMode?: string }).displayMode;
      }
      if (trigger === "update" && session?.displayMode) {
        token.displayMode = session.displayMode;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.teamId = token.teamId as string | undefined;
        session.user.roles = (token.roles as Role[]) ?? [];
        session.user.displayMode = token.displayMode as string | undefined;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
