import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function PendingPage() {
  return (
    <div className="card text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[--color-warning]/15">
        <svg className="h-7 w-7 text-[--color-warning]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h1 className="text-h2 text-[--color-text-primary] mb-2">Account pending approval</h1>
      <p className="text-body text-[--color-text-secondary] mb-6">
        Your request to join the team has been submitted. A team admin will review it shortly.
        You&apos;ll receive an email when your account is approved.
      </p>
      <div className="rounded-md bg-[--color-surface-overlay] px-4 py-3 text-small text-[--color-text-secondary] text-left mb-6">
        <p className="font-medium text-[--color-text-primary] mb-1">What happens next?</p>
        <ol className="list-decimal list-inside space-y-1">
          <li>A Head Mentor or Admin reviews your request</li>
          <li>They assign you a role and approve your account</li>
          <li>You receive an email confirmation and can log in</li>
        </ol>
      </div>
      <Link href="/login">
        <Button variant="outline" className="w-full">Back to sign in</Button>
      </Link>
    </div>
  );
}
