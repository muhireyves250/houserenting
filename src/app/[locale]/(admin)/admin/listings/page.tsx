import { House, Plus } from "lucide-react";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { allListings } from "@/features/admin/stats";
import { FillScreen, Toolbar } from "@/features/admin/components/kit";
import { HostStatus } from "@/features/hosting/components/HostStatus";
import { LISTING_MOVES, movesFrom } from "@/features/listings/lifecycle";
import { ActionsMenu } from "@/features/admin/components/ActionsMenu";
import { setHotDealAction } from "@/features/home/actions";
import { hotDealIds } from "@/features/home/sections-service";
import { deletePlaceAction, moveListingAction } from "@/features/places/actions";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { requireStaff } from "@/lib/permissions";
import { contractsEnding } from "@/features/places/status-service";
import { db } from "@/lib/db";
import { LocationFilter } from "@/features/locations/LocationFilter";
import { nameOf, villageCodesUnder } from "@/features/locations/rwanda";
import { PLACE_TYPES, type PlaceType } from "@/features/search/params";

const STATUSES = ["PENDING_REVIEW", "PUBLISHED", "CHANGES_REQUESTED", "HIDDEN", "PAUSED", "SUSPENDED", "REJECTED", "DRAFT", "ARCHIVED"] as const;
type Status = (typeof STATUSES)[number];
type Props = { searchParams: Promise<{ status?: string; type?: string; loc?: string }> };

