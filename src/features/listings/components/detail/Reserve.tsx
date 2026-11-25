"use client";

import { ArrowLeft, Building2, ChevronRight, House, LoaderCircle, ReceiptText, Smartphone, Tag } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useId, useRef, useState, useTransition, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { bookRentalAction, checkPromoAction } from "@/features/bookings/actions";
import { LONG_UNITS, periodFor, type BookingUnit } from "@/features/bookings/period";
import { maskPhone, parseMobileMoney, type MoMoProvider } from "@/features/listings/mobile-money";
import { useRouter } from "@/i18n/navigation";
import { useModal } from "@/lib/use-modal";
import { roomLabel } from "@/features/rooms/links";
import { cn } from "@/lib/cn";
import { formatRWF } from "@/lib/format";
import type { PlacePreviewData } from "./PlacePreview";
import type { Seller } from "./Booking";

const PROVIDERS: { id: MoMoProvider; badge: ReactNode }[] = [
  {
    id: "mtn",
    badge: <span className="flex h-7 w-11 items-center justify-center rounded-md bg-[#ffcb05] text-[10px] font-black tracking-tight text-black">MTN</span>,
  },
  {
    id: "airtel",
    badge: <span className="flex h-7 w-11 items-center justify-center rounded-md bg-[#e40000] text-[10px] font-bold text-white">airtel</span>,
  },
];

/** What the client chose: how (unit), from when, for how long, and the price worked out from the host's rates. */
export type ReservePlan = {
  unit: BookingUnit;
  start: string;
  /** Hours only: "HH:MM". */
  startTime: string | null;
  quantity: number;
  /** Units paid now (monthly rentals may pay fewer months upfront). */
  paidQuantity: number;
  unitPrice: number;
  subtotal: number;
  /** Before the host's discount, for "You save". */
  originalSubtotal: number | null;
  deposit: number;
  /** Long stays: identity details staff ask for. */
  identity: "NONE" | "ID" | "ID_NATIONALITY";
  checkInTime: string | null;
  checkOutTime: string | null;
};

/**
 * Reserving, in two screens. 1. The reservation: the place (or room), dates, guests, house rules, cancellation terms
 * and the price; "Continue to payment". 2. Payment: MTN MoMo or Airtel Money and the number, a promo code, and an
 * optional company (its TIN and purchase code, for the EBM invoice; without it the EBM goes to the phone number);
 * VIIPA's TIN as the seller; then Pay. The server rechecks everything and holds the dates while the guest pays.
 */
