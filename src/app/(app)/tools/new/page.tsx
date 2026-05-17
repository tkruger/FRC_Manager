import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import Link from "next/link";
import { NewToolForm } from "./NewToolForm";

export default async function NewToolPage() {
  const session = await auth();
  if (!session?.user?.teamId) redirect("/dashboard");
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <nav className="text-small text-[--color-text-secondary] mb-3">
        <Link href="/tools" className="hover:text-[--color-primary]">Tools</Link>
        <span className="mx-2">›</span>New tool
      </nav>
      <h1 className="text-h1 text-[--color-text-primary] mb-6">Add tool</h1>
      <NewToolForm />
    </div>
  );
}
