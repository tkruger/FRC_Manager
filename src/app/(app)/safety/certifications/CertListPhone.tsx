"use client";

import { useState } from "react";
import { RevokeCertButton } from "./RevokeCertButton";

export interface MemberCerts {
  id: string;
  name: string;
  /** Only the certifications they have a record of */
  certs: { name: string; status: "ACTIVE" | "EXPIRED" | "REVOKED"; expires: string | null }[];
}

const selectCls = "w-full rounded-md border border-(--color-border) bg-(--color-surface) px-3 py-2 text-sm text-(--color-text-primary) focus:border-(--color-primary) focus:outline-none";

/**
 * The certification matrix on a phone (too wide for a grid): each member with what they're certified
 * on — or pick a certification to see who has it.
 */
export function CertListPhone({ members, certNames, isAdmin }: { members: MemberCerts[]; certNames: string[]; isAdmin: boolean }) {
  const [cert, setCert] = useState("");

  return (
    <div className="space-y-3">
      <select aria-label="Show" value={cert} onChange={(e) => setCert(e.target.value)} className={selectCls}>
        <option value="">Each member&apos;s certifications</option>
        {certNames.map((c) => <option key={c} value={c}>Who has {c}?</option>)}
      </select>

      {cert ? (
        <ul className="card divide-y divide-(--color-border) p-0">
          {members.map((m) => {
            const c = m.certs.find((x) => x.name === cert);
            return (
              <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="min-w-0 break-words font-medium text-(--color-text-primary)">{m.name}</span>
                <span className="flex shrink-0 items-center gap-3">
                  <Status cert={c} />
                  {isAdmin && c?.status === "ACTIVE" && <RevokeCertButton userId={m.id} certName={cert} />}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <ul className="space-y-3">
          {members.map((m) => {
            const held = m.certs.filter((c) => c.status !== "REVOKED");
            return (
              <li key={m.id} className="card space-y-2">
                <p className="font-medium text-(--color-text-primary)">{m.name}</p>
                {held.length === 0 ? (
                  <p className="text-small text-(--color-text-secondary)">No certifications yet</p>
                ) : (
                  <ul className="flex flex-wrap gap-2">
                    {held.map((c) => (
                      <li key={c.name}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${c.status === "ACTIVE"
                          ? "border-(--color-success)/40 bg-(--color-success)/10 text-(--color-text-primary)"
                          : "border-(--color-warning)/40 bg-(--color-warning)/10 text-(--color-text-primary)"}`}>
                        <span aria-hidden className={c.status === "ACTIVE" ? "text-(--color-success)" : "text-(--color-warning)"}>{c.status === "ACTIVE" ? "✓" : "⚠"}</span>
                        {c.name}
                        {c.status === "EXPIRED" ? <span className="text-(--color-text-secondary)">· expired</span>
                          : c.expires && <span className="text-(--color-text-secondary)">· until {c.expires}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Status({ cert }: { cert?: MemberCerts["certs"][number] }) {
  if (!cert) return <span className="text-small text-(--color-text-disabled)">Not certified</span>;
  if (cert.status === "ACTIVE") {
    return <span className="text-small text-(--color-success)">✓ Certified{cert.expires ? <span className="text-(--color-text-secondary)"> · until {cert.expires}</span> : null}</span>;
  }
  if (cert.status === "EXPIRED") return <span className="text-small text-(--color-warning)">⚠ Expired</span>;
  return <span className="text-small text-(--color-danger)">Revoked</span>;
}
