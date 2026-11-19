import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Avatar } from "@/components/ui/Avatar";
import { PageIntro, Panel } from "@/features/admin/components/ui";
import { ProfileForm } from "@/features/users/components/ProfileForm";
import { SignOutButton } from "@/features/users/components/SignOutButton";
import { getProfile } from "@/features/users/service";
import { toAppLocale } from "@/i18n/routing";
import { requireUser } from "@/lib/session";

/** The owner's own account, inside their dashboard: details, language, log out. */
export default async function HostAccountPage() {
  const user = await requireUser("/host/account");
  const profile = await getProfile(user.id);
  if (!profile) notFound();
  const [t, tProfile] = await Promise.all([getTranslations("Host.shell"), getTranslations("Profile")]);
  return (
    <div className="mx-auto max-w-2xl">
      <PageIntro description={t("accountIntro")} />
      <div className="mb-5 flex items-center gap-4 rounded-2xl border border-line bg-surface p-5">
        <Avatar name={profile.name} className="size-14 text-lg" />
        <div className="min-w-0">
          <p className="text-[18px] font-bold text-ink">{profile.name}</p>
          <p className="truncate text-[13px] text-muted">{t("console")}</p>
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
