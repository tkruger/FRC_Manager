// Is this the testing copy of the app? Server-only.
//
// The test site is frc-manager.vercel.app (and Vercel preview deployments). TEST_SITE=1 or
// TEST_SITE=0 in a deployment's environment overrides the guess either way.

import { headers } from "next/headers";

const TEST_HOSTS = ["frc-manager.vercel.app"];

export async function isTestSite(): Promise<boolean> {
  const forced = process.env.TEST_SITE;
  if (forced === "1" || forced === "true") return true;
  if (forced === "0" || forced === "false") return false;
  if (process.env.VERCEL_ENV === "preview") return true;
  try {
    const host = ((await headers()).get("host") ?? "").toLowerCase().split(":")[0];
    return TEST_HOSTS.includes(host);
  } catch {
    return false;
  }
}
