"use client";

import { ArrowLeft, House, LoaderCircle, Smartphone, Tag } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useId, useRef, useState, useTransition, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { bookRentalAction, checkPromoAction } from "@/features/bookings/actions";
import { LONG_UNITS, periodFor, type BookingUnit } from "@/features/bookings/period";
import { maskPhone, parseMobileMoney, type MoMoProvider } from "@/features/listings/mobile-money";
import { useRouter } from "@/i18n/navigation";
import { useModal } from "@/lib/use-modal";
import { cn } from "@/lib/cn";
import { formatRWF } from "@/lib/format";
import type { PlacePreviewData } from "./PlacePreview";

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
 * "Confirm and pay" window: 1. choose MTN Mobile Money or Airtel Money and the number, 2. review and book.
 * Booking holds the dates for a while (the server rechecks them); payment isn't connected yet, so nothing is charged.
 */
export function ReserveDialog({
  listingId,
  holdMinutes,
  room = null,
  guestFeeBps = null,
  cancellationPolicy = null,
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
  room?: { id: string; name: string } | null;
  /** Platform fee on top of the (discounted) price, in basis points. */
  guestFeeBps?: number | null;
  /** Published cancellation terms; when null, the unpaid-hold rule is shown. */
  cancellationPolicy?: string | null;
  place: PlacePreviewData;
  plan: ReservePlan;
  guests: number;
  savings: number | null;
  onClose: () => void;
  onChangeDates: () => void;
}) {
  const t = useTranslations("Listings");
  const locale = useLocale();
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const numberId = useId();
  const hintId = useId();
  useModal(ref, onClose);

  const [step, setStep] = useState<1 | 2>(1);
  const [provider, setProvider] = useState<MoMoProvider>("mtn");
  const [number, setNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<string | null>(null);
  const [bookError, setBookError] = useState<string | null>(null);
  const [idNumber, setIdNumber] = useState("");
  const [nationality, setNationality] = useState("");
  const { checkInTime, checkOutTime } = plan;
  const long = LONG_UNITS.includes(plan.unit);
  const needsId = plan.identity === "ID" || plan.identity === "ID_NATIONALITY";
  const needsNationality = plan.identity === "ID_NATIONALITY";
  const identityMissing = (needsId && idNumber.trim().length < 4) || (needsNationality && nationality.trim().length < 2);
  const [promoInput, setPromoInput] = useState("");
  const [promo, setPromo] = useState<{ code: string; discount: number } | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [checkingPromo, startCheckingPromo] = useTransition();

  // What is paid now: the price (or the upfront months), less any promo, plus the service fee, plus a long-stay deposit.
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
  // Hours: "Nov 1, 2026 · 09:30–12:30"; otherwise the date range (one day for a single day).
  const dates =
    plan.unit === "HOUR"
      ? `${dateFmt.format(utc(plan.start))} · ${timeFmt.formatRange(period.startAt, period.endAt)}`
      : plan.unit === "DAY" && plan.quantity === 1
        ? dateFmt.format(utc(plan.start))
        : dateFmt.formatRange(utc(period.checkIn), utc(plan.unit === "DAY" ? new Date(utc(period.checkOut).getTime() - 86_400_000).toISOString().slice(0, 10) : period.checkOut));

  function next() {
    const result = parseMobileMoney(provider, number);
    if (!result.ok) {
      setError(result.error === "invalid" ? t("momoInvalid") : provider === "mtn" ? t("momoNetworkMtn") : t("momoNetworkAirtel"));
      return;
    }
    setError(null);
    setConfirmed(result.number);
    setStep(2);
  }

  function book() {
    setBookError(null);
    startBooking(async () => {
      const result = await bookRentalAction({
        listingId,
        unit: plan.unit,
        start: plan.start,
        startTime: plan.startTime,
        quantity: plan.quantity,
        guests: long ? 1 : guests,
        roomId: room?.id ?? null,
        promoCode: promo?.code ?? null,
        payment: { method: provider, phone: number },
        identity: needsId ? { idNumber, nationality: needsNationality ? nationality : null } : null,
      });
      if ("reference" in result) {
        router.push(`/bookings/${result.reference}`);
        return;
      }
      setBookError(t(`bookError.${result.error}`));
    });
  }

  const card = "rounded-2xl border border-line/80 bg-surface p-6";
  const changeButton =
    "rounded-lg bg-canvas px-3.5 py-1.5 text-[13px] font-semibold text-ink transition-colors hover:bg-line/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

  // Portalled to <body>: the sticky booking card would otherwise trap this layer under later page sections.
  return createPortal(
    <div className="fixed inset-0 z-[60] overflow-y-auto">
      <div aria-hidden="true" onClick={onClose} className="fixed inset-0 bg-[#00142e]/40 backdrop-blur-[8px] motion-safe:animate-[fade-in_300ms_ease-out]" />
      <div className="relative flex min-h-full items-start justify-center p-0 md:p-8">
        <div
          ref={ref}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="relative w-full max-w-5xl bg-canvas px-5 py-6 shadow-[0_30px_80px_-20px_rgba(0,20,60,0.55)] motion-safe:animate-pop-in md:rounded-[2rem] md:px-10 md:py-10"
        >
          <div className="mb-8 flex items-center gap-4">
            <button
              type="button"
              onClick={onClose}
              aria-label={t("goBack")}
              className="flex size-11 items-center justify-center rounded-full bg-surface text-ink shadow-sm transition-[background-color,transform] duration-300 hover:bg-line/60 active:scale-90"
            >
              <ArrowLeft className="size-5" aria-hidden="true" />
            </button>
            <h2 id={titleId} className="text-2xl font-bold tracking-[-0.02em] text-ink md:text-[32px]">
              {t("confirmAndPay")}
            </h2>
          </div>

          <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(300px,400px)] md:gap-12">
            {/* Steps */}
            <div className="flex flex-col gap-5">
              <section className={cn(card, step === 1 && "shadow-[0_12px_32px_-14px_rgba(16,24,40,0.3)]")}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-ink">{t("stepPay")}</h3>
                    {step === 2 && confirmed && (
                      <p className="mt-1 text-[15px] text-ink/80">
                        {providerName(provider)} · {maskPhone(confirmed)}
                      </p>
                    )}
                  </div>
                  {step === 2 && (
                    <button type="button" onClick={() => setStep(1)} className={changeButton}>
                      {t("change")}
                    </button>
                  )}
                </div>

                {step === 1 && (
                  <div className="mt-5 flex flex-col gap-5">
                    <div role="radiogroup" aria-label={t("stepPay")} className="flex flex-col divide-y divide-line/80">
                      {PROVIDERS.map(({ id, badge }) => (
                        <label key={id} className="flex cursor-pointer items-center gap-4 py-4">
                          {badge}
                          <span className="flex-1 text-[15px] font-semibold text-ink">{providerName(id)}</span>
                          <input
                            type="radio"
                            name="provider"
                            value={id}
                            checked={provider === id}
                            onChange={() => {
                              setProvider(id);
                              setError(null);
                            }}
                            className="size-5 cursor-pointer accent-[var(--color-ink)]"
                          />
                        </label>
                      ))}
                    </div>

                    <div>
                      <div
                        className={cn(
                          "flex flex-col gap-0.5 rounded-xl border px-4 py-3 transition-colors focus-within:border-ink max-md:focus-within:border-primary",
                          error ? "border-danger" : "border-line-strong",
                        )}
                      >
                        <label htmlFor={numberId} className="text-xs font-semibold text-muted">
                          {t("momoNumber")}
                        </label>
                        <span className="flex items-center gap-2">
                          <Smartphone className="size-4 text-muted" aria-hidden="true" />
                          <input
                            id={numberId}
                            type="tel"
                            inputMode="tel"
                            autoComplete="tel-national"
                            placeholder="078 123 4567"
                            value={number}
                            onChange={(event) => setNumber(event.target.value)}
                            aria-invalid={Boolean(error)}
                            aria-describedby={hintId}
                            className="w-full bg-transparent text-[15px] text-ink outline-none"
                          />
                        </span>
                      </div>
                      <p id={hintId} className="mt-2 text-[13px] text-muted">
                        {t("momoHint")}
                      </p>
                      {error && (
                        <p role="alert" className="mt-1 text-[13px] font-medium text-danger">
                          {error}
                        </p>
                      )}
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={next}
                        className="rounded-xl bg-ink px-8 py-3 text-[15px] font-semibold text-white transition-[background-color,transform] duration-300 hover:bg-black active:scale-[0.98]"
                      >
                        {t("nextStep")}
                      </button>
                    </div>
                  </div>
                )}
              </section>

              <section className={cn(card, step === 2 && "shadow-[0_12px_32px_-14px_rgba(16,24,40,0.3)]")}>
                <h3 className={cn("text-lg font-bold", step === 2 ? "text-ink" : "text-ink/60")}>{t("stepReview")}</h3>
                {step === 2 && (
                  <div className="mt-5 flex flex-col gap-5 motion-safe:animate-pop-in">
                    <div>
                      <p className="mb-1.5 text-[15px] font-semibold text-ink">{t("houseRules")}</p>
                      <ul className="flex flex-col gap-1 text-[15px] text-ink/80">
                        {checkInTime && <li>{t("checkIn", { time: checkInTime })}</li>}
                        {checkOutTime && <li>{t("checkOut", { time: checkOutTime })}</li>}
                      </ul>
                    </div>
                    <div>
                      <p className="mb-1.5 text-[15px] font-semibold text-ink">{t("cancellation")}</p>
                      <p className="text-[15px] whitespace-pre-line text-ink/80">{cancellationPolicy ?? t("cancelWhileUnpaid")}</p>
                    </div>
                    {needsId && (
                      <div className="flex flex-col gap-3 border-t border-line pt-5">
                        <p className="text-[15px] font-semibold text-ink">{t("yourDetails")}</p>
                        <label className="flex flex-col gap-0.5 rounded-xl border border-line-strong px-4 py-2.5 focus-within:border-ink max-md:focus-within:border-primary">
                          <span className="text-xs font-semibold text-muted">{t("idNumber")}</span>
                          <input value={idNumber} onChange={(e) => setIdNumber(e.target.value)} maxLength={40} autoComplete="off" className="w-full bg-transparent text-[15px] text-ink outline-none" />
                        </label>
                        {needsNationality && (
                          <label className="flex flex-col gap-0.5 rounded-xl border border-line-strong px-4 py-2.5 focus-within:border-ink max-md:focus-within:border-primary">
                            <span className="text-xs font-semibold text-muted">{t("nationality")}</span>
                            <input value={nationality} onChange={(e) => setNationality(e.target.value)} maxLength={60} autoComplete="country-name" className="w-full bg-transparent text-[15px] text-ink outline-none" />
                          </label>
                        )}
                        <p className="text-[13px] text-muted">{t("identityPrivacy")}</p>
                      </div>
                    )}
                    <p className="border-t border-line pt-5 text-[13px] leading-5 text-muted">{t("agree")}</p>
                    <button
                      type="button"
                      onClick={book}
                      disabled={booking || identityMissing}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-[#0a6fe0] py-3.5 text-[15px] font-semibold text-white shadow-[0_10px_24px_-10px_rgba(0,87,184,0.8)] transition-[filter,transform] duration-300 hover:brightness-110 active:scale-[0.98] disabled:cursor-wait disabled:opacity-70"
                    >
                      {booking && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
                      {t("holdDates")}
                    </button>
                    {bookError && (
                      <p role="alert" className="text-center text-[13px] font-medium text-danger">
                        {bookError}
                      </p>
                    )}
                    <p className="text-center text-[13px] text-muted">{t("holdNote", { minutes: holdMinutes })}</p>
                  </div>
                )}
              </section>
            </div>

            {/* Summary */}
            <div className="flex flex-col gap-4 md:sticky md:top-8 md:self-start">
              {savings !== null && (
                <p className="flex items-center justify-center gap-2.5 rounded-2xl bg-emerald-50 px-5 py-3.5 text-sm font-semibold text-emerald-900 ring-1 ring-emerald-200/70">
                  <Tag className="size-5 fill-emerald-500 text-emerald-600" aria-hidden="true" />
                  {t("youSave", { amount: formatRWF(savings, locale) })}
                </p>
              )}
              <div className={cn(card, "flex flex-col")}>
                <div className="flex items-center gap-4 pb-5">
                  <span className="relative flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary-soft text-primary">
                    {place.photo ? <Image src={place.photo} alt="" fill sizes="96px" className="object-cover" /> : <House className="size-7" aria-hidden="true" />}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[17px] leading-6 font-bold text-ink">{place.title}</p>
                    <p className="mt-1 text-[13px] text-ink/80">{place.subtitle}</p>
                    {room && <p className="mt-1 text-[13px] font-semibold text-ink">{room.name}</p>}
                  </div>
                </div>

                <div className="flex items-start justify-between gap-4 border-t border-line py-5">
                  <div>
                    <p className="text-[15px] font-semibold text-ink">{t("dates")}</p>
                    <p className="mt-1 text-[15px] text-ink/80">{dates}</p>
                    {checkInTime && <p className="text-[15px] text-ink/80">{t("checkIn", { time: checkInTime })}</p>}
                  </div>
                  <button type="button" onClick={onChangeDates} className={changeButton}>
                    {t("change")}
                  </button>
                </div>

                <div className="flex items-start justify-between gap-4 border-t border-line py-5">
                  <div>
                    <p className="text-[15px] font-semibold text-ink">{t("guestsLabel")}</p>
                    <p className="mt-1 text-[15px] text-ink/80">{t("statGuests", { count: guests })}</p>
                  </div>
                  <button type="button" onClick={onClose} className={changeButton}>
                    {t("change")}
                  </button>
                </div>

                <div className="border-t border-line py-5 tabular-nums">
                  <p className="mb-2 text-[15px] font-semibold text-ink">{t("priceDetails")}</p>
                  <div className="flex justify-between text-[15px] text-ink/80">
                    <span>
                      {t(`unitTimes.${plan.unit}`, { price: formatRWF(plan.unitPrice, locale), count: plan.paidQuantity })}
                    </span>
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
                  {guestFee > 0 && (
                    <div className="mt-1 flex justify-between text-[15px] text-ink/80">
                      <span>{t("serviceFee")}</span>
                      <span>{formatRWF(guestFee, locale)}</span>
                    </div>
                  )}
                </div>
                <div className="flex justify-between border-t border-line pt-5 text-[15px] font-bold text-ink tabular-nums">
                  <span>{long ? t("dueNow") : t("total")} (RWF)</span>
                  <span>{formatRWF(dueNow, locale)}</span>
                </div>
                {plan.unit === "MONTH" && plan.paidQuantity < plan.quantity && (
                  <p className="mt-2 text-[13px] text-muted">{t("monthlyNote", { months: plan.quantity, upfront: plan.paidQuantity })}</p>
                )}
                {/* Promo code */}
                <div className="mt-5 border-t border-line pt-5">
                  <div className="flex gap-2">
                    <label className="flex flex-1 flex-col gap-0.5 rounded-xl border border-line-strong px-3 py-2 focus-within:border-ink max-md:focus-within:border-primary">
                      <span className="text-xs font-semibold text-muted">{t("promoCode")}</span>
                      <input
                        value={promoInput}
                        onChange={(e) => setPromoInput(e.target.value)}
                        maxLength={40}
                        autoCapitalize="characters"
                        className="w-full bg-transparent text-[15px] text-ink uppercase outline-none"
                      />
                    </label>
                    <button type="button" onClick={applyPromo} disabled={!promoInput.trim() || checkingPromo} className={changeButton + " self-center disabled:opacity-50"}>
                      {t("applyPromo")}
                    </button>
                  </div>
                  {promoError && (
                    <p role="alert" className="mt-1 text-[13px] font-medium text-danger">
                      {promoError}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
