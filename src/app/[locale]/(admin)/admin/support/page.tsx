import { LifeBuoy, MessageSquareWarning } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { attentionCounts } from "@/features/admin/stats";
import { ModerationView } from "@/features/admin/views/ModerationView";
import { SupportView } from "@/features/admin/views/SupportView";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { requireAdmin } from "@/lib/permissions";

type Props = { searchParams: Promise<{ tab?: string; status?: string; show?: string }> };

/** Support and reviews on one page: help requests in one tab, guests' questions and feedback in the other. */
export default async function SupportAndReviewsPage({ searchParams }: Props) {
  await requireAdmin("/admin/support");
  const params = await searchParams;
  const reviews = params.tab === "reviews";
  const [t, counts] = await Promise.all([getTranslations("Admin"), attentionCounts()]);
  const tabs = (
    <nav aria-label={t("nav.support")} className="flex shrink-0 gap-2 rounded-2xl bg-surface p-1.5 ring-1 ring-line">
      {(
        [
          ["requests", LifeBuoy, counts.tickets, !reviews, { pathname: "/admin/support" }],
          ["reviews", MessageSquareWarning, counts.moderation, reviews, { pathname: "/admin/support", query: { tab: "reviews" } }],
        ] as const
      ).map(([key, Icon, count, on, href]) => (
        <Link
          key={key}
          href={href}
          aria-current={on ? "page" : undefined}
          className={cn(
            "flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-[13px] font-semibold transition-colors sm:gap-2 sm:px-3 sm:text-[14px]",
            on ? "bg-primary text-white" : "text-ink/75 hover:bg-canvas hover:text-ink",
          )}
        >
          <Icon className="size-4 shrink-0" aria-hidden="true" />
          {/* Phones: the short name; computers: the full one. */}
          <span className="truncate sm:hidden">{t(`supportTabs.short.${key}`)}</span>
          <span className="hidden truncate sm:inline">{t(`supportTabs.${key}`)}</span>
          {count > 0 && <span className={cn("rounded-full px-1.5 text-[11px] font-bold tabular-nums", on ? "bg-white/25 text-white" : "bg-primary/10 text-primary")}>{count}</span>}
        </Link>
      ))}
    </nav>
  );
  return reviews ? <ModerationView showPublished={params.show === "published"} tabs={tabs} /> : <SupportView raw={params.status} tabs={tabs} />;
}
