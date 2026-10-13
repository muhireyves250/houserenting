import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Avatar } from "@/components/ui/Avatar";
import { PageContainer } from "@/components/ui/PageContainer";
import { ProfileForm } from "@/features/users/components/ProfileForm";
import { SignOutButton } from "@/features/users/components/SignOutButton";
import { getProfile } from "@/features/users/service";
import { toAppLocale } from "@/i18n/routing";
import { requireUser } from "@/lib/session";

export default async function ProfilePage() {
  const user = await requireUser("/profile");
  const profile = await getProfile(user.id);
  if (!profile) notFound();
  const t = await getTranslations("Profile");

  return (
    <PageContainer className="max-w-2xl py-8">
      <div className="mb-8 flex items-center gap-4">
        <Avatar name={profile.name} className="size-16 text-xl" />
        <div>
          <h1 className="text-2xl font-bold tracking-[-0.02em]">{t("title")}</h1>
          <p className="text-sm text-muted">{profile.email}</p>
        </div>
      </div>
      <div className="rounded-card bg-surface p-6">
        <ProfileForm profile={{ ...profile, locale: toAppLocale(profile.locale) }} />
      </div>
      <div className="mt-6">
        <SignOutButton />
      </div>
    </PageContainer>
  );
}