export function ReserveDialog({
  listingId,
  holdMinutes,
  room = null,
  guestFeeBps = null,
  cancellationPolicy = null,
  seller = null,
  place,
  plan,
  guests,
  savings,
  onClose,
  onChangeDates,
}: {
  listingId: string;
  holdMinutes: number;
  /** The room being booked; null = the whole place. */
  room?: { id: string; name: string; number?: string | null } | null;
  /** Platform fee on top of the (discounted) price, in basis points. */
  guestFeeBps?: number | null;
  /** Published cancellation terms; when null, the unpaid-hold rule is shown. */
  cancellationPolicy?: string | null;
  /** VIIPA as the seller on the EBM invoice (its name and TIN). */
  seller?: Seller;
  place: PlacePreviewData;
  plan: ReservePlan;
  guests: number;
  savings: number | null;
  onClose: () => void;
  onChangeDates: () => void;
}) {
  const t = useTranslations("Listings");
  const tPay = useTranslations("Listings.pay");
  const tRooms = useTranslations("Rooms");
  const locale = useLocale();
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const numberId = useId();
  useModal(ref, onClose);

  const [screen, setScreen] = useState<"details" | "pay">("details");
  const [provider, setProvider] = useState<MoMoProvider>("mtn");
  const [number, setNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [bookError, setBookError] = useState<string | null>(null);
  const [idNumber, setIdNumber] = useState("");
  const [nationality, setNationality] = useState("");
  // Booking for a company (optional): TIN, then the purchase code is required.
  const [forCompany, setForCompany] = useState(false);
  const [tin, setTin] = useState("");
  const [purchaseCode, setPurchaseCode] = useState("");
  const { checkInTime, checkOutTime } = plan;
  const long = LONG_UNITS.includes(plan.unit);
  const needsId = plan.identity === "ID" || plan.identity === "ID_NATIONALITY";
  const needsNationality = plan.identity === "ID_NATIONALITY";
  const identityMissing = (needsId && idNumber.trim().length < 4) || (needsNationality && nationality.trim().length < 2);
  const tinValid = /^\d{9}$/.test(tin.trim());
  const companyMissing = forCompany && (!tinValid || purchaseCode.trim().length < 3);
  const [promoInput, setPromoInput] = useState("");
  const [promo, setPromo] = useState<{ code: string; discount: number } | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [checkingPromo, startCheckingPromo] = useTransition();

  // What is paid now: the price, less any promo, plus the service fee, plus a long-stay deposit.
  const discount = promo?.discount ?? 0;
  const guestFee = guestFeeBps ? Math.round(((plan.subtotal - discount) * guestFeeBps) / 10_000) : 0;
  const deposit = plan.deposit;
  const dueNow = plan.subtotal - discount + guestFee + deposit;

  function applyPromo() {
    setPromoError(null);
    startCheckingPromo(async () => {
      const result = await checkPromoAction(promoInput, plan.subtotal);
      if ("discount" in result) setPromo({ code: promoInput.trim().toUpperCase(), discount: result.discount });
      else {
        setPromo(null);
        setPromoError(t(`promoError.${result.error === "auth" ? "unknown" : result.error}` as "promoError.unknown"));
      }
    });
  }
  const [booking, startBooking] = useTransition();
  const router = useRouter();

  const providerName = (id: MoMoProvider) => (id === "mtn" ? t("mtnMomo") : t("airtelMoney"));
  const dateFmt = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  const period = periodFor(plan.unit, plan.start, plan.quantity, plan.startTime);
  const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);
  const timeFmt = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Kigali" });
  const dates =
    plan.unit === "HOUR"
      ? `${dateFmt.format(utc(plan.start))} · ${timeFmt.formatRange(period.startAt, period.endAt)}`
      : plan.unit === "DAY" && plan.quantity === 1
        ? dateFmt.format(utc(plan.start))
        : dateFmt.formatRange(utc(period.checkIn), utc(plan.unit === "DAY" ? new Date(utc(period.checkOut).getTime() - 86_400_000).toISOString().slice(0, 10) : period.checkOut));

  function pay() {
    const result = parseMobileMoney(provider, number);
    if (!result.ok) {
      setError(result.error === "invalid" ? t("momoInvalid") : provider === "mtn" ? t("momoNetworkMtn") : t("momoNetworkAirtel"));
      return;
    }
    setError(null);
    setBookError(null);
    startBooking(async () => {
      const res = await bookRentalAction({
        listingId,
        unit: plan.unit,
        start: plan.start,
        startTime: plan.startTime,
        quantity: plan.quantity,
        guests: long ? 1 : guests,
        roomId: room?.id ?? null,
        roomNumber: room?.number ?? null,
        promoCode: promo?.code ?? null,
        payment: { method: provider, phone: number },
        identity: needsId ? { idNumber, nationality: needsNationality ? nationality : null } : null,
        company: forCompany ? { tin: tin.trim(), purchaseCode: purchaseCode.trim() } : null,
      });
      if ("reference" in res) {
        router.push(`/bookings/${res.reference}`);
        return;
      }
      setBookError(t(`bookError.${res.error}`));
    });
  }

  const card = "rounded-2xl border border-line/80 bg-surface p-5 md:p-6";
  const changeButton =
    "rounded-lg bg-canvas px-3.5 py-1.5 text-[13px] font-semibold text-ink transition-colors hover:bg-line/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
  const field = "flex flex-col gap-0.5 rounded-xl border border-line-strong bg-surface px-4 py-2.5 focus-within:border-ink max-md:focus-within:border-primary";
  const input = "w-full bg-transparent text-[15px] text-ink outline-none";

  // The price, shown on both screens (with the promo once applied).
  const price = (
    <div className={cn(card, "flex flex-col tabular-nums")}>
      <p className="mb-2 text-[15px] font-semibold text-ink">{t("priceDetails")}</p>
      <div className="flex justify-between text-[15px] text-ink/80">
        <span>{t(`unitTimes.${plan.unit}`, { price: formatRWF(plan.unitPrice, locale), count: plan.paidQuantity })}</span>
        <span>{formatRWF(plan.subtotal, locale)}</span>
      </div>
      {promo && (
        <div className="mt-1 flex justify-between text-[15px] text-emerald-700">
          <span>{t("promoLine", { code: promo.code })}</span>
          <span>−{formatRWF(promo.discount, locale)}</span>
        </div>
      )}
      {deposit > 0 && (
        <div className="mt-1 flex justify-between text-[15px] text-ink/80">
          <span>{t("depositDue")}</span>
          <span>{formatRWF(deposit, locale)}</span>
        </div>
      )}
      <div className="mt-4 flex justify-between border-t border-line pt-4 text-[17px] font-bold text-ink">
        <span>{t("total")}</span>
        <span className="text-primary">{formatRWF(dueNow, locale)}</span>
      </div>
      {guestFee > 0 && <p className="mt-1 text-right text-xs text-muted">{t("feesIncluded")}</p>}
    </div>
  );

  return createPortal(
    <div data-lenis-prevent className="fixed inset-0 z-[60] overflow-y-auto">
      <div aria-hidden="true" onClick={onClose} className="fixed inset-0 bg-[#00142e]/40 backdrop-blur-[8px] motion-safe:animate-[fade-in_300ms_ease-out]" />
      <div className="relative flex min-h-full items-start justify-center p-0 md:p-8">
        <div
          ref={ref}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="relative w-full max-w-5xl bg-canvas px-4 py-5 shadow-[0_30px_80px_-20px_rgba(0,20,60,0.55)] motion-safe:animate-pop-in md:rounded-[2rem] md:px-10 md:py-10"
        >
          {/* Title and where we are: 1. Reservation, 2. Payment. */}
          <div className="mb-6 flex items-center gap-3 md:mb-8">
            <button
              type="button"
              onClick={() => (screen === "pay" ? setScreen("details") : onClose())}
              aria-label={screen === "pay" ? tPay("backToDetails") : t("goBack")}
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface text-ink shadow-sm transition-[background-color,transform] duration-300 hover:bg-line/60 active:scale-90"
            >
              <ArrowLeft className="size-5" aria-hidden="true" />
            </button>
            <div className="min-w-0">
              <h2 id={titleId} className="text-[22px] font-bold tracking-[-0.02em] text-ink md:text-[30px]">
                {screen === "details" ? tPay("detailsTitle") : tPay("payTitle")}
              </h2>
              <p className="text-[13px] font-semibold text-muted">{tPay("stepOf", { step: screen === "details" ? 1 : 2 })}</p>
            </div>
          </div>

          {screen === "details" ? (
            // 1. What is reserved.
            <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(300px,380px)] md:gap-10">
              <div className="flex flex-col gap-4">
                <div className={cn(card, "flex items-center gap-4")}>
                  <span className="relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary-soft text-primary md:size-24">
                    {place.photo ? <Image src={place.photo} alt="" fill sizes="96px" className="object-cover" /> : <House className="size-7" aria-hidden="true" />}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[17px] leading-6 font-bold text-ink">{place.title}</p>
                    <p className="mt-1 text-[13px] text-ink/80">{place.subtitle}</p>
                    {room && (
                      <p className="mt-1 text-[14px] font-semibold text-ink">
                        {room.name}
                        {room.number && ` · ${roomLabel(room.number, (n) => tRooms("roomNumber", { number: n }))}`}
                      </p>
                    )}
                  </div>
                </div>
                <div className={cn(card, "flex flex-col divide-y divide-line p-0 md:p-0")}>
                  <div className="flex items-start justify-between gap-4 p-5">
                    <div>
                      <p className="text-[15px] font-semibold text-ink">{t("dates")}</p>
                      <p className="mt-1 text-[15px] text-ink/80">{dates}</p>
                      {checkInTime && <p className="text-[14px] text-ink/70">{t("checkIn", { time: checkInTime })}</p>}
                      {checkOutTime && <p className="text-[14px] text-ink/70">{t("checkOut", { time: checkOutTime })}</p>}
                    </div>
                    <button type="button" onClick={onChangeDates} className={changeButton}>
                      {t("change")}
                    </button>
                  </div>
                  <div className="flex items-start justify-between gap-4 p-5">
                    <div>
                      <p className="text-[15px] font-semibold text-ink">{t("guestsLabel")}</p>
                      <p className="mt-1 text-[15px] text-ink/80">{t("statGuests", { count: guests })}</p>
                    </div>
                    <button type="button" onClick={onClose} className={changeButton}>
                      {t("change")}
                    </button>
                  </div>
                  <div className="p-5">
                    <p className="text-[15px] font-semibold text-ink">{t("cancellation")}</p>
                    <p className="mt-1 text-[14px] whitespace-pre-line text-ink/80">{cancellationPolicy ?? t("cancelWhileUnpaid")}</p>
                  </div>
                </div>
                {needsId && (
                  <div className={cn(card, "flex flex-col gap-3")}>
                    <p className="text-[15px] font-semibold text-ink">{t("yourDetails")}</p>
                    <label className={field}>
                      <span className="text-xs font-semibold text-muted">{t("idNumber")}</span>
                      <input value={idNumber} onChange={(e) => setIdNumber(e.target.value)} maxLength={40} autoComplete="off" className={input} />
                    </label>
                    {needsNationality && (
                      <label className={field}>
                        <span className="text-xs font-semibold text-muted">{t("nationality")}</span>
                        <input value={nationality} onChange={(e) => setNationality(e.target.value)} maxLength={60} autoComplete="country-name" className={input} />
                      </label>
                    )}
                    <p className="text-[13px] text-muted">{t("identityPrivacy")}</p>
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-4 md:sticky md:top-8 md:self-start">
                {savings !== null && (
                  <p className="flex items-center justify-center gap-2.5 rounded-2xl bg-emerald-50 px-5 py-3 text-sm font-semibold text-emerald-900 ring-1 ring-emerald-200/70">
                    <Tag className="size-5 fill-emerald-500 text-emerald-600" aria-hidden="true" />
                    {t("youSave", { amount: formatRWF(savings, locale) })}
                  </p>
                )}
                {price}
                <button
                  type="button"
                  disabled={identityMissing}
                  onClick={() => setScreen("pay")}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-[16px] font-semibold text-white shadow-[0_10px_24px_-10px_rgba(0,87,184,0.8)] transition-[filter,transform] duration-300 hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
                >
                  {tPay("continue")}
                  <ChevronRight className="size-5" aria-hidden="true" />
                </button>
              </div>
            </div>
          ) : (
            // 2. Payment.
            <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(300px,380px)] md:gap-10">
              <div className="flex flex-col gap-4 motion-safe:animate-pop-in">
                {/* How to pay, and the number. */}
                <div className={cn(card, "flex flex-col gap-4")}>
                  <p className="text-[15px] font-semibold text-ink">{tPay("method")}</p>
                  <div role="radiogroup" aria-label={tPay("method")} className="grid grid-cols-2 gap-2">
                    {PROVIDERS.map(({ id, badge }) => (
                      <label key={id} className={cn("flex cursor-pointer items-center gap-3 rounded-xl px-3 py-3 ring-1 transition-colors", provider === id ? "bg-primary/[0.06] ring-2 ring-primary" : "bg-surface ring-line")}>
                        <input
                          type="radio"
                          name="provider"
                          value={id}
                          checked={provider === id}
                          onChange={() => {
                            setProvider(id);
                            setError(null);
                          }}
                          className="sr-only"
                        />
                        {badge}
                        <span className="text-[14px] font-semibold text-ink">{providerName(id)}</span>
                      </label>
                    ))}
                  </div>
                  <div>
                    <label htmlFor={numberId} className={cn(field, error && "border-danger")}>
                      <span className="text-xs font-semibold text-muted">{t("momoNumber")}</span>
                      <span className="flex items-center gap-2">
                        <Smartphone className="size-4 text-muted" aria-hidden="true" />
                        <input id={numberId} type="tel" inputMode="tel" autoComplete="tel-national" placeholder="078 123 4567" value={number} onChange={(e) => setNumber(e.target.value)} aria-invalid={Boolean(error)} className={input} />
                      </span>
                    </label>
                    <p className="mt-1.5 text-[13px] text-muted">{t("momoHint")}</p>
                    {error && (
                      <p role="alert" className="mt-1 text-[13px] font-medium text-danger">
                        {error}
                      </p>
                    )}
                  </div>
                </div>

                {/* Promo code. */}
                <div className={cn(card, "flex flex-col gap-2")}>
                  <div className="flex gap-2">
                    <label className={cn(field, "flex-1")}>
                      <span className="text-xs font-semibold text-muted">{t("promoCode")}</span>
                      <input value={promoInput} onChange={(e) => setPromoInput(e.target.value)} maxLength={40} autoCapitalize="characters" placeholder="PROMO-…" className={cn(input, "uppercase")} />
                    </label>
                    <button type="button" onClick={applyPromo} disabled={!promoInput.trim() || checkingPromo} className={changeButton + " self-center disabled:opacity-50"}>
                      {t("applyPromo")}
                    </button>
                  </div>
                  {promo && <p className="text-[13px] font-medium text-emerald-700">{tPay("promoApplied", { code: promo.code, amount: formatRWF(promo.discount, locale) })}</p>}
                  {promoError && (
                    <p role="alert" className="text-[13px] font-medium text-danger">
                      {promoError}
                    </p>
                  )}
                </div>

                {/* A company (optional): its TIN and purchase code for the EBM invoice; otherwise EBM by phone. */}
                <div className={cn(card, "flex flex-col gap-3", forCompany && "ring-1 ring-ink")}>
                  <label className="flex cursor-pointer items-start gap-3">
                    <input type="checkbox" checked={forCompany} onChange={(e) => setForCompany(e.target.checked)} className="mt-0.5 size-5 accent-[var(--color-primary)]" />
                    <span>
                      <span className="flex items-center gap-1.5 text-[15px] font-semibold text-ink">
                        <Building2 className="size-4 text-muted" aria-hidden="true" />
                        {tPay("company")}
                      </span>
                      <span className="block text-[13px] text-muted">{forCompany ? tPay("companyHint") : tPay("ebmPhone")}</span>
                    </span>
                  </label>
                  {forCompany && (
                    <>
                      <label className={cn(field, tin && !tinValid && "border-danger")}>
                        <span className="text-xs font-semibold text-muted">{tPay("tin")}</span>
                        <input value={tin} onChange={(e) => setTin(e.target.value.replace(/\D/g, "").slice(0, 9))} inputMode="numeric" placeholder="111122233" className={cn(input, "tabular-nums")} />
                      </label>
                      {tin && !tinValid && <p className="-mt-2 text-[12px] font-medium text-danger">{tPay("tinInvalid")}</p>}
                      <label className={cn(field, tinValid && purchaseCode.trim().length < 3 && "border-danger")}>
                        <span className={cn("text-xs font-semibold", tinValid ? "text-danger" : "text-muted")}>{tPay("purchaseCode")}</span>
                        <input value={purchaseCode} onChange={(e) => setPurchaseCode(e.target.value)} maxLength={40} placeholder="PC-ORDER-98234" className={input} />
                      </label>
                    </>
                  )}
                </div>

                {/* The seller on the EBM invoice: VIIPA's TIN. */}
                {seller?.tin && (
                  <div className="flex items-center justify-between gap-3 rounded-2xl bg-primary/[0.05] px-5 py-4 ring-1 ring-primary/30">
                    <span className="flex items-center gap-2 text-[13px] font-bold tracking-[0.04em] text-primary uppercase">
                      <ReceiptText className="size-4" aria-hidden="true" />
                      {tPay("sellerTin", { name: seller.name ?? "VIIPA" })}
                    </span>
                    <span className="font-mono text-[20px] font-bold tracking-wider text-primary">{seller.tin}</span>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-4 md:sticky md:top-8 md:self-start">
                {price}
                <p className="text-[12px] leading-5 text-muted">{t("agree")}</p>
                <button
                  type="button"
                  onClick={pay}
                  disabled={booking || identityMissing || companyMissing || number.trim().length < 9}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-[16px] font-semibold text-white shadow-[0_10px_24px_-10px_rgba(0,87,184,0.8)] transition-[filter,transform] duration-300 hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
                >
                  {booking && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
                  {tPay("payButton", { amount: formatRWF(dueNow, locale) })}
                </button>
                {bookError && (
                  <p role="alert" className="text-center text-[13px] font-medium text-danger">
                    {bookError}
                  </p>
                )}
                <p className="text-center text-[12px] text-muted">
                  {providerName(provider)}
                  {number.trim() && ` · ${maskPhone(number.replace(/\s/g, ""))}`} · {t("holdNote", { minutes: holdMinutes })}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
