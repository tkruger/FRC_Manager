import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { ProfileForm } from "./ProfileForm";
import { AppIconPicker } from "./AppIconPicker";
import { APP_ICON_COOKIE, resolveAppIcon } from "@/lib/app-icons";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const appIcon = resolveAppIcon((await cookies()).get(APP_ICON_COOKIE)?.value);

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div>
        <h1 className="text-h1 text-[--color-text-primary]">Profile settings</h1>
        <p className="text-body text-[--color-text-secondary] mt-1">
          Update your personal information and app appearance.
        </p>
      </div>

      <ProfileForm
        initialName={session.user.name ?? ""}
        initialEmail={session.user.email ?? ""}
      />

      <AppIconPicker current={appIcon} />
    </div>
  );
}
