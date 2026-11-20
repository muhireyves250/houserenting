import { PageHero } from "@/components/shell/PageHero";
import { Bell } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageContainer } from "@/components/ui/PageContainer";
import { formatKigaliDateTime } from "@/features/bookings/format";
import { MarkRead } from "@/features/notifications/components/MarkRead";
import { NOTICE_GROUPS, noticeGroup, type NoticeGroup } from "@/features/notifications/categories";
import { listNotifications } from "@/features/notifications/service";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { requireUser } from "@/lib/session";
import { dynamicMessage } from "@/lib/dynamic-message";

type Props = { searchParams: Promise<{ show?: string }> };

export default async function NotificationsPage({ searchParams }: Props) {
  const user = await requireUser("/notifications");
  const raw = (await searchParams).show;
  const [t, tSupport, tHost, tStay, tPlaces, tFood, tPromoters, tLaundry, locale, items] = await Promise.all([
    getTranslations("Notifications"),
    getTranslations("Support"),
    getTranslations("Host"),
    getTranslations("MyStay"),
    getTranslations("Places"),
    getTranslations("Food"),
    getTranslations("Promoters"),
    getTranslations("Laundry"),
    getLocale(),
    listNotifications(user.id, 100),
  ]);
  const unread = items.some((n) => !n.readAt);
  // Filters: only the groups that have notices, with how many.
  const groups = NOTICE_GROUPS.map((g) => ({ g, count: items.filter((n) => noticeGroup(n.kind) === g).length })).filter((x) => x.count > 0);
  const show = groups.some((x) => x.g === raw) ? (raw as NoticeGroup) : null;
  const shown = show ? items.filter((n) => noticeGroup(n.kind) === show) : items;

  return (
    <PageContainer className="max-w-2xl py-6 md:py-10 max-md:pt-0">
      <PageHero title={t("title")} icon={Bell} />
      <h1 className="max-md:hidden mb-6 text-[26px] leading-8 font-bold tracking-[-0.03em] text-ink md:text-[32px] md:leading-10">{t("title")}</h1>
      {/* Opening the page marks everything as read (after it has been shown as new once). */}
      {unread && <MarkRead />}
      {groups.length > 1 && (
        <nav aria-label={t("filterLabel")} data-lenis-prevent className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
          {[{ g: null, count: items.length }, ...groups].map(({ g, count }) => {
            const on = g === show;
            return (
              <Link
                key={g ?? "all"}
                href={g ? { pathname: "/notifications", query: { show: g } } : "/notifications"}
                prefetch
                aria-current={on ? "page" : undefined}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] font-semibold whitespace-nowrap transition-colors",
                  on ? "border-primary bg-primary text-white" : "border-line bg-surface text-ink hover:border-primary/60",
                )}
              >
                {t(`filter.${g ?? "all"}`)}
                <span className={cn("tabular-nums", on ? "text-white/80" : "text-muted")}>{count}</span>
              </Link>
            );
          })}
        </nav>
      )}
      {items.length === 0 ? (
        <EmptyState icon={<Bell />} title={t("emptyTitle")} body={t("emptyBody")} />
      ) : (
        <ul className="divide-y divide-line rounded-3xl bg-surface px-5 shadow-[0_10px_30px_-14px_rgba(16,24,40,0.3)] ring-1 ring-black/[0.04] max-md:ring-line">
          {shown.map((n) => {
            const data = { ...(n.data as Record<string, string | number>) };
            // Listing notices carry a listing status; ticket notices a ticket status.
            if (typeof data.status === "string")
              data.statusLabel =
                n.kind === "orderStatus"
                  ? dynamicMessage(tFood, `status.${data.status}`, data.status)
                  : n.kind === "promoterStatus"
                    ? dynamicMessage(tPromoters, `status.${data.status}`, data.status)
                  : n.kind === "restaurantStatus"
                    ? dynamicMessage(tFood, `restaurantStatus.${data.status}`, data.status)
                    : dynamicMessage(n.kind === "listingStatus" ? tHost : tSupport, `status.${data.status}`, data.status);
            if (typeof data.roleLabel === "string" && n.kind === "restaurantTeamAdded") data.roleLabel = dynamicMessage(tFood, `role.${data.roleLabel}`, data.roleLabel).toLowerCase();
            if (typeof data.kindLabel === "string") data.kindLabel = dynamicMessage(tStay, `kind.${data.kindLabel}`, data.kindLabel).toLowerCase();
            if (typeof data.statusLabel === "string" && n.kind === "laundryUpdate") data.statusLabel = dynamicMessage(tLaundry, `update.${data.statusLabel}`, data.statusLabel);
            if (typeof data.roleLabel === "string" && n.kind === "teamAdded") data.roleLabel = dynamicMessage(tPlaces, `teamRole.${data.roleLabel}`, data.roleLabel).toLowerCase();
            const text = dynamicMessage(t, `kind.${n.kind}`, n.kind, data);
            const body = (
              <span className="flex gap-3 py-4">
                <span aria-hidden="true" className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-primary")} />
                <span className="flex flex-col gap-0.5">
                  <span className={cn("text-[15px] text-ink", !n.readAt && "font-semibold")}>{text}</span>
                  <span className="text-[13px] text-muted">{formatKigaliDateTime(locale, n.createdAt)}</span>
                </span>
              </span>
            );
            return <li key={n.id}>{n.href ? <Link href={n.href}>{body}</Link> : body}</li>;
          })}
        </ul>
      )}
    </PageContainer>
  );
}
