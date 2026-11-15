import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SOURCE_URL } from "@/components/legal/LegalPage";
import { LogoMark } from "@/components/brand/LogoMark";

export const metadata: Metadata = {
  title: "About — FRC Manager",
  description: "Free, open-source team management for FIRST Robotics Competition teams: tasks, orders, budget, tools, volunteers and competitions in one place.",
};

/** The headline features, each with a screenshot (public/about/*.png — fictional demo data) */
const HIGHLIGHTS = [
  {
    img: "tasks",
    kicker: "Tasks & season planning",
    title: "Everyone knows what to build next",
    body: "A Kanban board of sticky notes per sub-team, a Gantt chart for the season, and a TV view for the shop. Progress per sub-team, overdue work and the next event are visible at a glance.",
    points: ["Kanban, Gantt and list views", "Task templates for each season", "Present on TV for the shop screen"],
  },
  {
    img: "orders",
    kicker: "Orders & purchasing",
    title: "From “we need this” to “it’s on the shelf”",
    body: "Students request parts, mentors approve, the buyer orders. Prices fill in from vendor links, tracking numbers follow each package, and when it arrives it goes to inventory or tools — or nowhere.",
    points: ["Approval workflow you can customize", "Package tracking with delivery alerts", "Split orders, tax and shipping per vendor"],
  },
  {
    img: "budget",
    kicker: "Budget & expenses",
    title: "See where the money goes",
    body: "Plan the season’s budget by category, record what’s raised and pledged, and watch spending as orders and expenses come in. Members submit receipts for refunds; the treasurer reviews them.",
    points: ["Goal, raised and spent over the season", "Expense claims and refunds", "Every purchase counted against its category"],
  },
  {
    img: "volunteers",
    kicker: "Volunteers & parents",
    title: "Every meeting has its adults",
    body: "Parents sign up for meeting shifts, coordinators see the gaps and ask people to cover, and reminders go out with the shift instructions. Parents get their own view of their students’ team.",
    points: ["Coverage at a glance for the next 8 weeks", "“Ask someone to cover” in one tap", "Reminders by push, email or Discord"],
  },
] as const;

/** Everything else, briefly */
const MORE = [
  { icon: "🧰", title: "Tools", body: "Every tool tagged and scannable. Check out, check in, locations and competition pack lists." },
  { icon: "📦", title: "Inventory", body: "Stock levels, low-stock alerts and an order queue that turns into a purchase." },
  { icon: "🏆", title: "Competitions", body: "Match schedules, “now queuing” alerts, results and awards from The Blue Alliance and Nexus." },
  { icon: "🛡️", title: "Safety", body: "Incident reports that reach the safety captain right away, and certifications with expiry reminders." },
  { icon: "🤖", title: "Robot fleet", body: "Every robot this season, its weight against the limit and its open tasks." },
  { icon: "📅", title: "Calendar", body: "Meetings and events, with a feed for Google, Apple or Outlook calendars." },
  { icon: "💬", title: "Discord", body: "Sign in with Discord, team notifications in your server, and a bot for quick lookups." },
  { icon: "🔔", title: "Notifications", body: "Choose what you hear about: in the app, as a push on your phone, or by email." },
  { icon: "🔐", title: "Roles & history", body: "Each person sees what their role needs. Every change is in the history and the audit log." },
] as const;

