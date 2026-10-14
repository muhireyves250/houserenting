import { getLocale, getTranslations } from "next-intl/server";
import { recentAudit } from "@/features/audit/service";
import { formatKigaliDateTime } from "@/features/bookings/format";
import { Link } from "@/i18n/navigation";
import { requireAdmin } from "@/lib/permissions";
import { dynamicMessage } from "@/lib/dynamic-message";

const LINKS: Record<string, (id: string) => string> = {
  listing: (id) => `/admin/listings/${id}`,
  ticket: (id) => `/admin/support/${id}`,
};

export default async function AdminAuditPage() {
  await requireAdmin("/admin/audit");
  const [t, locale, entries] = await Promise.all([getTranslations("Admin"), getLocale(), recentAudit({ take: 200 })]);
  return (
    <ol className="divide-y divide-line rounded-3xl bg-surface px-5 shadow-[0_10px_30px_-14px_rgba(16,24,40,0.3)] ring-1 ring-black/[0.04] max-md:ring-line">
      {entries.length === 0 && <li className="py-8 text-center text-[15px] text-muted">{t("noAudit")}</li>}
      {entries.map((entry) => {
        const link = LINKS[entry.entityType]?.(entry.entityId);
        const reason = (entry.data as { reason?: string } | null)?.reason;
        return (
          <li key={entry.id} className="flex flex-col gap-0.5 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <span className="text-[15px] text-ink">
              <b className="font-semibold">{dynamicMessage(t, `action.${entry.action}`, entry.action)}</b> · {entry.actor?.name ?? t("system")}
              {link ? (
                <Link href={link} className="ml-1 text-[13px] text-primary hover:underline">
                  {entry.entityType} {entry.entityId.slice(0, 8)}
                </Link>
              ) : (
                <span className="ml-1 text-[13px] text-muted">
                  {entry.entityType} {entry.entityId.slice(0, 8)}
                </span>
              )}
              {reason && <span className="block text-[13px] text-muted">{reason}</span>}
            </span>
            <span className="shrink-0 text-[13px] text-muted">{formatKigaliDateTime(locale, entry.createdAt)}</span>
          </li>
        );
      })}
    </ol>
  );
}
