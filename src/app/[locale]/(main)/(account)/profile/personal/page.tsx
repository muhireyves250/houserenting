import { UserRound } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHero } from "@/components/shell/PageHero";
import { PageContainer } from "@/components/ui/PageContainer";
import { ProfileForm } from "@/features/users/components/ProfileForm";
import { getProfile } from "@/features/users/service";
import { toAppLocale } from "@/i18n/routing";
import { requireUser } from "@/lib/session";

export async function generateMetadata() {
  const t = await getTranslations("Profile");
  return { title: t("personalInfo") };
}

/** Name, email, phone and language, on their own page (from Profile). */
export default async function PersonalInfoPage() {
  const user = await requireUser("/profile/personal");
  const [profile, t] = await Promise.all([getProfile(user.id), getTranslations("Profile")]);
  if (!profile) notFound();
  return (
    <PageContainer className="max-w-2xl pt-6 pb-10 max-md:pt-0 md:py-10">
      <PageHero title={t("personalInfo")} icon={UserRound} />
      <h1 className="mb-6 text-[26px] leading-8 font-bold tracking-[-0.03em] text-ink max-md:hidden md:text-[32px] md:leading-10">{t("personalInfo")}</h1>
      <section className="rounded-3xl bg-surface p-6 shadow-[0_10px_30px_-14px_rgba(16,24,40,0.3)] ring-1 ring-black/[0.04] max-md:ring-line">
        <ProfileForm profile={{ ...profile, locale: toAppLocale(profile.locale) }} />
      </section>
    </PageContainer>
  );
}
