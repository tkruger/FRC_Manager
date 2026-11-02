import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageTitle } from "@/components/PageHeader";
import { canCoordinate, DEFAULT_MIN_ADULTS } from "@/lib/volunteers";
import { VolunteerSettingsForm } from "./VolunteerSettingsForm";

// Volunteer settings (Volunteer Coordinators, Head Mentors): how many confirmed adults each meeting
// needs, and the default shift instructions sent with sign-ups and reminders.

export default async function VolunteerSettingsPage() {
  const session = await auth();
  if (!session?.user?.teamId) redirect("/dashboard");
  if (!canCoordinate(session.user.roles as string[])) redirect("/volunteers");

  const settings = await prisma.volunteerSettings.findUnique({
    where:  { teamId: session.user.teamId },
    select: { instructions: true, minAdults: true },
  });

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div>
        <nav className="text-small text-(--color-text-secondary) mb-1">
          <Link href="/volunteers" className="hover:text-(--color-primary)">Volunteers</Link>
          <span className="mx-2">›</span>Settings
        </nav>
        <PageTitle help="volunteers">Volunteer settings</PageTitle>
      </div>
      <VolunteerSettingsForm minAdults={settings?.minAdults ?? DEFAULT_MIN_ADULTS} instructions={settings?.instructions ?? null} />
    </div>
  );
}
