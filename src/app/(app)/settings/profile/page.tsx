import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ProfileForm } from "./ProfileForm";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

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
    </div>
  );
}
