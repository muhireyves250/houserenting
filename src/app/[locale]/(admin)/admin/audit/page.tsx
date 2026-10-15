import { getLocale, getTranslations } from "next-intl/server";
import { FilterTabs, PageIntro, Pagination, Panel, Table, td } from "@/features/admin/components/ui";
import { countAudit, recentAudit } from "@/features/audit/service";
import { formatKigaliDateTime } from "@/features/bookings/format";
import { Link } from "@/i18n/navigation";
import { dynamicMessage } from "@/lib/dynamic-message";
import { requireAdmin } from "@/lib/permissions";

const GROUPS = {
  all: undefined,
  listings: ["listing", "question", "review"],
  bookings: ["booking"],
  people: ["user"],
  support: ["ticket"],
  money: ["settlement", "promo", "reward", "export"],
  settings: ["settings"],
} as const;
type Group = keyof typeof GROUPS;
const PER_PAGE = 50;

const LINKS: Record<string, (id: string) => string> = {
  listing: (id) => `/admin/listings/${id}`,
  ticket: (id) => `/admin/support/${id}`,
  booking: (id) => `/admin/bookings/${id}`,
  user: (id) => `/admin/users/${id}`,
};

type Props = { searchParams: Promise<{ type?: string; page?: string }> };

export default async function AdminAuditPage({ searchParams }: Props) {
  await requireAdmin("/admin/audit");
  const params = await searchParams;
  const group: Group = params.type && params.type in GROUPS ? (params.type as Group) : "all";
  const page = Math.max(1, Number(params.page) || 1);
  const types = GROUPS[group] ? [...GROUPS[group]!] : undefined;
  const [t, locale, entries, total] = await Promise.all([
    getTranslations("Admin"),
    getLocale(),
    recentAudit({ entityTypes: types, take: PER_PAGE, skip: (page - 1) * PER_PAGE }),
    countAudit(types),
  ]);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div>
      <PageIntro description={t("auditIntro")} />
      <div className="mb-4">
        <FilterTabs
          items={(Object.keys(GROUPS) as Group[]).map((g) => ({
            label: t(`auditGroup.${g}`),
            href: g === "all" ? "/admin/audit" : { pathname: "/admin/audit", query: { type: g } },
            on: group === g,
          }))}
        />
      </div>
      <Panel flush>
        <Table head={[t("col.when"), t("col.action"), t("col.by"), t("col.record")]} empty={entries.length === 0 ? <p className="py-12 text-center text-[14px] text-muted">{t("noAudit")}</p> : null}>
          {entries.map((entry) => {
            const link = LINKS[entry.entityType]?.(entry.entityId);
            const data = entry.data as { reason?: string; from?: string; to?: string } | null;
            return (
              <tr key={entry.id} className="hover:bg-canvas/70">
                <td className={`${td} text-[13px] whitespace-nowrap text-muted`}>{formatKigaliDateTime(locale, entry.createdAt)}</td>
                <td className={td}>
                  <span className="font-semibold text-ink">{dynamicMessage(t, `action.${entry.action}`, entry.action)}</span>
                  {data?.reason && <span className="block max-w-[320px] truncate text-xs text-muted">{data.reason}</span>}
                  {typeof data?.from === "string" && typeof data.to === "string" && (
                    <span className="block text-xs text-muted">
                      {data.from} → {data.to}
                    </span>
                  )}
                </td>
                <td className={`${td} text-[13px]`}>{entry.actor?.name ?? t("system")}</td>
                <td className={`${td} text-[13px]`}>
                  {link ? (
                    <Link href={link} className="text-primary hover:underline">
                      {entry.entityType} {entry.entityId.slice(0, 10)}
                    </Link>
                  ) : (
                    <span className="text-muted">
                      {entry.entityType} {entry.entityId.slice(0, 10)}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </Table>
        <Pagination
          page={page}
          pages={pages}
          label={(p, n) => t("pageOf", { page: p, pages: n })}
          hrefFor={(p) => `/admin/audit?${new URLSearchParams({ ...(group === "all" ? {} : { type: group }), page: String(p) })}`}
        />
      </Panel>
    </div>
  );
}
