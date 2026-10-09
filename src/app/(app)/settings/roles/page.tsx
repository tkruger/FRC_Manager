import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { PageTitle } from "@/components/PageHeader";
import { ROLE_LABELS } from "@/lib/rbac";
import { CAPABILITIES, ROLE_ORDER, ROLE_SUMMARY } from "@/lib/role-guide";

/** What each team role is for and who can do what. Linked from Team members. */
export default function RolesPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <nav className="text-small text-(--color-text-secondary) mb-1">
          <Link href="/settings/members" className="hover:text-(--color-primary)">Team members</Link>
          <span className="mx-2">›</span>Roles explained
        </nav>
        <PageTitle help="roles">Roles explained</PageTitle>
        <p className="text-body text-(--color-text-secondary) mt-1">
          A member can have several roles, and gets everything each of them allows. Changes take effect immediately.
          Head Mentors can do everything.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-h2 text-(--color-text-primary)">The roles</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {ROLE_ORDER.map((r) => (
            <div key={r} className="card space-y-1.5">
              <p className="text-sm font-semibold text-(--color-text-primary)">{ROLE_LABELS[r]}</p>
              <p className="text-small text-(--color-text-secondary)">{ROLE_SUMMARY[r].who}</p>
              <p className="text-sm text-(--color-text-primary)">{ROLE_SUMMARY[r].summary}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-h2 text-(--color-text-primary)">Who can do what</h2>
        <p className="text-small text-(--color-text-secondary)">Head Mentors can always do everything listed here.</p>
        {CAPABILITIES.map((group) => (
          <div key={group.area} className="card p-0">
            <p className="px-5 pt-4 pb-2 text-sm font-semibold text-(--color-text-primary)">{group.area}</p>
            <ul className="divide-y divide-(--color-border)">
              {group.items.map((item) => (
                <li key={item.action} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-sm text-(--color-text-primary)">{item.action}</span>
                  <span className="flex flex-wrap gap-1.5 sm:justify-end sm:max-w-[55%]">
                    {item.who === "everyone"
                      ? <Badge variant="success">Everyone</Badge>
                      : item.who.length === 0
                        ? <Badge variant="neutral">Head Mentor only</Badge>
                        : item.who.map((r) => <Badge key={r} variant="info">{ROLE_LABELS[r]}</Badge>)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </div>
  );
}
