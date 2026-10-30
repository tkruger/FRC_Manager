import { PrismaClient } from "@/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { withChangeLog } from "@/lib/audit/changes";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

/**
 * pg already treats sslmode=prefer/require/verify-ca as verify-full (encrypted, and the
 * server's certificate is checked) and warns that this will change in its next major
 * version. Saying verify-full keeps exactly that behavior and silences the warning.
 */
export function withStrictSsl(url: string): string {
  return url.replace(/([?&]sslmode=)(?:prefer|require|verify-ca)(?=&|$)/i, "$1verify-full");
}

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: withStrictSsl(process.env.DATABASE_URL!) });
  const base = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
  // Records who changed what on orders, tasks and meetings. Only adds query hooks — the
  // client's API is unchanged, so it keeps the plain client's type.
  return withChangeLog(base) as unknown as PrismaClient;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
