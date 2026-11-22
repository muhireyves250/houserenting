import { PageHero } from "@/components/shell/PageHero";
import { InstallApp } from "@/features/pwa/InstallApp";
import { Bell, ChevronRight, Heart, LifeBuoy, MessageSquare, QrCode, ShoppingBag, UserRound, Briefcase } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ProfilePhoto } from "@/features/users/components/ProfilePhoto";
import { db } from "@/lib/db";
import { PageContainer } from "@/components/ui/PageContainer";
import { SignOutButton } from "@/features/users/components/SignOutButton";
import { getProfile } from "@/features/users/service";
import { Link } from "@/i18n/navigation";
import { ProfileForm } from "@/features/users/components/ProfileForm";
import { toAppLocale } from "@/i18n/routing";
import { requireUser } from "@/lib/session";
import { hasWork, workRoles } from "@/features/hosting/work";
import { unreadCount } from "@/features/notifications/service";

export default async function ProfilePage() {
  const user = await requireUser("/profile");
  const profile = await getProfile(user.id);
  const photo = (await db.user.findUnique({ where: { id: user.id }, select: { image: true } }))?.image ?? null;
  if (!profile) notFound();
  const [t, tNav, unread, work] = await Promise.all([getTranslations("Profile"), getTranslations("Nav"), unreadCount(user.id), workRoles(user.id)]);
  const firstName = profile.name.split(" ")[0];
  const role = user.isHost ? t("roleHost") : t("roleGuest");
  const card = "rounded-3xl bg-surface shadow-[0_10px_30px_-14px_rgba(16,24,40,0.3)] ring-1 ring-black/[0.04] max-md:ring-line";
  const row = "flex w-full items-center gap-4 py-4 text-[15px] text-ink transition-colors active:bg-ink/5";

  return (
    <PageContainer className="max-w-2xl pt-6 pb-10 md:py-10 max-md:pt-0">
      {/* Phones: you (photo, name, role) are the top of the page. */}
      <PageHero title={firstName} subtitle={role} visual={<ProfilePhoto name={profile.name} image={photo} />} />
      <h1 className="max-md:hidden mb-6 text-[26px] leading-8 md:text-[32px] md:leading-10 font-bold tracking-[-0.03em] text-ink">{t("title")}</h1>

      {/* Computers: who you are, beside your details (the other pages are in the account menu on the left). */}
      <div className="grid gap-5 max-md:hidden lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start">
        <div className="flex flex-col gap-5">
          <section className={`${card} flex flex-col items-center px-6 py-8 text-center`}>
            <ProfilePhoto name={profile.name} image={photo} />
            <p className="mt-4 text-2xl leading-8 font-bold tracking-[-0.02em] text-ink">{firstName}</p>
            <p className="text-sm text-muted">{role}</p>
          </section>
          {/* Computers: installing the app sits in its own card under the photo. */}
          <div className={`${card} hidden px-5 py-1 lg:block lg:empty:hidden`}>
            <InstallApp variant="row" />
          </div>
        </div>
        <section className={`${card} hidden p-6 lg:block`}>
          <h2 className="mb-4 text-[17px] font-bold text-ink">{t("personalInfo")}</h2>
          <ProfileForm profile={{ ...profile, locale: toAppLocale(profile.locale) }} />
        </section>
      </div>

      {/* Settings list */}
      <ul className="mt-2 divide-y divide-line/70 md:mt-6 lg:hidden">
        {hasWork(work) && (
          // A role at a place or restaurant: their work dashboard first.
          <li className="lg:hidden">
            <Link href={work.home} className={`${row} font-semibold text-primary`}>
              <Briefcase className="size-6" strokeWidth={1.6} aria-hidden="true" />
              <span className="flex-1">{tNav("account.work")}</span>
              <ChevronRight className="size-5 text-primary/60" aria-hidden="true" />
            </Link>
          </li>
        )}
        <li className="lg:hidden">
          <Link href="/profile/personal" className={row}>
            <UserRound className="size-6" strokeWidth={1.6} aria-hidden="true" />
            <span className="flex-1">{t("personalInfo")}</span>
            <ChevronRight className="size-5 text-ink/60" aria-hidden="true" />
          </Link>
        </li>
        <li className="lg:hidden">
          <Link href="/favorites" className={row}>
            <Heart className="size-6" strokeWidth={1.6} aria-hidden="true" />
            <span className="flex-1">{tNav("favorites")}</span>
            <ChevronRight className="size-5 text-ink/60" aria-hidden="true" />
          </Link>
        </li>
        <li className="lg:hidden">
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
        <li className="lg:hidden">
          <Link href="/orders" className={row}>
            <ShoppingBag className="size-6" strokeWidth={1.6} aria-hidden="true" />
            <span className="flex-1">{tNav("orders")}</span>
            <ChevronRight className="size-5 text-ink/60" aria-hidden="true" />
          </Link>
        </li>
        <li className="lg:hidden">
          <Link href="/promote" className={row}>
            <QrCode className="size-6" strokeWidth={1.6} aria-hidden="true" />
            <span className="flex-1">{t("promote")}</span>
            <ChevronRight className="size-5 text-ink/60" aria-hidden="true" />
          </Link>
        </li>
        <li className="lg:hidden">
          <Link href="/support" className={row}>
            <LifeBuoy className="size-6" strokeWidth={1.6} aria-hidden="true" />
            <span className="flex-1">{t("help")}</span>
            <ChevronRight className="size-5 text-ink/60" aria-hidden="true" />
          </Link>
        </li>
        <li className="empty:hidden">
          <InstallApp variant="row" />
        </li>
        <li className="lg:hidden">
          <Link href="/chats" className={row}>
            <MessageSquare className="size-6" strokeWidth={1.6} aria-hidden="true" />
            <span className="flex-1">{tNav("chats")}</span>
            <ChevronRight className="size-5 text-ink/60" aria-hidden="true" />
          </Link>
        </li>

      </ul>

      {/* Computers: Log out is at the foot of the account menu. */}
      <div className="mt-4 border-t border-line/70 pt-2 lg:hidden">
        <SignOutButton />
      </div>
    </PageContainer>
  );
}
