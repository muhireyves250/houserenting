import { ChevronRight, House } from "lucide-react";
import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { dashboardCounts, pendingListings } from "@/features/admin/service";
import { formatKigaliDateTime } from "@/features/bookings/format";
import { Link } from "@/i18n/navigation";
import { requireAdmin } from "@/lib/permissions";

const card = "rounded-3xl bg-surface shadow-[0_10px_30px_-14px_rgba(16,24,40,0.3)] ring-1 ring-black/[0.04] max-md:ring-line";

export default async function AdminOverviewPage() {
  await requireAdmin("/admin");
  const [t, tType, locale, counts, pending] = await Promise.all([
    getTranslations("Admin"),
    getTranslations("ListingType"),
    getLocale(),
    dashboardCounts(),
    pendingListings(),
  ]);
  const tiles = [
    { label: t("count.listings"), value: counts.listings, href: "/admin" },
    { label: t("count.questions"), value: counts.questions, href: "/admin/moderation" },
    { label: t("count.reviews"), value: counts.reviews, href: "/admin/moderation" },
    { label: t("count.tickets"), value: counts.tickets, href: "/admin/support" },
  ];

  return (
    <div className="flex flex-col gap-8">
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map((tile) => (
          <li key={tile.label}>
            <Link href={tile.href} className={`${card} flex flex-col gap-1 p-5 transition-transform duration-300 active:scale-[0.97]`}>
              <span className="text-[28px] leading-8 font-bold text-ink tabular-nums">{tile.value}</span>
              <span className="text-[13px] text-muted">{tile.label}</span>
            </Link>
          </li>
        ))}
      </ul>

      <section>
        <h2 className="mb-3 text-lg font-bold text-ink">{t("toReview")}</h2>
        {pending.length === 0 ? (
          <p className="py-8 text-center text-[15px] text-muted">{t("nothingToReview")}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {pending.map((listing) => (
              <li key={listing.id}>
                <Link href={`/admin/listings/${listing.id}`} className={`${card} flex items-center gap-4 p-3 transition-transform duration-300 active:scale-[0.98]`}>
                  <span className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-primary-soft text-primary">
                    {listing.photos[0] ? <Image src={listing.photos[0].url} alt="" fill sizes="64px" className="object-cover" /> : <House className="size-6" aria-hidden="true" />}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[15px] font-semibold text-ink">{listing.title}</span>
                    <span className="truncate text-[13px] text-muted">
                      {tType(listing.type)} · {listing.district}, {listing.city} · {listing.host.name}
                    </span>
                    <span className="text-xs text-muted">{formatKigaliDateTime(locale, listing.updatedAt)}</span>
                  </span>
                  <ChevronRight className="size-5 shrink-0 text-ink/50" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
