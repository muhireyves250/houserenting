import { House, Plus } from "lucide-react";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { allListings } from "@/features/admin/stats";
import { HostStatus } from "@/features/hosting/components/HostStatus";
import { movesFrom } from "@/features/listings/lifecycle";
import { PlaceRowActions } from "@/features/places/components/PlaceRowActions";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { requireAdmin } from "@/lib/permissions";
import { contractsEnding } from "@/features/places/status-service";
import { db } from "@/lib/db";

const STATUSES = ["PENDING_REVIEW", "PUBLISHED", "CHANGES_REQUESTED", "HIDDEN", "PAUSED", "SUSPENDED", "REJECTED", "DRAFT"] as const;
type Status = (typeof STATUSES)[number];
type Props = { searchParams: Promise<{ status?: string }> };

export default async function AdminListingsPage({ searchParams }: Props) {
  await requireAdmin("/admin/listings");
  const raw = (await searchParams).status;
  // With no filter chosen: what waits for review, or everything when nothing does.
  const endingSoon = raw === "ending";
  let status: Status | undefined = STATUSES.includes(raw as Status) ? (raw as Status) : raw === "all" || endingSoon ? undefined : "PENDING_REVIEW";
  let listings = await allListings(status);
  // Agreements ending within a month (from the dashboard's renewal reminder).
  if (endingSoon) {
    const ids = new Set((await contractsEnding()).map((l) => l.id));
    listings = listings.filter((l) => ids.has(l.id));
  }
  if (!raw && listings.length === 0) {
    status = undefined;
    listings = await allListings();
  }
  const [t, tHost, tType, tPlaces] = await Promise.all([
    getTranslations("Admin"),
    getTranslations("Host"),
    getTranslations("ListingType"),
    getTranslations("Places"),
  ]);
  // Only the filters that have places (with how many), so the row stays short.
  const [counts, ending] = await Promise.all([db.listing.groupBy({ by: ["status"], _count: { _all: true } }), contractsEnding()]);
  const countOf = (s: Status) => counts.find((c) => c.status === s)?._count._all ?? 0;
  const total = counts.filter((c) => c.status !== "ARCHIVED").reduce((n, c) => n + c._count._all, 0);
  type Filter = { value: Status | "ending" | "all"; label: string; count: number };
  const filters = ([
    { value: "all", label: t("all"), count: total },
    ...STATUSES.map((s): Filter => ({ value: s, label: tHost(`status.${s}`), count: countOf(s) })),
    { value: "ending", label: tPlaces("endingSoon"), count: ending.length },
  ] as Filter[]).filter((f) => f.count > 0 || f.value === (endingSoon ? "ending" : (status ?? "all")));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-end">
        <Link href="/admin/listings/new" className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-[14px] font-semibold text-white hover:bg-primary-hover">
          <Plus className="size-4" aria-hidden="true" />
          {tPlaces("addPlace")}
        </Link>
      </div>
      <div className="flex flex-wrap gap-2">
        {filters.map((f) => {
          const on = (endingSoon ? "ending" : (status ?? "all")) === f.value;
          return (
            <Link
              key={f.value}
              href={{ pathname: "/admin/listings", query: { status: f.value } }}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-[13px] transition-colors",
                on ? "border-primary bg-primary font-semibold text-white" : "border-line bg-surface text-ink hover:border-primary/60",
              )}
            >
              {f.label} <span className={cn("tabular-nums", on ? "text-white/80" : "text-muted")}>{f.count}</span>
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
              <li key={listing.id} className="flex flex-col gap-2 px-4 py-3 transition-colors hover:bg-canvas/60 sm:flex-row sm:items-center sm:gap-3">
                <Link href={`/admin/listings/${listing.id}`} className="flex min-w-0 flex-1 items-center gap-4">
                  <span className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary-soft text-primary">
                    {listing.photos[0] ? <Image src={listing.photos[0].url} alt="" fill sizes="56px" className="object-cover" /> : <House className="size-5" aria-hidden="true" />}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[15px] font-semibold text-ink">{listing.title}</span>
                      <HostStatus status={listing.status} label={tHost(`status.${listing.status}`)} />
                    </span>
                    <span className="truncate text-[13px] text-muted">
                      {tType(listing.type)} · {listing.district === listing.city ? listing.city : `${listing.district}, ${listing.city}`} · {listing.host.name}
                    </span>
                  </span>
                </Link>
                <PlaceRowActions listingId={listing.id} moves={movesFrom(listing.status, { isStaff: true, isOwner: false })} editable={listing.status !== "ARCHIVED"} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
