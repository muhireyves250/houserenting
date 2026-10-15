import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Avatar } from "@/components/ui/Avatar";
import { PageIntro, Panel } from "@/features/admin/components/ui";
import { ProfileForm } from "@/features/users/components/ProfileForm";
import { SignOutButton } from "@/features/users/components/SignOutButton";
import { getProfile } from "@/features/users/service";
import { toAppLocale } from "@/i18n/routing";
import { requireAdmin } from "@/lib/permissions";

/** The staff member's own account, inside the dashboard: details, language, log out. */
export default async function AdminAccountPage() {
  const user = await requireAdmin("/admin/account");
  const profile = await getProfile(user.id);
  if (!profile) notFound();
  const [t, tProfile] = await Promise.all([getTranslations("Admin"), getTranslations("Profile")]);
  return (
    <div className="mx-auto max-w-2xl">
      <PageIntro description={t("accountIntro")} />
      <div className="mb-5 flex items-center gap-4 rounded-2xl border border-line bg-surface p-5">
        <Avatar name={profile.name} className="size-14 text-lg" />
        <div className="min-w-0">
          <p className="text-[18px] font-bold text-ink">{profile.name}</p>
          <p className="truncate text-[13px] text-muted">{t("staff")}</p>
        </div>
      </div>
      <div className="flex flex-col gap-5">
        <Panel title={tProfile("personalInfo")}>
          <ProfileForm profile={{ ...profile, locale: toAppLocale(profile.locale) }} />
        </Panel>
        <Panel>
          <SignOutButton />
        </Panel>
      </div>
    </div>
  );
}
