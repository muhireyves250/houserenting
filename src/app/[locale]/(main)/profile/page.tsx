import { Bell, ChevronRight, Heart, House, KeyRound, LifeBuoy, MessageSquare, QrCode, UserRound } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ProfilePhoto } from "@/features/users/components/ProfilePhoto";
import { db } from "@/lib/db";
import { PageContainer } from "@/components/ui/PageContainer";
import { ProfileForm } from "@/features/users/components/ProfileForm";
import { SignOutButton } from "@/features/users/components/SignOutButton";
import { getProfile } from "@/features/users/service";
import { LocaleSwitcher } from "@/components/shell/LocaleSwitcher";
import { Link } from "@/i18n/navigation";
import { Suspense } from "react";
import { toAppLocale } from "@/i18n/routing";
import { requireUser } from "@/lib/session";
import { unreadCount } from "@/features/notifications/service";
import { InviteFriends } from "@/features/referrals/components/InviteFriends";
import { ensureReferralCode, referralSummary } from "@/features/referrals/service";
import { getSettings } from "@/features/settings/service";
import { getEnv } from "@/lib/env";

const TILES = [
  { key: "bookings", href: "/bookings", icon: House, tint: "bg-primary/[0.08] text-primary" },
  { key: "favorites", href: "/favorites", icon: Heart, tint: "bg-rose-50 text-rose-600" },
] as const;

export default async function ProfilePage() {
  const user = await requireUser("/profile");
  const profile = await getProfile(user.id);
  const photo = (await db.user.findUnique({ where: { id: user.id }, select: { image: true } }))?.image ?? null;
  if (!profile) notFound();
  const [t, tNav, unread, settings] = await Promise.all([getTranslations("Profile"), getTranslations("Nav"), unreadCount(user.id), getSettings()]);
  const referral = settings.referralEnabled
    ? { code: await ensureReferralCode(user.id), summary: await referralSummary(user.id), reward: settings.referralRewardAmount }
    : null;
  const card = "rounded-3xl bg-surface shadow-[0_10px_30px_-14px_rgba(16,24,40,0.3)] ring-1 ring-black/[0.04] max-md:ring-line";
  const row = "flex w-full items-center gap-4 py-4 text-[15px] text-ink transition-colors active:bg-ink/5";

  return (
    <PageContainer className="max-w-2xl pt-6 pb-10 md:py-10">
      <h1 className="mb-6 text-[26px] leading-8 md:text-[32px] md:leading-10 font-bold tracking-[-0.03em] text-ink">{t("title")}</h1>

      {/* Who you are */}
      <section className={`${card} flex flex-col items-center px-6 py-8 text-center`}>
        <ProfilePhoto name={profile.name} image={photo} />
        <p className="mt-4 text-2xl leading-8 font-bold tracking-[-0.02em] text-ink">{profile.name.split(" ")[0]}</p>
        <p className="text-sm text-muted">{user.isHost ? t("roleHost") : t("roleGuest")}</p>
      </section>



      {/* Two big tiles */}
      <nav aria-label={t("title")} className="mt-4 grid grid-cols-2 gap-4">
        {TILES.map(({ key, href, icon: Icon, tint }) => (
          <Link
            key={key}
            href={href}
            className={`${card} flex aspect-square flex-col items-center justify-center gap-4 p-4 text-[15px] font-semibold text-ink transition-transform duration-300 active:scale-[0.97]`}
          >
            <span className={`flex size-20 items-center justify-center rounded-3xl ${tint}`}>
              <Icon className="size-10" strokeWidth={1.6} aria-hidden="true" />
            </span>
            {tNav(key)}
          </Link>
        ))}
      </nav>

      {/* Settings list */}
      <ul className="mt-6 divide-y divide-line/70">
        <li>
          <a href="#personal" className={row}>
            <UserRound className="size-6" strokeWidth={1.6} aria-hidden="true" />
            <span className="flex-1">{t("personalInfo")}</span>
            <ChevronRight className="size-5 text-ink/60" aria-hidden="true" />
          </a>
        </li>
        <li>
          <Link href="/notifications" className={row}>
            <Bell className="size-6" strokeWidth={1.6} aria-hidden="true" />
            <span className="flex-1">{t("notifications")}</span>
            {unread > 0 && (
              <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-white tabular-nums" aria-label={t("unread", { count: unread })}>
                {unread}
              </span>
            )}
            <ChevronRight className="size-5 text-ink/60" aria-hidden="true" />
          </Link>
        </li>
        <li>
          <Link href="/host" className={row}>
            <KeyRound className="size-6" strokeWidth={1.6} aria-hidden="true" />
            <span className="flex-1">{user.isHost ? t("yourListings") : t("hostYourPlace")}</span>
            <ChevronRight className="size-5 text-ink/60" aria-hidden="true" />
          </Link>
        </li>
        <li>
          <Link href="/promote" className={row}>
            <QrCode className="size-6" strokeWidth={1.6} aria-hidden="true" />
            <span className="flex-1">{t("promote")}</span>
            <ChevronRight className="size-5 text-ink/60" aria-hidden="true" />
          </Link>
        </li>
        <li>
          <Link href="/support" className={row}>
            <LifeBuoy className="size-6" strokeWidth={1.6} aria-hidden="true" />
            <span className="flex-1">{t("help")}</span>
            <ChevronRight className="size-5 text-ink/60" aria-hidden="true" />
          </Link>
        </li>
        <li>
          <Link href="/chats" className={row}>
            <MessageSquare className="size-6" strokeWidth={1.6} aria-hidden="true" />
            <span className="flex-1">{tNav("chats")}</span>
            <ChevronRight className="size-5 text-ink/60" aria-hidden="true" />
          </Link>
        </li>

        <li className="flex items-center justify-between gap-4 py-3 md:hidden">
          <span className="text-[15px] text-ink">{tNav("language")}</span>
          <Suspense>
            <LocaleSwitcher />
          </Suspense>
        </li>
      </ul>

      {referral && (
        <InviteFriends
          link={`${getEnv().BETTER_AUTH_URL}/?ref=${referral.code}`}
          code={referral.code}
          invited={referral.summary.invited}
          earned={referral.summary.approved}
          reward={referral.reward}
        />
      )}

      {/* Personal information */}
      <section id="personal" className={`${card} mt-6 scroll-mt-6 p-6`}>
        <h2 className="mb-5 text-lg font-bold text-ink">{t("personalInfo")}</h2>
        <ProfileForm profile={{ ...profile, locale: toAppLocale(profile.locale) }} />
      </section>

      <div className="mt-4 border-t border-line/70 pt-2">
        <SignOutButton />
      </div>
    </PageContainer>
  );
}
