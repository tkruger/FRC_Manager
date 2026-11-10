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
      /** Has asked to join a team (or their team awaits approval): show the waiting screen. teamId is unset until approved. */
      pendingTeam?: boolean;
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
    pendingTeam?: boolean;
    /** The user's sessionVersion when this session started */
    sv?: number;
  }
}
