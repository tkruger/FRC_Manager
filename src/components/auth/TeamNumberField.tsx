"use client";

import { useEffect, useState } from "react";
import { Field } from "@/components/ui/field";
import { teamNumberStatusAction, type TeamNumberStatus } from "@/app/actions/auth";

/**
 * The FRC team number on the sign-up forms. A team that isn't on FRC Manager yet can only be
 * registered by its Head Mentor, and the FRC Manager admins usually confirm that by email —
 * so as soon as we know the team is new, say so plainly and ask them to confirm.
 */
export function TeamNumberField({ error }: { error?: string }) {
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<{ n: number; s: TeamNumberStatus } | null>(null);
  const n = Number(value);
  const valid = Number.isInteger(n) && n >= 1 && n <= 99999;

  useEffect(() => {
    if (!valid) return;
    let live = true;
    const t = setTimeout(() => {
      teamNumberStatusAction(n).then((s) => { if (live && s) setStatus({ n, s }); }, () => {});
    }, 400);
    return () => { live = false; clearTimeout(t); };
  }, [n, valid]);

  const current = valid && status?.n === n ? status.s : null;

  return (
    <div className="space-y-3">
      <Field
        label="FRC Team Number"
        name="teamNumber"
        type="number"
        inputMode="numeric"
        required
        placeholder="e.g. 254"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        error={error}
      />

      {current === "new" && (
        <div role="status" className="rounded-lg border-2 border-(--color-warning) bg-(--color-warning)/10 px-4 py-3 text-sm text-(--color-text-primary) space-y-2.5">
          <p className="font-semibold text-base leading-snug">
            Team {n} isn&apos;t on FRC Manager yet — registering it makes you its <span className="underline decoration-(--color-warning) decoration-2 underline-offset-2">Head Mentor</span>.
          </p>
          <ul className="list-disc pl-5 space-y-1 text-(--color-text-secondary)">
            <li>
              <b className="text-(--color-text-primary)">Only your team&apos;s Head Mentor should do this.</b> The first person to register a team runs it on FRC Manager — they approve everyone else and choose their roles.
            </li>
            <li>
              <b className="text-(--color-text-primary)">Expect an email from the FRC Manager admins</b> asking you to confirm you&apos;re the team&apos;s Head Mentor before the team is approved. Use an address you check, and look in your spam folder.
            </li>
            <li>
              Student or another mentor? Don&apos;t register the team — ask your Head Mentor to set it up, then join with the access code they give you.
            </li>
          </ul>
          <label className="flex items-start gap-2.5 rounded-md bg-(--color-surface) px-3 py-2.5 ring-1 ring-(--color-warning)/40 cursor-pointer">
            <input type="checkbox" name="confirmHeadMentor" required className="mt-0.5 h-4 w-4 shrink-0 accent-(--color-primary)" />
            <span className="font-medium">I&apos;m the Head Mentor of Team {n}, and I understand I may be asked to confirm that by email.</span>
          </label>
        </div>
      )}

      {current === "unavailable" && (
        <p role="status" className="text-small text-(--color-danger)">
          Team {n} can&apos;t be registered on FRC Manager. Contact the FRC Manager admins if you think this is a mistake.
        </p>
      )}
    </div>
  );
}
