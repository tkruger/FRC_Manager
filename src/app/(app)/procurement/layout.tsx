import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isViewOnly } from "@/lib/access/read-only";

// Orders aren't for view-only accounts (Parents) — they're sent home
export default async function Layout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (isViewOnly(session?.user?.roles)) redirect("/dashboard");
  return children;
}
