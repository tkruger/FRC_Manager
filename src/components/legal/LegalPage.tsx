import Link from "next/link";
import { ClosePageButton } from "./ClosePageButton";

/** Where the source code lives (for anyone who wants to host it themselves) */
export const SOURCE_URL = "https://github.com/tkruger/FRC_Manager";

/** Shared layout for the public Terms of Service, Privacy Policy and What's new pages. */
/** closable: opened from the app in its own window or tab — a floating ✕ closes it. */
export function LegalPage({ title, updated, updatedLabel = "Last updated", closable = false, children }: { title: string; updated: string; updatedLabel?: string; closable?: boolean; children: React.ReactNode }) {
  return (
    <div className="page-scroll min-h-screen bg-(--color-surface)">
      {closable && <ClosePageButton />}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-6">
        <nav className={`flex flex-wrap gap-4 text-small text-(--color-text-secondary) ${closable ? "pr-12" : ""}`}>
          <Link href="/" className="font-semibold text-(--color-text-primary) hover:text-(--color-primary)">FRC Manager</Link>
          <Link href="/terms" className="hover:text-(--color-primary)">Terms of Service</Link>
          <Link href="/privacy" className="hover:text-(--color-primary)">Privacy Policy</Link>
          <Link href="/changelog" className="hover:text-(--color-primary)">What&apos;s new</Link>
          <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer" className="hover:text-(--color-primary)">Source code</a>
        </nav>
        <header>
          <h1 className="text-h1 text-(--color-text-primary)">{title}</h1>
          <p className="text-small text-(--color-text-secondary) mt-1">{updatedLabel} {updated}</p>
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
