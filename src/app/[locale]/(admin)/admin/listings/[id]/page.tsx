import { ChevronDown } from "lucide-react";
import Image from "next/image";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { movesFrom } from "@/features/listings/lifecycle";
import {
  AdminPlaceSettings,
  VerifyPayoutButton,
} from "@/features/places/components/AdminPlaceSettings";
import { BlocksPanel } from "@/features/places/components/BlocksPanel";
import { DocumentsPanel } from "@/features/places/components/DocumentsPanel";
import { TeamPanel } from "@/features/places/components/TeamPanel";
import { PlaceKitchens } from "@/features/food/components/PlaceKitchens";
import { db } from "@/lib/db";
import { AgreementEditor } from "@/features/agreements/components/AgreementEditor";
import { agreementPanel } from "@/features/agreements/service";
import { listTeam } from "@/features/places/team-service";
import { StatusActions } from "@/features/places/components/StatusActions";
import { ConfirmAction } from "@/features/admin/components/ConfirmAction";
import { deletePlaceAction } from "@/features/places/actions";
import { listingBlocks } from "@/features/places/blocks-service";
import { listingDocuments } from "@/features/places/documents-service";
import { maskAccount, payoutAccountOf } from "@/features/places/payout-service";
import { listingForReview } from "@/features/admin/service";
import { recentAudit } from "@/features/audit/service";
import { formatKigaliDateTime } from "@/features/bookings/format";
import { HostStatus } from "@/features/hosting/components/HostStatus";
import { Link } from "@/i18n/navigation";
import { formatRWF } from "@/lib/format";
import { requireStaff } from "@/lib/permissions";
import { RoomStatusSelect } from "@/features/admin/components/RoomStatusSelect";
import { PageIntro, Panel, Table, td } from "@/features/admin/components/ui";
import { listingBookings } from "@/features/admin/queries";
import { StatusBadge } from "@/features/bookings/components/StatusBadge";
import { formatStayDates } from "@/features/bookings/format";
import { listingRooms } from "@/features/rooms/service";
import { dynamicMessage } from "@/lib/dynamic-message";

type Props = { params: Promise<{ id: string }> };
const card =
  "rounded-3xl bg-surface p-5 shadow-[0_10px_30px_-14px_rgba(16,24,40,0.3)] ring-1 ring-black/[0.04] max-md:ring-line md:p-6";

