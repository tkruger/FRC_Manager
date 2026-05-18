import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

const SEVERITY_BADGE: Record<string, "danger"|"warning"|"info"> = {
  SIGNIFICANT_INJURY: "danger",
  MINOR_INJURY:       "warning",
  NEAR_MISS:          "info",
};

export default async function SafetyPage() {
  const session = await auth();
  if (!session?.user?.teamId) redirect("/dashboard");

  const [incidents, expiringCerts, robots] = await Promise.all([
    prisma.safetyIncident.findMany({
      where: { reportedBy: { teamId: session.user.teamId } },
      include: { reportedBy: { select: { name: true } } },
      orderBy: { incidentDate: "desc" },
      take: 10,
    }),
    prisma.userCertification.findMany({
      where: {
        user: { teamId: session.user.teamId },
        status: "ACTIVE",
        expiresAt: { lte: new Date(Date.now() + 30 * 86400000) },
      },
      include: { user: { select: { name: true } } },
      orderBy: { expiresAt: "asc" },
    }),
    prisma.robot.findMany({
      where: { season: { teamId: session.user.teamId, isActive: true }, archived: false },
      select: { id: true, displayName: true },
    }),
  ]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h1 text-[--color-text-primary]">Safety & Compliance</h1>
          <p className="text-body text-[--color-text-secondary] mt-1">Incidents, certifications, and inspection checklists</p>
        </div>
        <div className="flex gap-2">
          <Link href="/safety/certifications"><Button variant="outline" size="sm">Cert matrix</Button></Link>
          <Link href="/safety/inspection"><Button variant="outline" size="sm">Inspection</Button></Link>
          <Link href="/safety/incidents/new"><Button size="sm">+ File incident</Button></Link>
        </div>
      </div>

      {/* Expiring certs warning */}
      {expiringCerts.length > 0 && (
        <div className="rounded-md bg-[--color-warning]/10 border border-[--color-warning]/20 px-4 py-3">
          <p className="text-sm font-medium text-[--color-warning] mb-1">
            {expiringCerts.length} certification{expiringCerts.length !== 1 ? "s" : ""} expiring within 30 days
          </p>
          <div className="flex flex-wrap gap-2 mt-1">
            {expiringCerts.map((c) => (
              <span key={c.id} className="text-small text-[--color-warning]">
                {c.user.name} — {c.certName} ({formatDate(c.expiresAt)})
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Incident log */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-h2 text-[--color-text-primary]">Incident log</h2>
            <Link href="/safety/incidents/new"><Button variant="outline" size="sm">+ File incident</Button></Link>
          </div>
          <div className="card divide-y divide-[--color-border]">
            {incidents.length === 0 ? (
              <p className="py-6 text-center text-small text-[--color-success]">No incidents reported 🎉</p>
            ) : incidents.map((i) => (
              <div key={i.id} className="py-3">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant={SEVERITY_BADGE[i.severity]}>{i.severity.replace(/_/g, " ")}</Badge>
                  <span className="text-small text-[--color-text-secondary]">{formatDate(i.incidentDate)}</span>
                </div>
                <p className="text-sm text-[--color-text-primary] font-medium">{i.description.slice(0, 80)}{i.description.length > 80 ? "…" : ""}</p>
                <p className="text-small text-[--color-text-secondary]">Reported by {i.reportedBy.name}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Quick actions */}
        <div className="space-y-4">
          <h2 className="text-h2 text-[--color-text-primary]">Quick actions</h2>
          <div className="grid grid-cols-1 gap-3">
            {[
              { label: "Certification matrix",   desc: "View all members × all certifications",              href: "/safety/certifications",  color: "var(--color-secondary)" },
              { label: "Pre-competition inspection", desc: "Run the FIRST inspection checklist",             href: "/safety/inspection",       color: "var(--color-primary)"   },
              { label: "File safety incident",   desc: "Report an injury, near-miss, or violation",          href: "/safety/incidents/new",    color: "var(--color-danger)"    },
            ].map((a) => (
              <Link key={a.href} href={a.href}
                className="card flex items-center gap-4 hover:border-[--color-primary] transition-colors"
                style={{ borderLeftWidth: 4, borderLeftColor: a.color }}>
                <div>
                  <p className="text-sm font-medium text-[--color-text-primary]">{a.label}</p>
                  <p className="text-small text-[--color-text-secondary]">{a.desc}</p>
                </div>
              </Link>
            ))}
          </div>

          {/* Stats */}
          <div className="card">
            <h3 className="text-h3 text-[--color-text-primary] mb-3">Season stats</h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-h2 text-[--color-text-primary]">{incidents.length}</p>
                <p className="text-small text-[--color-text-secondary]">Incidents</p>
              </div>
              <div>
                <p className="text-h2 text-[--color-text-primary]">{incidents.filter((i) => i.severity === "SIGNIFICANT_INJURY").length}</p>
                <p className="text-small text-[--color-text-secondary]">Significant</p>
              </div>
              <div>
                <p className="text-h2 text-[--color-text-primary]">{expiringCerts.length}</p>
                <p className="text-small text-[--color-text-secondary]">Certs expiring</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
