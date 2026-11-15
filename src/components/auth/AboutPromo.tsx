import Image from "next/image";
import Link from "next/link";

const CHIPS = [
  ["🗂️", "Tasks & Gantt"],
  ["🛒", "Orders & tracking"],
  ["💰", "Budget"],
  ["🧰", "Tools"],
  ["🙋", "Volunteers"],
  ["🏆", "Competitions"],
] as const;

/** The promo colors: the theme color into its second color */
const PROMO_GRADIENT = "linear-gradient(140deg, color-mix(in srgb, var(--color-primary) 92%, black) 10%, var(--color-secondary) 100%)";

/** Beside the sign-in card on wide screens: what FRC Manager is, linking to the About page */
export function AboutPromo({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/about"
      className={`group relative block overflow-hidden rounded-2xl p-8 pb-0 text-white shadow-2xl shadow-black/30 ring-1 ring-white/10 transition-transform duration-200 hover:-translate-y-0.5 ${className}`}
      style={{ background: PROMO_GRADIENT }}
    >
      {/* Soft glows */}
      <div aria-hidden="true" className="pointer-events-none absolute -top-24 -right-16 h-64 w-64 rounded-full bg-white/15 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-black/25 blur-3xl" />

      <div className="relative">
        <p className="text-small font-semibold uppercase tracking-wider text-white/75">New here?</p>
        <h2 className="mt-1.5 text-3xl font-bold tracking-tight leading-tight">What&apos;s FRC Manager?</h2>
        <p className="mt-3 text-white/85 leading-relaxed">
          Free, open-source team management for FIRST Robotics Competition teams — your build, your orders and your
          people in one place.
        </p>

        <ul className="mt-5 grid grid-cols-2 gap-2">
          {CHIPS.map(([icon, label]) => (
            <li key={label} className="flex items-center gap-2 rounded-lg bg-white/12 px-3 py-2 text-sm font-medium ring-1 ring-white/15 backdrop-blur-sm">
              <span aria-hidden="true">{icon}</span>
              <span className="truncate">{label}</span>
            </li>
          ))}
        </ul>

        <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-lg shadow-black/20">
            See what it does
            <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-0.5">→</span>
          </span>
          <span className="text-small text-white/70">Free · open source · best-effort hosting</span>
        </div>
      </div>

      {/* A peek at the app */}
      <div className="relative mt-8 -mb-10 translate-x-6 rotate-[-2deg] transition-transform duration-300 group-hover:rotate-[-1deg] group-hover:-translate-y-1">
        <div className="rounded-xl bg-[#0b0d12] p-1.5 shadow-2xl shadow-black/50 ring-1 ring-white/15">
          <Image src="/about/tasks.png" alt="" width={1440} height={900} sizes="560px" className="w-full h-auto rounded-lg" priority />
        </div>
      </div>
    </Link>
  );
}

/** Narrower screens: a slim banner in the same colors, between the wordmark and the sign-in card */
export function AboutBanner({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/about"
      className={`group relative flex items-center gap-3 overflow-hidden rounded-xl px-4 py-3 text-white shadow-lg shadow-black/25 ring-1 ring-white/10 ${className}`}
      style={{ background: PROMO_GRADIENT }}
    >
      <div aria-hidden="true" className="pointer-events-none absolute -top-10 -right-6 h-24 w-24 rounded-full bg-white/20 blur-2xl" />
      <span aria-hidden="true" className="relative text-2xl leading-none">🤖</span>
      <span className="relative min-w-0 flex-1">
        <span className="block text-[0.6875rem] font-semibold uppercase tracking-wider text-white/75">New here?</span>
        <span className="block font-bold leading-tight">What&apos;s FRC Manager?</span>
      </span>
      <span aria-hidden="true" className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-gray-900 shadow-md transition-transform duration-200 group-hover:translate-x-0.5">→</span>
    </Link>
  );
}
