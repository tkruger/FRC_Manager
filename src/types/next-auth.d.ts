import type { Role } from "@/generated/prisma";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      teamId?: string;
      roles: Role[];
      displayMode?: string;
      /** Platform admin: approves new teams */
      isSuperAdmin?: boolean;
      /** PENDING until approved (people who sign up with Google or Discord get a session right away) */
      status?: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    teamId?: string;
    roles: Role[];
    displayMode?: string;
    isSuperAdmin?: boolean;
    status?: string;
    /** The user's sessionVersion when this session started */
    sv?: number;
  }
}
