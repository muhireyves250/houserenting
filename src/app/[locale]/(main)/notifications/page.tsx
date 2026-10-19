import { Bell } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageContainer } from "@/components/ui/PageContainer";
import { formatKigaliDateTime } from "@/features/bookings/format";
import { MarkRead } from "@/features/notifications/components/MarkRead";
import { listNotifications } from "@/features/notifications/service";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { requireUser } from "@/lib/session";
import { dynamicMessage } from "@/lib/dynamic-message";

export default async function NotificationsPage() {
  const user = await requireUser("/notifications");
  const [t, tSupport, tHost, tStay, tPlaces, tFood, tPromoters, locale, items] = await Promise.all([
    getTranslations("Notifications"),
    getTranslations("Support"),
    getTranslations("Host"),
    getTranslations("MyStay"),
    getTranslations("Places"),
    getTranslations("Food"),
    getTranslations("Promoters"),
    getLocale(),
    listNotifications(user.id),
  ]);
  const unread = items.some((n) => !n.readAt);

  return (
    <PageContainer className="max-w-2xl py-6 md:py-10">
      <h1 className="mb-6 text-[26px] leading-8 font-bold tracking-[-0.03em] text-ink md:text-[32px] md:leading-10">{t("title")}</h1>
      {/* Opening the page marks everything as read (after it has been shown as new once). */}
      {unread && <MarkRead />}
      {items.length === 0 ? (
        <EmptyState icon={<Bell />} title={t("emptyTitle")} body={t("emptyBody")} />
      ) : (
        <ul className="divide-y divide-line rounded-3xl bg-surface px-5 shadow-[0_10px_30px_-14px_rgba(16,24,40,0.3)] ring-1 ring-black/[0.04] max-md:ring-line">
          {items.map((n) => {
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
