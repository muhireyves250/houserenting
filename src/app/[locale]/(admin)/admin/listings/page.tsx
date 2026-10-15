import { ChevronRight, House } from "lucide-react";
import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { allListings } from "@/features/admin/stats";
import { formatKigaliDateTime } from "@/features/bookings/format";
import { HostStatus } from "@/features/hosting/components/HostStatus";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { requireAdmin } from "@/lib/permissions";

const STATUSES = ["PENDING_REVIEW", "PUBLISHED", "REJECTED", "DRAFT"] as const;
type Status = (typeof STATUSES)[number];
type Props = { searchParams: Promise<{ status?: string }> };

export default async function AdminListingsPage({ searchParams }: Props) {
  await requireAdmin("/admin/listings");
  const raw = (await searchParams).status;
  // With no filter chosen: what waits for review, or everything when nothing does.
  let status: Status | undefined = STATUSES.includes(raw as Status) ? (raw as Status) : raw === "all" ? undefined : "PENDING_REVIEW";
  let listings = await allListings(status);
  if (!raw && listings.length === 0) {
    status = undefined;
    listings = await allListings();
  }
  const [t, tHost, tType, locale] = await Promise.all([getTranslations("Admin"), getTranslations("Host"), getTranslations("ListingType"), getLocale()]);
  const filters: { value: Status | "all"; label: string }[] = [...STATUSES.map((s) => ({ value: s, label: tHost(`status.${s}`) })), { value: "all", label: t("all") }];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-2">
        {filters.map((f) => {
          const on = (status ?? "all") === f.value;
          return (
            <Link
              key={f.value}
              href={{ pathname: "/admin/listings", query: { status: f.value } }}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-[13px] transition-colors",
                on ? "border-primary bg-primary font-semibold text-white" : "border-line bg-surface text-ink hover:border-primary/60",
              )}
            >
              {f.label}
            </Link>
          );
        })}
      </div>
      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        {listings.length === 0 ? (
          <p className="py-12 text-center text-[15px] text-muted">{t("nothingHere")}</p>
        ) : (
          <ul className="divide-y divide-line">
            {listings.map((listing) => (
              <li key={listing.id}>
                <Link href={`/admin/listings/${listing.id}`} className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-canvas">
                  <span className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary-soft text-primary">
                    {listing.photos[0] ? <Image src={listing.photos[0].url} alt="" fill sizes="56px" className="object-cover" /> : <House className="size-5" aria-hidden="true" />}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-[15px] font-semibold text-ink">{listing.title}</span>
                    <span className="truncate text-[13px] text-muted">
                      {tType(listing.type)} · {listing.district}, {listing.city} · {listing.host.name}
                    </span>
                  </span>
                  <span className="hidden text-xs text-muted md:block">{formatKigaliDateTime(locale, listing.updatedAt)}</span>
                  <HostStatus status={listing.status} label={tHost(`status.${listing.status}`)} />
                  <ChevronRight className="size-5 shrink-0 text-ink/40" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
