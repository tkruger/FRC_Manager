// The site's public address, for links the app hands out (calendar feeds, public
// schedule, Discord links). Server-only — reads environment variables.

/**
 * 1. AUTH_URL / NEXTAUTH_URL — what sign-in uses, so links always match it
 * 2. On Vercel: the production domain (your custom domain once it's added) in production,
 *    or the deployment's own address in preview / pre-production
 * 3. Locally: http://localhost:3000
 */
export function appUrl(): string {
  const explicit = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL;
  if (explicit) return explicit.replace(/\/+$/, "");

  const vercelHost = process.env.VERCEL_ENV === "production"
    ? process.env.VERCEL_PROJECT_PRODUCTION_URL
    : process.env.VERCEL_BRANCH_URL ?? process.env.VERCEL_URL;
  if (vercelHost) return `https://${vercelHost}`;

  return "http://localhost:3000";
}
