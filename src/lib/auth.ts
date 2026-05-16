import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/generated/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt", maxAge: 14 * 24 * 60 * 60 },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
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
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.teamId = (user as { teamId?: string }).teamId;
        token.roles = (user as { roles?: Role[] }).roles ?? [];
        token.displayMode = (user as { displayMode?: string }).displayMode;
      }
      // handle update() calls from client
      if (trigger === "update" && session) {
        if (session.displayMode) token.displayMode = session.displayMode;
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
});
