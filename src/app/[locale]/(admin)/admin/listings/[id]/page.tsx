import Image from "next/image";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ReviewListing } from "@/features/admin/components/ReviewListing";
import { listingForReview } from "@/features/admin/service";
import { recentAudit } from "@/features/audit/service";
import { formatKigaliDateTime } from "@/features/bookings/format";
import { HostStatus } from "@/features/hosting/components/HostStatus";
import { Link } from "@/i18n/navigation";
import { formatRWF } from "@/lib/format";
import { requireAdmin } from "@/lib/permissions";
import { RoomStatusSelect } from "@/features/admin/components/RoomStatusSelect";
import { PageIntro, Panel, Table, td } from "@/features/admin/components/ui";
import { listingBookings } from "@/features/admin/queries";
import { StatusBadge } from "@/features/bookings/components/StatusBadge";
import { formatStayDates } from "@/features/bookings/format";
import { listingRooms } from "@/features/rooms/service";
import { dynamicMessage } from "@/lib/dynamic-message";

type Props = { params: Promise<{ id: string }> };
const card = "rounded-3xl bg-surface p-5 shadow-[0_10px_30px_-14px_rgba(16,24,40,0.3)] ring-1 ring-black/[0.04] max-md:ring-line md:p-6";

export default async function AdminListingPage({ params }: Props) {
  const { id } = await params;
  await requireAdmin(`/admin/listings/${id}`);
  const listing = await listingForReview(id);
  if (!listing) notFound();
  const [t, tHost, tType, tFacility, tListings, locale, history, rooms, bookings, tBookings, tRooms] = await Promise.all([
    getTranslations("Admin"),
    getTranslations("Host"),
    getTranslations("ListingType"),
    getTranslations("Facility"),
    getTranslations("Listings"),
    getLocale(),
    recentAudit({ entityType: "listing", entityId: id, take: 30 }),
    listingRooms(id),
    listingBookings(id),
    getTranslations("Bookings"),
    getTranslations("Rooms"),
  ]);
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-4">
      <PageIntro back={{ href: "/admin/listings", label: t("nav.listings") }} />
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-[22px] leading-7 font-bold text-ink">{listing.title}</h2>
        <HostStatus status={listing.status} label={tHost(`status.${listing.status}`)} />
      </div>

      {listing.photos.length > 0 ? (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {listing.photos.map((photo, i) => (
            <li key={photo.id} className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-canvas">
              <Image src={photo.url} alt={tHost("photoAlt", { n: i + 1 })} fill sizes="25vw" className="object-cover" />
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl bg-amber-50 px-5 py-3 text-sm text-amber-900 ring-1 ring-amber-200/70">{t("noPhotos")}</p>
      )}

      <section className={card}>
        <p className="text-[13px] text-muted">
          {tType(listing.type)} · {listing.addressLine}, {listing.district}, {listing.city} · {listing.lat.toFixed(5)}, {listing.lng.toFixed(5)}
        </p>
        <p className="mt-3 text-[15px] leading-6 whitespace-pre-line text-ink">{listing.description}</p>
        <p className="mt-3 text-[13px] text-ink/80">
          {tListings("statGuests", { count: listing.maxGuests })} · {tListings("statBedrooms", { count: listing.bedrooms })} ·{" "}
          {tListings("statBaths", { count: listing.bathrooms })} · {tListings("size", { size: listing.sizeM2 })}
        </p>
        {listing.facilities.length > 0 && <p className="mt-2 text-[13px] text-ink/80">{listing.facilities.map((f) => tFacility(f)).join(" · ")}</p>}
        <ul className="mt-3 flex flex-col gap-1 text-[15px] tabular-nums">
          {listing.rates.map((rate) => (
            <li key={rate.id}>
              {tListings(`unitName.${rate.unit}`)} · <b>{formatRWF(rate.price, locale)}</b>
            </li>
          ))}
        </ul>
        {listing.termsOfRent.length > 0 && (
          <ul className="mt-3 list-disc pl-5 text-[13px] text-ink/80">
            {listing.termsOfRent.map((term) => (
              <li key={term}>{term}</li>
            ))}
          </ul>
        )}
      </section>

      <section className={card}>
        <h3 className="mb-2 text-[15px] font-semibold text-ink">{t("host")}</h3>
        <Link href={`/admin/users/${listing.host.id}`} className="text-[15px] font-semibold text-primary hover:underline">
          {listing.host.name}
        </Link>
        <p className="text-[13px] text-muted">
          {listing.host.email}
          {listing.host.phone && ` · ${listing.host.phone}`}
        </p>
      </section>

      {(listing.status === "PENDING_REVIEW" || listing.status === "PUBLISHED") && (
        <section className={card}>
          <h3 className="mb-3 text-[15px] font-semibold text-ink">{listing.status === "PENDING_REVIEW" ? t("decision") : t("takeDown")}</h3>
          <ReviewListing listingId={listing.id} mode={listing.status === "PENDING_REVIEW" ? "review" : "live"} />
        </section>
      )}

      {rooms.length > 0 && (
        <Panel title={tRooms("title")} flush>
          <ul className="divide-y divide-line">
            {rooms.map((room) => (
              <li key={room.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <span>
                  <span className="block text-[14px] font-semibold text-ink">{room.name}</span>
                  <span className="block text-xs text-muted">
                    {room.rates.map((r) => `${formatRWF(r.price, locale)} ${tListings(`perUnit.${r.unit}`)}`).join(" · ")} · {tRooms("guests", { count: room.maxGuests })}
                  </span>
                </span>
                <RoomStatusSelect roomId={room.id} status={room.status} name={room.name} />
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel title={t("listingBookings")} flush>
        <Table
          head={[t("col.reference"), t("col.guest"), t("col.when"), t("col.total"), t("col.status")]}
          empty={bookings.length === 0 ? <p className="py-8 text-center text-[14px] text-muted">{t("nothingHere")}</p> : null}
        >
          {bookings.map((b) => (
            <tr key={b.reference} className="hover:bg-canvas/70">
              <td className={td}>
                <Link href={`/admin/bookings/${b.reference}`} className="font-mono text-[13px] font-semibold text-primary hover:underline">
                  {b.reference}
                </Link>
              </td>
              <td className={td}>{b.guest.name}</td>
              <td className={`${td} whitespace-nowrap`}>{formatStayDates(locale, iso(b.checkIn), iso(b.checkOut))}</td>
              <td className={`${td} whitespace-nowrap tabular-nums`}>{formatRWF(b.total, locale)}</td>
              <td className={td}>
                <StatusBadge status={b.status} label={tBookings(`status.${b.status}`)} />
              </td>
            </tr>
          ))}
        </Table>
      </Panel>

      <section className={card}>
        <h3 className="mb-3 text-[15px] font-semibold text-ink">{t("history")}</h3>
        <ol className="flex flex-col gap-2 text-[13px]">
          {history.map((entry) => (
            <li key={entry.id} className="flex flex-wrap justify-between gap-2">
              <span className="text-ink">
                <b className="font-semibold">{dynamicMessage(t, `action.${entry.action}`, entry.action)}</b> · {entry.actor?.name ?? t("system")}
                {(entry.data as { reason?: string } | null)?.reason && <span className="text-muted"> · {(entry.data as { reason: string }).reason}</span>}
              </span>
              <span className="text-muted">{formatKigaliDateTime(locale, entry.createdAt)}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
