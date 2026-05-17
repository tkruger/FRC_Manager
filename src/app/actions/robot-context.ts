"use server";

import { cookies } from "next/headers";

const COOKIE_NAME = "frc-active-robot";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export async function setActiveRobotAction(robotId: string | null): Promise<void> {
  const jar = await cookies();
  if (robotId) {
    jar.set(COOKIE_NAME, robotId, { path: "/", maxAge: COOKIE_MAX_AGE, httpOnly: false });
  } else {
    jar.delete(COOKIE_NAME);
  }
}

export async function getActiveRobotId(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(COOKIE_NAME)?.value ?? null;
}
