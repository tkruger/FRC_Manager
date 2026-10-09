"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import { formatDate } from "@/lib/utils";
import {
  sendEmailInvitesAction, postDiscordInviteAction, revokeInviteAction, type EmailInviteResult,
} from "@/app/actions/invites";

const inputCls =
  "w-full rounded-md border border-(--color-border) bg-(--color-surface) px-3 py-2 text-sm text-(--color-text-primary) focus:border-(--color-primary) focus:outline-none";

function CopyLink({ url }: { url: string }) {
  return (
    <button
      type="button"
      onClick={() => { navigator.clipboard?.writeText(url).then(() => toast.success("Link copied")).catch(() => toast.error("Couldn't copy — select the link instead")); }}
      className="text-small font-medium text-(--color-secondary) hover:underline"
    >
      Copy link
    </button>
  );
}

/** Invite a comma-separated list of email addresses */
export function EmailInvites({ emailReady, days }: { emailReady: boolean; days: number }) {
  const router = useRouter();
  const [emails, setEmails] = useState("");
  const [results, setResults] = useState<EmailInviteResult[] | null>(null);
  const [pending, start] = useTransition();

  function send(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await sendEmailInvitesAction(emails);
      if (!res.success) { toast.error(res.error); return; }
      setResults(res.results);
      const sent = res.results.filter((r) => r.status === "sent").length;
      const links = res.results.filter((r) => r.status === "link").length;
      if (sent) toast.success(`${sent} invite${sent === 1 ? "" : "s"} sent`);
      if (links) toast.error(`${links} invite${links === 1 ? "" : "s"} not emailed — copy the links below`);
      setEmails("");
      router.refresh();
    });
  }

  return (
    <section className="card space-y-3">
      <div>
        <h2 className="text-h3 text-(--color-text-primary)">Invite by email</h2>
        <p className="text-small text-(--color-text-secondary) mt-1">
          Separate addresses with commas. Each person gets their own link, good for {days} days.
          {!emailReady && " Email isn't set up yet, so you'll get the links to send yourself."}
        </p>
      </div>
      <form onSubmit={send} className="space-y-3">
        <textarea
          className={inputCls}
          rows={3}
          required
          value={emails}
          onChange={(e) => setEmails(e.target.value)}
          placeholder="alex@example.com, sam@example.com"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
        />
        <Button type="submit" isLoading={pending}>Send invites</Button>
      </form>

      {results && results.length > 0 && (
        <ul className="divide-y divide-(--color-border) rounded-md border border-(--color-border)">
          {results.map((r) => (
            <li key={r.email} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
              <span className="min-w-0 break-all text-(--color-text-primary)">{r.email}</span>
              <span className="flex items-center gap-2">
                {r.status === "sent" && <Badge variant="success">Emailed</Badge>}
                {r.status === "link" && <><Badge variant="warning">Not emailed</Badge>{r.url && <CopyLink url={r.url} />}</>}
                {r.status === "skipped" && <span className="text-small text-(--color-text-secondary)">{r.reason}</span>}
              </span>
              {/* The email service's own reason, so it can be fixed (e.g. domain not verified) */}
              {r.status === "link" && r.reason && (
                <span className="basis-full text-small text-(--color-danger) break-words">Why: {r.reason}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Post a team join link to a Discord channel */
export function DiscordInvite({ connected, channels, defaultChannel, days }: {
  connected: boolean; channels: { id: string; name: string }[]; defaultChannel: string; days: number;
}) {
  const router = useRouter();
  const [channel, setChannel] = useState(defaultChannel);
  const [url, setUrl] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!connected) {
    return (
      <section className="card space-y-1">
        <h2 className="text-h3 text-(--color-text-primary)">Invite via Discord</h2>
        <p className="text-small text-(--color-text-secondary)">Connect your Discord server in Settings → Discord to post a join link there.</p>
      </section>
    );
  }

  return (
    <section className="card space-y-3">
      <div>
        <h2 className="text-h3 text-(--color-text-primary)">Invite via Discord</h2>
        <p className="text-small text-(--color-text-secondary) mt-1">
          The bot posts a join link in the channel you pick. Anyone who uses it joins the team, so post it somewhere only
          your team can see. It works for {days} days, and you can turn it off below.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {channels.length > 0 ? (
          <select className={`${inputCls} h-11 min-w-0 flex-1`} value={channel} onChange={(e) => setChannel(e.target.value)} aria-label="Channel">
            {channels.map((c) => <option key={c.id} value={c.id}>#{c.name}</option>)}
          </select>
        ) : (
          <input className={`${inputCls} h-11 min-w-0 flex-1`} value={channel} onChange={(e) => setChannel(e.target.value.trim())}
            placeholder="Channel ID (right-click the channel → Copy Channel ID)" inputMode="numeric" aria-label="Channel ID" />
        )}
        <Button
          isLoading={pending}
          disabled={!channel}
          onClick={() => start(async () => {
            const res = await postDiscordInviteAction(channel);
            if (!res.success) { toast.error(res.error); return; }
            setUrl(res.url);
            toast.success("Join link posted in Discord");
            router.refresh();
          })}
        >
          Post join link
        </Button>
      </div>
      {url && (
        <p className="text-small text-(--color-text-secondary) break-all">
          Posted: {url} <CopyLink url={url} />
        </p>
      )}
    </section>
  );
}

interface OpenInvite {
  id: string; kind: "EMAIL" | "LINK"; email: string | null; url: string; uses: number; emailSent: boolean;
  invitedBy: string | null; createdAt: string; expiresAt: string;
}

/** Invites and links that still work, plus who recently joined */
export function InviteList({ invites, joined }: { invites: OpenInvite[]; joined: { id: string; email: string; acceptedAt: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <section className="space-y-3">
      <h2 className="text-h2 text-(--color-text-primary)">Open invites <span className="text-small font-normal text-(--color-text-secondary)">({invites.length})</span></h2>
      {invites.length === 0 ? (
        <div className="card text-small text-(--color-text-secondary)">No open invites.</div>
      ) : (
        <div className="card divide-y divide-(--color-border) p-0">
          {invites.map((i) => (
            <div key={i.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
              <div className="min-w-0">
                <p className="text-sm text-(--color-text-primary) break-all">
                  {i.kind === "EMAIL" ? i.email : "Discord join link"}
                  {i.kind === "LINK" && <span className="ml-2 text-small text-(--color-text-secondary)">· {i.uses} joined</span>}
                </p>
                <p className="text-small text-(--color-text-secondary)">
                  {i.invitedBy ? `${i.invitedBy} · ` : ""}{i.kind === "EMAIL" && !i.emailSent ? "not emailed · " : ""}expires {formatDate(i.expiresAt)}
                </p>
              </div>
              <span className="flex items-center gap-3">
                <CopyLink url={i.url} />
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    if (!confirm(i.kind === "LINK" ? "Turn off this join link? Anyone who hasn't used it yet won't be able to." : `Cancel the invite for ${i.email}?`)) return;
                    start(async () => {
                      const res = await revokeInviteAction(i.id);
                      if (!res.success) { toast.error(res.error); return; }
                      toast.success(i.kind === "LINK" ? "Join link turned off" : "Invite cancelled");
                      router.refresh();
                    });
                  }}
                  className="text-small font-medium text-(--color-danger) hover:underline disabled:opacity-50"
                >
                  {i.kind === "LINK" ? "Turn off" : "Cancel"}
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      {joined.length > 0 && (
        <p className="text-small text-(--color-text-secondary)">
          Recently joined by email invite: {joined.map((j) => j.email).join(", ")}
        </p>
      )}
    </section>
  );
}
