import { auth, oauthProviders } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AccountSecurity } from "./AccountSecurity";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { ProfileForm } from "./ProfileForm";
import { AppIconPicker } from "./AppIconPicker";
import { APP_ICON_COOKIE, resolveAppIcon } from "@/lib/app-icons";
import { VolunteerProfile } from "./VolunteerProfile";
import { canCoordinate, isAdult, isCleared } from "@/lib/volunteers";
import { isViewOnly } from "@/lib/access/read-only";
import { SubTeamPicker } from "@/components/SubTeamPicker";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const appIcon = resolveAppIcon((await cookies()).get(APP_ICON_COOKIE)?.value);
  const me = await prisma.user.findUnique({
    where:  { id: session.user.id },
    select: {
      name: true, email: true, emailVerified: true, password: true, accounts: { select: { provider: true } },
      phone: true, volunteerClearedAt: true, volunteerClearedUntil: true, subTeams: true,
    },
  });
  if (!me) redirect("/login");
  const roles = session.user.roles as string[];
  // Parents and mentors volunteer (coordinators too); students don't
  const showVolunteering = isAdult(roles) || canCoordinate(roles);
  const untilText = me.volunteerClearedUntil?.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
  const volunteerStatus = isCleared(me)
    ? `You're cleared to volunteer${untilText ? ` until ${untilText}` : ""}.`
    : me.volunteerClearedAt
      ? `Your volunteer clearance ended ${untilText}. Talk to a Head Mentor to renew it.`
      : "You're not cleared to volunteer yet — talk to a Head Mentor about getting cleared before signing up for shifts.";

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div>
        <h1 className="text-h1 text-(--color-text-primary)">Profile settings</h1>
        <p className="text-body text-(--color-text-secondary) mt-1">
          Update your personal information and app appearance.
        </p>
      </div>

      <ProfileForm initialName={me.name} />

      {/* Parents aren't in sub-teams */}
      {!isViewOnly(roles) && (
        <section className="card space-y-3">
          <div>
            <h2 className="text-h3 text-(--color-text-primary)">My sub-teams</h2>
            <p className="text-small text-(--color-text-secondary) mt-0.5">Pick every sub-team you&apos;re part of — you&apos;ll be reminded about their meetings.</p>
          </div>
          <SubTeamPicker userId={session.user.id} current={me.subTeams} />
        </section>
      )}

      {showVolunteering && <VolunteerProfile phone={me.phone} status={volunteerStatus} />}

      <AccountSecurity
        email={me.email}
        emailVerified={!!me.emailVerified}
        hasPassword={!!me.password}
        providers={oauthProviders()}
        connected={me.accounts.map((a) => a.provider)}
      />

      <AppIconPicker current={appIcon} />
    </div>
  );
}
