import Link from "next/link";
import { SOURCE_URL } from "@/components/legal/LegalPage";
import { LogoMark } from "@/components/brand/LogoMark";
import { AboutPromo, AboutBanner } from "@/components/auth/AboutPromo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen flex items-center justify-center bg-(--color-surface) px-4 py-12">
      <div className="w-full max-w-md lg:max-w-5xl lg:grid lg:grid-cols-[28rem_minmax(0,1fr)] lg:gap-14 lg:items-center">
      <div className="w-full max-w-md mx-auto">
        {/* Logo / wordmark */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <LogoMark />
            <span className="text-h2 font-bold text-(--color-text-primary)">FRC Manager</span>
          </div>
          <p className="text-small text-(--color-text-secondary)">
            Team Management Suite
          </p>
        </div>
        {/* Phones and tablets: what FRC Manager is, as a slim banner (wide screens get the card beside) */}
        <AboutBanner className="lg:hidden -mt-3 mb-5" />
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
      {/* Wide screens: what FRC Manager is, beside the card */}
      <AboutPromo className="hidden lg:block" />
      </div>
    </div>
  );
}