export default function AboutPage() {
  return (
    <div className="page-scroll min-h-screen bg-(--color-surface) text-(--color-text-primary) overflow-x-hidden">
      {/* Top bar */}
      <header className="max-w-6xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between gap-4">
        <Link href="/login" className="inline-flex items-center gap-2 font-bold">
          <LogoMark className="w-7 h-7" iconClassName="w-4 h-4" />
          <span>FRC Manager</span>
        </Link>
        <nav className="flex items-center gap-4 text-small">
          <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer" className="hidden sm:inline text-(--color-text-secondary) hover:text-(--color-primary)">Source code</a>
          <Link href="/login" className="rounded-md bg-(--color-primary) px-3.5 py-1.5 font-medium text-white hover:opacity-90">Sign in</Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 -top-24 h-[480px] bg-[radial-gradient(ellipse_at_top,color-mix(in_srgb,var(--color-primary)_18%,transparent),transparent_65%)]" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 pt-10 sm:pt-16 pb-12 text-center">
          <p className="inline-flex flex-wrap justify-center gap-x-2 gap-y-1 rounded-full border border-(--color-border) bg-(--color-surface-raised) px-3.5 py-1 text-small text-(--color-text-secondary)">
            <span>Free</span><span aria-hidden="true">·</span><span>Open source</span><span aria-hidden="true" className="hidden sm:inline">·</span><span>Built by an FRC team, for FRC teams</span>
          </p>
          <h1 className="mt-6 text-4xl sm:text-5xl font-bold tracking-tight leading-[1.1]">
            Run your robotics team<br className="hidden sm:block" /> from one place
          </h1>
          <p className="mt-5 text-base sm:text-lg text-(--color-text-secondary) max-w-2xl mx-auto leading-relaxed">
            FRC Manager keeps a FIRST Robotics Competition team&apos;s tasks, orders, budget, tools, volunteers and
            competitions together — on the shop computer and on everyone&apos;s phone. Students, mentors and parents each
            see what they need.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/register" className="w-full sm:w-auto rounded-md bg-(--color-primary) px-5 py-2.5 font-medium text-white hover:opacity-90">
              Create an account
            </Link>
            <Link href="/login" className="w-full sm:w-auto rounded-md border border-(--color-border-strong) px-5 py-2.5 font-medium hover:border-(--color-primary)/50 hover:text-(--color-primary)">
              Sign in
            </Link>
          </div>
          <p className="mt-4 text-small text-(--color-text-secondary)">
            Hosted on a best-effort basis — <a href="#best-effort" className="underline underline-offset-2 hover:text-(--color-primary)">what that means</a>.
          </p>
        </div>
      </section>

      {/* Highlights */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-8 space-y-16 sm:space-y-24">
        {HIGHLIGHTS.map((h, i) => (
          <div key={h.img} className="grid gap-8 lg:grid-cols-5 lg:gap-12 items-center">
            <div className={`lg:col-span-2 ${i % 2 ? "lg:order-2" : ""}`}>
              <p className="text-small font-semibold uppercase tracking-wider text-(--color-primary)">{h.kicker}</p>
              <h2 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight">{h.title}</h2>
              <p className="mt-4 text-(--color-text-secondary) leading-relaxed">{h.body}</p>
              <ul className="mt-5 space-y-2">
                {h.points.map((p) => (
                  <li key={p} className="flex gap-2.5 text-sm">
                    <span aria-hidden="true" className="mt-0.5 text-(--color-success)">✓</span>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
            <figure className={`lg:col-span-3 ${i % 2 ? "lg:order-1" : ""}`}>
              <div className="rounded-xl border border-(--color-border-strong) bg-[#0b0d12] p-1.5 shadow-2xl shadow-black/30">
                <Image
                  src={`/about/${h.img}.png`}
                  alt={`FRC Manager — ${h.kicker}`}
                  width={1440}
                  height={900}
                  sizes="(min-width: 1024px) 680px, 100vw"
                  className="w-full h-auto rounded-lg"
                />
              </div>
            </figure>
          </div>
        ))}
      </section>

      {/* Everything else */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">And the rest of the shop</h2>
          <p className="mt-3 text-(--color-text-secondary)">The everyday things a team keeps track of, built to work together.</p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MORE.map((f) => (
            <div key={f.title} className="rounded-xl border border-(--color-border) bg-(--color-surface-raised) p-5">
              <div className="flex items-center gap-2.5">
                <span aria-hidden="true" className="text-xl">{f.icon}</span>
                <h3 className="text-h3">{f.title}</h3>
              </div>
              <p className="mt-2 text-sm text-(--color-text-secondary) leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Best effort — the short version of the Terms of Service */}
      <section id="best-effort" className="max-w-4xl mx-auto px-4 sm:px-6 pb-16 sm:pb-24 scroll-mt-6">
        <div className="relative overflow-hidden rounded-2xl border border-(--color-warning)/30 bg-(--color-warning)/[0.06] p-6 sm:p-10">
          <div aria-hidden="true" className="absolute left-0 top-0 bottom-0 w-1 bg-(--color-warning)/70" />
          <p className="text-small font-semibold uppercase tracking-wider text-(--color-warning)">Before you rely on it</p>
          <h2 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight">Free, open source, and run on a best-effort basis</h2>
          <p className="mt-4 text-(--color-text-secondary) leading-relaxed">
            FRC Manager is maintained by volunteers in their spare time. You&apos;re welcome to use it — here&apos;s the
            short version of what that means:
          </p>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2">
            {[
              ["No guaranteed uptime", "It may be slow or down — even during build season or at a competition."],
              ["Features can change", "Anything may change, break or go away, with or without notice."],
              ["Keep your own copies", "Use it at your own risk; don’t make it your only record of anything important."],
              ["Host it yourself", "Want your own uptime and data? The source is free to run under the Apache 2.0 license."],
            ].map(([t, b]) => (
              <li key={t} className="rounded-lg bg-(--color-surface-raised) border border-(--color-border) p-4">
                <p className="font-semibold">{t}</p>
                <p className="mt-1 text-sm text-(--color-text-secondary) leading-relaxed">{b}</p>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm text-(--color-text-secondary)">
            And please don&apos;t use it to make money — it&apos;s given to the FIRST community for free.{" "}
            <Link href="/terms" className="font-medium text-(--color-secondary) hover:underline">Read the full Terms of Service →</Link>
          </p>
        </div>
      </section>

      {/* Closing call to action */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 pb-16 text-center">
        <h2 className="text-2xl font-bold tracking-tight">Ready when your team is</h2>
        <p className="mt-2 text-(--color-text-secondary)">Join with your team’s access code or an invite from your Head Mentor. A team new to FRC Manager is set up after a quick check.</p>
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/register" className="w-full sm:w-auto rounded-md bg-(--color-primary) px-5 py-2.5 font-medium text-white hover:opacity-90">Get started</Link>
          <Link href="/login" className="w-full sm:w-auto rounded-md border border-(--color-border-strong) px-5 py-2.5 font-medium hover:border-(--color-primary)/50 hover:text-(--color-primary)">Sign in</Link>
        </div>
      </section>

      <footer className="border-t border-(--color-border)">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row gap-4 items-center justify-between text-small text-(--color-text-secondary)">
          <p>FRC Manager is not affiliated with or endorsed by FIRST® or Discord.</p>
          <nav className="flex flex-wrap justify-center gap-x-4 gap-y-1">
            <Link href="/terms" className="hover:text-(--color-primary)">Terms of Service</Link>
            <Link href="/privacy" className="hover:text-(--color-primary)">Privacy Policy</Link>
            <Link href="/changelog" className="hover:text-(--color-primary)">What&apos;s new</Link>
            <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer" className="hover:text-(--color-primary)">Source code</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
