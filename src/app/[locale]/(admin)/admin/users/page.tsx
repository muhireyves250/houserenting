import { getLocale, getTranslations } from "next-intl/server";
import { Avatar } from "@/components/ui/Avatar";
import { FilterTabs, PageIntro, Pagination, Panel, SearchBox, Table, td } from "@/features/admin/components/ui";
import { searchUsers, type UserFilter } from "@/features/admin/queries";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { requireAdmin } from "@/lib/permissions";

type Props = { searchParams: Promise<{ filter?: string; q?: string; page?: string }> };
const FILTERS: UserFilter[] = ["all", "staff", "hosts", "suspended"];

export default async function AdminUsersPage({ searchParams }: Props) {
  await requireAdmin("/admin/users");
  const params = await searchParams;
  const filter = FILTERS.includes(params.filter as UserFilter) ? (params.filter as UserFilter) : "all";
  const q = (params.q ?? "").slice(0, 100);
  const page = Math.max(1, Number(params.page) || 1);
  const [t, locale, result] = await Promise.all([getTranslations("Admin"), getLocale(), searchUsers({ filter, q, page })]);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "Africa/Kigali" });
  const query = (extra: Record<string, string | undefined>) =>
    Object.fromEntries(Object.entries({ filter: filter === "all" ? undefined : filter, q: q || undefined, ...extra }).filter(([, v]) => v)) as Record<string, string>;
  const badge = "rounded-full px-2 py-0.5 text-[11px] font-semibold";

  return (
    <div>
      <PageIntro description={t("usersIntro", { count: result.total })} />
      <div className="mb-4 flex flex-col gap-3">
        <SearchBox value={q} placeholder={t("searchUsers")} keep={{ filter: filter === "all" ? undefined : filter }} />
        <FilterTabs
          items={FILTERS.map((f) => ({ label: t(`userFilter.${f}`), href: { pathname: "/admin/users", query: query({ filter: f === "all" ? undefined : f }) }, on: filter === f }))}
        />
      </div>
      <Panel flush>
        <Table
          head={[t("col.name"), t("col.role"), t("col.activity"), t("col.joined"), t("col.status")]}
          empty={result.rows.length === 0 ? <p className="py-12 text-center text-[14px] text-muted">{t("nothingHere")}</p> : null}
        >
          {result.rows.map((u) => (
            <tr key={u.id} className="transition-colors hover:bg-canvas/70">
              <td className={td}>
                <Link href={`/admin/users/${u.id}`} className="flex items-center gap-3">
                  <Avatar name={u.name} className="size-9 text-xs" />
                  <span className="min-w-0">
                    <span className="block max-w-[220px] truncate font-semibold text-ink hover:text-primary">{u.name}</span>
                    <span className="block max-w-[220px] truncate text-xs text-muted">{u.email}</span>
                  </span>
                </Link>
              </td>
              <td className={td}>
                <span className="flex flex-wrap gap-1">
                  {u.role === "ADMIN" && <span className={cn(badge, "bg-primary/10 text-primary")}>{t("staff")}</span>}
                  {u.isHost && <span className={cn(badge, "bg-canvas text-ink/80")}>{t("hostBadge")}</span>}
                  {u.role !== "ADMIN" && !u.isHost && <span className="text-[13px] text-muted">{t("guestRole")}</span>}
                </span>
              </td>
              <td className={`${td} text-[13px] text-ink/80 tabular-nums`}>{t("activityLine", { bookings: u._count.bookings, listings: u._count.listings })}</td>
              <td className={`${td} text-[13px] whitespace-nowrap text-muted`}>{date.format(u.createdAt)}</td>
              <td className={td}>
                <span className={cn(badge, u.status === "SUSPENDED" ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-800")}>{t(`userStatus.${u.status}`)}</span>
              </td>
            </tr>
          ))}
        </Table>
        <Pagination
          page={page}
          pages={result.pages}
          label={(p, n) => t("pageOf", { page: p, pages: n })}
          hrefFor={(p) => `/admin/users?${new URLSearchParams(query({ page: String(p) }))}`}
        />
      </Panel>
    </div>
  );
}
