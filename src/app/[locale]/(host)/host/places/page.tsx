import { House, Pencil, Plus } from "lucide-react";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { FillScreen, Toolbar } from "@/features/admin/components/kit";
import { HostStatus } from "@/features/hosting/components/HostStatus";
import { hostDashboard, hostListings } from "@/features/hosting/service";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { requireUser } from "@/lib/session";

type Props = { searchParams: Promise<{ status?: string }> };

/** The owner's places, like the staff list: filters and "List a place" on one row, the places scrolling below. */
export default async function HostPlacesPage({ searchParams }: Props) {
  const user = await requireUser("/host/places");
  const raw = (await searchParams).status;
  const [t, tHost, tType, all, dash] = await Promise.all([getTranslations("Host.dash"), getTranslations("Host"), getTranslations("ListingType"), hostListings(user.id), hostDashboard(user.id)]);
  // Only the filters that have places (with how many).
  const statuses = [...new Set(all.map((l) => l.status))];
  const status = statuses.includes(raw as (typeof statuses)[number]) ? raw : undefined;
  const listings = status ? all.filter((l) => l.status === status) : all;
  const filters = [{ value: undefined, label: tHost("allPlaces"), count: all.length }, ...statuses.map((s) => ({ value: s, label: tHost(`status.${s}`), count: all.filter((l) => l.status === s).length }))];

  return (
    <FillScreen>
      <Toolbar
        actions={
          <Link href="/host/listings/new" className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-[14px] font-semibold text-white hover:bg-primary-hover">
            <Plus className="size-4" aria-hidden="true" />
            {tHost("newListing")}
          </Link>
        }
      >
        <div className="flex flex-wrap gap-2">
          {filters.map((f) => {
            const on = f.value === status;
            return (
              <Link
                key={f.value ?? "all"}
                href={f.value ? { pathname: "/host/places", query: { status: f.value } } : "/host/places"}
                prefetch
                className={cn("rounded-full border px-3.5 py-1.5 text-[13px] transition-colors", on ? "border-primary bg-primary font-semibold text-white" : "border-line bg-surface text-ink hover:border-primary/60")}
              >
                {f.label} <span className={cn("tabular-nums", on ? "text-white/80" : "text-muted")}>{f.count}</span>
              </Link>
            );
          })}
        </div>
      </Toolbar>
      {/* The card stays put; its rows scroll inside (no scrollbar shown). */}
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-2xl border border-line bg-surface">
        {listings.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-14 text-center">
            <House className="size-8 text-line-strong" aria-hidden="true" />
            <p className="text-[15px] font-semibold text-ink">{tHost("emptyTitle")}</p>
            <p className="max-w-sm text-[13px] text-muted">{tHost("emptyBody")}</p>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {listings.map((listing) => {
              const nights = dash.nightsByPlace.get(listing.id) ?? 0;
              const coming = dash.upcomingByPlace.get(listing.id) ?? 0;
              return (
                <li key={listing.id} className="flex flex-col gap-2 px-4 py-3 transition-colors hover:bg-canvas/60 sm:flex-row sm:items-center sm:gap-3">
                  <Link href={`/host/listings/${listing.id}`} className="flex min-w-0 flex-1 items-center gap-4">
                    <span className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary-soft text-primary">
                      {listing.photos[0] ? <Image src={listing.photos[0].url} alt="" fill sizes="56px" className="object-cover" /> : <House className="size-5" aria-hidden="true" />}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-[15px] font-semibold text-ink">{listing.title}</span>
                        <HostStatus status={listing.status} label={tHost(`status.${listing.status}`)} />
                      </span>
                      <span className="truncate text-[13px] text-muted">
                        {tType(listing.type)} · {listing.district === listing.city ? listing.city : `${listing.district}, ${listing.city}`}
                      </span>
                      <span className="truncate text-[12.5px] text-ink/80">
                        <b className="font-semibold text-ink">{t("placeNights", { nights })}</b> · {t("placeUpcoming", { count: coming })}
                      </span>
                      {(listing.status === "REJECTED" || listing.status === "CHANGES_REQUESTED") && listing.rejectionReason && (
                        <span className="text-xs font-medium text-red-800">{tHost("needsChanges", { reason: listing.rejectionReason })}</span>
                      )}
                    </span>
                  </Link>
                  <Link
                    href={`/host/listings/${listing.id}`}
                    className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-full border border-line px-3.5 py-1.5 text-[13px] font-semibold text-ink hover:border-primary hover:text-primary sm:self-center"
                  >
                    <Pencil className="size-3.5" aria-hidden="true" />
                    {t("edit")}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </FillScreen>
  );
}
