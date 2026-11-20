import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { NOTICE_GROUPS, noticeGroup, type NoticeGroup } from "../categories";

/** Which notices to show: `show` from the address when it names a group that has notices, else all. */
export function pickNotices<T extends { kind: string }>(
  items: T[],
  raw: string | undefined,
) {
  const groups = NOTICE_GROUPS.map((g) => ({
    g,
    count: items.filter((n) => noticeGroup(n.kind) === g).length,
  })).filter((x) => x.count > 0);
  const show = groups.some((x) => x.g === raw) ? (raw as NoticeGroup) : null;
  return {
    groups,
    show,
    shown: show ? items.filter((n) => noticeGroup(n.kind) === show) : items,
  };
}

/** Filter chips (All, Bookings, Food…) with how many of each; they swipe sideways on phones. */
export async function NoticeFilter({
  path,
  total,
  groups,
  show,
}: {
  path: "/notifications" | "/host/notifications" | "/admin/notifications";
  total: number;
  groups: { g: NoticeGroup; count: number }[];
  show: NoticeGroup | null;
}) {
  if (groups.length < 2) return null;
  const t = await getTranslations("Notifications");
  return (
    <nav
      aria-label={t("filterLabel")}
      data-lenis-prevent
      className="no-scrollbar filter-row -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0"
    >
      {[{ g: null as NoticeGroup | null, count: total }, ...groups].map(
        ({ g, count }) => {
          const on = g === show;
          return (
            <Link
              key={g ?? "all"}
              href={g ? { pathname: path, query: { show: g } } : path}
              prefetch
              aria-current={on ? "page" : undefined}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] font-semibold whitespace-nowrap transition-colors",
                on
                  ? "border-primary bg-primary text-white"
                  : "border-line bg-surface text-ink hover:border-primary/60",
              )}
            >
              {t(`filter.${g ?? "all"}`)}
              <span
                className={cn(
                  "tabular-nums",
                  on ? "text-white/80" : "text-muted",
                )}
              >
                {count}
              </span>
            </Link>
          );
        },
      )}
    </nav>
  );
}
