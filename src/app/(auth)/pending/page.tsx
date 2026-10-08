import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function PendingPage({ searchParams }: { searchParams: Promise<{ team?: string }> }) {
  // A team that's new to FRC Manager is approved by the FRC Manager admins first
  const newTeam = (await searchParams).team === "new";

  return (
    <div className="card text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-(--color-warning)/15">
        <svg className="h-7 w-7 text-(--color-warning)" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h1 className="text-h2 text-(--color-text-primary) mb-2">
        {newTeam ? "Your team is waiting for approval" : "Account pending approval"}
      </h1>
      <p className="text-body text-(--color-text-secondary) mb-6">
        {newTeam
          ? "Your team is new to FRC Manager, so the FRC Manager admins review it first. Once it's approved you can sign in as your team's Head Mentor."
          : "Your request to join the team has been submitted. A Head Mentor or team leader will review it shortly."}
      </p>
      <div className="rounded-md bg-(--color-surface-overlay) px-4 py-3 text-small text-(--color-text-secondary) text-left mb-6">
        <p className="font-medium text-(--color-text-primary) mb-1">What happens next?</p>
        <ol className="list-decimal list-inside space-y-1">
          {newTeam ? (
            <>
              <li>An FRC Manager admin reviews your team</li>
              <li>Once approved, sign in — you&apos;re the team&apos;s Head Mentor</li>
              <li>Invite your team; you approve them in Team members</li>
            </>
          ) : (
            <>
              <li>A Head Mentor or team leader reviews your request</li>
              <li>They assign you a role and approve your account</li>
              <li>Sign in once you&apos;re approved</li>
            </>
          )}
        </ol>
      </div>
      <Link href="/login">
        <Button variant="outline" className="w-full">Back to sign in</Button>
      </Link>
    </div>
  );
}
