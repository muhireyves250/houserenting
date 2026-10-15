import { Bell } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { PageIntro, Panel } from "@/features/admin/components/ui";
import { formatKigaliDateTime } from "@/features/bookings/format";
import { MarkRead } from "@/features/notifications/components/MarkRead";
import { listNotifications } from "@/features/notifications/service";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { dynamicMessage } from "@/lib/dynamic-message";
import { requireAdmin } from "@/lib/permissions";

/** Staff notices (listings waiting, new support requests, payments to check…), inside the dashboard. */
export default async function AdminNotificationsPage() {
  const user = await requireAdmin("/admin/notifications");
  const [t, tNotes, tSupport, locale, items] = await Promise.all([
    getTranslations("Admin"),
    getTranslations("Notifications"),
    getTranslations("Support"),
    getLocale(),
    listNotifications(user.id, 100),
  ]);
  return (
    <div>
      <PageIntro description={t("notificationsIntro")} />
      {items.some((n) => !n.readAt) && <MarkRead />}
      <Panel flush>
        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-14 text-center">
            <Bell className="size-8 text-line-strong" aria-hidden="true" />
            <p className="text-[14px] text-muted">{tNotes("emptyTitle")}</p>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {items.map((n) => {
              const data = { ...(n.data as Record<string, string | number>) };
              if (typeof data.status === "string") data.statusLabel = dynamicMessage(tSupport, `status.${data.status}`, data.status);
              // Notices made before staff had their own area may point at client pages; keep them inside admin.
              const href = n.href && n.href.startsWith("/admin") ? n.href : null;
              const body = (
                <span className="flex gap-3 px-5 py-3.5">
                  <span aria-hidden="true" className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-primary")} />
                  <span className="flex flex-col gap-0.5">
                    <span className={cn("text-[14px] text-ink", !n.readAt && "font-semibold")}>{dynamicMessage(tNotes, `kind.${n.kind}`, n.kind, data)}</span>
                    <span className="text-xs text-muted">{formatKigaliDateTime(locale, n.createdAt)}</span>
                  </span>
                </span>
              );
              return (
                <li key={n.id} className="transition-colors hover:bg-canvas/60">
                  {href ? <Link href={href}>{body}</Link> : body}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}
