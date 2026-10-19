import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { CheckInOut } from "@/features/admin/components/StaffButtons";
import { StaffCancel } from "@/features/admin/components/StaffForms";
import { Facts, PageIntro, Panel } from "@/features/admin/components/ui";
import { actorNames, bookingForStaff } from "@/features/admin/queries";
import { StatusBadge } from "@/features/bookings/components/StatusBadge";
import { formatKigaliDateTime, formatStayDates } from "@/features/bookings/format";
import { isBookingReference } from "@/features/bookings/reference";
import { todayISO } from "@/features/search/date-range";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { dynamicMessage } from "@/lib/dynamic-message";
import { formatRWF } from "@/lib/format";
import { requireAdmin } from "@/lib/permissions";
import { DecideRequest, NoShowButton, SettleRefund } from "@/features/stay/components/StaffStayPanels";
import { priceChangeFor } from "@/features/stay/rules";

type Props = { params: Promise<{ reference: string }> };
const iso = (d: Date) => d.toISOString().slice(0, 10);

export default async function AdminBookingPage({ params }: Props) {
  const { reference } = await params;
  await requireAdmin(`/admin/bookings/${reference}`);
  if (!isBookingReference(reference)) notFound();
  const b = await bookingForStaff(reference);
  if (!b) notFound();
  const [t, tBookings, tListings, tMoney, tStay, locale, names] = await Promise.all([
    getTranslations("Admin"),
    getTranslations("Bookings"),
    getTranslations("Listings"),
    getTranslations("Money"),
    getTranslations("MyStay"),
    getLocale(),
    actorNames(b.events.map((e) => e.actorId)),
  ]);
  const rwf = (n: number) => formatRWF(n, locale);
  const time = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Kigali" });

  return (
    <div>
      <PageIntro
        back={{ href: "/admin/bookings", label: t("nav.bookings") }}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[15px] font-semibold text-ink">{b.reference}</span>
            <StatusBadge status={b.status} label={tBookings(`status.${b.status}`)} />
          </span>
        }
        actions={
          <>
            {b.status === "CONFIRMED" && iso(b.checkIn) <= todayISO() && <CheckInOut reference={b.reference} to="CHECKED_IN" />}
            {b.status === "CHECKED_IN" && <CheckInOut reference={b.reference} to="COMPLETED" />}
            {b.status === "CONFIRMED" && iso(b.checkIn) < todayISO() && <NoShowButton reference={b.reference} />}
            <Link href={`/admin/listings/${b.listing.id}`} className="rounded-full border border-line bg-surface px-4 py-2 text-[13px] font-semibold text-ink hover:border-primary">
              {t("viewListing")}
            </Link>
          </>
        }
      />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-5">
          <Panel title={t("stay")}>
            <Facts
              rows={[
                { label: t("col.place"), value: <Link href={`/admin/listings/${b.listing.id}`} className="text-primary hover:underline">{b.listing.title}</Link> },
                ...(b.room ? [{ label: tBookings("room"), value: b.room.name }] : []),
                { label: t("col.when"), value: formatStayDates(locale, iso(b.checkIn), iso(b.checkOut)) },
                ...(b.unit === "HOUR" ? [{ label: tBookings("time"), value: time.formatRange(b.startAt, b.endAt) }] : []),
                { label: t("length"), value: tListings(`unitCount.${b.unit}`, { count: b.quantity }) },
                { label: tListings("guestsLabel"), value: tListings("statGuests", { count: b.guests }) },
                { label: t("bookedAt"), value: formatKigaliDateTime(locale, b.createdAt) },
                ...(b.holdExpiresAt && b.status === "PENDING_PAYMENT" ? [{ label: t("holdUntil"), value: formatKigaliDateTime(locale, b.holdExpiresAt) }] : []),
              ]}
            />
          </Panel>
          <Panel title={t("moneySplit")}>
            <Facts
              rows={[
                { label: tListings(`unitTimes.${b.unit}`, { price: rwf(b.nightlyPrice), count: b.unit === "MONTH" ? (b.upfrontMonths ?? b.quantity) : b.quantity }), value: rwf(b.subtotal) },
                ...(b.discount > 0 ? [{ label: tListings("promoLine", { code: b.promoCode?.code ?? "" }), value: `−${rwf(b.discount)}` }] : []),
                ...(b.guestFee > 0 ? [{ label: tBookings("serviceFee"), value: rwf(b.guestFee) }] : []),
                ...(b.deposit > 0 ? [{ label: tListings("depositDue"), value: rwf(b.deposit) }] : []),
                { label: t("guestPays"), value: <b>{rwf(b.total)}</b> },
                { label: tMoney("kind.COMMISSION"), value: rwf(b.commission) },
                { label: tMoney("kind.HOST_PAYABLE"), value: rwf(b.hostPayout) },
              ]}
            />
          </Panel>
          <Panel title={t("payments")} flush>
            {b.payments.length === 0 ? (
              <p className="px-5 py-6 text-[14px] text-muted">{t("noPayments")}</p>
            ) : (
              <ul className="divide-y divide-line">
                {b.payments.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-[14px]">
                    <span>
                      <span className="font-mono text-[13px]">{p.providerReference}</span>
                      <span className="block text-xs text-muted">
                        {p.provider} · {formatKigaliDateTime(locale, p.createdAt)}
                      </span>
                    </span>
                    <span className="text-right tabular-nums">
                      {rwf(p.amount)}
                      <span className={cn("block text-xs font-semibold", p.status === "SUCCEEDED" ? "text-emerald-700" : "text-red-700")}>{p.status}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title={tBookings("timeline")} flush>
            <ol className="divide-y divide-line">
              {b.events.map((e) => (
                <li key={e.id} className="flex flex-wrap items-start justify-between gap-2 px-5 py-3 text-[14px]">
                  <span>
                    <b className="font-semibold">{dynamicMessage(tBookings, `event.${e.toStatus}`, e.toStatus)}</b>
                    <span className="block text-xs text-muted">
                      {(e.actorId && names.get(e.actorId)) ?? t("system")}
                      {e.reason && ` · ${e.reason}`}
                    </span>
                  </span>
                  <span className="text-xs text-muted">{formatKigaliDateTime(locale, e.createdAt)}</span>
                </li>
              ))}
            </ol>
          </Panel>
        </div>
        <div className="flex flex-col gap-5">
          {b.requests.length > 0 && (
            <Panel title={tStay("requestsTitle")}>
              <ul className="flex flex-col gap-3">
                {b.requests.map((r) => {
                  const newOut = r.newCheckOut ? iso(r.newCheckOut) : null;
                  const change = newOut ? priceChangeFor({ checkIn: iso(b.checkIn), checkOut: iso(b.checkOut), subtotal: b.subtotal }, newOut) : null;
                  return (
                    <li key={r.id} className="rounded-xl border border-line p-3 text-[14px]">
                      <span className="flex items-center justify-between gap-2">
                        <b className="font-semibold">{tStay(`kind.${r.kind}`)}</b>
                        <span className="text-xs font-semibold text-muted">{tStay(`requestStatus.${r.status}`)}</span>
                      </span>
                      {newOut && <span className="block text-[13px] text-ink">{tStay("until", { date: formatStayDates(locale, newOut, newOut) })}</span>}
                      {r.transferTo && <span className="block text-[13px] text-ink">{tStay("transferToShort", { place: r.transferTo })}</span>}
                      <span className="block text-[13px] text-muted">{r.reason}</span>
                      {r.status === "PENDING" && change !== null && r.kind === "EXTEND" && (
                        <span className="block text-[13px] font-semibold text-ink">{tStay("extraCost", { amount: rwf(change) })}</span>
                      )}
                      {r.response && <span className="block text-[13px] text-ink">{tStay("staffReply", { text: r.response })}</span>}
                      {r.status === "PENDING" && (
                        <DecideRequest
                          requestId={r.id}
                          kind={r.kind}
                          total={b.total}
                          suggestedRefund={r.kind === "CANCEL" ? b.total : r.kind === "SHORTEN" && change !== null ? -change : null}
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            </Panel>
          )}
          {b.refundStatus !== "NONE" && (
            <Panel title={tStay("refundTitle")}>
              {b.refundStatus === "PENDING" ? (
                <SettleRefund reference={b.reference} amount={b.refundAmount ?? 0} />
              ) : (
                <p className="text-[14px] text-ink">{tStay(`refund.${b.refundStatus}`, { amount: rwf(b.refundAmount ?? 0) })}</p>
              )}
            </Panel>
          )}
          {b.feedback && (
            <Panel title={tStay("feedbackTitle")}>
              <p className="text-[14px] font-semibold text-ink">{b.feedback.liked ? tStay("like") : tStay("dislike")}</p>
              {b.feedback.comment && <p className="text-[13px] text-muted">{b.feedback.comment}</p>}
            </Panel>
          )}
          {b.guestDocument && (
            <Panel title={tStay("idTitle")}>
              <a href={`/api/v1/bookings/${b.reference}/guest-id`} target="_blank" rel="noopener" className="text-[14px] font-semibold text-primary hover:underline">
                {b.guestDocument.filename}
              </a>
            </Panel>
          )}
          <Panel title={t("guest")}>
            <Facts
              rows={[
                { label: t("col.name"), value: <Link href={`/admin/users/${b.guest.id}`} className="text-primary hover:underline">{b.guest.name}</Link> },
                { label: t("col.email"), value: <span className="break-all">{b.guest.email}</span> },
                { label: t("col.phone"), value: b.guest.phone ?? "—" },
                ...(b.payerPhone ? [{ label: t("payer"), value: `${b.paymentMethod?.toUpperCase() ?? ""} ${b.payerPhone}` }] : []),
              ]}
            />
          </Panel>
          {b.identity && (
            <Panel title={t("identity")}>
              <Facts rows={[{ label: t("idNumber"), value: b.identity.idNumber }, { label: t("nationality"), value: b.identity.nationality ?? "—" }]} />
              <p className="mt-2 text-xs text-muted">{t("identityNote")}</p>
            </Panel>
          )}
          <Panel title={t("host")}>
            <Facts
              rows={[
                { label: t("col.name"), value: <Link href={`/admin/users/${b.listing.host.id}`} className="text-primary hover:underline">{b.listing.host.name}</Link> },
                { label: t("col.email"), value: <span className="break-all">{b.listing.host.email}</span> },
                { label: t("col.phone"), value: b.listing.host.phone ?? "—" },
              ]}
            />
          </Panel>
          {b.status === "PENDING_PAYMENT" && (
            <Panel title={t("releaseHold")}>
              <StaffCancel reference={b.reference} />
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
