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
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    teamId?: string;
    roles: Role[];
    displayMode?: string;
  }
}
