import { auth } from "@/lib/auth";

export default async function DashboardPage() {
  const session = await auth();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-h1 text-[--color-text-primary]">
          Welcome back, {session?.user?.name?.split(" ")[0]}
        </h1>
        <p className="text-body text-[--color-text-secondary] mt-1">
          FRC Team Management Suite — Season Dashboard
        </p>
      </div>

      {/* Quick-access module cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {[
          { title: "Robot Fleet",   href: "/fleet",       desc: "Manage your robots", icon: "🤖", color: "var(--color-primary)" },
          { title: "Tools",         href: "/tools",       desc: "Checkout & maintenance", icon: "🔧", color: "#7C3AED" },
          { title: "Inventory",     href: "/inventory",   desc: "Parts & materials", icon: "📦", color: "var(--color-secondary)" },
          { title: "Procurement",   href: "/procurement", desc: "Orders & requests", icon: "🛒", color: "#059669" },
          { title: "Budget",        href: "/budget",      desc: "Spend & BOM tracking", icon: "💰", color: "#D97706" },
          { title: "Schedule",      href: "/schedule",    desc: "Build season tasks", icon: "📅", color: "#DC2626" },
          { title: "Safety",        href: "/safety",      desc: "Certs & checklists", icon: "🛡️", color: "#0891B2" },
        ].map((mod) => (
          <a
            key={mod.href}
            href={mod.href}
            className="card group hover:shadow-md transition-shadow flex flex-col gap-3 no-underline"
            style={{ borderLeftColor: mod.color, borderLeftWidth: "4px" }}
          >
            <div className="text-2xl">{mod.icon}</div>
            <div>
              <p className="text-h3 text-[--color-text-primary] group-hover:text-[--color-primary] transition-colors">
                {mod.title}
              </p>
              <p className="text-small text-[--color-text-secondary] mt-0.5">{mod.desc}</p>
            </div>
          </a>
        ))}
      </div>

      {/* Season not configured notice */}
      <div className="mt-8 card bg-[--color-info]/8 border-[--color-info]/20">
        <p className="text-sm text-[--color-text-primary] font-medium">
          No active season configured
        </p>
        <p className="text-small text-[--color-text-secondary] mt-1">
          A Head Mentor can set up the current season, kick-off date, and Week 0 deadline in{" "}
          <a href="/settings/season" className="text-[--color-secondary] hover:underline">
            Season Settings
          </a>
          .
        </p>
      </div>
    </div>
  );
}
