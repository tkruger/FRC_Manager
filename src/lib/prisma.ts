import { PrismaClient } from "@/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";

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
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
