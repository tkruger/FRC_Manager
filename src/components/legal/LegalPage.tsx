import Link from "next/link";

/** Shared layout for the public Terms of Service and Privacy Policy pages. */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-(--color-surface)">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-6">
        <nav className="flex flex-wrap gap-4 text-small text-(--color-text-secondary)">
          <Link href="/" className="font-semibold text-(--color-text-primary) hover:text-(--color-primary)">FRC Manager</Link>
          <Link href="/terms" className="hover:text-(--color-primary)">Terms of Service</Link>
          <Link href="/privacy" className="hover:text-(--color-primary)">Privacy Policy</Link>
        </nav>
        <header>
          <h1 className="text-h1 text-(--color-text-primary)">{title}</h1>
          <p className="text-small text-(--color-text-secondary) mt-1">Last updated {updated}</p>
        </header>
        <article className="space-y-5 text-sm leading-relaxed text-(--color-text-primary) [&_h2]:text-h3 [&_h2]:pt-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_a]:text-(--color-secondary) [&_a]:underline">
          {children}
        </article>
      </div>
    </div>
  );
}

/** Contact line: LEGAL_CONTACT_EMAIL if configured, otherwise the team's Head Mentor. */
export function LegalContact() {
  const email = process.env.LEGAL_CONTACT_EMAIL;
  return email
    ? <>email <a href={`mailto:${email}`}>{email}</a></>
    : <>contact your team&apos;s Head Mentor, who manages your team&apos;s FRC Manager accounts</>;
}
