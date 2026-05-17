import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import { AwardCertDialog } from "./AwardCertDialog";
import { RevokeCertButton } from "./RevokeCertButton";

// Well-known FRC certification names
const STANDARD_CERTS = [
  "Drill Press Safety", "Angle Grinder", "Band Saw", "Mill Operator",
  "Lathe Operator", "3D Printer", "Soldering Iron", "Electrical Safety",
  "Pneumatics Safety", "Forklift / Lifting Equipment",
];

export default async function CertificationsPage() {
  const session = await auth();
  if (!session?.user?.teamId) redirect("/dashboard");

  const [members, certs] = await Promise.all([
    prisma.user.findMany({
      where: { teamId: session.user.teamId, status: "ACTIVE" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.userCertification.findMany({
      where: { user: { teamId: session.user.teamId } },
      include: { user: { select: { id: true, name: true } } },
    }),
  ]);

  // All cert names in use + standard ones
  const allCertNames = Array.from(new Set([
    ...STANDARD_CERTS,
    ...certs.map((c) => c.certName),
  ])).sort();

  // Build matrix: member → cert → status
  type CertStatus = "ACTIVE" | "EXPIRED" | "REVOKED" | null;
  const matrix: Record<string, Record<string, { status: CertStatus; id?: string; expiresAt?: Date | null }>> = {};
  for (const m of members) {
    matrix[m.id] = {};
    for (const cert of allCertNames) {
      matrix[m.id][cert] = { status: null };
    }
  }
  for (const c of certs) {
    if (matrix[c.userId]?.[c.certName] !== undefined) {
      matrix[c.userId][c.certName] = { status: c.status as CertStatus, id: c.id, expiresAt: c.expiresAt };
    }
  }

  const isAdmin = session.user.roles.some((r) => ["HEAD_MENTOR", "SAFETY_CAPTAIN", "INVENTORY_ADMIN"].includes(r));

  return (
    <div className="max-w-full px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <nav className="text-small text-[--color-text-secondary] mb-1">
            <Link href="/safety" className="hover:text-[--color-primary]">Safety</Link>
            <span className="mx-2">›</span>Certifications
          </nav>
          <h1 className="text-h1 text-[--color-text-primary]">Certification matrix</h1>
          <p className="text-body text-[--color-text-secondary] mt-1">{members.length} members × {allCertNames.length} certifications</p>
        </div>
        {isAdmin && <AwardCertDialog members={members} certNames={allCertNames} />}
      </div>

      <div className="overflow-x-auto rounded-lg border border-[--color-border]">
        <table className="text-sm">
          <thead className="bg-[--color-surface-raised] border-b border-[--color-border]">
            <tr>
              <th className="px-4 py-3 text-left text-label font-medium text-[--color-text-secondary] whitespace-nowrap sticky left-0 bg-[--color-surface-raised] z-10 min-w-[160px]">
                Member
              </th>
              {allCertNames.map((cert) => (
                <th key={cert} className="px-3 py-3 text-label font-medium text-[--color-text-secondary] text-center whitespace-nowrap min-w-[120px]">
                  {cert}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[--color-border]">
            {members.map((m) => (
              <tr key={m.id} className="hover:bg-[--color-surface-raised] transition-colors">
                <td className="px-4 py-3 font-medium text-[--color-text-primary] sticky left-0 bg-[--color-surface] z-10 border-r border-[--color-border]">
                  {m.name}
                </td>
                {allCertNames.map((cert) => {
                  const c = matrix[m.id]?.[cert];
                  const status = c?.status;
                  return (
                    <td key={cert} className="px-3 py-3 text-center">
                      {status === "ACTIVE" ? (
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="text-[--color-success] text-lg" title={c?.expiresAt ? `Expires ${formatDate(c.expiresAt)}` : "Active"}>✓</span>
                          {c?.expiresAt && <span className="text-[10px] text-[--color-text-secondary]">{formatDate(c.expiresAt)}</span>}
                          {isAdmin && c?.id && <RevokeCertButton userId={m.id} certName={cert} />}
                        </div>
                      ) : status === "EXPIRED" ? (
                        <span className="text-[--color-warning] text-lg" title="Expired">⚠</span>
                      ) : status === "REVOKED" ? (
                        <span className="text-[--color-danger] text-xs">Revoked</span>
                      ) : (
                        <span className="text-[--color-text-disabled]">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