export default async function AdminListingsPage({ searchParams }: Props) {
  await requireStaff("listings", "/admin/listings");
  const params = await searchParams;
  const raw = params.status;
  // Category (lodge, apartment…), together with the status filter.
  const type = (PLACE_TYPES as readonly string[]).includes(params.type ?? "") ? (params.type as PlaceType) : undefined;
  // With no filter chosen: what waits for review, or everything when nothing does.
  const endingSoon = raw === "ending";
  let status: Status | undefined = STATUSES.includes(raw as Status) ? (raw as Status) : raw === "all" || endingSoon ? undefined : "PENDING_REVIEW";
  // Official location filter (province down to village): every village under the chosen place.
  const loc = params.loc && nameOf(params.loc) ? params.loc : null;
  const villages = loc ? villageCodesUnder(loc) : undefined;
  let listings = await allListings(status, type, villages);
  // Agreements ending within a month (from the dashboard's renewal reminder).
  if (endingSoon) {
    const ids = new Set((await contractsEnding()).map((l) => l.id));
    listings = listings.filter((l) => ids.has(l.id));
  }
  if (!raw && listings.length === 0) {
    status = undefined;
    listings = await allListings(undefined, type, villages);
  }
  const [t, tHost, tType, tPlaces] = await Promise.all([
    getTranslations("Admin"),
    getTranslations("Host"),
    getTranslations("ListingType"),
    getTranslations("Places"),
  ]);
  // Only the filters that have places (with how many), so the row stays short.
  const [counts, typeCounts, ending, hot] = await Promise.all([
    db.listing.groupBy({ by: ["status"], where: type ? { type } : {}, _count: { _all: true } }),
    db.listing.groupBy({ by: ["type"], where: { status: status ?? { not: "ARCHIVED" } }, _count: { _all: true } }),
    contractsEnding(),
    hotDealIds(),
  ]);
  const typeCount = (t: PlaceType) => typeCounts.find((c) => c.type === t)?._count._all ?? 0;
  const keep = (extra: Record<string, string | undefined>) =>
    Object.fromEntries(Object.entries({ status: endingSoon ? "ending" : (status ?? (raw === "all" ? "all" : undefined)), type, loc: loc ?? undefined, ...extra }).filter(([, v]) => v)) as Record<string, string>;
  // Wording for what a status change may answer (shown under the Actions button).
  const moveErrors = Object.fromEntries(["notFound", "notAllowed", "wrongStatus", "reasonNeeded", "payoutMissing", "noPrices", "noPhotos", "noAgreement"].map((k) => [k, tPlaces(`moveError.${k as "notFound"}`)]));
  const countOf = (s: Status) => counts.find((c) => c.status === s)?._count._all ?? 0;
  const total = counts.filter((c) => c.status !== "ARCHIVED").reduce((n, c) => n + c._count._all, 0);
  type Filter = { value: Status | "ending" | "all"; label: string; count: number };
  // Every status, always (with how many): to review, live, changes asked, hidden, paused, suspended, archived…
  const filters = [
    { value: "all", label: t("all"), count: total },
    ...STATUSES.map((s): Filter => ({ value: s, label: s === "ARCHIVED" ? tPlaces("archivedFilter") : tHost(`status.${s}`), count: countOf(s) })),
    { value: "ending", label: tPlaces("endingSoon"), count: ending.length },
  ] as Filter[];

  return (
    <FillScreen>
      {/* Filters and Add a place on one row; the list scrolls below. */}
      <Toolbar
        actions={
          <Link href="/admin/listings/new" className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-[14px] font-semibold text-white hover:bg-primary-hover">
            <Plus className="size-4" aria-hidden="true" />
            {tPlaces("addPlace")}
          </Link>
        }
      >
        <div data-lenis-prevent className="filter-row flex flex-wrap gap-2">
          {filters.map((f) => {
            const on = (endingSoon ? "ending" : (status ?? "all")) === f.value;
            return (
              <Link
                key={f.value}
                href={{ pathname: "/admin/listings", query: keep({ status: f.value }) }}
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
        {/* Category by category: lodges, apartments, houses… (only those that have places). */}
        <div data-lenis-prevent className="filter-row mt-2 flex flex-wrap gap-2">
          {[undefined, ...PLACE_TYPES.filter((t) => typeCount(t) > 0 || t === type)].map((t) => {
            const on = t === type;
            return (
              <Link
                key={t ?? "any"}
                href={{ pathname: "/admin/listings", query: keep({ type: t ?? "" }) }}
                className={cn(
                  "rounded-full border px-3 py-1 text-[12.5px] transition-colors",
                  on ? "border-ink bg-ink font-semibold text-white" : "border-dashed border-line-strong bg-surface text-ink/80 hover:border-primary/60",
                )}
              >
                {t ? tType(t) : tPlaces("allCategories")}
                {t && <span className={cn("ml-1 tabular-nums", on ? "text-white/80" : "text-muted")}>{typeCount(t)}</span>}
              </Link>
            );
          })}
        </div>
        <LocationFilter pathname="/admin/listings" current={loc} keep={keep({ loc: undefined })} />
      </Toolbar>
      {/* The card stays put; its rows scroll inside (no scrollbar shown). */}
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-2xl border border-line bg-surface">
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
                      {tType(listing.type)} · {listing.district === listing.city ? listing.city : `${listing.district}, ${listing.city}`} · {tPlaces("row.owner", { name: listing.host.name })}
                    </span>
                    {/* Who cooks for it, and whether a guest is staying now (or bookings coming). */}
                    <span className="flex flex-wrap items-center gap-1.5 text-[12px]">
                      {(() => {
                        const now = new Date();
                        const staying = listing.bookings.some((b) => b.startAt <= now && b.endAt > now);
                        const coming = listing.bookings.filter((b) => b.startAt > now).length;
                        return (
                          <>
                            <span className={staying ? "rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-800" : "rounded-full bg-canvas px-2 py-0.5 font-semibold text-muted"}>{staying ? tPlaces("row.bookedNow") : tPlaces("row.freeNow")}</span>
                            {coming > 0 && <span className="rounded-full bg-primary/10 px-2 py-0.5 font-semibold text-primary">{tPlaces("row.coming", { count: coming })}</span>}
                          </>
                        );
                      })()}
                      {listing.kitchens.length > 0 && (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-900">
                          {tPlaces("row.food", { names: listing.kitchens.map((k) => k.restaurant.name).join(", ") })}
                        </span>
                      )}
                    </span>
                  </span>
                </Link>
                {/* One Actions button: open, edit, every status change allowed now, delete (never booked). */}
                <ActionsMenu
                  items={[
                    { kind: "link", label: tPlaces("actions.open"), href: `/admin/listings/${listing.id}` },
                    ...(listing.status !== "ARCHIVED" ? [{ kind: "link" as const, label: tPlaces("editShort"), href: `/admin/listings/${listing.id}/edit` }] : []),
                    ...movesFrom(listing.status, { isStaff: true, isOwner: false }).map((move) => ({
                      kind: "run" as const,
                      label: tPlaces(`move.${move}`),
                      action: moveListingAction.bind(null, listing.id, move),
                      reason: LISTING_MOVES[move].reason,
                      confirm: LISTING_MOVES[move].reason ? undefined : tPlaces("actions.confirm", { action: tPlaces(`move.${move}`), title: listing.title }),
                      danger: ["suspend", "archive", "reject", "hide"].includes(move),
                      errors: moveErrors,
                    })),
                    // Live houses: put first in Hot deals on the home page, or take out.
                    ...(listing.status === "PUBLISHED"
                      ? [
                          hot.has(listing.id)
                            ? { kind: "run" as const, label: tPlaces("hotDealRemove"), action: setHotDealAction.bind(null, listing.id, false) }
                            : { kind: "run" as const, label: tPlaces("hotDealAdd"), action: setHotDealAction.bind(null, listing.id, true), errors: { notLive: tPlaces("hotDealNotLive") } },
                        ]
                      : []),
                    ...(listing._count.bookings === 0
                      ? [{ kind: "run" as const, label: tPlaces("deleteShort"), action: deletePlaceAction.bind(null, listing.id), confirm: tPlaces("deletePlaceQuestion"), danger: true, errors: { hasBookings: tPlaces("deleteHasBookings"), notAllowed: tPlaces("deleteNotAllowed") } }]
                      : []),
                  ]}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </FillScreen>
  );
}
