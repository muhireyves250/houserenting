import { Heart, House, MessageSquare } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Avatar } from "@/components/ui/Avatar";
import { PageContainer } from "@/components/ui/PageContainer";
import { ProfileForm } from "@/features/users/components/ProfileForm";
import { SignOutButton } from "@/features/users/components/SignOutButton";
import { getProfile } from "@/features/users/service";
import { Link } from "@/i18n/navigation";
import { toAppLocale } from "@/i18n/routing";
import { requireUser } from "@/lib/session";

const SHORTCUTS = [
  { key: "favorites", href: "/favorites", icon: Heart, tint: "bg-rose-50 text-rose-600" },
  { key: "bookings", href: "/bookings", icon: House, tint: "bg-primary/[0.08] text-primary" },
  { key: "chats", href: "/chats", icon: MessageSquare, tint: "bg-emerald-50 text-emerald-700" },
] as const;

export default async function ProfilePage() {
  const user = await requireUser("/profile");
  const profile = await getProfile(user.id);
  if (!profile) notFound();
  const [t, tNav] = await Promise.all([getTranslations("Profile"), getTranslations("Nav")]);
  const card = "rounded-3xl bg-surface shadow-[0_10px_30px_-14px_rgba(16,24,40,0.3)] ring-1 ring-black/[0.04]";

  return (
    <PageContainer className="max-w-2xl pt-6 pb-10 md:py-10">
      <h1 className="mb-6 text-[32px] leading-10 font-bold tracking-[-0.03em] text-ink">{t("title")}</h1>

      {/* Who you are */}
      <section className={`${card} flex flex-col items-center px-6 py-8 text-center`}>
        <Avatar name={profile.name} className="size-24 text-3xl" />
        <p className="mt-4 text-[26px] leading-8 font-bold tracking-[-0.02em] text-ink">{profile.name}</p>
        <p className="mt-1 text-sm text-muted">{profile.email}</p>
      </section>

      {/* Shortcuts */}
      <nav aria-label={t("title")} className="mt-4 grid grid-cols-3 gap-3">
        {SHORTCUTS.map(({ key, href, icon: Icon, tint }) => (
          <Link
            key={key}
            href={href}
            className={`${card} flex flex-col items-center gap-3 px-3 py-5 text-[15px] font-semibold text-ink transition-transform duration-300 active:scale-[0.97] md:hover:-translate-y-0.5`}
          >
            <span className={`flex size-12 items-center justify-center rounded-2xl ${tint}`}>
              <Icon className="size-6" aria-hidden="true" />
            </span>
            {tNav(key)}
          </Link>
        ))}
      </nav>

      {/* Personal information */}
      <section className={`${card} mt-4 p-6`}>
        <h2 className="mb-5 text-lg font-bold text-ink">{t("personalInfo")}</h2>
        <ProfileForm profile={{ ...profile, locale: toAppLocale(profile.locale) }} />
      </section>

      <div className="mt-6">
        <SignOutButton />
      </div>
    </PageContainer>
  );
}
