import Link from "next/link";
import { SOURCE_URL } from "@/components/legal/LegalPage";
import { LogoMark } from "@/components/brand/LogoMark";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen flex items-center justify-center bg-(--color-surface) px-4 py-12">
      {/* For anyone who lands here not knowing what this is: the public About page.
          Top right on wide screens; on phones it sits in the flow above the wordmark. */}
      <Link
        href="/about"
        className="hidden sm:inline-flex absolute top-5 right-5 items-center gap-1.5 rounded-full border border-(--color-border) bg-(--color-surface-raised) px-3.5 py-1.5 text-small font-medium text-(--color-text-secondary) hover:text-(--color-primary) hover:border-(--color-primary)/40 transition-colors"
      >
        What&apos;s FRC Manager? <span aria-hidden="true">→</span>
      </Link>
      <div className="w-full max-w-md">
        {/* Logo / wordmark */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <LogoMark />
            <span className="text-h2 font-bold text-(--color-text-primary)">FRC Manager</span>
          </div>
          <p className="text-small text-(--color-text-secondary)">
            Team Management Suite
            <span className="sm:hidden">
              <span className="mx-1.5">·</span>
              <Link href="/about" className="font-medium text-(--color-secondary) hover:underline">What&apos;s this?</Link>
            </span>
          </p>
        </div>
        {children}
        <p className="mt-8 text-center text-small text-(--color-text-secondary)">
          <Link href="/about" className="whitespace-nowrap hover:text-(--color-primary)">About</Link>
          <span className="mx-2">·</span>
          <Link href="/terms" className="whitespace-nowrap hover:text-(--color-primary)">Terms of Service</Link>
          <span className="mx-2">·</span>
          <Link href="/privacy" className="whitespace-nowrap hover:text-(--color-primary)">Privacy Policy</Link>
          <span className="mx-2">·</span>
          <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer" className="whitespace-nowrap hover:text-(--color-primary)">Source code</a>
        </p>
      </div>
    </div>
  );
}