export default async function AdminListingPage({ params }: Props) {
  const { id } = await params;
  await requireStaff("listings", `/admin/listings/${id}`);
  const listing = await listingForReview(id);
  if (!listing) notFound();
  const [
    t,
    tHost,
    tType,
    tFacility,
    tListings,
    locale,
    history,
    rooms,
    bookings,
    tBookings,
    tRooms,
  ] = await Promise.all([
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
  const [tPlaces, blocks, documents, payout, team, tAgree, placeAgreement, laundryAgreement, tFood, restaurants] = await Promise.all([
    getTranslations("Places"),
    listingBlocks(id),
    listingDocuments(id),
    payoutAccountOf(listing.host.id),
    listTeam(id),
    getTranslations("Agreements"),
    agreementPanel("PLACE", id),
    agreementPanel("LAUNDRY", id),
    getTranslations("Food.placeKitchens"),
    db.restaurant.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, status: true, places: { where: { listingId: id }, select: { id: true } } } }),
  ]);
  const kitchens = restaurants.map((r) => ({ id: r.id, name: r.name, live: r.status === "PUBLISHED", assigned: r.places.length > 0 }));
  const day = (d: Date | null) => (d ? iso(d) : null);
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  const chip = "rounded-full bg-canvas px-2.5 py-1 text-[12px] text-ink";
  const place =
    listing.district === listing.city
      ? listing.city
      : `${listing.district}, ${listing.city}`;

  return (
    <div className="flex flex-col gap-4">
      <PageIntro back={{ href: "/admin/listings", label: t("nav.listings") }} />
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-[22px] leading-7 font-bold text-ink">
          {listing.title}
        </h2>
        <HostStatus
          status={listing.status}
          label={tHost(`status.${listing.status}`)}
        />
        {listing.featured && (
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
            {tPlaces("featuredBadge")}
          </span>
        )}
        <span className="ml-auto flex gap-2">
          {listing.status !== "ARCHIVED" && (
            <Link
              href={`/admin/listings/${listing.id}/edit`}
              className="rounded-full bg-primary px-4 py-2 text-[13px] font-semibold text-white hover:bg-primary-hover"
            >
              {tPlaces("editPlace")}
            </Link>
          )}
        </span>
      </div>

      {/* Photos as a strip of thumbnails. */}
      {listing.photos.length > 0 ? (
        <ul className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
          {listing.photos.map((photo, i) => (
            <li
              key={photo.id}
              className="relative h-24 w-32 shrink-0 overflow-hidden rounded-xl bg-canvas"
            >
              <Image
                src={photo.url}
                alt={tHost("photoAlt", { n: i + 1 })}
                fill
                sizes="128px"
                className="object-cover"
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl bg-amber-50 px-5 py-3 text-sm text-amber-900 ring-1 ring-amber-200/70">
          {t("noPhotos")}
        </p>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-4">
          {/* The place in short: what, where, size, prices; the long words folded. */}
          <section className={card}>
            <div className="flex flex-wrap gap-1.5">
              <span className={chip}>{tType(listing.type)}</span>
              <span className={chip}>{place}</span>
              <span className={chip}>
                {tListings("statGuests", { count: listing.maxGuests })}
              </span>
              <span className={chip}>
                {tListings("statBedrooms", { count: listing.bedrooms })}
              </span>
              <span className={chip}>
                {tListings("statBaths", { count: listing.bathrooms })}
              </span>
              <span className={chip}>
                {tListings("size", { size: listing.sizeM2 })}
              </span>
            </div>
            <ul className="mt-3 flex flex-wrap gap-2">
              {listing.rates.map((rate) => (
                <li
                  key={rate.id}
                  className="rounded-xl bg-primary/[0.06] px-3 py-1.5 text-[13px] text-ink tabular-nums"
                >
                  {tListings(`unitName.${rate.unit}`)} ·{" "}
                  <b className="font-bold">{formatRWF(rate.price, locale)}</b>
                </li>
              ))}
            </ul>
            <details className="mt-3 border-t border-line pt-3 text-[14px]">
              <summary className="cursor-pointer font-semibold text-ink">
                {t("aboutPlace")}
              </summary>
              <p className="mt-2 text-[13px] text-muted">
                {listing.addressLine}
              </p>
              <p className="mt-2 leading-6 whitespace-pre-line text-ink/85">
                {listing.description}
              </p>
              {listing.facilities.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {listing.facilities.map((f) => (
                    <li key={f} className={chip}>
                      {tFacility(f)}
                    </li>
                  ))}
                </ul>
              )}
              {listing.termsOfRent.length > 0 && (
                <ul className="mt-3 list-disc pl-5 text-[13px] text-ink/80">
                  {listing.termsOfRent.map((term) => (
                    <li key={term}>{term}</li>
                  ))}
                </ul>
              )}
            </details>
          </section>

          <section className={card}>
            <h3 className="mb-3 text-[15px] font-semibold text-ink">
              {tPlaces("statusTitle")}
            </h3>
            {listing.rejectionReason &&
              ["REJECTED", "CHANGES_REQUESTED", "HIDDEN", "SUSPENDED"].includes(
                listing.status,
              ) && (
                <p className="mb-3 text-[13px] text-muted">
                  {tPlaces("lastReason", { reason: listing.rejectionReason })}
                </p>
              )}
            <StatusActions
              listingId={listing.id}
              moves={movesFrom(listing.status, {
                isStaff: true,
                isOwner: false,
              })}
            />
            {/* Delete for good: only a place nobody booked (booked ones are archived instead, so their history stays). */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
              <span className="text-[13px] text-muted">
                {bookings.length === 0
                  ? tPlaces("deletePlace")
                  : tPlaces("deleteHasBookings")}
              </span>
              {bookings.length === 0 && (
                <ConfirmAction
                  label={tPlaces("deleteShort")}
                  question={tPlaces("deletePlaceQuestion")}
                  action={deletePlaceAction.bind(null, listing.id)}
                  errors={{
                    hasBookings: tPlaces("deleteHasBookings"),
                    notAllowed: tPlaces("deleteNotAllowed"),
                  }}
                  then="/admin/listings"
                />
              )}
            </div>
          </section>

          <Panel
            title={<Count label={t("listingBookings")} n={bookings.length} />}
            flush
          >
            {bookings.length === 0 ? (
              <p className="py-6 text-center text-[14px] text-muted">
                {t("nothingHere")}
              </p>
            ) : (
              <Table
                head={[
                  t("col.reference"),
                  t("col.guest"),
                  t("col.when"),
                  t("col.total"),
                  t("col.status"),
                ]}
              >
                {bookings.map((b) => (
                  <tr key={b.reference} className="hover:bg-canvas/70">
                    <td className={td}>
                      <Link
                        href={`/admin/bookings/${b.reference}`}
                        className="font-mono text-[13px] font-semibold text-primary hover:underline"
                      >
                        {b.reference}
                      </Link>
                    </td>
                    <td className={td}>{b.guest.name}</td>
                    <td className={`${td} whitespace-nowrap`}>
                      {formatStayDates(locale, iso(b.checkIn), iso(b.checkOut))}
                    </td>
                    <td className={`${td} whitespace-nowrap tabular-nums`}>
                      {formatRWF(b.total, locale)}
                    </td>
                    <td className={td}>
                      <StatusBadge
                        status={b.status}
                        label={tBookings(`status.${b.status}`)}
                      />
                    </td>
                  </tr>
                ))}
              </Table>
            )}
          </Panel>

          {rooms.length > 0 && (
            <Panel
              title={<Count label={tRooms("title")} n={rooms.length} />}
              flush
            >
              <ul className="divide-y divide-line">
                {rooms.map((room) => (
                  <li
                    key={room.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
                  >
                    <span>
                      <span className="block text-[14px] font-semibold text-ink">
                        {room.name}
                        {room.numbers.length > 0 && (
                          <span className="ml-2 text-[12px] font-normal text-muted">
                            {tRooms("roomsCount", {
                              count: room.numbers.length,
                            })}
                          </span>
                        )}
                      </span>
                      <span className="block text-xs text-muted">
                        {room.rates
                          .map(
                            (r) =>
                              `${formatRWF(r.price, locale)} ${tListings(`perUnit.${r.unit}`)}`,
                          )
                          .join(" · ")}
                      </span>
                    </span>
                    <RoomStatusSelect
                      roomId={room.id}
                      status={room.status}
                      name={room.name}
                    />
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <Fold
            title={
              <Count label={tPlaces("blocksTitle")} n={blocks.active.length} />
            }
          >
            <BlocksPanel
              listingId={listing.id}
              rooms={rooms.map((r) => ({ id: r.id, name: r.name }))}
              active={blocks.active}
              past={blocks.past}
            />
          </Fold>

          <Fold title={tPlaces("settingsTitle")}>
            <AdminPlaceSettings
              listingId={listing.id}
              initial={{
                contractStart: day(listing.contractStart),
                contractEnd: day(listing.contractEnd),
                featured: listing.featured,
                operator: listing.operator,
                keepVisible: listing.keepVisible,
              }}
            />
          </Fold>
        </div>

        {/* Owner and paperwork. */}
        <div className="flex flex-col gap-4">
          <section className={card}>
            <h3 className="mb-2 text-[13px] font-semibold text-muted">
              {t("host")}
            </h3>
            <Link
              href={`/admin/users/${listing.host.id}`}
              className="text-[15px] font-semibold text-primary hover:underline"
            >
              {listing.host.name}
            </Link>
            <p className="text-[13px] break-all text-muted">
              {listing.host.email}
            </p>
            {listing.host.phone && (
              <a
                href={`tel:${listing.host.phone}`}
                className="text-[13px] text-primary hover:underline"
              >
                {listing.host.phone}
              </a>
            )}
          </section>

          <Fold
            title={
              <span className="flex items-center gap-2">
                {tPlaces("payoutTitle")}
                <span
                  className={
                    payout?.verifiedAt
                      ? "text-[12px] font-semibold text-emerald-700"
                      : "text-[12px] font-semibold text-amber-800"
                  }
                >
                  {payout
                    ? payout.verifiedAt
                      ? tPlaces("payoutVerified")
                      : tPlaces("payoutPending")
                    : "—"}
                </span>
              </span>
            }
          >
            {payout ? (
              <div className="flex flex-col gap-3">
                <p className="text-[14px] text-ink">
                  {payout.method === "BANK"
                    ? `${payout.bankName ?? ""} · `
                    : `${tPlaces("payoutMomo")} · `}
                  {payout.accountName} ·{" "}
                  <span className="font-mono">
                    {maskAccount(payout.accountNumber)}
                  </span>
                </p>
                {!payout.verifiedAt && (
                  <VerifyPayoutButton userId={listing.host.id} />
                )}
              </div>
            ) : (
              <p className="text-[13px] text-muted">
                {listing.operator === "VIIPA"
                  ? tPlaces("payoutNotNeeded")
                  : tPlaces("payoutNone")}
              </p>
            )}
          </Fold>

          <Fold
            title={
              <Count label={tPlaces("documentsTitle")} n={documents.length} />
            }
          >
            <DocumentsPanel listingId={listing.id} documents={documents} />
          </Fold>

          {/* VIIPA's commission agreements with this place: stays, and laundry. Every change kept with its date. */}
          <Fold title={tAgree("title")}>
            <div className="flex flex-col gap-4">
              <AgreementEditor subject="PLACE" subjectId={listing.id} current={placeAgreement.current} history={placeAgreement.history} fallback={tAgree("noAgreement")} />
              <div className="border-t border-line pt-3">
                <p className="mb-1.5 text-[13px] font-semibold text-ink">{tAgree("laundryTitle")}</p>
                <AgreementEditor subject="LAUNDRY" subjectId={listing.id} current={laundryAgreement.current} history={laundryAgreement.history} fallback={tAgree("noAgreement")} />
              </div>
            </div>
          </Fold>

          {/* The restaurants that cook for guests here (several are fine; guests see one menu). */}
          <Fold title={<Count label={tFood("title")} n={kitchens.filter((k) => k.assigned).length} />}>
            <PlaceKitchens listingId={listing.id} assigned={kitchens.filter((k) => k.assigned)} all={kitchens} />
          </Fold>

          {/* Managers and receptionists of this place (the owner is told when staff add someone). */}
          <Fold title={<Count label={tPlaces("teamTitle")} n={team.length} />}>
            <TeamPanel listingId={listing.id} members={team} staff />
          </Fold>

          <Fold title={<Count label={t("history")} n={history.length} />}>
            <ol className="flex flex-col gap-2 text-[13px]">
              {history.map((entry) => (
                <li key={entry.id} className="flex flex-col">
                  <span className="text-ink">
                    <b className="font-semibold">
                      {dynamicMessage(
                        t,
                        `action.${entry.action}`,
                        entry.action,
                      )}
                    </b>{" "}
                    · {entry.actor?.name ?? t("system")}
                    {(entry.data as { reason?: string } | null)?.reason && (
                      <span className="text-muted">
                        {" "}
                        · {(entry.data as { reason: string }).reason}
                      </span>
                    )}
                  </span>
                  <span className="text-[12px] text-muted">
                    {formatKigaliDateTime(locale, entry.createdAt)}
                  </span>
                </li>
              ))}
            </ol>
          </Fold>
        </div>
      </div>
    </div>
  );
}

/** A title with how many things are in it. */
function Count({ label, n }: { label: string; n: number }) {
  return (
    <span className="flex items-center gap-2">
      {label}
      <span className="rounded-full bg-canvas px-2 py-0.5 text-[12px] font-bold text-muted tabular-nums">
        {n}
      </span>
    </span>
  );
}

/** A section that stays closed until needed. */
function Fold({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <details className="group rounded-3xl bg-surface ring-1 ring-line">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-[15px] font-semibold text-ink [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDown
          className="size-4 shrink-0 text-muted transition-transform group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <div className="border-t border-line px-5 py-4">{children}</div>
    </details>
  );
}
