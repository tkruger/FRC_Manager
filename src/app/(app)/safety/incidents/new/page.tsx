import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import Link from "next/link";
import { IncidentForm } from "./IncidentForm";

export default async function NewIncidentPage() {
  const session = await auth();
  if (!session) redirect("/login");
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <nav className="text-small text-[--color-text-secondary] mb-3">
        <Link href="/safety" className="hover:text-[--color-primary]">Safety</Link>
        <span className="mx-2">›</span>File incident
      </nav>
      <h1 className="text-h1 text-[--color-text-primary] mb-1">File safety incident</h1>
      <p className="text-body text-[--color-text-secondary] mb-6">
        Report any injury, near-miss, or safety violation immediately. Records are permanent and confidential.
      </p>
      <IncidentForm />
    </div>
  );
}
